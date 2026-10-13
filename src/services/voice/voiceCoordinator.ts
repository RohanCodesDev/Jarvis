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

export interface StreamingSpeechHandle {
  feedChunk: (chunk: string) => void;
  finish: () => void;
  cancel: () => void;
}

const COMMON_ABBREVIATIONS = new Set([
  'mr.',
  'mrs.',
  'ms.',
  'dr.',
  'prof.',
  'sr.',
  'jr.',
  'vs.',
  'etc.',
  'approx.',
  'e.g.',
  'i.e.',
]);

/**
 * Tokenize next complete sentence from an incoming streaming text buffer.
 */
export function splitNextSentence(
  buffer: string,
  isFinal = false,
): { sentence: string; remainder: string } | null {
  for (let i = 0; i < buffer.length; i++) {
    const ch = buffer[i];
    const isPunct = ch === '.' || ch === '!' || ch === '?';
    const isDoubleNewline = ch === '\n' && buffer[i + 1] === '\n';

    if (isPunct || isDoubleNewline) {
      const nextChar = buffer[i + 1];
      const isBoundary = nextChar === undefined ? isFinal : /\s/.test(nextChar);

      if (isBoundary) {
        const candidate = buffer.slice(0, i + (isPunct ? 1 : 0)).trim();
        if (candidate.length === 0) continue;
        const words = candidate.split(/\s+/);
        const lastWord = words[words.length - 1].toLowerCase();

        const isDecimal = /\d\.\d*$/.test(
          buffer.slice(Math.max(0, i - 2), i + 2),
        );
        const isAbbrev = COMMON_ABBREVIATIONS.has(lastWord);

        if (!isDecimal && !isAbbrev) {
          const sentence = candidate;
          const remainder = buffer.slice(i + 1).trimStart();
          return { sentence, remainder };
        }
      }
    }
  }

  if (isFinal && buffer.trim().length > 0) {
    return { sentence: buffer.trim(), remainder: '' };
  }
  return null;
}

export class VoiceCoordinator {
  private recognizer: ISpeechRecognizer;
  private synthesizer: ISpeechSynthesizer;
  private state: VoiceState = 'idle';
  private activeStreamingHandle: StreamingSpeechHandle | null = null;

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
    this.halt();

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
   * Begin pipelined streaming speech. Speaks sentence-by-sentence as tokens stream from the LLM.
   */
  public startStreamingSpeech(
    callbacks: Pick<VoiceCoordinatorCallbacks, 'onStateChange' | 'onError'>,
    options?: SpeechSynthesisOptions,
    onComplete?: () => void,
  ): StreamingSpeechHandle {
    this.halt();

    this.state = 'speaking';
    callbacks.onStateChange('speaking');

    let buffer = '';
    let isCancelled = false;

    const handleComplete = () => {
      if (isCancelled) return;
      this.state = 'idle';
      this.activeStreamingHandle = null;
      callbacks.onStateChange('idle');
      onComplete?.();
    };

    const feedSentence = (sentence: string) => {
      if (isCancelled || !sentence.trim()) return;
      if (this.synthesizer.enqueueSentence) {
        this.synthesizer.enqueueSentence(sentence, options, undefined, (err) =>
          callbacks.onError(err),
        );
      } else {
        this.synthesizer.speak(sentence, options);
      }
    };

    const handle: StreamingSpeechHandle = {
      feedChunk: (chunk: string) => {
        if (isCancelled) return;
        buffer += chunk;
        let res: { sentence: string; remainder: string } | null;
        while ((res = splitNextSentence(buffer, false))) {
          feedSentence(res.sentence);
          buffer = res.remainder;
        }
      },
      finish: () => {
        if (isCancelled) return;
        let res: { sentence: string; remainder: string } | null;
        while ((res = splitNextSentence(buffer, true))) {
          feedSentence(res.sentence);
          buffer = res.remainder;
          if (!buffer) break;
        }
        buffer = '';
        if (this.synthesizer.finishQueue) {
          this.synthesizer.finishQueue(handleComplete);
        } else {
          handleComplete();
        }
      },
      cancel: () => {
        isCancelled = true;
        buffer = '';
        this.synthesizer.stop();
        this.state = 'idle';
        this.activeStreamingHandle = null;
        callbacks.onStateChange('idle');
      },
    };

    this.activeStreamingHandle = handle;
    return handle;
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
   * Halt all audio: stop listening, stop speaking immediately, cancel streams.
   */
  public halt(
    callbacks?: Pick<VoiceCoordinatorCallbacks, 'onStateChange'>,
  ): void {
    if (this.activeStreamingHandle) {
      this.activeStreamingHandle.cancel();
      this.activeStreamingHandle = null;
    }
    this.recognizer.abort();
    this.synthesizer.stop();
    this.state = 'idle';
    callbacks?.onStateChange('idle');
  }
}
