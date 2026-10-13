import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { ToolExecutionResult } from './toolTypes';

const execAsync = promisify(exec);

export type VolumeAction = 'mute' | 'unmute' | 'up' | 'down' | 'set';
export type MediaPlaybackAction = 'play_pause' | 'next' | 'previous' | 'stop';

/**
 * Executes a virtual keystroke sequence via Windows WScript.Shell
 */
async function sendVirtualKeys(charCodes: number[], count = 1): Promise<void> {
  if (process.platform !== 'win32' || process.env.VITEST === 'true') {
    return;
  }

  const loopCode = charCodes
    .map(
      (code) => `(New-Object -ComObject Wscript.Shell).SendKeys([char]${code})`,
    )
    .join('; ');

  const command =
    count > 1
      ? `powershell -NoProfile -NonInteractive -Command "1..${count} | ForEach-Object { ${loopCode} }"`
      : `powershell -NoProfile -NonInteractive -Command "${loopCode}"`;

  await execAsync(command, { timeout: 3500 });
}

export async function controlVolume(
  action: VolumeAction,
  level?: number,
): Promise<ToolExecutionResult> {
  const startTime = performance.now();

  try {
    let message = '';

    switch (action) {
      case 'mute':
      case 'unmute': {
        // [char]173 toggles mute on Windows
        await sendVirtualKeys([173]);
        message =
          action === 'mute'
            ? 'Master audio muted, sir.'
            : 'Master audio unmuted, sir.';
        break;
      }
      case 'up': {
        // [char]175 increments volume (+2% per tap, 5 taps = +10%)
        await sendVirtualKeys([175], 5);
        message = 'Master volume increased by 10%, sir.';
        break;
      }
      case 'down': {
        // [char]174 decrements volume (-2% per tap, 5 taps = -10%)
        await sendVirtualKeys([174], 5);
        message = 'Master volume decreased by 10%, sir.';
        break;
      }
      case 'set': {
        const target = Math.min(100, Math.max(0, level ?? 50));
        // Reset to 0% (50 taps of volume down), then step up to target
        const upTaps = Math.round(target / 2);
        if (process.platform === 'win32' && process.env.VITEST !== 'true') {
          const resetCmd = `powershell -NoProfile -NonInteractive -Command "1..50 | ForEach-Object { (New-Object -ComObject Wscript.Shell).SendKeys([char]174) }; 1..${upTaps} | ForEach-Object { (New-Object -ComObject Wscript.Shell).SendKeys([char]175) }"`;
          await execAsync(resetCmd, { timeout: 5000 });
        }
        message = `Master volume calibrated to ${target}%, sir.`;
        break;
      }
    }

    const elapsed = Math.round(performance.now() - startTime);
    return {
      success: true,
      message,
      data: { action, level },
      durationMs: elapsed,
    };
  } catch (err: unknown) {
    const elapsed = Math.round(performance.now() - startTime);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Failed to adjust system audio: ${msg}`,
      error: msg,
      durationMs: elapsed,
    };
  }
}

export async function controlMedia(
  action: MediaPlaybackAction,
): Promise<ToolExecutionResult> {
  const startTime = performance.now();

  try {
    let message = '';
    switch (action) {
      case 'play_pause':
        // [char]179 = Play/Pause
        await sendVirtualKeys([179]);
        message = 'Media playback toggled, sir.';
        break;
      case 'next':
        // [char]176 = Next Track
        await sendVirtualKeys([176]);
        message = 'Skipped to next media track, sir.';
        break;
      case 'previous':
        // [char]177 = Previous Track
        await sendVirtualKeys([177]);
        message = 'Navigated to previous media track, sir.';
        break;
      case 'stop':
        // [char]178 = Stop Media
        await sendVirtualKeys([178]);
        message = 'Media playback stopped, sir.';
        break;
    }

    const elapsed = Math.round(performance.now() - startTime);
    return {
      success: true,
      message,
      data: { action },
      durationMs: elapsed,
    };
  } catch (err: unknown) {
    const elapsed = Math.round(performance.now() - startTime);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Failed to execute media key directive: ${msg}`,
      error: msg,
      durationMs: elapsed,
    };
  }
}
