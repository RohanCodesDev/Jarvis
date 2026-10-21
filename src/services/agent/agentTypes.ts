import type { ToolExecutionResult } from '../tools/toolTypes';

export type StepRiskLevel = 'low' | 'medium' | 'high';

export type StepStatus =
  | 'pending'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export type PlanStatus =
  | 'created'
  | 'validating'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TaskStep {
  id: string;
  index: number;
  toolId: string;
  args: Record<string, unknown>;
  description: string;
  risk: StepRiskLevel;
  requiresApproval: boolean;
  status: StepStatus;
  result?: ToolExecutionResult;
  error?: string;
  durationMs?: number;
  retryCount: number;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface ExecutionPlan {
  id: string;
  title: string;
  prompt: string;
  steps: TaskStep[];
  status: PlanStatus;
  createdAt: string;
  completedAt?: string;
  currentStepIndex: number;
  summary?: string;
  totalDurationMs?: number;
}

export interface PlanProgressEvent {
  planId: string;
  status: PlanStatus;
  currentStepIndex: number;
  totalSteps: number;
  activeStep?: TaskStep;
  steps: TaskStep[];
  summary?: string;
  error?: string;
}
