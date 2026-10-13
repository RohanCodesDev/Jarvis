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
You have access to safe, sandboxed desktop tools. When the user requests an action that requires a tool, output a single-line command directive in the format:
[ACTION: tool_id {"param1": "value"}]

1. open_app: Launch an approved desktop app.
   - Parameters: {"app": "spotify" | "chrome" | "vscode" | "notepad" | "calculator" | "terminal" | "settings" | "explorer" | "taskmanager"}
   - Example: [ACTION: open_app {"app": "spotify"}]

2. open_url: Open a verified HTTP/HTTPS URL in the default browser.
   - Parameters: {"url": "https://github.com"}
   - Example: [ACTION: open_url {"url": "https://youtube.com"}]

3. system_diagnostics: Check system battery %, RAM usage, CPU model, and uptime.
   - Parameters: {}
   - Example: [ACTION: system_diagnostics {}]

4. read_file: Read a text file from approved user folders (Desktop, Documents, Downloads).
   - Parameters: {"filePath": "C:\\Users\\...\\file.txt"}
   - Example: [ACTION: read_file {"filePath": "notes.txt"}]

5. write_file: Create or save a file (.txt, .md, .json, .csv, .log).
   - Parameters: {"filePath": "report.txt", "content": "..."}
   - Example: [ACTION: write_file {"filePath": "memo.txt", "content": "Meeting notes"}]

IMPORTANT RULES:
- Never claim you performed an action without outputting the [ACTION: ...] directive.
- If the user asks you to open an application or check the battery, execute the corresponding action.`;
  }
}

export const globalToolRegistry = new ToolRegistry();
