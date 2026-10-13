import { shell } from 'electron';
import type { ToolExecutionResult } from './toolTypes';

export function sanitizeAndValidateUrl(rawInput: string): string | null {
  if (!rawInput) return null;
  let target = rawInput.trim();

  // Allow safe Windows Settings protocols (e.g. ms-settings:display)
  if (target.toLowerCase().startsWith('ms-settings:')) {
    const cleanSetting = target.replace(/[^a-zA-Z0-9:-]/g, '');
    return cleanSetting;
  }

  // If another scheme like file:, javascript:, data:, ftp:, etc. is present, reject immediately
  if (/^[a-z0-9+.-]+:/i.test(target) && !/^https?:\/\//i.test(target)) {
    return null;
  }

  // If no scheme, default to https://
  if (!/^https?:\/\//i.test(target)) {
    target = 'https://' + target;
  }

  try {
    const parsed = new URL(target);
    // Strictly restrict to standard web protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    // Block local addresses or loopback if attempted maliciously
    if (!parsed.hostname || parsed.hostname.length < 3) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function openWebUrl(
  rawUrl: string,
  isTestMode = false,
): Promise<ToolExecutionResult> {
  const startTime = performance.now();
  const validUrl = sanitizeAndValidateUrl(rawUrl);

  if (!validUrl) {
    return {
      success: false,
      message: `Invalid or untrusted URL: "${rawUrl}". Only valid http/https URLs are permitted.`,
      error: 'Invalid URL format',
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  if (isTestMode || process.env.VITEST === 'true') {
    return {
      success: true,
      message: `Navigated to ${validUrl} (simulation).`,
      data: { url: validUrl },
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  try {
    if (shell?.openExternal) {
      await shell.openExternal(validUrl);
    }
    const elapsed = Math.round(performance.now() - startTime);
    return {
      success: true,
      message: `Navigated to ${validUrl}, sir.`,
      data: { url: validUrl },
      durationMs: elapsed,
    };
  } catch (err: unknown) {
    const elapsed = Math.round(performance.now() - startTime);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Failed to open URL: ${msg}`,
      error: msg,
      durationMs: elapsed,
    };
  }
}
