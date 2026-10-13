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
    },
    onChunk: (event: ChatStreamChunkEvent) => void,
  ) => () => void;
  cancelChatMessage: (streamId: string) => Promise<void>;
  onActivityEvent?: (callback: (item: ActivityItem) => void) => () => void;
  transcribeAudio: (params: {
    base64Audio: string;
    format?: string;
  }) => Promise<{ text: string; source: 'whisper' | 'mock'; error?: string }>;
}

declare global {
  interface Window {
    jarvisDesktop?: DesktopBridgeAPI;
  }
}
