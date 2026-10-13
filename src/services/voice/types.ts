export type VoiceState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error';

export interface SpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

export interface SpeechSynthesisOptions {
  voiceGender?: 'male' | 'female';
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
}

export interface ISpeechRecognizer {
  isSupported(): boolean;
  start(
    onTranscript: (text: string, isFinal: boolean) => void,
    onError: (error: string) => void,
    options?: SpeechRecognitionOptions,
  ): Promise<void>;
  stop(): void;
  abort(): void;
  isListening(): boolean;
}

export interface ISpeechSynthesizer {
  isSupported(): boolean;
  speak(
    text: string,
    options?: SpeechSynthesisOptions,
    onEnd?: () => void,
    onError?: (error: string) => void,
  ): void;
  enqueueSentence?(
    text: string,
    options?: SpeechSynthesisOptions,
    onEnd?: () => void,
    onError?: (error: string) => void,
  ): void;
  finishQueue?(onComplete?: () => void): void;
  stop(): void;
  isSpeaking(): boolean;
  getVoices(): SpeechSynthesisVoice[];
}
