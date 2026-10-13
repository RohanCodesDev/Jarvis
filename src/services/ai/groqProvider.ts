import { loadSettings } from '../settingsStore';
import {
  type AIModelInfo,
  type AIProvider,
  type AIStreamCallbacks,
  type SendMessageOptions,
  SendMessageOptionsSchema,
} from './types';
import { JARVIS_SYSTEM_PROMPT } from './systemPrompt';

const GROQ_API_BASE = 'https://api.groq.com/openai/v1';

export const GROQ_MODELS: AIModelInfo[] = [
  {
    id: 'openai/gpt-oss-120b',
    name: 'OpenAI GPT-OSS 120B (High Intelligence)',
    isFree: true,
    contextLength: 131072,
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'OpenAI GPT-OSS 20B (Ultra Fast ~1000 t/s)',
    isFree: true,
    contextLength: 131072,
  },
  {
    id: 'qwen/qwen3.8-27b',
    name: 'Qwen 3.8 27B Vision / Reasoning',
    isFree: true,
    contextLength: 131072,
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    isFree: true,
    contextLength: 128000,
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile',
    isFree: true,
    contextLength: 128000,
  },
  {
    id: 'deepseek-r1-distill-llama-70b',
    name: 'DeepSeek R1 Distill Llama 70B',
    isFree: true,
    contextLength: 128000,
  },
  {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B (MoE 32k)',
    isFree: true,
    contextLength: 32768,
  },
];

export class GroqProvider implements AIProvider {
  public readonly name = 'groq';
  private getApiKey: () => string | null;

  constructor(apiKeyProvider: () => string | null) {
    this.getApiKey = apiKeyProvider;
  }

  async validateKey(key: string): Promise<{ valid: boolean; error?: string }> {
    if (!key || !key.trim()) {
      return { valid: false, error: 'Groq API key cannot be empty' };
    }

    try {
      const response = await fetch(`${GROQ_API_BASE}/models`, {
        headers: {
          Authorization: `Bearer ${key.trim()}`,
        },
      });

      if (response.ok) return { valid: true };
      if (response.status === 401) {
        return { valid: false, error: 'Invalid Groq API key' };
      }
      return { valid: false, error: `Groq returned status ${response.status}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { valid: false, error: `Connection failed: ${msg}` };
    }
  }

  async getModels(): Promise<AIModelInfo[]> {
    const key = this.getApiKey();
    if (!key) return GROQ_MODELS;

    try {
      const response = await fetch(`${GROQ_API_BASE}/models`, {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      });

      if (!response.ok) return GROQ_MODELS;

      const data = (await response.json()) as {
        data?: Array<{ id: string; active?: boolean; context_window?: number }>;
      };

      if (!Array.isArray(data.data) || data.data.length === 0)
        return GROQ_MODELS;

      // Filter for chat-capable models (ignore whisper audio, guard, orpheus TTS)
      const chatModels = data.data
        .filter((m) => {
          const id = m.id.toLowerCase();
          return (
            !id.includes('whisper') &&
            !id.includes('guard') &&
            !id.includes('orpheus') &&
            (m.active === undefined || m.active === true)
          );
        })
        .map((m) => ({
          id: m.id,
          name: `${m.id}`,
          isFree: true,
          contextLength: m.context_window || 128000,
        }));

      if (chatModels.length > 0) {
        return chatModels;
      }
      return GROQ_MODELS;
    } catch {
      return GROQ_MODELS;
    }
  }

  async sendMessage(
    options: SendMessageOptions,
    callbacks: AIStreamCallbacks,
  ): Promise<void> {
    const validated = SendMessageOptionsSchema.safeParse(options);
    if (!validated.success) {
      callbacks.onError(
        `Invalid request: ${validated.error.issues.map((i) => i.message).join(', ')}`,
      );
      return;
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      callbacks.onError(
        'Groq API key is not configured. Please add your Groq key in Settings.',
      );
      return;
    }

    let model = options.model?.trim();
    if (!model || model.includes('/')) {
      const settings = loadSettings();
      model = settings.groqModel || 'openai/gpt-oss-120b';
    }
    const temperature = options.temperature ?? 0.7;

    let finalSystemPrompt = JARVIS_SYSTEM_PROMPT;
    if (options.searchContext) {
      finalSystemPrompt += `\n\n${options.searchContext}`;
    }

    const nonSystemMessages = options.messages.filter(
      (m) => m.role !== 'system',
    );
    const messages = [
      {
        role: 'system' as const,
        content: finalSystemPrompt,
      },
      ...nonSystemMessages,
    ];

    let response: Response;
    try {
      response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          temperature,
        }),
        signal: options.signal,
      });
    } catch (err: unknown) {
      if (options.signal?.aborted) {
        callbacks.onError('Request cancelled by user');
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      callbacks.onError(`Network connection failed: ${msg}`);
      return;
    }

    if (!response.ok) {
      let detail = '';
      try {
        const errJson = (await response.json()) as {
          error?: { message?: string };
        };
        detail = errJson.error?.message || '';
      } catch {
        detail = await response.text().catch(() => '');
      }

      // If 404: model not found or account doesn't have access.
      // Dynamically query live models on this key and auto-switch to an active one!
      if (response.status === 404) {
        try {
          const liveModels = await this.getModels();
          const candidate = liveModels.find((m) => m.id !== model);
          if (candidate) {
            console.warn(
              `[GroqProvider] Model "${model}" not found (404). Live models on this key: [${liveModels.map((m) => m.id).join(', ')}]. Auto-switching to "${candidate.id}".`,
            );
            return this.sendMessage(
              { ...options, model: candidate.id },
              callbacks,
            );
          } else {
            callbacks.onError(
              `Groq error (404): Model "${model}" is unavailable on this account. Active models: ${liveModels.map((m) => m.id).join(', ') || 'none found'}.`,
            );
            return;
          }
        } catch {
          // If live fetch fails, fall through to default error
        }
      }

      callbacks.onError(
        `Groq error (${response.status}): ${detail || response.statusText}`,
      );
      return;
    }

    if (!response.body) {
      callbacks.onError('Response stream unavailable.');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullResponse = '';

    try {
      while (true) {
        if (options.signal?.aborted) {
          reader.cancel().catch(() => {});
          callbacks.onError('Request cancelled by user');
          return;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') {
            callbacks.onDone(fullResponse, { model });
            return;
          }

          try {
            const parsed = JSON.parse(dataStr) as {
              choices?: Array<{
                delta?: { content?: string };
              }>;
            };

            const deltaContent = parsed.choices?.[0]?.delta?.content;
            if (deltaContent) {
              fullResponse += deltaContent;
              callbacks.onChunk(deltaContent);
            }
          } catch {}
        }
      }

      callbacks.onDone(fullResponse, { model });
    } catch (err: unknown) {
      if (options.signal?.aborted) {
        callbacks.onError('Request cancelled');
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        callbacks.onError(`Stream read error: ${msg}`);
      }
    }
  }
}
