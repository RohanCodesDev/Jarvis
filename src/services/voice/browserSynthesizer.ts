import { type ISpeechSynthesizer, type SpeechSynthesisOptions } from './types';

function detectScriptLanguage(text: string): string {
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text)) return 'ar';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';
  if (/[\u3040-\u30FF]/.test(text)) return 'ja';
  if (/[\u0400-\u04FF]/.test(text)) return 'ru';
  return 'en';
}

interface QueuedUtterance {
  text: string;
  options?: SpeechSynthesisOptions;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

export class BrowserSpeechSynthesizer implements ISpeechSynthesizer {
  private _isSpeaking = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private queue: QueuedUtterance[] = [];
  private isQueueProcessing = false;
  private queueCompleteCallback: (() => void) | null = null;
  private isQueueFinished = false;
  private watchdogTimeout: number | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
          this.loadVoices();
        };
      }
    }
  }

  private loadVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      this.voices = window.speechSynthesis.getVoices();
    } catch {
      this.voices = [];
    }
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public isSpeaking(): boolean {
    return (
      this._isSpeaking ||
      (this.isSupported() && window.speechSynthesis.speaking)
    );
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (this.voices.length === 0) {
      this.loadVoices();
    }
    return this.voices;
  }

  /**
   * Select a preferred voice with priority given to Windows 11 Natural / Neural voices.
   */
  private pickVoice(
    gender: 'male' | 'female' = 'male',
    lang = 'en',
  ): SpeechSynthesisVoice | null {
    const list = this.getVoices();
    if (!list || list.length === 0) return null;

    const langMatches = list.filter((v) =>
      v.lang.toLowerCase().startsWith(lang.toLowerCase()),
    );
    if (langMatches.length > 0) {
      if (gender === 'male') {
        const maleNames = [
          'george',
          'david',
          'oliver',
          'guy',
          'ryan',
          'male',
          'mark',
          'daniel',
          'naayf',
          'tarik',
        ];

        // 1. Prioritize Windows 11 Natural / Neural / Online voices for cinematic voice quality
        const naturalMatch = langMatches.find((v) => {
          const n = v.name.toLowerCase();
          const isNatural =
            n.includes('natural') ||
            n.includes('online') ||
            n.includes('neural');
          return isNatural && maleNames.some((name) => n.includes(name));
        });
        if (naturalMatch) return naturalMatch;

        // 2. Standard installed male voices
        const match = langMatches.find((v) =>
          maleNames.some((name) => v.name.toLowerCase().includes(name)),
        );
        if (match) return match;
      } else {
        const femaleNames = [
          'zira',
          'hazel',
          'samantha',
          'susan',
          'catherine',
          'jenny',
          'female',
          'aria',
          'hoda',
          'salma',
        ];

        const naturalMatch = langMatches.find((v) => {
          const n = v.name.toLowerCase();
          const isNatural =
            n.includes('natural') ||
            n.includes('online') ||
            n.includes('neural');
          return isNatural && femaleNames.some((name) => n.includes(name));
        });
        if (naturalMatch) return naturalMatch;

        const match = langMatches.find((v) =>
          femaleNames.some((name) => v.name.toLowerCase().includes(name)),
        );
        if (match) return match;
      }
      return langMatches[0];
    }

    if (lang === 'en') {
      return list[0] || null;
    }

    return null;
  }

  /**
   * Clean text for acoustic voice delivery (strip markdown code, citations, asterisks, symbols).
   */
  private sanitizeForSpeech(text: string): string {
    return text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(/\[(?:Source\s*\d+|\d+)\]/gi, '')
      .replace(/https?:\/\/\S+/g, 'link')
      .replace(/[*_#~]/g, '')
      .replace(/^[-*•]\s+/gm, '')
      .replace(/&/g, ' and ')
      .replace(/%/g, ' percent ')
      .replace(/\+/g, ' plus ')
      .replace(
        /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
        '',
      )
      .replace(/\s+/g, ' ')
      .trim();
  }

  private clearWatchdog(): void {
    if (this.watchdogTimeout !== null) {
      clearTimeout(this.watchdogTimeout);
      this.watchdogTimeout = null;
    }
  }

  private processNextInQueue(): void {
    if (this.queue.length === 0) {
      this.isQueueProcessing = false;
      this._isSpeaking = false;
      this.currentUtterance = null;
      this.clearWatchdog();

      if (this.isQueueFinished && this.queueCompleteCallback) {
        const cb = this.queueCompleteCallback;
        this.queueCompleteCallback = null;
        this.isQueueFinished = false;
        cb();
      }
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.isQueueProcessing = true;
    this._isSpeaking = true;

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {}

    try {
      const utterance = new SpeechSynthesisUtterance(item.text);
      this.currentUtterance = utterance;

      const detectedLang = detectScriptLanguage(item.text);
      const targetLang =
        item.options?.lang || (detectedLang !== 'en' ? detectedLang : 'en');
      utterance.lang =
        targetLang === 'ar'
          ? 'ar-SA'
          : targetLang === 'hi'
            ? 'hi-IN'
            : targetLang === 'en'
              ? 'en-US'
              : targetLang;

      const voice = this.pickVoice(
        item.options?.voiceGender || 'male',
        targetLang,
      );
      if (voice) {
        utterance.voice = voice;
      }

      utterance.rate = item.options?.rate ?? 1.05;
      utterance.pitch = item.options?.pitch ?? 0.96;
      utterance.volume = item.options?.volume ?? 1.0;

      utterance.onstart = () => {
        this._isSpeaking = true;
      };

      const handleDone = () => {
        this.clearWatchdog();
        item.onEnd?.();
        this.processNextInQueue();
      };

      utterance.onend = handleDone;

      utterance.onerror = (e) => {
        this.clearWatchdog();
        try {
          window.speechSynthesis.cancel();
        } catch {}
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          item.onError?.(`Speech synthesis error: ${e.error}`);
        }
        handleDone();
      };

      // Watchdog timeout to resume if Chromium speech engine gets suspended
      this.watchdogTimeout = window.setTimeout(() => {
        if (
          this._isSpeaking &&
          this.isSupported() &&
          window.speechSynthesis.speaking
        ) {
          try {
            window.speechSynthesis.resume();
          } catch {}
        }
      }, 10000);

      window.speechSynthesis.speak(utterance);
    } catch (err: unknown) {
      this.clearWatchdog();
      const msg = err instanceof Error ? err.message : String(err);
      item.onError?.(`Failed to initiate speech: ${msg}`);
      this.processNextInQueue();
    }
  }

  /**
   * Enqueue a single sentence into the pipelined speech stream.
   */
  public enqueueSentence(
    text: string,
    options?: SpeechSynthesisOptions,
    onEnd?: () => void,
    onError?: (error: string) => void,
  ): void {
    if (!this.isSupported()) {
      onError?.('Speech synthesis is not supported on this device.');
      onEnd?.();
      return;
    }

    const clean = this.sanitizeForSpeech(text);
    if (!clean) {
      onEnd?.();
      return;
    }

    this.queue.push({
      text: clean,
      options,
      onEnd,
      onError,
    });

    if (!this.isQueueProcessing) {
      this.processNextInQueue();
    }
  }

  /**
   * Signal that the streaming LLM response has concluded.
   */
  public finishQueue(onComplete?: () => void): void {
    this.isQueueFinished = true;
    this.queueCompleteCallback = onComplete || null;

    if (!this.isQueueProcessing && this.queue.length === 0) {
      this.queueCompleteCallback = null;
      this.isQueueFinished = false;
      onComplete?.();
    }
  }

  public speak(
    text: string,
    options?: SpeechSynthesisOptions,
    onEnd?: () => void,
    onError?: (error: string) => void,
  ): void {
    this.stop();
    this.enqueueSentence(text, options, undefined, onError);
    this.finishQueue(onEnd);
  }

  public stop(): void {
    this.clearWatchdog();
    this.queue = [];
    this.isQueueProcessing = false;
    this.isQueueFinished = false;
    this.queueCompleteCallback = null;
    this._isSpeaking = false;
    this.currentUtterance = null;
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }
}
