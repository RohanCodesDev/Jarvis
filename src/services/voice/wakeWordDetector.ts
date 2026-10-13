/**
 * Hands-Free Wake-Word Detector for J.A.R.V.I.S.
 * Continuously listens in the background for "Hey Jarvis" / "Jarvis" activation
 * and triggers voice interaction without requiring button clicks.
 */

// Ambient types for Web Speech API recognition
interface IWindowWithSpeech extends Window {
  SpeechRecognition?: new () => ISpeechRecognition;
  webkitSpeechRecognition?: new () => ISpeechRecognition;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: ISpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface ISpeechEvent {
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

export interface WakeWordCallbacks {
  onWakeWordDetected: (directive?: string) => void;
  onStatusChange?: (isListening: boolean) => void;
  onError?: (error: string) => void;
}

const WAKE_PATTERNS = [
  /\b(?:hey|hi|ok|okay)\s+jarvis[\s,.:!-]*(.*)$/i,
  /\bjarvis[\s,.:!-]*(.*)$/i,
];

export class WakeWordDetector {
  private recognition: ISpeechRecognition | null = null;
  private isRunning = false;
  private isPaused = false;
  private callbacks: WakeWordCallbacks | null = null;
  private restartTimeout: ReturnType<typeof setTimeout> | null = null;
  private consecutiveErrors = 0;

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as unknown as IWindowWithSpeech;
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  public isActive(): boolean {
    return this.isRunning && !this.isPaused;
  }

  /**
   * Start passive always-on wake-word monitoring.
   */
  public start(callbacks: WakeWordCallbacks): void {
    if (!this.isSupported()) {
      callbacks.onError?.(
        'Speech recognition is not supported in this runtime.',
      );
      return;
    }

    this.callbacks = callbacks;
    this.isRunning = true;
    this.isPaused = false;
    this.consecutiveErrors = 0;

    this.initRecognition();
  }

  /**
   * Pause wake-word listening (e.g. while JARVIS is speaking or thinking).
   */
  public pause(): void {
    this.isPaused = true;
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
    }
    this.callbacks?.onStatusChange?.(false);
  }

  /**
   * Resume passive listening when returning to idle.
   */
  public resume(): void {
    if (!this.isRunning) return;
    this.isPaused = false;
    this.scheduleRestart(200);
  }

  /**
   * Stop wake-word detection completely.
   */
  public stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
      this.recognition = null;
    }
    this.callbacks?.onStatusChange?.(false);
    this.callbacks = null;
  }

  private initRecognition(): void {
    if (!this.isRunning || this.isPaused) return;

    const win = window as unknown as IWindowWithSpeech;
    const RecognitionClass =
      win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!RecognitionClass) return;

    try {
      if (this.recognition) {
        try {
          this.recognition.abort();
        } catch {}
        this.recognition = null;
      }

      const instance = new RecognitionClass();
      instance.continuous = true;
      instance.interimResults = true;
      instance.lang = 'en-US';

      instance.onstart = () => {
        this.consecutiveErrors = 0;
        this.callbacks?.onStatusChange?.(true);
      };

      instance.onresult = (event: ISpeechEvent) => {
        if (this.isPaused || !this.isRunning) return;

        let accumulated = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          if (item && item[0]) {
            accumulated += ' ' + item[0].transcript;
          }
        }

        const trimmed = accumulated.trim();
        if (!trimmed) return;

        for (const pattern of WAKE_PATTERNS) {
          const match = trimmed.match(pattern);
          if (match) {
            const trailing = (match[1] || '').trim();
            // Pause immediately to avoid self-triggering
            this.pause();
            this.callbacks?.onWakeWordDetected(trailing || undefined);
            return;
          }
        }
      };

      instance.onerror = (event: { error: string }) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
        }

        this.consecutiveErrors++;
        if (event.error === 'not-allowed') {
          this.callbacks?.onError?.(
            'Microphone access denied for wake-word sentinel.',
          );
          this.stop();
          return;
        }

        // Backoff restart on repeated errors
        const delay = Math.min(
          1000 * Math.pow(1.5, this.consecutiveErrors),
          8000,
        );
        this.scheduleRestart(delay);
      };

      instance.onend = () => {
        this.callbacks?.onStatusChange?.(false);
        if (this.isRunning && !this.isPaused) {
          this.scheduleRestart(350);
        }
      };

      this.recognition = instance;
      instance.start();
    } catch (err: unknown) {
      console.warn('[WakeWordDetector] Start error:', err);
      this.scheduleRestart(2000);
    }
  }

  private scheduleRestart(delayMs: number): void {
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
    }
    if (!this.isRunning || this.isPaused) return;

    this.restartTimeout = setTimeout(() => {
      this.restartTimeout = null;
      if (this.isRunning && !this.isPaused) {
        this.initRecognition();
      }
    }, delayMs);
  }
}

export const wakeWordDetector = new WakeWordDetector();
