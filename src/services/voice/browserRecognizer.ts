import { type ISpeechRecognizer, type SpeechRecognitionOptions } from './types';

// Ambient types for Web Speech API recognition
interface IWindowWithSpeech extends Window {
  SpeechRecognition?: new () => ISpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => ISpeechRecognitionInstance;
}

interface ISpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
}

interface ISpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
        confidence: number;
      };
    };
  };
}

export class BrowserSpeechRecognizer implements ISpeechRecognizer {
  private recognition: ISpeechRecognitionInstance | null = null;
  private _isListening = false;

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as unknown as IWindowWithSpeech;
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  public isListening(): boolean {
    return this._isListening;
  }

  public async start(
    onTranscript: (text: string, isFinal: boolean) => void,
    onError: (error: string) => void,
    options?: SpeechRecognitionOptions,
  ): Promise<void> {
    if (!this.isSupported()) {
      onError('Speech recognition is not supported in this environment.');
      return;
    }

    // Stop any existing instance
    this.abort();

    try {
      // Warm up microphone permission if mediaDevices is present
      if (
        typeof navigator !== 'undefined' &&
        navigator.mediaDevices?.getUserMedia
      ) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          // Stop track immediately to avoid holding device exclusively
          stream.getTracks().forEach((track) => track.stop());
        } catch (mediaErr: unknown) {
          const msg =
            mediaErr instanceof Error ? mediaErr.message : String(mediaErr);
          onError(`Microphone hardware error: ${msg}`);
          return;
        }
      }

      const win = window as unknown as IWindowWithSpeech;
      const RecognitionClass =
        win.SpeechRecognition || win.webkitSpeechRecognition;
      if (!RecognitionClass) {
        onError('SpeechRecognition constructor unavailable.');
        return;
      }

      const instance = new RecognitionClass();
      instance.continuous = options?.continuous ?? false;
      instance.interimResults = options?.interimResults ?? true;
      instance.lang = options?.lang || 'en-US';

      instance.onresult = (event: ISpeechRecognitionEvent) => {
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          if (!item || !item[0]) continue;
          if (item.isFinal) {
            finalText += item[0].transcript;
          } else {
            interimText += item[0].transcript;
          }
        }

        if (finalText.trim()) {
          onTranscript(finalText.trim(), true);
        } else if (interimText.trim()) {
          onTranscript(interimText.trim(), false);
        }
      };

      instance.onerror = (event: { error: string; message?: string }) => {
        if (event.error === 'no-speech') {
          // Normal timeout when user stays silent
          return;
        }
        if (event.error === 'aborted') {
          return;
        }
        if (event.error === 'not-allowed') {
          onError('Microphone permission denied by Windows system settings.');
          return;
        }
        onError(`Speech recognition error: ${event.error}`);
      };

      instance.onend = () => {
        this._isListening = false;
        this.recognition = null;
      };

      this.recognition = instance;
      this._isListening = true;
      instance.start();
    } catch (err: unknown) {
      this._isListening = false;
      const msg = err instanceof Error ? err.message : String(err);
      onError(`Failed to start speech recognition: ${msg}`);
    }
  }

  public stop(): void {
    if (this.recognition && this._isListening) {
      try {
        this.recognition.stop();
      } catch {}
    }
    this._isListening = false;
  }

  public abort(): void {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
      this.recognition = null;
    }
    this._isListening = false;
  }
}
