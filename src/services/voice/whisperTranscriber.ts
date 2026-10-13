import { getApiKey, getGroqKey, sanitizeApiKey } from '../secretStore';

export interface TranscribeAudioParams {
  base64Audio: string;
  format?: string;
}

export interface TranscribeAudioResult {
  text: string;
  source: 'whisper' | 'mock';
  error?: string;
}

export class WhisperTranscriber {
  private getApiKey: () => string | null;

  constructor(keyProvider: () => string | null = () => getApiKey()) {
    this.getApiKey = keyProvider;
  }

  /**
   * Transcribe recorded audio using Groq Free Whisper, OpenRouter Whisper, or fallback.
   */
  public async transcribe(
    params: TranscribeAudioParams,
  ): Promise<TranscribeAudioResult> {
    const key = this.getApiKey();
    const rawGroqKey = getGroqKey();
    const candidate = rawGroqKey || (key?.startsWith('gsk_') ? key : null);
    const groqKey = candidate ? sanitizeApiKey(candidate) : null;

    // 1. Prioritize Groq Free Whisper API when a valid gsk_ key is configured
    if (groqKey && groqKey.startsWith('gsk_')) {
      try {
        const binary = Buffer.from(params.base64Audio, 'base64');
        if (binary.length < 500) {
          return {
            text: '',
            source: 'whisper',
            error:
              'Audio recording was too brief or silent. Please speak your directive clearly.',
          };
        }

        const format = params.format || 'wav';
        const fileName = `audio.${format}`;
        const mimeType =
          format === 'wav'
            ? 'audio/wav'
            : format === 'ogg'
              ? 'audio/ogg'
              : 'audio/webm';

        const fileObj =
          typeof File !== 'undefined'
            ? new File([binary], fileName, { type: mimeType })
            : new Blob([binary], { type: mimeType });

        const formData = new FormData();
        formData.append('file', fileObj, fileName);
        formData.append('model', 'whisper-large-v3-turbo');

        const groqRes = await fetch(
          'https://api.groq.com/openai/v1/audio/transcriptions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${groqKey}`,
            },
            body: formData,
          },
        );

        if (groqRes.ok) {
          const json = (await groqRes.json()) as { text?: string };
          return {
            text: json.text?.trim() || '',
            source: 'whisper',
          };
        } else {
          const errDetail = await groqRes.text().catch(() => '');
          if (groqRes.status === 401) {
            return {
              text: '',
              source: 'whisper',
              error:
                'Groq rejected the API key (401 Invalid Key). Please check console.groq.com/keys and update your key in Settings.',
            };
          }
          if (groqRes.status === 400) {
            return {
              text: '',
              source: 'whisper',
              error:
                'Audio capture was too brief or noisy to transcribe. Please speak clearly into the microphone.',
            };
          }
          return {
            text: '',
            source: 'whisper',
            error: `Groq Whisper failed (${groqRes.status}): ${errDetail}`,
          };
        }
      } catch (groqErr) {
        console.warn('[Whisper] Groq STT error:', groqErr);
      }
    }

    if (!key) {
      // Mock / Offline fallback when no key is configured
      return {
        text: 'Run complete desktop telemetry diagnostics',
        source: 'mock',
      };
    }

    const format = params.format || 'webm';

    try {
      const response = await fetch(
        'https://openrouter.ai/api/v1/audio/transcriptions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'HTTP-Referer': 'https://github.com/RohanCodesDev/Jarvis',
            'X-Title': 'JARVIS Desktop',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai/whisper-large-v3',
            input_audio: {
              data: params.base64Audio,
              format,
            },
          }),
        },
      );

      if (!response.ok) {
        if (response.status === 402) {
          return {
            text: '',
            source: 'whisper',
            error:
              'OpenRouter audio requires at least $0.50 credit balance on your account. Text chat remains free with your chosen model!',
          };
        }

        const errorText = await response.text().catch(() => '');
        return {
          text: '',
          source: 'whisper',
          error: `Whisper transcription failed (${response.status}): ${errorText || response.statusText}`,
        };
      }

      const json = (await response.json()) as { text?: string };
      const text = json.text?.trim() || '';

      return {
        text,
        source: 'whisper',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        text: '',
        source: 'whisper',
        error: `Transcription network error: ${msg}`,
      };
    }
  }
}

export const whisperTranscriber = new WhisperTranscriber();
