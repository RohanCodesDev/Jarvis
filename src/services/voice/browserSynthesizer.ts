import { type ISpeechSynthesizer, type SpeechSynthesisOptions } from './types';

function detectScriptLanguage(text: string): string {
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text)) return 'ar';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';
  if (/[\u3040-\u30FF]/.test(text)) return 'ja';
  if (/[\u0400-\u04FF]/.test(text)) return 'ru';
  return 'en';
}

export class BrowserSpeechSynthesizer implements ISpeechSynthesizer {
  private _isSpeaking = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];

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
   * Select a preferred voice based on gender and language.
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

    // Do NOT force an English voice on non-English scripts if no matching voice is installed
    return null;
  }

  /**
   * Clean text for natural pronunciation (remove markdown asterisks, hashes, code ticks).
   */
  private sanitizeForSpeech(text: string): string {
    return text
      .replace(/[*_#`~[\]]/g, ' ')
      .replace(/https?:\/\/\S+/g, 'link')
      .replace(/\s+/g, ' ')
      .trim();
  }

  public speak(
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

    this.stop();

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {}

    const clean = this.sanitizeForSpeech(text);
    if (!clean) {
      onEnd?.();
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(clean);
      this.currentUtterance = utterance;

      const detectedLang = detectScriptLanguage(clean);
      const targetLang =
        options?.lang || (detectedLang !== 'en' ? detectedLang : 'en');
      utterance.lang =
        targetLang === 'ar'
          ? 'ar-SA'
          : targetLang === 'hi'
            ? 'hi-IN'
            : targetLang === 'en'
              ? 'en-US'
              : targetLang;

      const voice = this.pickVoice(options?.voiceGender || 'male', targetLang);
      if (voice) {
        utterance.voice = voice;
      }

      utterance.rate = options?.rate ?? 1.05;
      utterance.pitch = options?.pitch ?? 0.96;
      utterance.volume = options?.volume ?? 1.0;

      utterance.onstart = () => {
        this._isSpeaking = true;
      };

      utterance.onend = () => {
        this._isSpeaking = false;
        this.currentUtterance = null;
        onEnd?.();
      };

      utterance.onerror = (e) => {
        this._isSpeaking = false;
        this.currentUtterance = null;
        try {
          window.speechSynthesis.cancel();
        } catch {}
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          onError?.(`Speech synthesis error: ${e.error}`);
        }
        onEnd?.();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err: unknown) {
      this._isSpeaking = false;
      this.currentUtterance = null;
      try {
        window.speechSynthesis.cancel();
      } catch {}
      const msg = err instanceof Error ? err.message : String(err);
      onError?.(`Failed to initiate speech: ${msg}`);
      onEnd?.();
    }
  }

  public stop(): void {
    this._isSpeaking = false;
    this.currentUtterance = null;
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }
}
