import type {
  WorkflowItem,
  CreateWorkflowParams,
  TriggerType,
  WorkflowTriggerConfig,
} from './workflowTypes';
import { databaseService } from '../db/databaseService';
import { globalToolRegistry } from '../tools/toolRegistry';
import { getSystemDiagnostics } from '../tools/systemStatsTool';

export type WorkflowTriggerCallback = (
  workflow: WorkflowItem,
  result: { success: boolean; message: string },
) => void;

export type WorkflowUpdateCallback = (workflow: WorkflowItem) => void;

export class WorkflowEngine {
  private workflows: Map<string, WorkflowItem> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private triggerListeners: Set<WorkflowTriggerCallback> = new Set();
  private updateListeners: Set<WorkflowUpdateCallback> = new Set();
  private conditionCooldowns: Map<string, number> = new Map(); // workflowId -> lastTriggerTimestamp

  constructor() {
    this.start();
  }

  public start(): void {
    if (this.checkInterval) return;
    this.checkInterval = setInterval(() => {
      this.evaluateWorkflows().catch((err) => {
        console.warn('[WorkflowEngine] Error in evaluation loop:', err);
      });
    }, 2000);
  }

  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  public onWorkflowTrigger(cb: WorkflowTriggerCallback): () => void {
    this.triggerListeners.add(cb);
    return () => this.triggerListeners.delete(cb);
  }

  public onWorkflowUpdated(cb: WorkflowUpdateCallback): () => void {
    this.updateListeners.add(cb);
    return () => this.updateListeners.delete(cb);
  }

  public static calculateNextRunTime(
    triggerType: TriggerType,
    config: WorkflowTriggerConfig,
  ): number {
    const now = Date.now();
    if (triggerType === 'delay') {
      const mins = Math.max(0.1, config.delayMinutes ?? 5);
      return now + Math.round(mins * 60 * 1000);
    }

    if (triggerType === 'interval') {
      const mins = Math.max(1, config.intervalMinutes ?? 15);
      return now + Math.round(mins * 60 * 1000);
    }

    if (triggerType === 'daily_time' && config.targetTime) {
      const [hStr, mStr] = config.targetTime.split(':');
      const targetH = parseInt(hStr || '9', 10);
      const targetM = parseInt(mStr || '0', 10);

      const targetDate = new Date();
      targetDate.setHours(targetH, targetM, 0, 0);

      // If target time has already passed today, advance to tomorrow
      if (targetDate.getTime() <= now) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      return targetDate.getTime();
    }

    // Condition triggers evaluate dynamically in the tick loop
    return now;
  }

  public async createWorkflow(
    params: CreateWorkflowParams,
  ): Promise<WorkflowItem> {
    const id = `wf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nextRunMs = WorkflowEngine.calculateNextRunTime(
      params.triggerType,
      params.triggerConfig,
    );

    const isOneShot =
      params.triggerType === 'delay' || params.maxExecutions === 1;

    const item: WorkflowItem = {
      id,
      name: params.name.trim(),
      description: params.description?.trim(),
      triggerType: params.triggerType,
      triggerConfig: params.triggerConfig,
      actionType: params.actionType,
      actionPayload: params.actionPayload,
      status: 'active',
      nextRunMs,
      executionCount: 0,
      maxExecutions: isOneShot ? 1 : params.maxExecutions,
      createdAt: new Date().toISOString(),
    };

    this.workflows.set(id, item);
    await databaseService.saveWorkflow(item).catch(() => {});
    this.notifyUpdate(item);
    return item;
  }

  public async evaluateWorkflows(): Promise<void> {
    const now = Date.now();
    let sysDiagnostics: any = null;

    for (const wf of this.workflows.values()) {
      if (wf.status !== 'active') continue;

      let isDue = false;

      // 1. Time-based triggers (delay, interval, daily_time)
      if (wf.triggerType !== 'condition') {
        if (now >= wf.nextRunMs) {
          isDue = true;
        }
      } else if (wf.triggerConfig.condition) {
        // 2. Condition-based trigger (e.g. battery < 20%, ram > 85%)
        const lastCooldown = this.conditionCooldowns.get(wf.id) || 0;
        // 5 minute cooldown between re-triggering conditions
        if (now - lastCooldown >= 5 * 60 * 1000) {
          if (!sysDiagnostics) {
            const diagResult = await getSystemDiagnostics().catch(() => null);
            sysDiagnostics = diagResult?.data;
          }

          if (sysDiagnostics) {
            const { metric, operator, value } = wf.triggerConfig.condition;
            let currentVal: number | undefined;

            if (metric === 'battery') {
              currentVal = sysDiagnostics.batteryPercent;
            } else if (metric === 'ram') {
              currentVal = sysDiagnostics.usedMemoryPercent;
            }

            if (typeof currentVal === 'number') {
              if (operator === '<' && currentVal < value) isDue = true;
              else if (operator === '<=' && currentVal <= value) isDue = true;
              else if (operator === '>' && currentVal > value) isDue = true;
              else if (operator === '>=' && currentVal >= value) isDue = true;

              if (isDue) {
                this.conditionCooldowns.set(wf.id, now);
              }
            }
          }
        }
      }

      if (isDue) {
        await this.executeWorkflow(wf);
      }
    }
  }

  public async executeWorkflow(
    wf: WorkflowItem,
  ): Promise<{ success: boolean; message: string }> {
    const now = Date.now();
    wf.executionCount += 1;
    wf.lastRunMs = now;

    let execResult: { success: boolean; message: string } = {
      success: true,
      message: 'Workflow executed successfully.',
    };

    try {
      if (wf.actionType === 'tool' && wf.actionPayload.toolId) {
        const result = await globalToolRegistry.executeTool(
          wf.actionPayload.toolId,
          wf.actionPayload.args || {},
        );
        execResult = {
          success: result.success,
          message: result.message,
        };
      } else if (wf.actionType === 'speech' && wf.actionPayload.speechText) {
        execResult = {
          success: true,
          message: `Vocal notification triggered: "${wf.actionPayload.speechText}"`,
        };
      } else if (wf.actionType === 'mission' && wf.actionPayload.prompt) {
        const { globalTaskPlanner } = await import('../agent/taskPlanner');
        const { globalTaskExecutor } = await import('../agent/taskExecutor');
        const plan = globalTaskPlanner.createPlanFromPrompt(
          wf.actionPayload.prompt,
        );
        if (plan) {
          const executed = await globalTaskExecutor.executePlan(plan);
          execResult = {
            success: executed.status === 'completed',
            message: executed.summary || 'Mission completed successfully.',
          };
        } else {
          execResult = {
            success: true,
            message: `Mission prompt dispatched: "${wf.actionPayload.prompt}"`,
          };
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      execResult = {
        success: false,
        message: `Execution failed: ${msg}`,
      };
    }

    wf.lastResult = {
      ...execResult,
      timestamp: new Date().toISOString(),
    };

    // Calculate next run or complete workflow
    if (wf.maxExecutions && wf.executionCount >= wf.maxExecutions) {
      wf.status = 'completed';
    } else if (wf.triggerType === 'interval') {
      const intervalMins = wf.triggerConfig.intervalMinutes ?? 15;
      wf.nextRunMs = now + intervalMins * 60 * 1000;
    } else if (wf.triggerType === 'daily_time') {
      wf.nextRunMs = WorkflowEngine.calculateNextRunTime(
        'daily_time',
        wf.triggerConfig,
      );
    } else if (wf.triggerType === 'delay') {
      wf.status = 'completed';
    }

    await databaseService.saveWorkflow(wf).catch(() => {});
    this.notifyTrigger(wf, execResult);
    this.notifyUpdate(wf);

    return execResult;
  }

  public async executeWorkflowNow(
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    const wf = this.workflows.get(id);
    if (!wf) {
      return { success: false, message: `Workflow "${id}" not found.` };
    }
    return this.executeWorkflow(wf);
  }

  public async toggleWorkflow(id: string): Promise<WorkflowItem | null> {
    const wf = this.workflows.get(id);
    if (!wf) return null;

    if (wf.status === 'active') {
      wf.status = 'paused';
    } else if (wf.status === 'paused' || wf.status === 'completed') {
      wf.status = 'active';
      // Recalculate next run if resuming
      wf.nextRunMs = WorkflowEngine.calculateNextRunTime(
        wf.triggerType,
        wf.triggerConfig,
      );
    }

    await databaseService.saveWorkflow(wf).catch(() => {});
    this.notifyUpdate(wf);
    return wf;
  }

  public async deleteWorkflow(id: string): Promise<boolean> {
    const deleted = this.workflows.delete(id);
    if (deleted) {
      await databaseService.deleteWorkflow(id).catch(() => {});
    }
    return deleted;
  }

  public getWorkflows(): WorkflowItem[] {
    return Array.from(this.workflows.values()).sort(
      (a, b) => b.nextRunMs - a.nextRunMs,
    );
  }

  public async syncFromDatabase(): Promise<void> {
    try {
      const saved = await databaseService.getWorkflows();
      for (const item of saved) {
        this.workflows.set(item.id, item);
      }
    } catch (err) {
      console.warn('[WorkflowEngine] Failed to sync from Neon DB:', err);
    }
  }

  private notifyTrigger(
    wf: WorkflowItem,
    res: { success: boolean; message: string },
  ): void {
    for (const listener of this.triggerListeners) {
      try {
        listener(wf, res);
      } catch (err) {
        console.warn('[WorkflowEngine] Listener error on trigger:', err);
      }
    }
  }

  private notifyUpdate(wf: WorkflowItem): void {
    for (const listener of this.updateListeners) {
      try {
        listener(wf);
      } catch (err) {
        console.warn('[WorkflowEngine] Listener error on update:', err);
      }
    }
  }
}

export const globalWorkflowEngine = new WorkflowEngine();
