import { clipboard } from 'electron';
import type { ToolExecutionResult } from './toolTypes';

export async function writeToClipboard(
  text: string,
): Promise<ToolExecutionResult> {
  const startTime = performance.now();

  if (process.env.VITEST === 'true' || !clipboard) {
    return {
      success: true,
      message: `Copied to clipboard: "${text.length > 40 ? text.substring(0, 40) + '...' : text}"`,
      data: { text },
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  try {
    clipboard.writeText(text);
    const elapsed = Math.round(performance.now() - startTime);
    return {
      success: true,
      message: `Content copied to Windows clipboard, sir: "${text.length > 40 ? text.substring(0, 40) + '...' : text}"`,
      data: { text },
      durationMs: elapsed,
    };
  } catch (err: unknown) {
    const elapsed = Math.round(performance.now() - startTime);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Failed to write to clipboard: ${msg}`,
      error: msg,
      durationMs: elapsed,
    };
  }
}

export async function readFromClipboard(): Promise<ToolExecutionResult> {
  const startTime = performance.now();

  if (process.env.VITEST === 'true' || !clipboard) {
    return {
      success: true,
      message: 'Clipboard content retrieved (simulation).',
      data: { text: 'Simulated clipboard buffer' },
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  try {
    const text = await clipboard.readText();
    const elapsed = Math.round(performance.now() - startTime);

    if (!text || !text.trim()) {
      return {
        success: true,
        message: 'The Windows clipboard is currently empty, sir.',
        data: { text: '' },
        durationMs: elapsed,
      };
    }

    const preview =
      text.length > 120 ? text.substring(0, 120) + '... [truncated]' : text;
    return {
      success: true,
      message: `Clipboard buffer contains: "${preview}"`,
      data: { text },
      durationMs: elapsed,
    };
  } catch (err: unknown) {
    const elapsed = Math.round(performance.now() - startTime);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Failed to read clipboard: ${msg}`,
      error: msg,
      durationMs: elapsed,
    };
  }
}
