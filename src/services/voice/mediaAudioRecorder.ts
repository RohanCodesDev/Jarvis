export interface RecordedAudioData {
  base64: string;
  format: string;
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = 1;
  const sampleRate = 16000;
  const inputChannel = buffer.getChannelData(0);

  // Resample to 16kHz if needed
  let samples: Float32Array;
  if (buffer.sampleRate === sampleRate) {
    samples = inputChannel;
  } else {
    const ratio = buffer.sampleRate / sampleRate;
    const newLength = Math.round(inputChannel.length / ratio);
    samples = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const originIndex = i * ratio;
      const index = Math.floor(originIndex);
      const frac = originIndex - index;
      const nextIndex = Math.min(index + 1, inputChannel.length - 1);
      samples[i] =
        inputChannel[index] * (1 - frac) + inputChannel[nextIndex] * frac;
    }
  }

  const dataSize = samples.length * 2;
  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  // RIFF chunk
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + dataSize, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // fmt chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true); // 1 channel
  view.setUint32(24, sampleRate, true); // 16000 Hz
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true); // 16-bit

  // data chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return wavBuffer;
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

    // Do NOT pass timeslice — record as single unfragmented container
    recorder.start();
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
          const rawBlob = new Blob(this.recordedChunks, {
            type: recorder.mimeType || 'audio/webm',
          });
          this.stopTracks();

          if (rawBlob.size < 1200) {
            reject(
              new Error(
                'Audio recording was too brief. Please speak your directive clearly.',
              ),
            );
            return;
          }

          // Convert to pristine 16kHz mono WAV for 100% Whisper API compatibility
          let finalBlob = rawBlob;
          let finalFormat = 'webm';

          try {
            const AudioCtxClass =
              window.AudioContext ||
              (window as unknown as { webkitAudioContext: typeof AudioContext })
                .webkitAudioContext;
            if (AudioCtxClass) {
              const audioCtx = new AudioCtxClass();
              const arrayBuf = await rawBlob.arrayBuffer();
              const decoded = await audioCtx.decodeAudioData(arrayBuf);
              await audioCtx.close();

              if (decoded.duration < 0.25) {
                reject(
                  new Error(
                    'Audio recording was too brief. Please speak your directive clearly.',
                  ),
                );
                return;
              }

              const wavBuf = audioBufferToWav(decoded);
              finalBlob = new Blob([wavBuf], { type: 'audio/wav' });
              finalFormat = 'wav';
            }
          } catch (wavErr) {
            console.warn(
              '[MediaRecorder] WAV conversion fallback to raw container:',
              wavErr,
            );
          }

          // Convert finalBlob to base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.includes(',')
              ? dataUrl.split(',')[1]
              : dataUrl;
            resolve({
              base64,
              format: finalFormat,
            });
          };
          reader.onerror = (e) => {
            reject(new Error(`Failed to encode audio: ${e}`));
          };
          reader.readAsDataURL(finalBlob);
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
