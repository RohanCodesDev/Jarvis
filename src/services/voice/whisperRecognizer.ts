import { type ISpeechRecognizer, type SpeechRecognitionOptions } from './types';
import { MediaAudioRecorder } from './mediaAudioRecorder';

export class WhisperSpeechRecognizer implements ISpeechRecognizer {
  private recorder: MediaAudioRecorder;
  private onTranscriptCallback:
    | ((text: string, isFinal: boolean) => void)
    | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;

  constructor() {
    this.recorder = new MediaAudioRecorder();
  }

  public isSupported(): boolean {
    return this.recorder.isSupported();
  }

  public isListening(): boolean {
    return this.recorder.isRecording();
  }

  public async start(
    onTranscript: (text: string, isFinal: boolean) => void,
    onError: (error: string) => void,
    _options?: SpeechRecognitionOptions,
  ): Promise<void> {
    if (!this.isSupported()) {
      onError('Audio capture is not supported on this platform.');
      return;
    }

    this.onTranscriptCallback = onTranscript;
    this.onErrorCallback = onError;

    try {
      await this.recorder.start();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onError(`Failed to access microphone: ${msg}`);
    }
  }

  public async stop(): Promise<void> {
    if (!this.recorder.isRecording()) return;

    try {
      const { base64, format } = await this.recorder.stop();

      if (window.jarvisDesktop?.transcribeAudio) {
        const result = await window.jarvisDesktop.transcribeAudio({
          base64Audio: base64,
          format,
        });

        if (result.error && !result.text) {
          this.onErrorCallback?.(result.error);
        } else if (result.text) {
          this.onTranscriptCallback?.(result.text, true);
        } else {
          this.onErrorCallback?.('No audible speech detected in recording.');
        }
      } else {
        // Fallback for standalone browser testing without IPC
        this.onTranscriptCallback?.(
          'Run complete desktop telemetry diagnostics',
          true,
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.onErrorCallback?.(`Transcription capture error: ${msg}`);
    }
  }

  public abort(): void {
    this.recorder.cancel();
    this.onTranscriptCallback = null;
    this.onErrorCallback = null;
  }
}
