import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { ToolExecutionResult } from './toolTypes';

const execAsync = promisify(exec);

export async function getDisplayBrightness(): Promise<ToolExecutionResult> {
  const startTime = performance.now();

  if (process.platform !== 'win32' || process.env.VITEST === 'true') {
    return {
      success: true,
      message: 'Display brightness is currently at 80% (simulation).',
      data: { brightness: 80 },
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  try {
    const cmd =
      'powershell -NoProfile -NonInteractive -Command "(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness).CurrentBrightness"';
    const { stdout } = await execAsync(cmd, { timeout: 3500 });
    const parsed = parseInt(stdout.trim(), 10);
    const brightness = isNaN(parsed) ? 100 : parsed;
    const elapsed = Math.round(performance.now() - startTime);

    return {
      success: true,
      message: `Display brightness is currently set to ${brightness}%, sir.`,
      data: { brightness },
      durationMs: elapsed,
    };
  } catch (err: unknown) {
    const elapsed = Math.round(performance.now() - startTime);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Unable to query monitor brightness: ${msg}`,
      error: msg,
      durationMs: elapsed,
    };
  }
}

export async function setDisplayBrightness(
  level: number,
): Promise<ToolExecutionResult> {
  const startTime = performance.now();
  const target = Math.min(100, Math.max(0, Math.round(level)));

  if (process.platform !== 'win32' || process.env.VITEST === 'true') {
    return {
      success: true,
      message: `Display brightness calibrated to ${target}% (simulation).`,
      data: { brightness: target },
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  try {
    const cmd = `powershell -NoProfile -NonInteractive -Command "(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods).WmiSetBrightness(1, ${target})"`;
    await execAsync(cmd, { timeout: 4000 });
    const elapsed = Math.round(performance.now() - startTime);

    return {
      success: true,
      message: `Display brightness adjusted to ${target}%, sir.`,
      data: { brightness: target },
      durationMs: elapsed,
    };
  } catch (err: unknown) {
    const elapsed = Math.round(performance.now() - startTime);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Failed to adjust monitor brightness: ${msg}`,
      error: msg,
      durationMs: elapsed,
    };
  }
}
