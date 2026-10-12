import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserSpeechRecognizer } from '../src/services/voice/browserRecognizer';
import { BrowserSpeechSynthesizer } from '../src/services/voice/browserSynthesizer';
import { VoiceCoordinator } from '../src/services/voice/voiceCoordinator';
import {
  type ISpeechRecognizer,
  type ISpeechSynthesizer,
} from '../src/services/voice/types';

describe('Stage 3: Voice Interaction - BrowserSpeechRecognizer', () => {
  it('reports unsupported when SpeechRecognition API is absent', () => {
    const recognizer = new BrowserSpeechRecognizer();
    // In node/vitest, window.SpeechRecognition is absent
    expect(recognizer.isSupported()).toBe(false);
  });

  it('calls onError if start is called in unsupported environment', async () => {
    const recognizer = new BrowserSpeechRecognizer();
    const onTranscript = vi.fn();
    const onError = vi.fn();

    await recognizer.start(onTranscript, onError);

    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining('not supported'),
    );
    expect(recognizer.isListening()).toBe(false);
  });

  it('safely handles stop and abort when inactive', () => {
    const recognizer = new BrowserSpeechRecognizer();
    expect(() => recognizer.stop()).not.toThrow();
    expect(() => recognizer.abort()).not.toThrow();
    expect(recognizer.isListening()).toBe(false);
  });
});

describe('Stage 3: Voice Interaction - BrowserSpeechSynthesizer', () => {
  it('reports supported based on window.speechSynthesis presence', () => {
    const synth = new BrowserSpeechSynthesizer();
    // Default in node/vitest environment
    expect(typeof synth.isSupported()).toBe('boolean');
  });

  it('safely handles stop when no speech is playing', () => {
    const synth = new BrowserSpeechSynthesizer();
    expect(() => synth.stop()).not.toThrow();
    expect(synth.isSpeaking()).toBe(false);
  });
});

describe('Stage 3: Voice Interaction - VoiceCoordinator Orchestration', () => {
  let mockRecognizer: ISpeechRecognizer;
  let mockSynthesizer: ISpeechSynthesizer;
  let coordinator: VoiceCoordinator;

  beforeEach(() => {
    mockRecognizer = {
      isSupported: vi.fn().mockReturnValue(true),
      start: vi.fn(),
      stop: vi.fn(),
      abort: vi.fn(),
      isListening: vi.fn().mockReturnValue(false),
    };

    mockSynthesizer = {
      isSupported: vi.fn().mockReturnValue(true),
      speak: vi.fn(),
      stop: vi.fn(),
      isSpeaking: vi.fn().mockReturnValue(false),
      getVoices: vi.fn().mockReturnValue([]),
    };

    coordinator = new VoiceCoordinator(mockRecognizer, mockSynthesizer);
  });

  it('starts in idle state', () => {
    expect(coordinator.getState()).toBe('idle');
  });

  it('transitions to listening and handles interim + final transcripts', async () => {
    const onStateChange = vi.fn();
    const onInterim = vi.fn();
    const onFinal = vi.fn();
    const onError = vi.fn();

    mockRecognizer.start = vi.fn().mockImplementation(async (onTranscript) => {
      // simulate user speaking interim words
      onTranscript('diagnostics', false);
      // simulate silence detection delivering final speech
      onTranscript('diagnostics report', true);
    });

    await coordinator.startListening({
      onStateChange,
      onInterimTranscript: onInterim,
      onFinalTranscript: onFinal,
      onError,
    });

    expect(onStateChange).toHaveBeenCalledWith('listening');
    expect(onInterim).toHaveBeenCalledWith('diagnostics');
    expect(onStateChange).toHaveBeenCalledWith('processing');
    expect(onFinal).toHaveBeenCalledWith('diagnostics report');
    expect(mockRecognizer.stop).toHaveBeenCalled();
  });

  it('transitions to error state and auto-recovers to idle upon speech failure', async () => {
    vi.useFakeTimers();

    const onStateChange = vi.fn();
    const onFinal = vi.fn();
    const onError = vi.fn();

    mockRecognizer.start = vi
      .fn()
      .mockImplementation(async (_onTranscript, onErr) => {
        onErr('Microphone permission denied');
      });

    await coordinator.startListening({
      onStateChange,
      onFinalTranscript: onFinal,
      onError,
    });

    expect(onStateChange).toHaveBeenCalledWith('error');
    expect(onError).toHaveBeenCalledWith('Microphone permission denied');

    // Fast-forward error cooldown timer
    vi.advanceTimersByTime(3100);
    expect(onStateChange).toHaveBeenCalledWith('idle');
    expect(coordinator.getState()).toBe('idle');

    vi.useRealTimers();
  });

  it('delegates speech playback to synthesizer', () => {
    const onStateChange = vi.fn();
    const onError = vi.fn();
    const onComplete = vi.fn();

    mockSynthesizer.speak = vi
      .fn()
      .mockImplementation((_text, _options, onEnd) => {
        onEnd?.();
      });

    coordinator.speak(
      'All telemetry nominal.',
      { onStateChange, onError },
      { voiceGender: 'male' },
      onComplete,
    );

    expect(onStateChange).toHaveBeenCalledWith('speaking');
    expect(mockSynthesizer.speak).toHaveBeenCalledWith(
      'All telemetry nominal.',
      { voiceGender: 'male' },
      expect.any(Function),
      expect.any(Function),
    );
    expect(onStateChange).toHaveBeenCalledWith('idle');
    expect(onComplete).toHaveBeenCalled();
  });

  it('immediately halts both recognizer and synthesizer on halt()', () => {
    const onStateChange = vi.fn();

    coordinator.halt({ onStateChange });

    expect(mockRecognizer.abort).toHaveBeenCalled();
    expect(mockSynthesizer.stop).toHaveBeenCalled();
    expect(onStateChange).toHaveBeenCalledWith('idle');
    expect(coordinator.getState()).toBe('idle');
  });
});
