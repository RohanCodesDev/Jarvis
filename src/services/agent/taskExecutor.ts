import type { ExecutionPlan, TaskStep, PlanProgressEvent } from './agentTypes';
import { globalToolRegistry, ToolRegistry } from '../tools/toolRegistry';
import type { ToolExecutionResult } from '../tools/toolTypes';

export type ProgressCallback = (event: PlanProgressEvent) => void;

interface PendingApproval {
  resolve: (approved: boolean) => void;
  stepId: string;
}

export class TaskExecutor {
  private registry: ToolRegistry;
  private activePlans = new Map<string, ExecutionPlan>();
  private pendingApprovals = new Map<string, PendingApproval>();
  private cancellationTokens = new Set<string>();

  constructor(registry: ToolRegistry = globalToolRegistry) {
    this.registry = registry;
  }

  public getActivePlan(planId: string): ExecutionPlan | undefined {
    return this.activePlans.get(planId);
  }

  /**
   * Request approval confirmation for a high-risk step.
   */
  public approveStep(
    planId: string,
    stepId: string,
    approved: boolean,
  ): boolean {
    const key = `${planId}:${stepId}`;
    const pending = this.pendingApprovals.get(key);
    if (!pending) return false;

    this.pendingApprovals.delete(key);
    pending.resolve(approved);
    return true;
  }

  /**
   * Immediately aborts and cancels an active multi-step plan.
   */
  public cancelPlan(planId: string): boolean {
    const plan = this.activePlans.get(planId);
    if (!plan) return false;

    this.cancellationTokens.add(planId);

    // Release any pending approval promise as rejected
    for (const [key, pending] of this.pendingApprovals.entries()) {
      if (key.startsWith(`${planId}:`)) {
        this.pendingApprovals.delete(key);
        pending.resolve(false);
      }
    }

    plan.status = 'cancelled';
    plan.completedAt = new Date().toISOString();
    plan.summary = 'Mission execution aborted by user override.';

    for (const step of plan.steps) {
      if (
        step.status === 'pending' ||
        step.status === 'awaiting_approval' ||
        step.status === 'running'
      ) {
        step.status = 'cancelled';
        step.error = 'Plan cancelled by user';
      }
    }

    return true;
  }

  /**
   * Executes an ExecutionPlan sequentially with timeouts, bounded retries, and approval gates.
   */
  public async executePlan(
    plan: ExecutionPlan,
    onProgress?: ProgressCallback,
  ): Promise<ExecutionPlan> {
    const startTime = performance.now();
    this.activePlans.set(plan.id, plan);
    this.cancellationTokens.delete(plan.id);

    plan.status = 'running';
    this.emitProgress(plan, onProgress);

    let failedCount = 0;
    let completedCount = 0;

    for (let i = 0; i < plan.steps.length; i++) {
      // Check cancellation before each step
      if (this.cancellationTokens.has(plan.id)) {
        break;
      }

      const step = plan.steps[i];
      plan.currentStepIndex = i;

      // 1. Approval Gate Check
      if (step.requiresApproval) {
        step.status = 'awaiting_approval';
        plan.status = 'awaiting_approval';
        this.emitProgress(plan, onProgress, step);

        const approved = await this.waitForApproval(plan.id, step.id);
        if (!approved || this.cancellationTokens.has(plan.id)) {
          step.status = 'cancelled';
          step.error = 'User denied execution approval';
          plan.status = 'cancelled';
          this.emitProgress(plan, onProgress, step);
          break;
        }

        // Resumed after approval
        step.requiresApproval = false;
        plan.status = 'running';
      }

      step.status = 'running';
      this.emitProgress(plan, onProgress, step);

      // 2. Execute with Bounded Retries & Timeout
      const stepStartTime = performance.now();
      let stepResult: ToolExecutionResult | null = null;
      let attempt = 0;
      const maxRetries = step.maxRetries ?? 1;

      while (attempt <= maxRetries) {
        if (this.cancellationTokens.has(plan.id)) {
          step.status = 'cancelled';
          step.error = 'Execution cancelled';
          break;
        }

        try {
          stepResult = await this.executeStepWithTimeout(
            step,
            step.timeoutMs || 12000,
          );

          if (stepResult.success) {
            break;
          } else {
            attempt++;
            step.retryCount = attempt;
            if (attempt <= maxRetries) {
              await new Promise((r) => setTimeout(r, 400));
            }
          }
        } catch (err: unknown) {
          attempt++;
          step.retryCount = attempt;
          const msg = err instanceof Error ? err.message : String(err);
          stepResult = {
            success: false,
            message: `Step error: ${msg}`,
            error: msg,
            durationMs: Math.round(performance.now() - stepStartTime),
          };
          if (attempt <= maxRetries) {
            await new Promise((r) => setTimeout(r, 400));
          }
        }
      }

      const stepElapsed = Math.round(performance.now() - stepStartTime);
      step.durationMs = stepElapsed;
      step.result = stepResult || {
        success: false,
        message: 'Step failed to produce result',
        error: 'No result',
        durationMs: stepElapsed,
      };

      if (step.result.success) {
        step.status = 'completed';
        completedCount++;
      } else {
        step.status = 'failed';
        step.error = step.result.error || step.result.message;
        failedCount++;

        // If this step failed, stop dependent subsequent steps safely
        for (let j = i + 1; j < plan.steps.length; j++) {
          plan.steps[j].status = 'skipped';
          plan.steps[j].error = `Skipped due to Step ${step.index} failure`;
        }
        this.emitProgress(plan, onProgress, step);
        break;
      }

      this.emitProgress(plan, onProgress, step);
    }

    const totalElapsed = Math.round(performance.now() - startTime);
    plan.totalDurationMs = totalElapsed;
    plan.completedAt = new Date().toISOString();

    if (this.cancellationTokens.has(plan.id) || plan.status === 'cancelled') {
      plan.status = 'cancelled';
    } else if (failedCount > 0) {
      plan.status = 'failed';
    } else {
      plan.status = 'completed';
    }

    plan.summary = this.generatePlanSummary(
      plan,
      completedCount,
      failedCount,
      totalElapsed,
    );
    this.emitProgress(plan, onProgress);

    return plan;
  }

  private async executeStepWithTimeout(
    step: TaskStep,
    timeoutMs: number,
  ): Promise<ToolExecutionResult> {
    let timer: NodeJS.Timeout;

    const timeoutPromise = new Promise<ToolExecutionResult>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Step execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const executionPromise = this.registry.executeTool(step.toolId, step.args);

    try {
      const res = await Promise.race([executionPromise, timeoutPromise]);
      clearTimeout(timer!);
      return res;
    } catch (err) {
      clearTimeout(timer!);
      throw err;
    }
  }

  private waitForApproval(planId: string, stepId: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.pendingApprovals.set(`${planId}:${stepId}`, { resolve, stepId });
    });
  }

  private emitProgress(
    plan: ExecutionPlan,
    callback?: ProgressCallback,
    activeStep?: TaskStep,
  ): void {
    if (!callback) return;
    callback({
      planId: plan.id,
      status: plan.status,
      currentStepIndex: plan.currentStepIndex,
      totalSteps: plan.steps.length,
      activeStep: activeStep || plan.steps[plan.currentStepIndex],
      steps: [...plan.steps],
      summary: plan.summary,
    });
  }

  /**
   * Generates a truthful, verified debrief report based exclusively on actual tool results.
   */
  public generatePlanSummary(
    plan: ExecutionPlan,
    completed: number,
    failed: number,
    durationMs: number,
  ): string {
    if (plan.status === 'cancelled') {
      return `Mission cancelled by user directive (${completed}/${plan.steps.length} steps completed).`;
    }

    if (failed > 0) {
      const failedStep = plan.steps.find((s) => s.status === 'failed');
      return `Mission halted at Step ${failedStep?.index ?? 1}: ${failedStep?.error || 'Execution error'}. (${completed} completed, 1 failed, ${plan.steps.length - completed - 1} skipped).`;
    }

    const stepOutcomes = plan.steps
      .map(
        (s) =>
          `${s.index}. ${s.description}: ${s.result?.message || 'Success'}`,
      )
      .join('\n');

    return `Mission completed successfully (${completed}/${plan.steps.length} steps, ${durationMs}ms):\n${stepOutcomes}`;
  }
}

export const globalTaskExecutor = new TaskExecutor();
