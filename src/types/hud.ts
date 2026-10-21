export type AssistantState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'jarvis' | 'system';
  text: string;
  timestamp: string;
  status?: 'sending' | 'delivered' | 'error';
  metadata?: {
    modelUsed?: string;
    durationMs?: number;
    tokens?: number;
  };
}

export interface ActivityItem {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  category: 'system' | 'ai' | 'voice' | 'tool' | 'security';
  message: string;
  durationMs?: number;
  imageUrl?: string;
}

export interface SystemTelemetry {
  cpuUsage: number;
  memoryUsageMb: number;
  activeModel: string;
  connectionStatus: 'connected' | 'reconnecting' | 'offline' | 'mock';
  latencyMs: number;
  speechEngine: 'browser-synthesis' | 'offline';
  micEnabled: boolean;
  speakerEnabled: boolean;
}

export interface UserMemoryItem {
  id: string;
  content: string;
  category: 'preference' | 'system' | 'personal' | 'context';
  createdAt: string;
}

export type HudTheme = 'cyan' | 'gold' | 'matrix' | 'crimson' | 'violet';

export interface JarvisSettings {
  cloudProvider: 'openrouter' | 'groq' | 'ollama';
  openRouterModel: string;
  groqModel?: string;
  ollamaModel: string;
  hasApiKey: boolean;
  hasGroqKey?: boolean;
  speechEnabled: boolean;
  voiceGender: 'male' | 'female';
  soundEffects: boolean;
  compactMode: boolean;
  theme?: HudTheme;
  webSearchEnabled?: boolean;
  wakeWordEnabled?: boolean;
}

export interface ChatStreamChunkEvent {
  streamId: string;
  chunk?: string;
  done?: boolean;
  error?: string;
  fullResponse?: string;
  metadata?: {
    model?: string;
  };
}

export interface DesktopBridgeAPI {
  getSystemInfo: () => Promise<{
    platform: string;
    arch: string;
    electronVersion: string;
    nodeVersion: string;
  }>;
  logActivity: (item: Omit<ActivityItem, 'id' | 'timestamp'>) => Promise<void>;
  hasApiKey: () => Promise<boolean>;
  setApiKey: (key: string) => Promise<{ success: boolean; error?: string }>;
  deleteApiKey: () => Promise<{ success: boolean }>;
  validateApiKey: (key: string) => Promise<{ valid: boolean; error?: string }>;
  hasGroqKey: () => Promise<boolean>;
  setGroqKey: (key: string) => Promise<{ success: boolean; error?: string }>;
  deleteGroqKey: () => Promise<{ success: boolean }>;
  validateGroqKey: (key: string) => Promise<{ valid: boolean; error?: string }>;
  getSettings: () => Promise<JarvisSettings>;
  saveSettings: (
    settings: Partial<JarvisSettings>,
  ) => Promise<{ success: boolean }>;
  getAvailableModels: (
    provider?: 'openrouter' | 'groq' | 'ollama',
  ) => Promise<Array<{ id: string; name: string; isFree?: boolean }>>;
  sendChatMessage: (
    params: {
      streamId: string;
      message: string;
      history?: Array<{
        role: 'user' | 'assistant' | 'system';
        content: string;
      }>;
      model?: string;
      screenCaptureDataUrl?: string;
    },
    onChunk: (event: ChatStreamChunkEvent) => void,
  ) => () => void;
  cancelChatMessage: (streamId: string) => Promise<void>;
  onActivityEvent?: (callback: (item: ActivityItem) => void) => () => void;
  transcribeAudio: (params: {
    base64Audio: string;
    format?: string;
  }) => Promise<{ text: string; source: 'whisper' | 'mock'; error?: string }>;
  // Stage 4: Persistent Memory & Knowledge Banks
  getMemories: () => Promise<UserMemoryItem[]>;
  addMemory: (
    item: UserMemoryItem,
  ) => Promise<{ success: boolean; error?: string }>;
  updateMemory: (
    id: string,
    content: string,
  ) => Promise<{ success: boolean; error?: string }>;
  deleteMemory: (id: string) => Promise<{ success: boolean; error?: string }>;
  getChatHistory: (
    conversationId?: string,
    limit?: number,
  ) => Promise<ChatMessage[]>;
  saveChatMessage: (
    message: ChatMessage,
    conversationId?: string,
  ) => Promise<{ success: boolean }>;
  clearChatHistory: (conversationId?: string) => Promise<{ success: boolean }>;
  getDbStatus: () => Promise<{ isConnected: boolean; error?: string }>;
  // Stage 5: Desktop Actions & Windows Automation
  executeTool?: (
    toolId: string,
    args?: unknown,
  ) => Promise<import('../services/tools/toolTypes').ToolExecutionResult>;
  getApprovedApps?: () => Promise<
    import('../services/tools/appLauncher').ApprovedApp[]
  >;
  getSystemDiagnostics?: () => Promise<
    import('../services/tools/toolTypes').ToolExecutionResult
  >;
  getToolAuditLogs?: () => Promise<
    import('../services/tools/toolTypes').ToolAuditLog[]
  >;
  // Stage 6: Agentic Task Execution & Multi-Step Missions
  createTaskPlan?: (
    prompt: string,
  ) => Promise<import('../services/agent/agentTypes').ExecutionPlan | null>;
  executeTaskPlan?: (
    plan: import('../services/agent/agentTypes').ExecutionPlan,
  ) => Promise<import('../services/agent/agentTypes').ExecutionPlan>;
  approveTaskStep?: (
    planId: string,
    stepId: string,
    approved: boolean,
  ) => Promise<{ success: boolean }>;
  cancelTaskPlan?: (planId: string) => Promise<{ success: boolean }>;
  getTaskPlans?: () => Promise<
    import('../services/agent/agentTypes').ExecutionPlan[]
  >;
  onTaskProgress?: (
    callback: (
      event: import('../services/agent/agentTypes').PlanProgressEvent,
    ) => void,
  ) => () => void;
  // Stage 7: Reminders, Scheduling & Ollama
  createReminder?: (
    text: string,
    minutes?: number,
  ) => Promise<import('../services/scheduler/reminderTypes').ReminderItem>;
  getReminders?: () => Promise<
    import('../services/scheduler/reminderTypes').ReminderItem[]
  >;
  dismissReminder?: (id: string) => Promise<{ success: boolean }>;
  onReminderTriggered?: (
    callback: (
      reminder: import('../services/scheduler/reminderTypes').ReminderItem,
    ) => void,
  ) => () => void;
  validateOllama?: () => Promise<{ valid: boolean; error?: string }>;
  captureScreenAndAnalyze?: (
    prompt?: string,
  ) => Promise<import('../services/tools/toolTypes').ToolExecutionResult>;
}

declare global {
  interface Window {
    jarvisDesktop?: DesktopBridgeAPI;
  }
}
