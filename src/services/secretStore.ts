import { safeStorage, app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

function getSecretsPath(): string {
  const userData = app?.getPath ? app.getPath('userData') : process.cwd();
  return path.join(userData, 'jarvis-secrets.bin');
}

export function isSecretStorageAvailable(): boolean {
  return (
    typeof safeStorage?.isEncryptionAvailable === 'function' &&
    safeStorage.isEncryptionAvailable()
  );
}

export function sanitizeApiKey(raw: string): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/^(?:Bearer\s+|Bearer:\s*)/i, '')
    .replace(/^(?:GROQ_API_KEY|OPENROUTER_API_KEY)\s*=\s*/i, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
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
  const sanitized = sanitizeApiKey(key);
  if (!sanitized) return false;
  const encrypted = safeStorage.encryptString(sanitized);
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
    return sanitizeApiKey(safeStorage.decryptString(encrypted));
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

function getGroqSecretsPath(): string {
  const userData = app?.getPath ? app.getPath('userData') : process.cwd();
  return path.join(userData, 'jarvis-groq.bin');
}

export function storeGroqKey(key: string): boolean {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[SecretStore] OS safeStorage encryption unavailable');
    return false;
  }
  const sanitized = sanitizeApiKey(key);
  if (!sanitized) return false;
  const encrypted = safeStorage.encryptString(sanitized);
  fs.writeFileSync(getGroqSecretsPath(), encrypted);
  return true;
}

export function getGroqKey(): string | null {
  const filePath = getGroqSecretsPath();
  if (!fs.existsSync(filePath)) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const encrypted = fs.readFileSync(filePath);
    return sanitizeApiKey(safeStorage.decryptString(encrypted));
  } catch (err) {
    console.error('[SecretStore] Failed to decrypt Groq key:', err);
    return null;
  }
}

export function hasGroqKey(): boolean {
  const filePath = getGroqSecretsPath();
  return fs.existsSync(filePath);
}

export function deleteGroqKey(): boolean {
  const filePath = getGroqSecretsPath();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

export const DEFAULT_NEON_DB_URI =
  'postgresql://neondb_owner:npg_M8ZaGh6FdDeq@ep-autumn-bread-b4bsip4f-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';

function getDbUriPath(): string {
  const userData = app?.getPath ? app.getPath('userData') : process.cwd();
  return path.join(userData, 'jarvis-db-uri.bin');
}

export function storeDbUri(uri: string): boolean {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[SecretStore] OS safeStorage encryption unavailable');
    return false;
  }
  const trimmed = (uri || '').trim();
  if (!trimmed) return false;
  const encrypted = safeStorage.encryptString(trimmed);
  fs.writeFileSync(getDbUriPath(), encrypted);
  return true;
}

export function getDbUri(): string {
  const filePath = getDbUriPath();
  if (!fs.existsSync(filePath)) return DEFAULT_NEON_DB_URI;
  if (!safeStorage.isEncryptionAvailable()) return DEFAULT_NEON_DB_URI;
  try {
    const encrypted = fs.readFileSync(filePath);
    const decrypted = safeStorage.decryptString(encrypted).trim();
    return decrypted || DEFAULT_NEON_DB_URI;
  } catch (err) {
    console.error('[SecretStore] Failed to decrypt DB URI:', err);
    return DEFAULT_NEON_DB_URI;
  }
}

export function hasCustomDbUri(): boolean {
  const filePath = getDbUriPath();
  return fs.existsSync(filePath);
}

export function deleteDbUri(): boolean {
  const filePath = getDbUriPath();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}
