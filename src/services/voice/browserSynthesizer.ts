import { type ISpeechSynthesizer, type SpeechSynthesisOptions } from './types';

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
    const candidates = langMatches.length > 0 ? langMatches : list;

    // Search by typical Windows / Chromium voice names for Stark-like JARVIS or assistant
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
      ];
      const match = candidates.find((v) =>
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
      ];
      const match = candidates.find((v) =>
        femaleNames.some((name) => v.name.toLowerCase().includes(name)),
      );
      if (match) return match;
    }

    return candidates[0] || null;
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

    const clean = this.sanitizeForSpeech(text);
    if (!clean) {
      onEnd?.();
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(clean);
      this.currentUtterance = utterance;

      const voice = this.pickVoice(
        options?.voiceGender || 'male',
        options?.lang || 'en',
      );
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
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          onError?.(`Speech synthesis error: ${e.error}`);
        }
        onEnd?.();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err: unknown) {
      this._isSpeaking = false;
      this.currentUtterance = null;
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
