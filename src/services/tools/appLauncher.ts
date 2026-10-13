import { spawn } from 'node:child_process';
import { shell } from 'electron';
import type { ToolExecutionResult } from './toolTypes';

export interface ApprovedApp {
  id: string;
  displayName: string;
  aliases: string[];
  command: string;
  args?: string[];
  isUri?: boolean;
}

export const APPROVED_APPS: ApprovedApp[] = [
  {
    id: 'spotify',
    displayName: 'Spotify',
    aliases: ['spotify', 'music', 'spotify music'],
    command: 'spotify:',
    isUri: true,
  },
  {
    id: 'chrome',
    displayName: 'Google Chrome',
    aliases: ['chrome', 'google chrome', 'browser', 'google'],
    command: 'chrome.exe',
  },
  {
    id: 'edge',
    displayName: 'Microsoft Edge',
    aliases: ['edge', 'microsoft edge'],
    command: 'msedge.exe',
  },
  {
    id: 'vscode',
    displayName: 'Visual Studio Code',
    aliases: ['code', 'vs code', 'vscode', 'visual studio code'],
    command: 'code.cmd',
  },
  {
    id: 'notepad',
    displayName: 'Notepad',
    aliases: ['notepad', 'text editor', 'notes'],
    command: 'notepad.exe',
  },
  {
    id: 'calculator',
    displayName: 'Calculator',
    aliases: ['calculator', 'calc', 'math'],
    command: 'calc.exe',
  },
  {
    id: 'terminal',
    displayName: 'Windows Terminal',
    aliases: ['terminal', 'wt', 'windows terminal'],
    command: 'wt.exe',
  },
  {
    id: 'powershell',
    displayName: 'PowerShell',
    aliases: ['powershell', 'pwsh', 'shell'],
    command: 'powershell.exe',
  },
  {
    id: 'explorer',
    displayName: 'File Explorer',
    aliases: ['explorer', 'files', 'file explorer', 'my pc'],
    command: 'explorer.exe',
  },
  {
    id: 'settings',
    displayName: 'Windows Settings',
    aliases: ['settings', 'windows settings', 'control panel'],
    command: 'ms-settings:',
    isUri: true,
  },
  {
    id: 'taskmanager',
    displayName: 'Task Manager',
    aliases: ['task manager', 'taskmgr', 'processes'],
    command: 'taskmgr.exe',
  },
];

export function findApprovedApp(query: string): ApprovedApp | null {
  if (!query) return null;
  const clean = query.trim().toLowerCase();

  for (const app of APPROVED_APPS) {
    if (app.id === clean || app.displayName.toLowerCase() === clean) {
      return app;
    }
    if (app.aliases.some((alias) => alias === clean || clean.includes(alias))) {
      return app;
    }
  }

  return null;
}

export async function launchApp(
  appName: string,
  isTestMode = false,
): Promise<ToolExecutionResult> {
  const startTime = performance.now();
  const matchedApp = findApprovedApp(appName);

  if (!matchedApp) {
    const approvedList = APPROVED_APPS.map((a) => a.displayName).join(', ');
    return {
      success: false,
      message: `Access denied. Application "${appName}" is not in the approved application registry.`,
      error: `Disallowed application: ${appName}. Approved applications: ${approvedList}`,
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  if (isTestMode || process.env.VITEST === 'true') {
    return {
      success: true,
      message: `${matchedApp.displayName} launched successfully (simulation).`,
      data: { app: matchedApp.id, displayName: matchedApp.displayName },
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  try {
    if (matchedApp.isUri && shell?.openExternal) {
      await shell.openExternal(matchedApp.command);
    } else {
      const child = spawn(matchedApp.command, matchedApp.args || [], {
        detached: true,
        stdio: 'ignore',
        shell: false,
      });
      child.unref();
    }

    const elapsed = Math.round(performance.now() - startTime);
    return {
      success: true,
      message: `${matchedApp.displayName} launched successfully, sir.`,
      data: {
        app: matchedApp.id,
        displayName: matchedApp.displayName,
      },
      durationMs: elapsed,
    };
  } catch (err: unknown) {
    const elapsed = Math.round(performance.now() - startTime);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Failed to launch ${matchedApp.displayName}: ${msg}`,
      error: msg,
      durationMs: elapsed,
    };
  }
}
