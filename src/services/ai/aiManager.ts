import {
  type AIModelInfo,
  type AIProvider,
  type SendMessageOptions,
} from './types';
import { OpenRouterProvider } from './openrouterProvider';
import { GroqProvider } from './groqProvider';
import { MockAIProvider } from './mockProvider';
import { getApiKey, hasApiKey, getGroqKey, hasGroqKey } from '../secretStore';
import { loadSettings } from '../settingsStore';

export class AIManager {
  private openRouterProvider: OpenRouterProvider;
  private groqProvider: GroqProvider;
  private mockProvider: MockAIProvider;
  private activeStreams: Map<string, AbortController> = new Map();

  constructor() {
    this.openRouterProvider = new OpenRouterProvider(() => getApiKey());
    this.groqProvider = new GroqProvider(() => getGroqKey());
    this.mockProvider = new MockAIProvider();
  }

  /**
   * Determine the current provider: OpenRouter, Groq, or Mock fallback.
   */
  public getActiveProvider(preferMock = false): AIProvider {
    if (preferMock) return this.mockProvider;

    const settings = loadSettings();
    if (settings.cloudProvider === 'groq' && hasGroqKey()) {
      return this.groqProvider;
    }
    if (hasApiKey()) {
      return this.openRouterProvider;
    }
    if (hasGroqKey()) {
      return this.groqProvider;
    }
    return this.mockProvider;
  }

  /**
   * Validate an API key with the OpenRouter provider.
   */
  public async validateOpenRouterKey(
    key: string,
  ): Promise<{ valid: boolean; error?: string }> {
    return this.openRouterProvider.validateKey(key);
  }

  /**
   * Validate an API key with the Groq provider.
   */
  public async validateGroqKey(
    key: string,
  ): Promise<{ valid: boolean; error?: string }> {
    return this.groqProvider.validateKey(key);
  }

  /**
   * List available models.
   */
  public async getModels(): Promise<AIModelInfo[]> {
    const settings = loadSettings();
    if (settings.cloudProvider === 'groq' && hasGroqKey()) {
      return this.groqProvider.getModels();
    }
    if (hasApiKey()) {
      return this.openRouterProvider.getModels();
    }
    if (hasGroqKey()) {
      return this.groqProvider.getModels();
    }
    return this.mockProvider.getModels();
  }

  /**
   * Stream a conversation message.
   */
  public async streamChat(
    streamId: string,
    options: Omit<SendMessageOptions, 'signal'>,
    onChunk: (chunk: string) => void,
    onDone: (fullResponse: string, metadata?: { model?: string }) => void,
    onError: (error: string) => void,
  ): Promise<void> {
    // Cancel any previous stream with same ID
    this.cancelStream(streamId);

    const controller = new AbortController();
    this.activeStreams.set(streamId, controller);

    const provider = this.getActiveProvider();

    try {
      await provider.sendMessage(
        {
          ...options,
          signal: controller.signal,
        },
        {
          onChunk: (chunk) => {
            if (!controller.signal.aborted) {
              onChunk(chunk);
            }
          },
          onDone: (full, meta) => {
            this.activeStreams.delete(streamId);
            onDone(full, meta);
          },
          onError: (err) => {
            this.activeStreams.delete(streamId);
            onError(err);
          },
        },
      );
    } catch (err: unknown) {
      this.activeStreams.delete(streamId);
      const msg = err instanceof Error ? err.message : String(err);
      onError(msg);
    }
  }

  /**
   * Cancel an in-flight stream.
   */
  public cancelStream(streamId: string): void {
    const controller = this.activeStreams.get(streamId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(streamId);
    }
  }
}

// Global singleton in main process
export const aiManager = new AIManager();
