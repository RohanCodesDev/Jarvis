export type TriggerType = 'delay' | 'interval' | 'daily_time' | 'condition';

export type ActionType = 'tool' | 'mission' | 'speech';

export type WorkflowStatus = 'active' | 'paused' | 'completed' | 'failed';

export interface ConditionTriggerConfig {
  metric: 'battery' | 'cpu' | 'ram';
  operator: '<' | '>' | '<=' | '>=';
  value: number;
}

export interface WorkflowTriggerConfig {
  delayMinutes?: number;
  intervalMinutes?: number;
  targetTime?: string; // HH:MM in 24hr format e.g. "09:00"
  condition?: ConditionTriggerConfig;
}

export interface WorkflowActionPayload {
  toolId?: string;
  args?: Record<string, unknown>;
  prompt?: string;
  speechText?: string;
}

export interface WorkflowItem {
  id: string;
  name: string;
  description?: string;
  triggerType: TriggerType;
  triggerConfig: WorkflowTriggerConfig;
  actionType: ActionType;
  actionPayload: WorkflowActionPayload;
  status: WorkflowStatus;
  nextRunMs: number;
  lastRunMs?: number;
  executionCount: number;
  maxExecutions?: number; // 1 for one-shot delays, undefined for recurring
  lastResult?: {
    success: boolean;
    message: string;
    timestamp: string;
  };
  createdAt: string;
}

export interface CreateWorkflowParams {
  name: string;
  description?: string;
  triggerType: TriggerType;
  triggerConfig: WorkflowTriggerConfig;
  actionType: ActionType;
  actionPayload: WorkflowActionPayload;
  maxExecutions?: number;
}
