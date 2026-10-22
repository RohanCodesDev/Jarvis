/**
 * Autonomous Hands-Free Wake-Word Detector for J.A.R.V.I.S.
 * Uses low-overhead Web Audio VAD (Voice Activity Detection) + Groq Whisper
 * to spot "Hey Jarvis" activation without network-blocked SpeechRecognition loops.
 */

export interface WakeWordCallbacks {
  onWakeWordDetected: (directive?: string) => void;
  onError?: (error: string) => void;
}

const WAKE_PATTERNS = [
  /\b(?:hey|hi|ok|okay)\s+jarvis\b[\s,.:!-]*(.*)$/i,
  /\bjarvis\b[\s,.:!]+(.+)$/i,
];

export class WakeWordDetector {
  private isRunning = false;
  private isPaused = false;
  private isProcessing = false;
  private callbacks: WakeWordCallbacks | null = null;

  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private monitorInterval: ReturnType<typeof setInterval> | null = null;

  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isSpeechActive = false;
  private silenceFrames = 0;
  private speechFrames = 0;
  private lastCheckTime = 0;
  private rateLimitBackoffUntil = 0;

  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      ) !== 'undefined'
    );
  }

  public isActive(): boolean {
    return this.isRunning && !this.isPaused;
  }

  /**
   * Start passive always-on wake-word monitoring.
   */
  public async start(callbacks: WakeWordCallbacks): Promise<void> {
    if (!this.isSupported()) {
      callbacks.onError?.('Audio capture is not supported in this runtime.');
      return;
    }

    this.callbacks = callbacks;
    this.isRunning = true;
    this.isPaused = false;
    this.isProcessing = false;

    await this.initVAD();
  }

  /**
   * Pause wake-word listening (e.g. while JARVIS is speaking or thinking).
   */
  public pause(): void {
    this.isPaused = true;
    this.resetRecordingState();
  }

  /**
   * Resume passive listening when returning to idle.
   */
  public resume(): void {
    if (!this.isRunning) return;
    this.isPaused = false;
    this.isProcessing = false;
    this.resetRecordingState();
  }

  /**
   * Stop wake-word detection completely and release microphone.
   */
  public stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    this.isProcessing = false;
    this.resetRecordingState();

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }

    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    this.analyser = null;
    this.callbacks = null;
  }

  private async initVAD(): Promise<void> {
    try {
      if (this.stream) {
        this.stream.getTracks().forEach((t) => t.stop());
        this.stream = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (!this.isRunning) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      this.stream = stream;

      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;

      const audioCtx = new AudioContextClass();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);

      this.audioCtx = audioCtx;
      this.analyser = analyser;

      this.startAudioLoop();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.callbacks?.onError?.(`Microphone access error: ${msg}`);
      this.stop();
    }
  }

  private startAudioLoop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    const dataArray = new Uint8Array(256);

    // Monitor audio energy every 80ms (virtually 0% CPU footprint)
    this.monitorInterval = setInterval(() => {
      if (
        !this.isRunning ||
        this.isPaused ||
        this.isProcessing ||
        !this.analyser ||
        Date.now() < this.rateLimitBackoffUntil ||
        Date.now() - this.lastCheckTime < 5000
      ) {
        return;
      }

      this.analyser.getByteFrequencyData(dataArray);

      // Calculate root-mean-square energy
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const val = dataArray[i] / 128.0 - 1.0;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / dataArray.length);

      // Filter ambient room noise; require clear vocal prominence
      const ENERGY_THRESHOLD = 0.14;

      if (rms > ENERGY_THRESHOLD) {
        this.speechFrames++;
        this.silenceFrames = 0;

        // When speech is sustained for > 400ms (5 consecutive frames), start collecting audio segment
        if (this.speechFrames >= 5 && !this.isSpeechActive) {
          this.isSpeechActive = true;
          this.startSegmentRecording();
        }
      } else if (this.isSpeechActive) {
        this.silenceFrames++;

        // When user pauses for ~480ms (6 frames of silence), finish the speech burst
        if (this.silenceFrames >= 6) {
          this.isSpeechActive = false;
          this.finishSegmentRecording();
        }
      }
    }, 80);
  }

  private startSegmentRecording(): void {
    if (!this.stream) return;

    try {
      this.recordedChunks = [];
      let mimeType = 'audio/webm;codecs=opus';
      if (
        typeof MediaRecorder !== 'undefined' &&
        !MediaRecorder.isTypeSupported(mimeType)
      ) {
        mimeType = MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      }

      const recorder = new MediaRecorder(
        this.stream,
        mimeType ? { mimeType } : undefined,
      );
      this.mediaRecorder = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      recorder.start();

      // Auto-cap single wake-word attempt at 3.5 seconds
      setTimeout(() => {
        if (this.isSpeechActive && this.mediaRecorder?.state === 'recording') {
          this.isSpeechActive = false;
          this.finishSegmentRecording();
        }
      }, 3500);
    } catch (recErr) {
      console.warn('[WakeWordDetector] Segment recorder error:', recErr);
      this.resetRecordingState();
    }
  }

  private finishSegmentRecording(): void {
    if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
      this.resetRecordingState();
      return;
    }

    const recorder = this.mediaRecorder;
    recorder.onstop = async () => {
      try {
        const blob = new Blob(this.recordedChunks, {
          type: recorder.mimeType || 'audio/webm',
        });

        // Ignore accidental noise clicks (< 8000 bytes)
        if (blob.size < 8000) {
          this.resetRecordingState();
          return;
        }

        await this.verifyWakeWordWithWhisper(blob);
      } catch {
        this.resetRecordingState();
      }
    };

    try {
      recorder.stop();
    } catch {
      this.resetRecordingState();
    }
  }

  private async verifyWakeWordWithWhisper(blob: Blob): Promise<void> {
    if (!window.jarvisDesktop?.transcribeAudio) {
      this.resetRecordingState();
      return;
    }

    this.isProcessing = true;
    this.lastCheckTime = Date.now();

    try {
      // Encode blob to base64
      const reader = new FileReader();
      const base64Audio = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          resolve(res.includes(',') ? res.split(',')[1] : res);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const transcription = await window.jarvisDesktop.transcribeAudio({
        base64Audio,
        format: 'webm',
      });

      if (transcription.error && (transcription.error.includes('429') || transcription.error.includes('rate limit'))) {
        console.warn('[WakeWordDetector] Groq Whisper 429 hit. Backing off wake-word polling for 45s to preserve quota.');
        this.rateLimitBackoffUntil = Date.now() + 45000;
      }

      const text = (transcription.text || '').trim();

      if (text) {
        for (const pattern of WAKE_PATTERNS) {
          const match = text.match(pattern);
          if (match) {
            const directive = (match[1] || '').trim();
            this.pause();
            this.callbacks?.onWakeWordDetected(directive || undefined);
            return;
          }
        }
      }
    } catch {
      // Silent pass for non-matching speech bursts
    } finally {
      this.isProcessing = false;
      this.resetRecordingState();
    }
  }

  private resetRecordingState(): void {
    this.isSpeechActive = false;
    this.speechFrames = 0;
    this.silenceFrames = 0;
    this.recordedChunks = [];
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.mediaRecorder = null;
  }
}

export const wakeWordDetector = new WakeWordDetector();
