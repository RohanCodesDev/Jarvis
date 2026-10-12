import { safeStorage, app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

function getSecretsPath(): string {
  return path.join(app.getPath('userData'), 'jarvis-secrets.bin');
}

export function isSecretStorageAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

/**
 * Encrypt and persist the OpenRouter API key using OS-backed DPAPI / safeStorage.
 * Never called directly from renderer.
 */
export function storeApiKey(key: string): boolean {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[SecretStore] OS safeStorage encryption unavailable');
    return false;
  }
  const encrypted = safeStorage.encryptString(key.trim());
  fs.writeFileSync(getSecretsPath(), encrypted);
  return true;
}

/**
 * Decrypt the stored API key for main-process use ONLY (e.g. OpenRouter provider).
 * This value MUST NEVER be sent over IPC to the renderer process.
 */
export function getApiKey(): string | null {
  const filePath = getSecretsPath();
  if (!fs.existsSync(filePath)) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const encrypted = fs.readFileSync(filePath);
    return safeStorage.decryptString(encrypted);
  } catch (err) {
    console.error('[SecretStore] Failed to decrypt API key:', err);
    return null;
  }
}

/**
 * Check if an encrypted API key exists on disk.
 * Safe to report as a boolean status to the renderer.
 */
export function hasApiKey(): boolean {
  const filePath = getSecretsPath();
  return fs.existsSync(filePath);
}

/**
 * Purge stored API key from disk.
 */
export function deleteApiKey(): boolean {
  const filePath = getSecretsPath();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}
