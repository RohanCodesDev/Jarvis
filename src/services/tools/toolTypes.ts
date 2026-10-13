import { z } from 'zod';

export type PermissionLevel = 'low_risk' | 'needs_approval' | 'blocked';

export interface ToolExecutionResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
  durationMs?: number;
}

export interface ToolDefinition<TParams = unknown> {
  id: string;
  name: string;
  description: string;
  permission: PermissionLevel;
  schema: z.ZodSchema<TParams>;
  execute: (args: TParams) => Promise<ToolExecutionResult>;
}

export interface ToolAuditLog {
  id: string;
  toolId: string;
  timestamp: string;
  args: Record<string, unknown>;
  success: boolean;
  resultMessage?: string;
  error?: string;
  durationMs: number;
}
