import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { JarvisSettings } from '../types/hud';

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'jarvis-settings.json');
}

export const DEFAULT_SETTINGS: JarvisSettings = {
  cloudProvider: 'openrouter',
  openRouterModel: 'anthropic/claude-3.5-sonnet',
  ollamaModel: 'llama3:latest',
  hasApiKey: false,
  speechEnabled: true,
  voiceGender: 'male',
  soundEffects: true,
  compactMode: false,
};

export function loadSettings(): JarvisSettings {
  const filePath = getSettingsPath();
  if (!fs.existsSync(filePath)) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<JarvisSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (err) {
    console.error('[SettingsStore] Failed to parse settings file:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Partial<JarvisSettings>): boolean {
  try {
    const current = loadSettings();
    const updated = { ...current, ...settings };
    fs.writeFileSync(
      getSettingsPath(),
      JSON.stringify(updated, null, 2),
      'utf-8',
    );
    return true;
  } catch (err) {
    console.error('[SettingsStore] Failed to save settings:', err);
    return false;
  }
}
