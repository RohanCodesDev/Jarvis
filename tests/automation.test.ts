import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WorkflowEngine,
  globalWorkflowEngine,
} from '../src/services/automation/workflowEngine';
import { globalToolRegistry } from '../src/services/tools/toolRegistry';
import { detectDirectIntent } from '../src/services/tools/intentDetector';
import { DatabaseService } from '../src/services/db/databaseService';
import type { WorkflowItem } from '../src/services/automation/workflowTypes';

describe('Autonomous Scheduled Workflows & System Automation', () => {
  describe('WorkflowEngine Core Execution & Lifecycle', () => {
    let engine: WorkflowEngine;

    beforeEach(() => {
      engine = new WorkflowEngine();
      engine.stop(); // Stop background interval to control ticks manually
    });

    afterEach(() => {
      engine.stop();
    });

    it('calculates proper target timestamp for one-shot delay workflows', () => {
      const now = Date.now();
      const nextRun = WorkflowEngine.calculateNextRunTime('delay', {
        delayMinutes: 10,
      });

      expect(nextRun).toBeGreaterThan(now + 9 * 60 * 1000);
      expect(nextRun).toBeLessThanOrEqual(now + 10 * 60 * 1000 + 50);
    });

    it('calculates proper target timestamp for recurring interval workflows', () => {
      const now = Date.now();
      const nextRun = WorkflowEngine.calculateNextRunTime('interval', {
        intervalMinutes: 30,
      });

      expect(nextRun).toBeGreaterThan(now + 29 * 60 * 1000);
      expect(nextRun).toBeLessThanOrEqual(now + 30 * 60 * 1000 + 50);
    });

    it('calculates proper target timestamp for daily_time schedule', () => {
      const targetTime = '23:59';
      const nextRun = WorkflowEngine.calculateNextRunTime('daily_time', {
        targetTime,
      });
      const date = new Date(nextRun);

      expect(date.getHours()).toBe(23);
      expect(date.getMinutes()).toBe(59);
      expect(nextRun).toBeGreaterThan(Date.now());
    });

    it('creates an active workflow and dispatches update notifications', async () => {
      const updateSpy = vi.fn();
      engine.onWorkflowUpdated(updateSpy);

      const wf = await engine.createWorkflow({
        name: 'Late Night Dimmer',
        triggerType: 'delay',
        triggerConfig: { delayMinutes: 5 },
        actionType: 'tool',
        actionPayload: {
          toolId: 'volume_control',
          args: { action: 'set', level: 20 },
        },
      });

      expect(wf.id).toMatch(/^wf-/);
      expect(wf.name).toBe('Late Night Dimmer');
      expect(wf.status).toBe('active');
      expect(wf.executionCount).toBe(0);
      expect(wf.maxExecutions).toBe(1);
      expect(updateSpy).toHaveBeenCalledWith(wf);
    });

    it('executes one-shot delay workflow and marks it completed', async () => {
      const triggerSpy = vi.fn();
      engine.onWorkflowTrigger(triggerSpy);

      const wf = await engine.createWorkflow({
        name: 'One-Shot Protocol',
        triggerType: 'delay',
        triggerConfig: { delayMinutes: 1 },
        actionType: 'speech',
        actionPayload: { speechText: 'Test speech trigger' },
      });

      const res = await engine.executeWorkflow(wf);

      expect(res.success).toBe(true);
      expect(wf.executionCount).toBe(1);
      expect(wf.status).toBe('completed');
      expect(wf.lastResult?.message).toContain('Vocal notification triggered');
      expect(triggerSpy).toHaveBeenCalledWith(wf, expect.any(Object));
    });

    it('advances nextRunMs for interval workflows after execution', async () => {
      const wf = await engine.createWorkflow({
        name: 'Heartbeat Protocol',
        triggerType: 'interval',
        triggerConfig: { intervalMinutes: 15 },
        actionType: 'speech',
        actionPayload: { speechText: 'Heartbeat active' },
      });

      const beforeRun = Date.now();
      await engine.executeWorkflow(wf);

      expect(wf.status).toBe('active');
      expect(wf.executionCount).toBe(1);
      expect(wf.nextRunMs).toBeGreaterThanOrEqual(
        beforeRun + 15 * 60 * 1000 - 100,
      );
    });

    it('toggles workflow status between active and paused', async () => {
      const wf = await engine.createWorkflow({
        name: 'Pausable Task',
        triggerType: 'interval',
        triggerConfig: { intervalMinutes: 20 },
        actionType: 'speech',
        actionPayload: { speechText: 'Pausable' },
      });

      expect(wf.status).toBe('active');

      const paused = await engine.toggleWorkflow(wf.id);
      expect(paused?.status).toBe('paused');

      const resumed = await engine.toggleWorkflow(wf.id);
      expect(resumed?.status).toBe('active');
    });

    it('deletes workflows cleanly', async () => {
      const wf = await engine.createWorkflow({
        name: 'Temporary Task',
        triggerType: 'delay',
        triggerConfig: { delayMinutes: 5 },
        actionType: 'speech',
        actionPayload: { speechText: 'Bye' },
      });

      const deleted = await engine.deleteWorkflow(wf.id);
      expect(deleted).toBe(true);
      expect(engine.getWorkflows().find((w) => w.id === wf.id)).toBeUndefined();
    });

    it('allows immediate manual execution via executeWorkflowNow', async () => {
      const wf = await engine.createWorkflow({
        name: 'Immediate Manual Trigger',
        triggerType: 'delay',
        triggerConfig: { delayMinutes: 60 },
        actionType: 'tool',
        actionPayload: {
          toolId: 'volume_control',
          args: { action: 'set', level: 40 },
        },
      });

      const res = await engine.executeWorkflowNow(wf.id);
      expect(res.success).toBe(true);
      expect(wf.executionCount).toBe(1);
    });
  });

  describe('Database Persistence (workflows table)', () => {
    it('persists and retrieves workflow items from cache and storage', async () => {
      const mockPool: any = {
        connect: vi.fn().mockResolvedValue({
          query: vi.fn().mockResolvedValue({ rows: [] }),
          release: vi.fn(),
        }),
        on: vi.fn(),
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('SELECT id, name, description, trigger_type')) {
            return {
              rows: [
                {
                  id: 'wf-test-persist-1',
                  name: 'Database Backup Automation',
                  description: null,
                  trigger_type: 'interval',
                  trigger_config: JSON.stringify({ intervalMinutes: 60 }),
                  action_type: 'speech',
                  action_payload: JSON.stringify({ speechText: 'Persist test' }),
                  status: 'active',
                  next_run_ms: Date.now() + 3600000,
                  last_run_ms: null,
                  execution_count: 2,
                  max_executions: null,
                  last_result: null,
                  created_at: new Date().toISOString(),
                },
              ],
            };
          }
          return { rows: [] };
        }),
      };

      const db = new DatabaseService(mockPool);

      const item: WorkflowItem = {
        id: 'wf-test-persist-1',
        name: 'Database Backup Automation',
        triggerType: 'interval',
        triggerConfig: { intervalMinutes: 60 },
        actionType: 'speech',
        actionPayload: { speechText: 'Persist test' },
        status: 'active',
        nextRunMs: Date.now() + 3600000,
        executionCount: 2,
        createdAt: new Date().toISOString(),
      };

      const saveRes = await db.saveWorkflow(item);
      expect(saveRes.success).toBe(true);

      const all = await db.getWorkflows();
      const found = all.find((w) => w.id === 'wf-test-persist-1');
      expect(found).toBeDefined();
      expect(found?.name).toBe('Database Backup Automation');
      expect(found?.triggerType).toBe('interval');

      const deleted = await db.deleteWorkflow('wf-test-persist-1');
      expect(deleted).toBe(true);
    });
  });

  describe('ToolRegistry Workflow Tools (create_workflow & manage_workflow)', () => {
    it('executes create_workflow tool successfully', async () => {
      const res = await globalToolRegistry.executeTool('create_workflow', {
        name: 'Registry Test Workflow',
        triggerType: 'delay',
        delayMinutes: 5,
        actionType: 'speech',
        speechText: 'Hello from registry',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('Autonomous workflow');
      expect(res.data).toBeDefined();

      const created = res.data as WorkflowItem;
      await globalWorkflowEngine.deleteWorkflow(created.id);
    });

    it('executes manage_workflow tool to list, pause, and delete workflows', async () => {
      const created = await globalWorkflowEngine.createWorkflow({
        name: 'Manage Tool Test',
        triggerType: 'interval',
        triggerConfig: { intervalMinutes: 10 },
        actionType: 'speech',
        actionPayload: { speechText: 'Test' },
      });

      // 1. List
      const listRes = await globalToolRegistry.executeTool('manage_workflow', {
        action: 'list',
      });
      expect(listRes.success).toBe(true);
      expect(Array.isArray(listRes.data)).toBe(true);

      // 2. Pause
      const pauseRes = await globalToolRegistry.executeTool('manage_workflow', {
        action: 'pause',
        workflowId: created.id,
      });
      expect(pauseRes.success).toBe(true);
      expect(pauseRes.message).toContain('paused');

      // 3. Delete
      const delRes = await globalToolRegistry.executeTool('manage_workflow', {
        action: 'delete',
        workflowId: created.id,
      });
      expect(delRes.success).toBe(true);
    });
  });

  describe('Intent Detection for Natural Language Automation Directives', () => {
    it('detects "in 10 minutes set volume to 20" as create_workflow tool intent', () => {
      const detected = detectDirectIntent('in 10 minutes set volume to 20');
      expect(detected).not.toBeNull();
      expect(detected?.toolId).toBe('create_workflow');
      expect(detected?.args?.triggerType).toBe('delay');
      expect(detected?.args?.delayMinutes).toBe(10);
      expect(detected?.args?.actionType).toBe('tool');
      expect(detected?.args?.toolId).toBe('volume_control');
    });

    it('detects "every 15 minutes check battery" as recurring interval workflow intent', () => {
      const detected = detectDirectIntent('every 15 minutes check battery');
      expect(detected).not.toBeNull();
      expect(detected?.toolId).toBe('create_workflow');
      expect(detected?.args?.triggerType).toBe('interval');
      expect(detected?.args?.intervalMinutes).toBe(15);
      expect(detected?.args?.actionType).toBe('tool');
      expect(detected?.args?.toolId).toBe('system_diagnostics');
    });

    it('detects "if battery drops below 20% alert me" as conditional trigger workflow', () => {
      const detected = detectDirectIntent(
        'if battery drops below 20% alert me',
      );
      expect(detected).not.toBeNull();
      expect(detected?.toolId).toBe('create_workflow');
      expect(detected?.args?.triggerType).toBe('condition');
      expect(detected?.args?.metric).toBe('battery');
      expect(detected?.args?.operator).toBe('<');
      expect(detected?.args?.threshold).toBe(20);
      expect(detected?.args?.actionType).toBe('speech');
    });

    it('detects "show workflows" as manage_workflow list intent', () => {
      const detected = detectDirectIntent('show workflows');
      expect(detected).not.toBeNull();
      expect(detected?.toolId).toBe('manage_workflow');
      expect(detected?.args?.action).toBe('list');
    });

    it('detects "pause workflow wf-987" as manage_workflow pause intent', () => {
      const detected = detectDirectIntent('pause workflow wf-987');
      expect(detected).not.toBeNull();
      expect(detected?.toolId).toBe('manage_workflow');
      expect(detected?.args?.action).toBe('pause');
      expect(detected?.args?.workflowId).toBe('wf-987');
    });
  });
});
