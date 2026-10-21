import { z } from 'zod';

export interface AIMessageContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | AIMessageContentPart[];
  imageUrl?: string;
}

export interface AIStreamCallbacks {
  onChunk: (chunk: string) => void;
  onDone: (
    fullResponse: string,
    metadata?: { model?: string; tokens?: number },
  ) => void;
  onError: (error: string) => void;
}

export interface SendMessageOptions {
  messages: AIMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  searchContext?: string;
  screenCaptureDataUrl?: string;
  signal?: AbortSignal;
}

export interface AIModelInfo {
  id: string;
  name: string;
  contextLength?: number;
  isFree?: boolean;
}

export interface AIProvider {
  name: string;
  sendMessage(
    options: SendMessageOptions,
    callbacks: AIStreamCallbacks,
  ): Promise<void>;
  validateKey(key: string): Promise<{ valid: boolean; error?: string }>;
  getModels(): Promise<AIModelInfo[]>;
}

// Zod validation schemas
export const AIMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.union([
    z.string().min(1, 'Message content cannot be empty'),
    z.array(z.any()),
  ]),
  imageUrl: z.string().optional(),
});

export const SendMessageOptionsSchema = z.object({
  messages: z.array(AIMessageSchema).min(1, 'At least one message is required'),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  searchContext: z.string().optional(),
  screenCaptureDataUrl: z.string().optional(),
});
