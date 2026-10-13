import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ToolExecutionResult } from './toolTypes';

const APPROVED_ROOTS = [
  path.join(os.homedir(), 'Desktop'),
  path.join(os.homedir(), 'Documents'),
  path.join(os.homedir(), 'Downloads'),
  process.cwd(),
];

const BLOCKED_PATTERNS = [
  /windows/i,
  /system32/i,
  /program files/i,
  /\.env/i,
  /\.ssh/i,
  /id_rsa/i,
  /\.bin$/i,
  /sam$/i,
];

export function isPathSafe(targetPath: string): {
  safe: boolean;
  reason?: string;
} {
  const normalized = path.resolve(targetPath);

  // Check forbidden system patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        safe: false,
        reason: `Access to system or sensitive file pattern is blocked: ${pattern}`,
      };
    }
  }

  // Ensure path is within an approved root
  const isWithinApproved = APPROVED_ROOTS.some((root) => {
    const rel = path.relative(root, normalized);
    return !rel.startsWith('..') && !path.isAbsolute(rel);
  });

  if (!isWithinApproved) {
    return {
      safe: false,
      reason:
        'Target path is outside approved user directories (Desktop, Documents, Downloads, Workspace).',
    };
  }

  return { safe: true };
}

export async function readSafeFile(
  filePath: string,
): Promise<ToolExecutionResult> {
  const startTime = performance.now();
  const check = isPathSafe(filePath);

  if (!check.safe) {
    return {
      success: false,
      message: `Security violation: ${check.reason}`,
      error: check.reason,
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    return {
      success: false,
      message: `File not found: ${path.basename(filePath)}`,
      error: 'File does not exist',
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  try {
    const stats = fs.statSync(resolved);
    if (stats.size > 1024 * 1024) {
      return {
        success: false,
        message: 'File size exceeds 1MB limit for safe reading.',
        error: 'File too large',
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    const content = fs.readFileSync(resolved, 'utf-8');
    const elapsed = Math.round(performance.now() - startTime);
    return {
      success: true,
      message: `File "${path.basename(filePath)}" read successfully (${stats.size} bytes).`,
      data: {
        fileName: path.basename(filePath),
        sizeBytes: stats.size,
        content:
          content.length > 4000
            ? content.substring(0, 4000) + '\n... [truncated]'
            : content,
      },
      durationMs: elapsed,
    };
  } catch (err: unknown) {
    const elapsed = Math.round(performance.now() - startTime);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Failed to read file: ${msg}`,
      error: msg,
      durationMs: elapsed,
    };
  }
}

export async function createSafeFile(
  filePath: string,
  content: string,
): Promise<ToolExecutionResult> {
  const startTime = performance.now();
  const check = isPathSafe(filePath);

  if (!check.safe) {
    return {
      success: false,
      message: `Security violation: ${check.reason}`,
      error: check.reason,
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  const allowedExts = new Set(['.txt', '.md', '.json', '.csv', '.log']);
  const ext = path.extname(filePath).toLowerCase();
  if (!allowedExts.has(ext)) {
    return {
      success: false,
      message: `Disallowed file extension "${ext}". Approved extensions: .txt, .md, .json, .csv, .log`,
      error: 'Invalid file extension',
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  try {
    const resolved = path.resolve(filePath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, content, 'utf-8');
    const elapsed = Math.round(performance.now() - startTime);
    return {
      success: true,
      message: `File "${path.basename(filePath)}" created successfully on ${path.dirname(resolved)}.`,
      data: {
        fileName: path.basename(filePath),
        path: resolved,
        sizeBytes: Buffer.byteLength(content, 'utf-8'),
      },
      durationMs: elapsed,
    };
  } catch (err: unknown) {
    const elapsed = Math.round(performance.now() - startTime);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Failed to create file: ${msg}`,
      error: msg,
      durationMs: elapsed,
    };
  }
}
