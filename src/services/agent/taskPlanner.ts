import type { ExecutionPlan, TaskStep, StepRiskLevel } from './agentTypes';
import { globalToolRegistry, ToolRegistry } from '../tools/toolRegistry';
import { detectDirectIntent } from '../tools/intentDetector';

const HIGH_RISK_TOOLS = new Set(['lock_workstation']);
const MEDIUM_RISK_TOOLS = new Set(['close_app', 'write_file']);

export class TaskPlanner {
  private registry: ToolRegistry;

  constructor(registry: ToolRegistry = globalToolRegistry) {
    this.registry = registry;
  }

  /**
   * Deterministically splits a compound user prompt into individual directives.
   * e.g. "Check system diagnostics, capture screen, and mute volume"
   */
  public decomposePromptDirectives(prompt: string): string[] {
    if (!prompt) return [];
    const clean = prompt.trim();

    // 1. Check numbered list format: "1. do this 2. do that"
    if (/\b1\.\s+.*\b2\.\s+/i.test(clean)) {
      return clean
        .split(/\b\d+\.\s+/)
        .map((s) => s.trim().replace(/^[;,.]\s*/, ''))
        .filter((s) => s.length > 0);
    }

    // 2. Check sequential split keywords: "then", "and then", "after that", "next"
    const splitRegex =
      /\s*(?:;\s*|\band then\b|\bafter that\b|\bthen\b|\bnext\b|\bfinally\b|,\s*and\s+)\s*/i;

    const parts = clean
      .split(splitRegex)
      .map((p) => p.trim().replace(/^[,\-.]\s*/, ''))
      .filter((p) => p.length > 2);

    if (parts.length > 1) {
      return parts;
    }

    // 3. Fallback: comma separation if each part resembles a command
    const commaParts = clean
      .split(/,\s*/)
      .map((p) => p.trim())
      .filter((p) => p.length > 2);

    if (commaParts.length >= 2) {
      let validCount = 0;
      for (const part of commaParts) {
        if (detectDirectIntent(part)) validCount++;
      }
      if (validCount >= 2) {
        return commaParts;
      }
    }

    return [clean];
  }

  /**
   * Fast-path attempt to create a multi-step plan directly from user prompt.
   */
  public createPlanFromPrompt(prompt: string): ExecutionPlan | null {
    const segments = this.decomposePromptDirectives(prompt);
    if (segments.length < 2) {
      return null;
    }

    const steps: TaskStep[] = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const detected = detectDirectIntent(seg);
      if (!detected) {
        // If one of the directives cannot be mapped directly, return null to let LLM plan
        return null;
      }

      const risk = this.classifyRisk(detected.toolId);
      steps.push({
        id: `step-${i + 1}-${Math.random().toString(36).substring(2, 6)}`,
        index: i + 1,
        toolId: detected.toolId,
        args: detected.args,
        description: this.generateStepDescription(
          detected.toolId,
          detected.args,
          seg,
        ),
        risk,
        requiresApproval: risk === 'high',
        status: 'pending',
        retryCount: 0,
        maxRetries: 1,
        timeoutMs: 12000,
      });
    }

    const planId = `plan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const plan: ExecutionPlan = {
      id: planId,
      title: `Tactical Multi-Step Mission (${steps.length} Steps)`,
      prompt,
      steps,
      status: 'created',
      createdAt: new Date().toISOString(),
      currentStepIndex: 0,
    };

    return this.validatePlan(plan).plan;
  }

  /**
   * Parse an AI-generated structured plan directive: [PLAN: [{"toolId": "...", "args": {...}, "description": "..."}]]
   */
  public parseModelPlanDirective(
    response: string,
    originalPrompt: string,
  ): ExecutionPlan | null {
    const startIndex = response.indexOf('[PLAN:');
    if (startIndex === -1) return null;
    const afterTag = response.slice(startIndex + 6).trimStart();
    const arrayStart = afterTag.indexOf('[');
    if (arrayStart === -1) return null;

    let depth = 0;
    let arrayEnd = -1;
    for (let i = arrayStart; i < afterTag.length; i++) {
      if (afterTag[i] === '[') depth++;
      else if (afterTag[i] === ']') {
        depth--;
        if (depth === 0) {
          arrayEnd = i;
          break;
        }
      }
    }
    if (arrayEnd === -1) return null;

    try {
      const rawSteps = JSON.parse(afterTag.slice(arrayStart, arrayEnd + 1));
      if (!Array.isArray(rawSteps) || rawSteps.length === 0) return null;

      const steps: TaskStep[] = rawSteps.map((s, idx) => {
        const toolId = String(s.toolId || '').trim();
        const args = (
          typeof s.args === 'object' && s.args !== null ? s.args : {}
        ) as Record<string, unknown>;
        const risk = this.classifyRisk(toolId);
        return {
          id: `step-${idx + 1}-${Math.random().toString(36).substring(2, 6)}`,
          index: idx + 1,
          toolId,
          args,
          description:
            s.description ||
            this.generateStepDescription(toolId, args, `Step ${idx + 1}`),
          risk,
          requiresApproval: s.requiresApproval === true || risk === 'high',
          status: 'pending',
          retryCount: 0,
          maxRetries: 1,
          timeoutMs: 12000,
        };
      });

      const plan: ExecutionPlan = {
        id: `plan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: `Autonomous Task Sequence (${steps.length} Steps)`,
        prompt: originalPrompt,
        steps,
        status: 'created',
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
      };

      return this.validatePlan(plan).plan;
    } catch {
      return null;
    }
  }

  /**
   * Validates each step in the plan against the active tool registry and Zod schemas.
   */
  public validatePlan(plan: ExecutionPlan): {
    valid: boolean;
    plan: ExecutionPlan;
    errors: string[];
  } {
    const errors: string[] = [];

    for (const step of plan.steps) {
      const tool = this.registry.getTool(step.toolId);
      if (!tool) {
        errors.push(
          `Step ${step.index}: Tool "${step.toolId}" does not exist in registry.`,
        );
        step.status = 'failed';
        step.error = `Tool "${step.toolId}" not found`;
        continue;
      }

      const parseResult = tool.schema.safeParse(step.args);
      if (!parseResult.success) {
        const issues =
          parseResult.error.issues || (parseResult.error as any).errors || [];
        const msg =
          issues.map((i: any) => i.message).join('; ') || 'Invalid parameters';
        errors.push(`Step ${step.index} (${step.toolId}): ${msg}`);
        step.status = 'failed';
        step.error = msg;
      } else {
        step.args = parseResult.data;
      }
    }

    const valid = errors.length === 0;
    plan.status = valid ? 'validating' : 'failed';
    if (!valid) {
      plan.summary = `Plan validation failed: ${errors.join(' | ')}`;
    }

    return { valid, plan, errors };
  }

  public classifyRisk(toolId: string): StepRiskLevel {
    if (HIGH_RISK_TOOLS.has(toolId)) return 'high';
    if (MEDIUM_RISK_TOOLS.has(toolId)) return 'medium';
    return 'low';
  }

  private generateStepDescription(
    toolId: string,
    args: Record<string, unknown>,
    fallback: string,
  ): string {
    switch (toolId) {
      case 'system_diagnostics':
        return 'Query hardware diagnostics & system telemetry';
      case 'network_diagnostics':
        return 'Run network ping & connectivity diagnostics';
      case 'capture_screen':
        return 'Capture primary display screenshot';
      case 'lock_workstation':
        return 'Lock Windows workstation session';
      case 'volume_control':
        return `Adjust system volume (${args.action}${args.level ? ` to ${args.level}%` : ''})`;
      case 'brightness_control':
        return `Display brightness (${args.action}${args.level ? ` to ${args.level}%` : ''})`;
      case 'media_control':
        return `Media playback control (${args.action})`;
      case 'open_app':
        return `Launch approved application "${args.app}"`;
      case 'close_app':
        return `Terminate application process "${args.app}"`;
      case 'open_url':
        return `Open web address "${args.url}"`;
      case 'write_file':
        return `Write safe file "${args.filePath}"`;
      case 'read_file':
        return `Read safe file "${args.filePath}"`;
      case 'direct_search':
        return `Search ${args.platform} for "${args.query}"`;
      case 'quick_note':
        return `Quick memo (${args.action})`;
      case 'clipboard_control':
        return `System clipboard (${args.action})`;
      default:
        return fallback || `Execute tool "${toolId}"`;
    }
  }
}

export const globalTaskPlanner = new TaskPlanner();
