import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/services/settingsStore';

describe('Settings Defaults & Validation', () => {
  it('initializes with OpenRouter as default cloud provider', () => {
    expect(DEFAULT_SETTINGS.cloudProvider).toBe('openrouter');
  });

  it('has Claude 3.5 Sonnet as default model', () => {
    expect(DEFAULT_SETTINGS.openRouterModel).toBe(
      'anthropic/claude-3.5-sonnet',
    );
  });

  it('defaults to speech enabled with sound effects on', () => {
    expect(DEFAULT_SETTINGS.speechEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.soundEffects).toBe(true);
  });

  it('starts with mock mode (hasApiKey false)', () => {
    expect(DEFAULT_SETTINGS.hasApiKey).toBe(false);
  });
});
