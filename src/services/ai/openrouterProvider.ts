import {
  type AIModelInfo,
  type AIProvider,
  type AIStreamCallbacks,
  type SendMessageOptions,
  SendMessageOptionsSchema,
} from './types';

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

export const CURATED_MODELS: AIModelInfo[] = [
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B (Free)',
    isFree: true,
    contextLength: 131072,
  },
  {
    id: 'google/gemini-2.0-flash-lite-preview-02-05:free',
    name: 'Gemini 2.0 Flash Lite (Free)',
    isFree: true,
    contextLength: 1048576,
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3',
    isFree: false,
    contextLength: 64000,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    isFree: false,
    contextLength: 128000,
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    isFree: false,
    contextLength: 200000,
  },
];

const JARVIS_SYSTEM_PROMPT = `You are JARVIS, an intelligent AI desktop assistant running natively on Windows 11.
Persona and Instructions:
- Sharp, composed, insightful, and authoritative.
- Speak in natural, sophisticated English. Avoid generic canned bot greetings like "Hello! How can I help you today?".
- Deliver direct, high-value explanations and responses.
- Structure responses clearly with concise points when appropriate for a modern tactical terminal HUD.
- You have real-time desktop awareness and strive for maximum precision.`;

export class OpenRouterProvider implements AIProvider {
  public readonly name = 'openrouter';
  private getApiKey: () => string | null;

  constructor(apiKeyProvider: () => string | null) {
    this.getApiKey = apiKeyProvider;
  }

  /**
   * Validate an OpenRouter API key without incurring costs.
   */
  async validateKey(key: string): Promise<{ valid: boolean; error?: string }> {
    if (!key || !key.trim()) {
      return { valid: false, error: 'API key cannot be empty' };
    }

    try {
      const response = await fetch(`${OPENROUTER_API_BASE}/auth/key`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${key.trim()}`,
          'HTTP-Referer': 'https://github.com/RohanCodesDev/Jarvis',
          'X-Title': 'JARVIS Desktop',
        },
      });

      if (response.status === 200) {
        return { valid: true };
      }

      if (response.status === 401) {
        return {
          valid: false,
          error:
            'Invalid API key. Please check your credentials on openrouter.ai.',
        };
      }

      const errorText = await response.text().catch(() => '');
      return {
        valid: false,
        error: `OpenRouter returned status ${response.status}: ${errorText || 'Unknown error'}`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        valid: false,
        error: `Network error connecting to OpenRouter: ${msg}`,
      };
    }
  }

  /**
   * Retrieve available models (returns curated list, supplemented by API if available).
   */
  async getModels(): Promise<AIModelInfo[]> {
    const key = this.getApiKey();
    if (!key) {
      return CURATED_MODELS;
    }

    try {
      const response = await fetch(`${OPENROUTER_API_BASE}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${key}`,
          'HTTP-Referer': 'https://github.com/RohanCodesDev/Jarvis',
          'X-Title': 'JARVIS Desktop',
        },
      });

      if (!response.ok) {
        return CURATED_MODELS;
      }

      const data = (await response.json()) as {
        data?: Array<{
          id: string;
          name?: string;
          context_length?: number;
          pricing?: { prompt?: string };
        }>;
      };

      if (!Array.isArray(data.data)) {
        return CURATED_MODELS;
      }

      // Merge curated models with top models from API
      const apiModels: AIModelInfo[] = data.data.slice(0, 30).map((m) => ({
        id: m.id,
        name: m.name || m.id,
        contextLength: m.context_length,
        isFree: m.pricing?.prompt === '0',
      }));

      // Deduplicate
      const map = new Map<string, AIModelInfo>();
      for (const m of CURATED_MODELS) map.set(m.id, m);
      for (const m of apiModels) {
        if (!map.has(m.id)) map.set(m.id, m);
      }

      return Array.from(map.values());
    } catch {
      return CURATED_MODELS;
    }
  }

  /**
   * Stream a chat completion request from OpenRouter.
   */
  async sendMessage(
    options: SendMessageOptions,
    callbacks: AIStreamCallbacks,
  ): Promise<void> {
    // 1. Validate inputs
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
        'OpenRouter API key is not configured. Please open Settings and add your API key.',
      );
      return;
    }

    const model =
      options.model?.trim() || 'meta-llama/llama-3.3-70b-instruct:free';
    const temperature = options.temperature ?? 0.7;

    // 2. Prepare message history with JARVIS system prompt
    const messages = [...options.messages];
    if (!messages.some((m) => m.role === 'system')) {
      messages.unshift({
        role: 'system',
        content: JARVIS_SYSTEM_PROMPT,
      });
    }

    // 3. Initiate streaming request
    let response: Response;
    try {
      response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://github.com/RohanCodesDev/Jarvis',
          'X-Title': 'JARVIS Desktop',
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

    // 4. Handle HTTP status codes gracefully
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

      if (response.status === 401) {
        callbacks.onError(
          `Authentication failed (401): ${detail || 'Invalid OpenRouter API key.'}`,
        );
        return;
      }
      if (response.status === 402) {
        callbacks.onError(
          `Credit limit exceeded (402): ${detail || 'Insufficient credits on OpenRouter.'}`,
        );
        return;
      }
      if (response.status === 429) {
        callbacks.onError(
          `Rate limit exceeded (429): ${detail || 'Too many requests. Please retry in a few seconds.'}`,
        );
        return;
      }
      callbacks.onError(
        `OpenRouter error (${response.status}): ${detail || response.statusText}`,
      );
      return;
    }

    if (!response.body) {
      callbacks.onError('Response stream body unavailable.');
      return;
    }

    // 5. Parse Server-Sent Events stream
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
        buffer = lines.pop() ?? ''; // keep trailing unfinished line

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
                finish_reason?: string;
              }>;
            };

            const deltaContent = parsed.choices?.[0]?.delta?.content;
            if (deltaContent) {
              fullResponse += deltaContent;
              callbacks.onChunk(deltaContent);
            }
          } catch {
            // Ignore unparseable SSE heartbeats / comments
          }
        }
      }

      // Finish when stream closes if no [DONE] token was explicitly received
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
