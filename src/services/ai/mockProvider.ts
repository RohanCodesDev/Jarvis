import {
  type AIModelInfo,
  type AIProvider,
  type AIStreamCallbacks,
  type SendMessageOptions,
} from './types';

export class MockAIProvider implements AIProvider {
  public readonly name = 'mock';

  async validateKey(_key: string): Promise<{ valid: boolean; error?: string }> {
    return { valid: true };
  }

  async getModels(): Promise<AIModelInfo[]> {
    return [
      {
        id: 'jarvis-mock-neural-core',
        name: 'JARVIS Local Simulated Core',
        isFree: true,
      },
    ];
  }

  async sendMessage(
    options: SendMessageOptions,
    callbacks: AIStreamCallbacks,
  ): Promise<void> {
    const lastMsg = options.messages[options.messages.length - 1];
    const userQuery = lastMsg ? lastMsg.content.toLowerCase() : '';

    let reply =
      'Diagnostics normal. Operating in simulated offline mode. Configure your OpenRouter key in Settings to activate neural cloud processing.';

    if (userQuery.includes('diagnostic') || userQuery.includes('system')) {
      reply =
        'System integrity: 100%. All local telemetry nodes nominal. Latency: 12ms. Standing by for instructions.';
    } else if (userQuery.includes('memory')) {
      reply =
        'Memory stack verified: 0 leaks detected. Buffer allocations healthy across all visual pipelines.';
    } else if (userQuery.includes('security') || userQuery.includes('check')) {
      reply =
        'Security perimeter intact. IPC channels sandboxed, OS-backed keystore active. No anomalies detected.';
    } else if (
      userQuery.includes('who are you') ||
      userQuery.includes('jarvis')
    ) {
      reply =
        'I am JARVIS — your desktop assistant. I stand ready to manage systems, synthesize data, and execute tasks.';
    }

    // Simulate streaming words
    const words = reply.split(' ');
    let accumulated = '';

    for (let i = 0; i < words.length; i++) {
      if (options.signal?.aborted) {
        callbacks.onError('Simulated request cancelled');
        return;
      }
      const token = (i === 0 ? '' : ' ') + words[i];
      accumulated += token;
      callbacks.onChunk(token);
      await new Promise((r) => setTimeout(r, 45));
    }

    callbacks.onDone(accumulated, { model: 'jarvis-mock-neural-core' });
  }
}
