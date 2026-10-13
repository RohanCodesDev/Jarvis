import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { ToolExecutionResult } from './toolTypes';

const execAsync = promisify(exec);

export async function lockWorkstation(): Promise<ToolExecutionResult> {
  const startTime = performance.now();

  if (process.platform !== 'win32' || process.env.VITEST === 'true') {
    return {
      success: true,
      message: 'Workstation lock protocol engaged (simulation).',
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  try {
    // Official Windows API call to lock the screen
    await execAsync('rundll32.exe user32.dll,LockWorkStation', {
      timeout: 3000,
    });
    const elapsed = Math.round(performance.now() - startTime);

    return {
      success: true,
      message: 'Workstation secured and locked, sir.',
      durationMs: elapsed,
    };
  } catch (err: unknown) {
    const elapsed = Math.round(performance.now() - startTime);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Failed to lock workstation: ${msg}`,
      error: msg,
      durationMs: elapsed,
    };
  }
}
