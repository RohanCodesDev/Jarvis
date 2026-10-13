import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { findApprovedApp } from './appLauncher';
import type { ToolExecutionResult } from './toolTypes';

const execAsync = promisify(exec);

const APP_PROCESS_MAP: Record<string, string[]> = {
  spotify: ['Spotify'],
  chrome: ['chrome'],
  edge: ['msedge'],
  vscode: ['Code'],
  notepad: ['Notepad'],
  calculator: ['CalculatorApp', 'Calculator', 'calc'],
  terminal: ['WindowsTerminal'],
  taskmanager: ['Taskmgr'],
};

export async function closeApprovedApp(
  appName: string,
): Promise<ToolExecutionResult> {
  const startTime = performance.now();
  const matchedApp = findApprovedApp(appName);

  if (!matchedApp) {
    return {
      success: false,
      message: `Access denied. "${appName}" is not in the approved application registry.`,
      error: `Disallowed app termination: ${appName}`,
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  const processNames = APP_PROCESS_MAP[matchedApp.id] || [matchedApp.id];

  if (process.platform !== 'win32' || process.env.VITEST === 'true') {
    return {
      success: true,
      message: `${matchedApp.displayName} terminated successfully (simulation).`,
      data: { app: matchedApp.id, displayName: matchedApp.displayName },
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  try {
    const psCodes = processNames
      .map(
        (proc) =>
          `Stop-Process -Name '${proc}' -Force -ErrorAction SilentlyContinue`,
      )
      .join('; ');

    const command = `powershell -NoProfile -NonInteractive -Command "${psCodes}"`;
    await execAsync(command, { timeout: 3500 });

    const elapsed = Math.round(performance.now() - startTime);
    return {
      success: true,
      message: `${matchedApp.displayName} process closed, sir.`,
      data: { app: matchedApp.id, displayName: matchedApp.displayName },
      durationMs: elapsed,
    };
  } catch (err: unknown) {
    const elapsed = Math.round(performance.now() - startTime);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Failed to terminate ${matchedApp.displayName}: ${msg}`,
      error: msg,
      durationMs: elapsed,
    };
  }
}
