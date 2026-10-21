import { describe, it, expect, vi } from 'vitest';
import { globalToolRegistry } from '../src/services/tools/toolRegistry';
import { detectDirectIntent } from '../src/services/tools/intentDetector';
import { MockAIProvider } from '../src/services/ai/mockProvider';
import { OpenRouterProvider } from '../src/services/ai/openrouterProvider';
import { GroqProvider } from '../src/services/ai/groqProvider';
import { OllamaProvider } from '../src/services/ai/ollamaProvider';

describe('Multimodal Screen Vision & Desktop Awareness', () => {
  describe('Tool Registry & Screen Vision Tool', () => {
    it('registers the analyze_screen tool with low_risk permission', () => {
      const tool = globalToolRegistry.getTool('analyze_screen');
      expect(tool).toBeDefined();
      expect(tool?.name).toContain('Multimodal Screen Vision');
      expect(tool?.permission).toBe('low_risk');
    });

    it('executes analyze_screen and returns visual frame telemetry', async () => {
      const res = await globalToolRegistry.executeTool('analyze_screen', {
        query: 'Inspect open IDE windows',
      });
      expect(res.success).toBe(true);
      expect(res.message).toContain('Optical receptor scan acquired');
      expect(res.data).toBeDefined();
      expect((res.data as Record<string, unknown>).dataUrl).toBeDefined();
    });
  });

  describe('Vision Intent Detection', () => {
    it('accurately identifies screen vision requests', () => {
      const queries = [
        'look at my screen',
        'JARVIS, what is on my screen right now?',
        'inspect my screen and find the bug',
        'analyze my screen',
        'can you see my screen?',
        'debug this error on my screen',
      ];

      for (const q of queries) {
        const intent = detectDirectIntent(q);
        expect(intent).toBeDefined();
        expect(intent?.toolId).toBe('analyze_screen');
        expect(intent?.confidence).toBe('high');
      }
    });

    it('differentiates screen vision from standard screenshot export', () => {
      const visionIntent = detectDirectIntent('look at my screen');
      expect(visionIntent?.toolId).toBe('analyze_screen');

      const screenshotIntent = detectDirectIntent('take a screenshot');
      expect(screenshotIntent?.toolId).toBe('capture_screen');
    });
  });

  describe('Multimodal AI Providers with Screen Vision', () => {
    it('MockAIProvider returns optical receptor commentary when screenCaptureDataUrl is present', async () => {
      const mock = new MockAIProvider();
      let streamedResponse = '';

      await mock.sendMessage(
        {
          messages: [{ role: 'user', content: 'What is visible?' }],
          screenCaptureDataUrl:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        },
        {
          onChunk: (chunk) => {
            streamedResponse += chunk;
          },
          onDone: (full) => {
            streamedResponse = full;
          },
          onError: () => {},
        },
      );

      expect(streamedResponse).toContain('Optical receptor feed acquired');
      expect(streamedResponse).toContain('Primary display captured');
    });

    it('OpenRouterProvider constructs multimodal image_url payload and auto-routes to vision model', async () => {
      let capturedBody: any = null;
      const fakeFetch = vi
        .fn()
        .mockImplementation(async (_url: string, init: RequestInit) => {
          capturedBody = JSON.parse(init.body as string);
          return {
            ok: true,
            status: 200,
            body: {
              getReader: () => ({
                read: vi
                  .fn()
                  .mockResolvedValueOnce({ done: true, value: undefined }),
              }),
            },
          };
        });
      globalThis.fetch = fakeFetch;

      const provider = new OpenRouterProvider(() => 'sk-or-v1-testkey');
      await provider.sendMessage(
        {
          messages: [{ role: 'user', content: 'Help me debug this error' }],
          screenCaptureDataUrl: 'data:image/png;base64,FAKEDATA',
        },
        {
          onChunk: () => {},
          onDone: () => {},
          onError: () => {},
        },
      );

      expect(capturedBody).toBeDefined();
      expect(capturedBody.model).toContain('vision');
      const userMsg = capturedBody.messages.find((m: any) => m.role === 'user');
      expect(Array.isArray(userMsg.content)).toBe(true);
      expect(userMsg.content[1].type).toBe('image_url');
      expect(userMsg.content[1].image_url.url).toBe(
        'data:image/png;base64,FAKEDATA',
      );
    });

    it('GroqProvider routes to llama-3.2-11b-vision-preview for screen captures', async () => {
      let capturedBody: any = null;
      const fakeFetch = vi
        .fn()
        .mockImplementation(async (_url: string, init: RequestInit) => {
          capturedBody = JSON.parse(init.body as string);
          return {
            ok: true,
            status: 200,
            body: {
              getReader: () => ({
                read: vi
                  .fn()
                  .mockResolvedValueOnce({ done: true, value: undefined }),
              }),
            },
          };
        });
      globalThis.fetch = fakeFetch;

      const provider = new GroqProvider(() => 'gsk_testkey');
      await provider.sendMessage(
        {
          messages: [
            { role: 'user', content: 'Explain the diagram on screen' },
          ],
          screenCaptureDataUrl: 'data:image/png;base64,FAKEDIAGRAM',
        },
        {
          onChunk: () => {},
          onDone: () => {},
          onError: () => {},
        },
      );

      expect(capturedBody).toBeDefined();
      expect(capturedBody.model).toBe('llama-3.2-11b-vision-preview');
      const userMsg = capturedBody.messages.find((m: any) => m.role === 'user');
      expect(Array.isArray(userMsg.content)).toBe(true);
      expect(userMsg.content[1].image_url.url).toBe(
        'data:image/png;base64,FAKEDIAGRAM',
      );
    });

    it('OllamaProvider passes stripped base64 images array in /api/chat payload', async () => {
      let capturedBody: any = null;
      const fakeFetch = vi
        .fn()
        .mockImplementation(async (_url: string, init: RequestInit) => {
          capturedBody = JSON.parse(init.body as string);
          return {
            ok: true,
            status: 200,
            body: {
              getReader: () => ({
                read: vi
                  .fn()
                  .mockResolvedValueOnce({ done: true, value: undefined }),
              }),
            },
          };
        });
      globalThis.fetch = fakeFetch;

      const provider = new OllamaProvider('http://127.0.0.1:11434');
      await provider.sendMessage(
        {
          messages: [{ role: 'user', content: 'Look at this code' }],
          screenCaptureDataUrl: 'data:image/png;base64,RAWBASE64DATA',
        },
        {
          onChunk: () => {},
          onDone: () => {},
          onError: () => {},
        },
      );

      expect(capturedBody).toBeDefined();
      const userMsg = capturedBody.messages.find((m: any) => m.role === 'user');
      expect(userMsg.images).toBeDefined();
      expect(userMsg.images).toEqual(['RAWBASE64DATA']);
    });
  });
});
