import {
  type AIModelInfo,
  type AIProvider,
  type SendMessageOptions,
} from './types';
import { OpenRouterProvider } from './openrouterProvider';
import { MockAIProvider } from './mockProvider';
import { getApiKey, hasApiKey } from '../secretStore';

export class AIManager {
  private openRouterProvider: OpenRouterProvider;
  private mockProvider: MockAIProvider;
  private activeStreams: Map<string, AbortController> = new Map();

  constructor() {
    this.openRouterProvider = new OpenRouterProvider(() => getApiKey());
    this.mockProvider = new MockAIProvider();
  }

  /**
   * Determine the current provider: OpenRouter if configured, otherwise mock fallback.
   */
  public getActiveProvider(preferMock = false): AIProvider {
    if (preferMock || !hasApiKey()) {
      return this.mockProvider;
    }
    return this.openRouterProvider;
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
   * List available models.
   */
  public async getModels(): Promise<AIModelInfo[]> {
    if (hasApiKey()) {
      return this.openRouterProvider.getModels();
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
