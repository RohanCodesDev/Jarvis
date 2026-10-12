import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AIMessageSchema,
  SendMessageOptionsSchema,
} from '../src/services/ai/types';
import {
  OpenRouterProvider,
  CURATED_MODELS,
} from '../src/services/ai/openrouterProvider';
import { MockAIProvider } from '../src/services/ai/mockProvider';
import { AIManager } from '../src/services/ai/aiManager';

describe('Stage 2: AI Engine - Validation Schemas', () => {
  it('validates correct AI messages', () => {
    const valid = AIMessageSchema.safeParse({
      role: 'user',
      content: 'Run diagnostics',
    });
    expect(valid.success).toBe(true);
  });

  it('rejects empty message content', () => {
    const invalid = AIMessageSchema.safeParse({
      role: 'user',
      content: '',
    });
    expect(invalid.success).toBe(false);
  });

  it('validates SendMessageOptions with multiple messages', () => {
    const valid = SendMessageOptionsSchema.safeParse({
      messages: [
        { role: 'system', content: 'You are JARVIS' },
        { role: 'user', content: 'Status report' },
      ],
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      temperature: 0.7,
    });
    expect(valid.success).toBe(true);
  });

  it('rejects SendMessageOptions with empty messages array', () => {
    const invalid = SendMessageOptionsSchema.safeParse({
      messages: [],
    });
    expect(invalid.success).toBe(false);
  });
});

describe('Stage 2: AI Engine - OpenRouterProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns curated models list', async () => {
    const provider = new OpenRouterProvider(() => null);
    const models = await provider.getModels();
    expect(models.length).toBeGreaterThanOrEqual(CURATED_MODELS.length);
    expect(models.some((m) => m.id.includes('llama-3.3'))).toBe(true);
  });

  it('calls onError if API key is not configured', async () => {
    const provider = new OpenRouterProvider(() => null);
    const onChunk = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    await provider.sendMessage(
      {
        messages: [{ role: 'user', content: 'Hello' }],
      },
      { onChunk, onDone, onError },
    );

    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining('OpenRouter API key is not configured'),
    );
    expect(onChunk).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('handles 401 authentication failure gracefully', async () => {
    const provider = new OpenRouterProvider(() => 'sk-or-invalid-key');
    const onChunk = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: { message: 'Invalid API key' } }),
    });

    await provider.sendMessage(
      {
        messages: [{ role: 'user', content: 'Ping' }],
      },
      { onChunk, onDone, onError },
    );

    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining('Authentication failed (401)'),
    );
  });

  it('handles 429 rate limit errors without crashing', async () => {
    const provider = new OpenRouterProvider(() => 'sk-or-valid-key');
    const onChunk = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({ error: { message: 'Rate limit exceeded' } }),
    });

    await provider.sendMessage(
      {
        messages: [{ role: 'user', content: 'Ping' }],
      },
      { onChunk, onDone, onError },
    );

    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining('Rate limit exceeded (429)'),
    );
  });

  it('streams SSE chunks correctly and signals done', async () => {
    const provider = new OpenRouterProvider(() => 'sk-or-mock-key');
    const onChunk = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"Tactical "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"telemetry "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"online."}}]}\n\n',
      'data: [DONE]\n\n',
    ];

    const encoder = new TextEncoder();
    let chunkIndex = 0;
    const mockStream = {
      getReader: () => ({
        read: async () => {
          if (chunkIndex < sseChunks.length) {
            const val = encoder.encode(sseChunks[chunkIndex++]);
            return { done: false, value: val };
          }
          return { done: true, value: undefined };
        },
        cancel: async () => {},
      }),
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: mockStream,
    });

    await provider.sendMessage(
      {
        messages: [{ role: 'user', content: 'Report' }],
      },
      { onChunk, onDone, onError },
    );

    expect(onChunk).toHaveBeenCalledWith('Tactical ');
    expect(onChunk).toHaveBeenCalledWith('telemetry ');
    expect(onChunk).toHaveBeenCalledWith('online.');
    expect(onDone).toHaveBeenCalledWith('Tactical telemetry online.', {
      model: expect.any(String),
    });
    expect(onError).not.toHaveBeenCalled();
  });
});

describe('Stage 2: AI Engine - MockAIProvider', () => {
  it('streams simulated response tokens for offline mode', async () => {
    const provider = new MockAIProvider();
    const onChunk = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    await provider.sendMessage(
      {
        messages: [{ role: 'user', content: 'system diagnostics' }],
      },
      { onChunk, onDone, onError },
    );

    expect(onChunk).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith(
      expect.stringContaining('System integrity: 100%'),
      { model: 'jarvis-mock-neural-core' },
    );
    expect(onError).not.toHaveBeenCalled();
  });
});

describe('Stage 2: AI Engine - AIManager Orchestration', () => {
  it('selects mock provider when no API key is present', () => {
    const manager = new AIManager();
    const provider = manager.getActiveProvider();
    expect(provider.name).toBe('mock');
  });

  it('cancels active streams upon request', async () => {
    const manager = new AIManager();
    const streamId = 'stream-test-cancel';
    const onChunk = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    // Start streaming and cancel immediately
    const promise = manager.streamChat(
      streamId,
      {
        messages: [{ role: 'user', content: 'Run long diagnostics' }],
      },
      onChunk,
      onDone,
      onError,
    );

    manager.cancelStream(streamId);
    await promise;

    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/cancelled/i));
  });
});
