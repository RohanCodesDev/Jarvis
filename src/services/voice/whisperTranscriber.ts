import { getApiKey } from '../secretStore';

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
   * Transcribe recorded audio using OpenRouter Whisper or fallback.
   */
  public async transcribe(
    params: TranscribeAudioParams,
  ): Promise<TranscribeAudioResult> {
    const key = this.getApiKey();

    if (!key) {
      // Mock / Offline fallback when API key is not configured
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
