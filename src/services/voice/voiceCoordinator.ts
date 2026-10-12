import {
  type ISpeechRecognizer,
  type ISpeechSynthesizer,
  type SpeechRecognitionOptions,
  type SpeechSynthesisOptions,
  type VoiceState,
} from './types';
import { WhisperSpeechRecognizer } from './whisperRecognizer';
import { BrowserSpeechSynthesizer } from './browserSynthesizer';

export interface VoiceCoordinatorCallbacks {
  onStateChange: (state: VoiceState) => void;
  onInterimTranscript?: (text: string) => void;
  onFinalTranscript: (text: string) => void;
  onError: (error: string) => void;
}

export class VoiceCoordinator {
  private recognizer: ISpeechRecognizer;
  private synthesizer: ISpeechSynthesizer;
  private state: VoiceState = 'idle';

  constructor(
    recognizer?: ISpeechRecognizer,
    synthesizer?: ISpeechSynthesizer,
  ) {
    this.recognizer = recognizer || new WhisperSpeechRecognizer();
    this.synthesizer = synthesizer || new BrowserSpeechSynthesizer();
  }

  public getState(): VoiceState {
    return this.state;
  }

  public isRecognitionSupported(): boolean {
    return this.recognizer.isSupported();
  }

  public isSynthesisSupported(): boolean {
    return this.synthesizer.isSupported();
  }

  /**
   * Start listening for voice directives.
   */
  public async startListening(
    callbacks: VoiceCoordinatorCallbacks,
    options?: SpeechRecognitionOptions,
  ): Promise<void> {
    // Stop any ongoing speech playback first
    this.synthesizer.stop();

    this.state = 'listening';
    callbacks.onStateChange('listening');

    await this.recognizer.start(
      (text: string, isFinal: boolean) => {
        if (isFinal) {
          this.state = 'processing';
          callbacks.onStateChange('processing');
          this.recognizer.stop();
          callbacks.onFinalTranscript(text);
        } else {
          callbacks.onInterimTranscript?.(text);
        }
      },
      (error: string) => {
        this.state = 'error';
        callbacks.onStateChange('error');
        callbacks.onError(error);
        setTimeout(() => {
          if (this.state === 'error') {
            this.state = 'idle';
            callbacks.onStateChange('idle');
          }
        }, 3000);
      },
      options,
    );
  }

  /**
   * Stop speech recognition.
   */
  public stopListening(
    callbacks?: Pick<VoiceCoordinatorCallbacks, 'onStateChange'>,
  ): void {
    this.recognizer.stop();
    this.state = 'idle';
    callbacks?.onStateChange('idle');
  }

  /**
   * Speak a text response aloud.
   */
  public speak(
    text: string,
    callbacks: Pick<VoiceCoordinatorCallbacks, 'onStateChange' | 'onError'>,
    options?: SpeechSynthesisOptions,
    onComplete?: () => void,
  ): void {
    if (!text.trim()) {
      onComplete?.();
      return;
    }

    this.state = 'speaking';
    callbacks.onStateChange('speaking');

    this.synthesizer.speak(
      text,
      options,
      () => {
        this.state = 'idle';
        callbacks.onStateChange('idle');
        onComplete?.();
      },
      (err: string) => {
        this.state = 'error';
        callbacks.onStateChange('error');
        callbacks.onError(err);
        onComplete?.();
      },
    );
  }

  /**
   * Halt all audio: stop listening, stop speaking immediately.
   */
  public halt(
    callbacks?: Pick<VoiceCoordinatorCallbacks, 'onStateChange'>,
  ): void {
    this.recognizer.abort();
    this.synthesizer.stop();
    this.state = 'idle';
    callbacks?.onStateChange('idle');
  }
}
