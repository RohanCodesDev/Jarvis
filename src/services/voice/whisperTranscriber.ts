import { getApiKey, getGroqKey } from '../secretStore';

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
    const groqKey = getGroqKey() || (key?.startsWith('gsk_') ? key : null);

    // 1. Prioritize Groq Free Whisper API when configured
    if (groqKey) {
      try {
        const binary = Buffer.from(params.base64Audio, 'base64');
        const blob = new Blob([binary], { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', blob, 'audio.webm');
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
