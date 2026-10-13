import { shell } from 'electron';
import type { ToolExecutionResult } from './toolTypes';

export type SearchPlatform = 'youtube' | 'github' | 'google';

export async function executeDirectSearch(
  platform: SearchPlatform,
  query: string,
): Promise<ToolExecutionResult> {
  const startTime = performance.now();
  const cleanQuery = query.trim();

  if (!cleanQuery) {
    return {
      success: false,
      message: 'Search query cannot be empty.',
      error: 'Empty query',
      durationMs: 0,
    };
  }

  let targetUrl = '';
  let platformName = '';

  switch (platform) {
    case 'youtube':
      targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`;
      platformName = 'YouTube';
      break;
    case 'github':
      targetUrl = `https://github.com/search?q=${encodeURIComponent(cleanQuery)}`;
      platformName = 'GitHub';
      break;
    case 'google':
    default:
      targetUrl = `https://www.google.com/search?q=${encodeURIComponent(cleanQuery)}`;
      platformName = 'Google';
      break;
  }

  if (process.env.VITEST === 'true' || !shell) {
    return {
      success: true,
      message: `Searching ${platformName} for "${cleanQuery}" (simulation).`,
      data: { platform, query: cleanQuery, url: targetUrl },
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  try {
    await shell.openExternal(targetUrl);
    const elapsed = Math.round(performance.now() - startTime);

    return {
      success: true,
      message: `Searching ${platformName} for "${cleanQuery}", sir.`,
      data: { platform, query: cleanQuery, url: targetUrl },
      durationMs: elapsed,
    };
  } catch (err: unknown) {
    const elapsed = Math.round(performance.now() - startTime);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Failed to initiate search: ${msg}`,
      error: msg,
      durationMs: elapsed,
    };
  }
}
