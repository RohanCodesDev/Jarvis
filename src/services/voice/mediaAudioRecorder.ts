export interface RecordedAudioData {
  base64: string;
  format: string;
}

export class MediaAudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private recordedChunks: Blob[] = [];
  private _isRecording = false;

  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== 'undefined'
    );
  }

  public isRecording(): boolean {
    return this._isRecording;
  }

  public async start(): Promise<void> {
    if (!this.isSupported()) {
      throw new Error(
        'MediaRecorder or getUserMedia is not supported in this runtime.',
      );
    }

    this.stopTracks();
    this.recordedChunks = [];

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.audioStream = stream;

    // Determine supported mime type
    let mimeType = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg';
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    this.mediaRecorder = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    recorder.start(100); // 100ms chunks
    this._isRecording = true;
  }

  public async stop(): Promise<RecordedAudioData> {
    if (!this.mediaRecorder || !this._isRecording) {
      this.stopTracks();
      throw new Error('No active recording in progress');
    }

    return new Promise((resolve, reject) => {
      const recorder = this.mediaRecorder!;

      recorder.onstop = async () => {
        try {
          this._isRecording = false;
          const blob = new Blob(this.recordedChunks, {
            type: recorder.mimeType || 'audio/webm',
          });
          this.stopTracks();

          // Convert blob to base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            // Strip data:audio/webm;base64, prefix
            const base64 = dataUrl.includes(',')
              ? dataUrl.split(',')[1]
              : dataUrl;
            resolve({
              base64,
              format: 'webm',
            });
          };
          reader.onerror = (e) => {
            reject(new Error(`Failed to encode audio: ${e}`));
          };
          reader.readAsDataURL(blob);
        } catch (err) {
          this.stopTracks();
          reject(err);
        }
      };

      try {
        recorder.stop();
      } catch (err) {
        this.stopTracks();
        reject(err);
      }
    });
  }

  public cancel(): void {
    this._isRecording = false;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.stopTracks();
    this.recordedChunks = [];
  }

  private stopTracks(): void {
    if (this.audioStream) {
      try {
        this.audioStream.getTracks().forEach((track) => track.stop());
      } catch {}
      this.audioStream = null;
    }
    this.mediaRecorder = null;
  }
}
