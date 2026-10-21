import { describe, it, expect, vi } from 'vitest';
import { TaskPlanner } from '../src/services/agent/taskPlanner';
import { TaskExecutor } from '../src/services/agent/taskExecutor';
import type { ExecutionPlan } from '../src/services/agent/agentTypes';
import { ToolRegistry } from '../src/services/tools/toolRegistry';
import { DatabaseService } from '../src/services/db/databaseService';
import { z } from 'zod';

describe('Stage 6: Agentic Task Execution & Multi-Step Missions', () => {
  describe('TaskPlanner (Decomposition & Validation)', () => {
    const planner = new TaskPlanner();

    it('decomposes sequential compound prompts into discrete directives', () => {
      const parts1 = planner.decomposePromptDirectives(
        'Check system diagnostics, and capture screen',
      );
      expect(parts1.length).toBe(2);

      const parts2 = planner.decomposePromptDirectives(
        'volume down then close calculator and then lock workstation',
      );
      expect(parts2.length).toBe(3);

      const parts3 = planner.decomposePromptDirectives(
        '1. Check network diagnostics 2. Take screenshot 3. Mute volume',
      );
      expect(parts3.length).toBe(3);
    });

    it('creates an execution plan from a multi-directive user prompt', () => {
      const plan = planner.createPlanFromPrompt(
        'capture screen then check system diagnostics',
      );

      expect(plan).not.toBeNull();
      expect(plan?.steps.length).toBe(2);
      expect(plan?.steps[0].toolId).toBe('capture_screen');
      expect(plan?.steps[1].toolId).toBe('system_diagnostics');
      expect(plan?.steps[0].status).toBe('pending');
    });

    it('classifies risk levels accurately and gates high-risk steps', () => {
      expect(planner.classifyRisk('system_diagnostics')).toBe('low');
      expect(planner.classifyRisk('capture_screen')).toBe('low');
      expect(planner.classifyRisk('close_app')).toBe('medium');
      expect(planner.classifyRisk('write_file')).toBe('medium');
      expect(planner.classifyRisk('lock_workstation')).toBe('high');

      const plan = planner.createPlanFromPrompt(
        'check system diagnostics then lock workstation',
      );
      expect(plan).not.toBeNull();
      expect(plan?.steps[0].requiresApproval).toBe(false);
      expect(plan?.steps[1].requiresApproval).toBe(true);
    });

    it('parses AI-generated structured plan directives [PLAN: [...]]', () => {
      const modelResponse = `I will coordinate your mission immediately, sir.\n[PLAN: [{"toolId": "volume_control", "args": {"action": "mute"}, "description": "Mute master volume"}, {"toolId": "system_diagnostics", "args": {}, "description": "Inspect hardware telemetry"}]]`;
      const plan = planner.parseModelPlanDirective(
        modelResponse,
        'Mute sound and run diagnostics',
      );

      expect(plan).not.toBeNull();
      expect(plan?.steps.length).toBe(2);
      expect(plan?.steps[0].toolId).toBe('volume_control');
      expect(plan?.steps[1].toolId).toBe('system_diagnostics');
    });

    it('validates plan parameters and rejects unregistered tools or bad schemas', () => {
      const customRegistry = new ToolRegistry();
      const customPlanner = new TaskPlanner(customRegistry);

      const invalidPlan: ExecutionPlan = {
        id: 'plan-invalid-1',
        title: 'Invalid Plan',
        prompt: 'do impossible thing',
        status: 'created',
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps: [
          {
            id: 's-1',
            index: 1,
            toolId: 'non_existent_tool_xyz',
            args: {},
            description: 'Run unknown tool',
            risk: 'low',
            requiresApproval: false,
            status: 'pending',
            retryCount: 0,
          },
          {
            id: 's-2',
            index: 2,
            toolId: 'volume_control',
            args: { action: 'invalid_action_name' },
            description: 'Set volume bad',
            risk: 'low',
            requiresApproval: false,
            status: 'pending',
            retryCount: 0,
          },
        ],
      };

      const result = customPlanner.validatePlan(invalidPlan);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(2);
      expect(invalidPlan.steps[0].status).toBe('failed');
      expect(invalidPlan.steps[1].status).toBe('failed');
    });
  });

  describe('TaskExecutor (Sequential Execution, Retries, Approval, Cancellation)', () => {
    it('executes a multi-step mission sequentially and produces verified synthesis report', async () => {
      const testRegistry = new ToolRegistry();
      const executor = new TaskExecutor(testRegistry);

      const step1Spy = vi.fn().mockResolvedValue({
        success: true,
        message: 'Diagnostics completed: CPU nominal',
        durationMs: 15,
      });
      const step2Spy = vi.fn().mockResolvedValue({
        success: true,
        message: 'Volume set to 40%',
        durationMs: 10,
      });

      testRegistry.registerTool({
        id: 'mock_diag',
        name: 'Mock Diag',
        description: 'Mock',
        permission: 'low_risk',
        schema: z.object({}),
        execute: step1Spy,
      });

      testRegistry.registerTool({
        id: 'mock_vol',
        name: 'Mock Vol',
        description: 'Mock',
        permission: 'low_risk',
        schema: z.object({ level: z.number() }),
        execute: step2Spy,
      });

      const plan: ExecutionPlan = {
        id: 'plan-exec-1',
        title: 'Sequential Test Plan',
        prompt: 'run diag and set vol to 40',
        status: 'created',
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps: [
          {
            id: 'step-1',
            index: 1,
            toolId: 'mock_diag',
            args: {},
            description: 'Run mock diag',
            risk: 'low',
            requiresApproval: false,
            status: 'pending',
            retryCount: 0,
          },
          {
            id: 'step-2',
            index: 2,
            toolId: 'mock_vol',
            args: { level: 40 },
            description: 'Set mock volume',
            risk: 'low',
            requiresApproval: false,
            status: 'pending',
            retryCount: 0,
          },
        ],
      };

      const progressEvents: string[] = [];
      const executed = await executor.executePlan(plan, (prog) => {
        progressEvents.push(`${prog.status}:${prog.activeStep?.toolId}`);
      });

      expect(executed.status).toBe('completed');
      expect(step1Spy).toHaveBeenCalledTimes(1);
      expect(step2Spy).toHaveBeenCalledTimes(1);
      expect(executed.steps[0].status).toBe('completed');
      expect(executed.steps[1].status).toBe('completed');
      expect(executed.summary).toContain('Mission completed successfully');
      expect(progressEvents.length).toBeGreaterThan(0);
    });

    it('honestly reports step failure and aborts dependent subsequent steps without claiming false success', async () => {
      const testRegistry = new ToolRegistry();
      const executor = new TaskExecutor(testRegistry);

      testRegistry.registerTool({
        id: 'failing_step',
        name: 'Failing Step',
        description: 'Simulates failure',
        permission: 'low_risk',
        schema: z.object({}),
        execute: async () => ({
          success: false,
          message: 'Hardware access denied',
          error: 'E_DENIED',
          durationMs: 5,
        }),
      });

      const secondStepSpy = vi
        .fn()
        .mockResolvedValue({ success: true, message: 'Should not run' });
      testRegistry.registerTool({
        id: 'second_step',
        name: 'Second Step',
        description: 'Dependent step',
        permission: 'low_risk',
        schema: z.object({}),
        execute: secondStepSpy,
      });

      const plan: ExecutionPlan = {
        id: 'plan-fail-1',
        title: 'Failure Recovery Test Plan',
        prompt: 'fail first step then do second',
        status: 'created',
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps: [
          {
            id: 'step-1',
            index: 1,
            toolId: 'failing_step',
            args: {},
            description: 'Failing hardware query',
            risk: 'low',
            requiresApproval: false,
            status: 'pending',
            retryCount: 0,
            maxRetries: 0,
          },
          {
            id: 'step-2',
            index: 2,
            toolId: 'second_step',
            args: {},
            description: 'Dependent action',
            risk: 'low',
            requiresApproval: false,
            status: 'pending',
            retryCount: 0,
          },
        ],
      };

      const executed = await executor.executePlan(plan);

      expect(executed.status).toBe('failed');
      expect(executed.steps[0].status).toBe('failed');
      expect(executed.steps[1].status).toBe('skipped');
      expect(secondStepSpy).not.toHaveBeenCalled();
      expect(executed.summary).toContain('Mission halted at Step 1');
      expect(executed.summary).not.toContain('completed successfully');
    });

    it('pauses at approval checkpoint and resumes upon user approval', async () => {
      const testRegistry = new ToolRegistry();
      const executor = new TaskExecutor(testRegistry);

      testRegistry.registerTool({
        id: 'approval_tool',
        name: 'Approval Tool',
        description: 'Requires approval',
        permission: 'low_risk',
        schema: z.object({}),
        execute: async () => ({
          success: true,
          message: 'Confirmed and executed',
          durationMs: 10,
        }),
      });

      const plan: ExecutionPlan = {
        id: 'plan-appr-1',
        title: 'Approval Gate Plan',
        prompt: 'run sensitive tool',
        status: 'created',
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps: [
          {
            id: 'step-appr',
            index: 1,
            toolId: 'approval_tool',
            args: {},
            description: 'Executive action',
            risk: 'high',
            requiresApproval: true,
            status: 'pending',
            retryCount: 0,
          },
        ],
      };

      // Launch execution in background promise
      const execPromise = executor.executePlan(plan);

      // Give it a brief tick to enter awaiting_approval state
      await new Promise((r) => setTimeout(r, 40));
      expect(plan.status).toBe('awaiting_approval');
      expect(plan.steps[0].status).toBe('awaiting_approval');

      // User grants approval
      const approved = executor.approveStep('plan-appr-1', 'step-appr', true);
      expect(approved).toBe(true);

      const finished = await execPromise;
      expect(finished.status).toBe('completed');
      expect(finished.steps[0].status).toBe('completed');
    });

    it('supports immediate cancellation and aborts active/pending steps', async () => {
      const testRegistry = new ToolRegistry();
      const executor = new TaskExecutor(testRegistry);

      testRegistry.registerTool({
        id: 'long_step',
        name: 'Long Step',
        description: 'Takes time',
        permission: 'low_risk',
        schema: z.object({}),
        execute: async () => {
          await new Promise((r) => setTimeout(r, 200));
          return { success: true, message: 'Done' };
        },
      });

      const plan: ExecutionPlan = {
        id: 'plan-cancel-1',
        title: 'Cancellation Plan',
        prompt: 'run and abort',
        status: 'created',
        createdAt: new Date().toISOString(),
        currentStepIndex: 0,
        steps: [
          {
            id: 'step-1',
            index: 1,
            toolId: 'long_step',
            args: {},
            description: 'Long running task',
            risk: 'low',
            requiresApproval: false,
            status: 'pending',
            retryCount: 0,
          },
          {
            id: 'step-2',
            index: 2,
            toolId: 'long_step',
            args: {},
            description: 'Should never run',
            risk: 'low',
            requiresApproval: false,
            status: 'pending',
            retryCount: 0,
          },
        ],
      };

      const execPromise = executor.executePlan(plan);

      // Cancel plan mid-flight
      setTimeout(() => {
        executor.cancelPlan('plan-cancel-1');
      }, 50);

      const finished = await execPromise;
      expect(finished.status).toBe('cancelled');
      expect(finished.summary).toContain('Mission cancelled');
    });
  });

  describe('Database Persistence (Mission History & Audit)', () => {
    it('persists and retrieves task execution plans in cache and storage', async () => {
      const mockPool: any = {
        connect: vi.fn().mockResolvedValue({
          query: vi.fn().mockResolvedValue({ rows: [] }),
          release: vi.fn(),
        }),
        on: vi.fn(),
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('SELECT id, title, prompt')) {
            return {
              rows: [
                {
                  id: 'plan-db-test-1',
                  title: 'Audit Telemetry Mission',
                  prompt: 'diagnostics and volume check',
                  status: 'completed',
                  steps: JSON.stringify([
                    { id: 's-1', index: 1, toolId: 'system_diagnostics' },
                  ]),
                  summary: 'All 2 steps executed successfully.',
                  duration_ms: 45,
                  created_at: new Date().toISOString(),
                },
              ],
            };
          }
          return { rows: [] };
        }),
      };
      const db = new DatabaseService(mockPool);

      const samplePlan: ExecutionPlan = {
        id: 'plan-db-test-1',
        title: 'Audit Telemetry Mission',
        prompt: 'diagnostics and volume check',
        status: 'completed',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        currentStepIndex: 2,
        totalDurationMs: 45,
        summary: 'All 2 steps executed successfully.',
        steps: [
          {
            id: 's-1',
            index: 1,
            toolId: 'system_diagnostics',
            args: {},
            description: 'Check telemetry',
            risk: 'low',
            requiresApproval: false,
            status: 'completed',
            retryCount: 0,
          },
        ],
      };

      const saveRes = await db.saveTaskPlan(samplePlan);
      expect(saveRes.success).toBe(true);

      const loadedPlans = await db.getTaskPlans();
      expect(loadedPlans.some((p) => p.id === 'plan-db-test-1')).toBe(true);
    });
  });
});
