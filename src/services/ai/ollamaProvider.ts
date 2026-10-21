import type {
  AIModelInfo,
  AIProvider,
  SendMessageOptions,
  AIStreamCallbacks,
} from './types';
import { JARVIS_SYSTEM_PROMPT } from './systemPrompt';

export class OllamaProvider implements AIProvider {
  public readonly name = 'ollama';
  private baseUrl: string;

  constructor(baseUrl = 'http://127.0.0.1:11434') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  public async validateKey(
    _key?: string,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        return { valid: true };
      }
      return {
        valid: false,
        error: `Ollama returned HTTP status ${res.status}`,
      };
    } catch {
      return {
        valid: false,
        error: `Could not connect to Ollama server at ${this.baseUrl}. Is Ollama running?`,
      };
    }
  }

  public async getModels(): Promise<AIModelInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          models?: Array<{ name: string; size?: number }>;
        };
        if (json.models && json.models.length > 0) {
          return json.models.map((m) => ({
            id: m.name,
            name: `${m.name} (Local)`,
            isFree: true,
          }));
        }
      }
    } catch {
      // Offline fallback
    }

    return [
      { id: 'llama3:latest', name: 'Llama 3 (Local)', isFree: true },
      { id: 'mistral:latest', name: 'Mistral 7B (Local)', isFree: true },
      { id: 'phi3:mini', name: 'Phi-3 Mini (Local)', isFree: true },
      { id: 'qwen2:latest', name: 'Qwen 2 (Local)', isFree: true },
    ];
  }

  public async sendMessage(
    options: SendMessageOptions,
    callbacks: AIStreamCallbacks,
  ): Promise<void> {
    const model = options.model || 'llama3:latest';

    // Assemble messages with JARVIS persona and search augmentation
    let systemContent = JARVIS_SYSTEM_PROMPT;
    if (options.searchContext) {
      systemContent += `\n\n${options.searchContext}`;
    }

    const messages = [
      { role: 'system', content: systemContent },
      ...options.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          options: {
            temperature: options.temperature ?? 0.6,
          },
        }),
        signal: options.signal,
      });

      if (!response.ok) {
        const errDetail = await response.text().catch(() => '');
        callbacks.onError(
          `Ollama error (${response.status}): ${errDetail || response.statusText}`,
        );
        return;
      }

      if (!response.body) {
        callbacks.onError('Ollama response body is empty.');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const parsed = JSON.parse(trimmed) as {
              message?: { content?: string };
              done?: boolean;
            };

            if (parsed.message?.content) {
              accumulated += parsed.message.content;
              callbacks.onChunk(parsed.message.content);
            }

            if (parsed.done) {
              callbacks.onDone(accumulated, { model });
              return;
            }
          } catch {
            // Ignore partial JSON lines
          }
        }
      }

      callbacks.onDone(accumulated, { model });
    } catch (err: unknown) {
      if (options.signal?.aborted) {
        callbacks.onDone('', { model });
        return;
      }

      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED')) {
        callbacks.onError(
          `Ollama local server is unreachable at ${this.baseUrl}. Please start Ollama ("ollama serve") or switch to OpenRouter/Groq in Settings.`,
        );
      } else {
        callbacks.onError(`Ollama request failed: ${msg}`);
      }
    }
  }
}
