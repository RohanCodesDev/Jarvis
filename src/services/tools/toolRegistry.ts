import { z } from 'zod';
import type {
  ToolDefinition,
  ToolExecutionResult,
  ToolAuditLog,
} from './toolTypes';
import { launchApp, APPROVED_APPS } from './appLauncher';
import { openWebUrl } from './urlLauncher';
import { getSystemDiagnostics } from './systemStatsTool';
import { readSafeFile, createSafeFile } from './fileTools';
import {
  controlVolume,
  controlMedia,
  type VolumeAction,
  type MediaPlaybackAction,
} from './mediaTools';
import { getNetworkDiagnostics } from './networkTools';
import { lockWorkstation } from './systemControlTools';
import { capturePrimaryScreen } from './screenCaptureTool';

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition<any>>();
  private auditLogs: ToolAuditLog[] = [];
  private maxAuditLogs = 100;

  constructor() {
    this.registerDefaultTools();
  }

  private registerDefaultTools(): void {
    // 1. Open Application
    this.registerTool({
      id: 'open_app',
      name: 'Launch Application',
      description: `Opens an approved desktop application (${APPROVED_APPS.map((a) => a.displayName).join(', ')}).`,
      permission: 'low_risk',
      schema: z.object({
        app: z.string().min(1, 'Application name is required'),
      }),
      execute: async (args: { app: string }) => {
        return await launchApp(args.app);
      },
    });

    // 2. Open URL
    this.registerTool({
      id: 'open_url',
      name: 'Open Web URL',
      description:
        'Opens a valid HTTP or HTTPS web address in the default browser.',
      permission: 'low_risk',
      schema: z.object({
        url: z.string().min(3, 'URL is required'),
      }),
      execute: async (args: { url: string }) => {
        return await openWebUrl(args.url);
      },
    });

    // 3. System Diagnostics
    this.registerTool({
      id: 'system_diagnostics',
      name: 'System Hardware Diagnostics',
      description:
        'Queries Windows live telemetry including battery status, memory usage, CPU model, and uptime.',
      permission: 'low_risk',
      schema: z.object({}).catchall(z.unknown()),
      execute: async () => {
        return await getSystemDiagnostics();
      },
    });

    // 4. Read File
    this.registerTool({
      id: 'read_file',
      name: 'Read Safe File',
      description:
        'Safely reads a text file from approved user folders (Desktop, Documents, Downloads, Workspace).',
      permission: 'low_risk',
      schema: z.object({
        filePath: z.string().min(1, 'File path is required'),
      }),
      execute: async (args: { filePath: string }) => {
        return await readSafeFile(args.filePath);
      },
    });

    // 5. Write File
    this.registerTool({
      id: 'write_file',
      name: 'Write Safe File',
      description:
        'Creates or updates a safe file (.txt, .md, .json, .csv, .log) in approved user folders.',
      permission: 'low_risk',
      schema: z.object({
        filePath: z.string().min(1, 'File path is required'),
        content: z.string(),
      }),
      execute: async (args: { filePath: string; content: string }) => {
        return await createSafeFile(args.filePath, args.content);
      },
    });

    // 6. System Master Volume
    this.registerTool({
      id: 'volume_control',
      name: 'System Volume Control',
      description:
        'Adjusts master Windows volume (mute, unmute, volume up, volume down, or set to percentage).',
      permission: 'low_risk',
      schema: z.object({
        action: z.enum(['mute', 'unmute', 'up', 'down', 'set']),
        level: z.number().min(0).max(100).optional(),
      }),
      execute: async (args: { action: VolumeAction; level?: number }) => {
        return await controlVolume(args.action, args.level);
      },
    });

    // 7. Media Playback Control
    this.registerTool({
      id: 'media_control',
      name: 'Media Playback Control',
      description:
        'Sends virtual media key commands (play/pause, next track, previous track, stop).',
      permission: 'low_risk',
      schema: z.object({
        action: z.enum(['play_pause', 'next', 'previous', 'stop']),
      }),
      execute: async (args: { action: MediaPlaybackAction }) => {
        return await controlMedia(args.action);
      },
    });

    // 8. Network & Connectivity Diagnostics
    this.registerTool({
      id: 'network_diagnostics',
      name: 'Network Diagnostics',
      description:
        'Checks active network adapter profile, Wi-Fi SSID, and internet ping latency.',
      permission: 'low_risk',
      schema: z.object({}).catchall(z.unknown()),
      execute: async () => {
        return await getNetworkDiagnostics();
      },
    });

    // 9. Workstation Lock
    this.registerTool({
      id: 'lock_workstation',
      name: 'Lock Windows Workstation',
      description: 'Safely locks the Windows user session.',
      permission: 'low_risk',
      schema: z.object({}).catchall(z.unknown()),
      execute: async () => {
        return await lockWorkstation();
      },
    });

    // 10. Screen Capture
    this.registerTool({
      id: 'capture_screen',
      name: 'Capture Primary Display',
      description:
        'Captures a full-resolution screenshot of the screen and saves it to Desktop/JARVIS_Screenshots.',
      permission: 'low_risk',
      schema: z.object({}).catchall(z.unknown()),
      execute: async () => {
        return await capturePrimaryScreen();
      },
    });
  }

  public registerTool<T>(tool: ToolDefinition<T>): void {
    this.tools.set(tool.id, tool as ToolDefinition<any>);
  }

  public getTool(toolId: string): ToolDefinition<any> | undefined {
    return this.tools.get(toolId);
  }

  public getAllTools(): ToolDefinition<any>[] {
    return Array.from(this.tools.values());
  }

  public async executeTool(
    toolId: string,
    rawArgs: unknown = {},
  ): Promise<ToolExecutionResult> {
    const startTime = performance.now();
    const tool = this.tools.get(toolId);

    if (!tool) {
      const errorResult: ToolExecutionResult = {
        success: false,
        message: `Tool "${toolId}" does not exist in registry.`,
        error: 'Tool not found',
        durationMs: 0,
      };
      this.recordAuditLog(toolId, rawArgs, errorResult);
      return errorResult;
    }

    // Validate parameters with Zod
    const parseResult = tool.schema.safeParse(rawArgs);
    if (!parseResult.success) {
      const issues =
        parseResult.error.issues || (parseResult.error as any).errors || [];
      const errorMsg =
        issues.map((e: any) => e.message).join('; ') ||
        parseResult.error.message;
      const errorResult: ToolExecutionResult = {
        success: false,
        message: `Invalid parameters for tool "${toolId}": ${errorMsg}`,
        error: errorMsg,
        durationMs: Math.round(performance.now() - startTime),
      };
      this.recordAuditLog(toolId, rawArgs, errorResult);
      return errorResult;
    }

    try {
      const result = await tool.execute(parseResult.data);
      const elapsed = Math.round(performance.now() - startTime);
      result.durationMs = result.durationMs ?? elapsed;

      this.recordAuditLog(toolId, parseResult.data, result);
      return result;
    } catch (err: unknown) {
      const elapsed = Math.round(performance.now() - startTime);
      const msg = err instanceof Error ? err.message : String(err);
      const failureResult: ToolExecutionResult = {
        success: false,
        message: `Execution failed for tool "${toolId}": ${msg}`,
        error: msg,
        durationMs: elapsed,
      };
      this.recordAuditLog(toolId, parseResult.data, failureResult);
      return failureResult;
    }
  }

  private recordAuditLog(
    toolId: string,
    args: unknown,
    result: ToolExecutionResult,
  ): void {
    const log: ToolAuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      toolId,
      timestamp: new Date().toISOString(),
      args:
        typeof args === 'object' && args !== null
          ? (args as Record<string, unknown>)
          : { raw: args },
      success: result.success,
      resultMessage: result.message,
      error: result.error,
      durationMs: result.durationMs || 0,
    };

    this.auditLogs.unshift(log);
    if (this.auditLogs.length > this.maxAuditLogs) {
      this.auditLogs.pop();
    }
  }

  public getAuditLogs(): ToolAuditLog[] {
    return [...this.auditLogs];
  }

  public clearAuditLogs(): void {
    this.auditLogs = [];
  }

  public getToolPromptDocumentation(): string {
    return `### AVAILABLE SYSTEM TOOLS:
You have access to safe, sandboxed desktop tools. When the user requests an action, output a single-line command directive:
[ACTION: tool_id {"param1": "value"}]

1. open_app: Launch an approved desktop app (spotify, chrome, edge, vscode, notepad, calculator, terminal, powershell, explorer, settings, taskmanager).
   - [ACTION: open_app {"app": "spotify"}]

2. open_url: Open a web URL.
   - [ACTION: open_url {"url": "https://github.com"}]

3. system_diagnostics: Check battery %, RAM usage, CPU model, and uptime.
   - [ACTION: system_diagnostics {}]

4. volume_control: Adjust or mute system volume.
   - Actions: "mute" | "unmute" | "up" | "down" | "set"
   - [ACTION: volume_control {"action": "mute"}]
   - [ACTION: volume_control {"action": "set", "level": 50}]

5. media_control: Control media playback.
   - Actions: "play_pause" | "next" | "previous" | "stop"
   - [ACTION: media_control {"action": "next"}]

6. network_diagnostics: Check Wi-Fi SSID, internet ping latency, and connection.
   - [ACTION: network_diagnostics {}]

7. capture_screen: Take a full screenshot and save to Desktop.
   - [ACTION: capture_screen {}]

8. lock_workstation: Lock Windows workstation.
   - [ACTION: lock_workstation {}]

9. read_file: Read a text file from approved folders.
   - [ACTION: read_file {"filePath": "notes.txt"}]

10. write_file: Save a file (.txt, .md, .json, .csv, .log).
    - [ACTION: write_file {"filePath": "memo.txt", "content": "Meeting notes"}]`;
  }
}

export const globalToolRegistry = new ToolRegistry();
