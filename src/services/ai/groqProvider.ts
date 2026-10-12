import {
  type AIModelInfo,
  type AIProvider,
  type AIStreamCallbacks,
  type SendMessageOptions,
  SendMessageOptionsSchema,
} from './types';

const GROQ_API_BASE = 'https://api.groq.com/openai/v1';

export const GROQ_MODELS: AIModelInfo[] = [
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile (Free Tier)',
    isFree: true,
    contextLength: 128000,
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant (Free Tier)',
    isFree: true,
    contextLength: 128000,
  },
  {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B (Free Tier)',
    isFree: true,
    contextLength: 32768,
  },
];

const JARVIS_SYSTEM_PROMPT = `You are JARVIS, an intelligent AI desktop assistant running natively on Windows 11.
Persona and Instructions:
- Sharp, composed, insightful, and authoritative.
- Speak in natural, sophisticated English. Avoid generic canned bot greetings.
- Deliver direct, high-value explanations and responses.
- Structure responses clearly with concise points when appropriate for a modern tactical terminal HUD.`;

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
    return GROQ_MODELS;
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

    const model = options.model?.trim() || 'llama-3.3-70b-versatile';
    const temperature = options.temperature ?? 0.7;

    const messages = [...options.messages];
    if (!messages.some((m) => m.role === 'system')) {
      messages.unshift({
        role: 'system',
        content: JARVIS_SYSTEM_PROMPT,
      });
    }

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
