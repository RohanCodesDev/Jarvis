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

export interface JarvisSettings {
  cloudProvider: 'openrouter' | 'ollama';
  openRouterModel: string;
  ollamaModel: string;
  hasApiKey: boolean;
  speechEnabled: boolean;
  voiceGender: 'male' | 'female';
  soundEffects: boolean;
  compactMode: boolean;
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
  getSettings: () => Promise<JarvisSettings>;
  saveSettings: (
    settings: Partial<JarvisSettings>,
  ) => Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    jarvisDesktop?: DesktopBridgeAPI;
  }
}
