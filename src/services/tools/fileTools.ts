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

// Add OneDrive folders if they exist on Windows
try {
  const oneDriveRoot = path.join(os.homedir(), 'OneDrive');
  if (fs.existsSync(oneDriveRoot)) {
    const odDesktop = path.join(oneDriveRoot, 'Desktop');
    const odDocs = path.join(oneDriveRoot, 'Documents');
    if (fs.existsSync(odDesktop)) APPROVED_ROOTS.push(odDesktop);
    if (fs.existsSync(odDocs)) APPROVED_ROOTS.push(odDocs);
  }
} catch {
  // Ignore permission / access errors
}

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

/**
 * Resolves user path, expanding %USERPROFILE%, ~, stripping quotes, and defaulting bare filenames to Desktop.
 */
export function resolveUserPath(rawPath: string): string {
  if (!rawPath) return path.join(os.homedir(), 'Desktop');
  let p = rawPath.trim().replace(/^["']+|["']+$/g, '');

  // Expand Windows environment variables
  p = p.replace(/%USERPROFILE%/gi, os.homedir());
  p = p.replace(/%HOMEPATH%/gi, os.homedir());
  p = p.replace(/%HOMESHARE%/gi, os.homedir());

  // Expand ~ or ~/ or ~\
  if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) {
    p = path.join(os.homedir(), p.slice(1));
  }

  // Handle relative and bare filenames
  if (!path.isAbsolute(p)) {
    if (/^Desktop[\\/]/i.test(p)) {
      p = path.join(os.homedir(), p);
    } else if (/^Documents[\\/]/i.test(p)) {
      p = path.join(os.homedir(), p);
    } else if (/^Downloads[\\/]/i.test(p)) {
      p = path.join(os.homedir(), p);
    } else {
      // Bare filenames default directly to user's real Desktop
      p = path.join(os.homedir(), 'Desktop', p);
    }
  }

  return path.resolve(p);
}

export function isPathSafe(targetPath: string): {
  safe: boolean;
  resolvedPath: string;
  reason?: string;
} {
  const normalized = resolveUserPath(targetPath);

  // Check forbidden system patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        safe: false,
        resolvedPath: normalized,
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
      resolvedPath: normalized,
      reason:
        'Target path is outside approved user directories (Desktop, Documents, Downloads, Workspace).',
    };
  }

  return { safe: true, resolvedPath: normalized };
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

  const resolved = check.resolvedPath;
  if (!fs.existsSync(resolved)) {
    return {
      success: false,
      message: `File not found: ${path.basename(filePath)} on ${path.dirname(resolved)}`,
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
      message: `File "${path.basename(resolved)}" read successfully (${stats.size} bytes).`,
      data: {
        fileName: path.basename(resolved),
        path: resolved,
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
  let targetPath = (filePath || 'untitled.txt')
    .trim()
    .replace(/^["']+|["']+$/g, '');

  // If no extension is specified, default to .txt
  if (!path.extname(targetPath)) {
    targetPath += '.txt';
  }

  const check = isPathSafe(targetPath);
  if (!check.safe) {
    return {
      success: false,
      message: `Security violation: ${check.reason}`,
      error: check.reason,
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  const allowedExts = new Set([
    '.txt',
    '.md',
    '.json',
    '.csv',
    '.log',
    '.js',
    '.ts',
    '.py',
    '.html',
    '.css',
    '.xml',
    '.yaml',
    '.yml',
    '.sql',
  ]);
  const ext = path.extname(check.resolvedPath).toLowerCase();
  if (!allowedExts.has(ext)) {
    return {
      success: false,
      message: `Disallowed file extension "${ext}". Approved extensions: .txt, .md, .json, .csv, .log, .js, .ts, .py, .html, .css`,
      error: 'Invalid file extension',
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  try {
    const resolved = check.resolvedPath;
    fs.mkdirSync(path.dirname(resolved), { recursive: true });

    // Safety: If file already exists, create a .bak copy before overwriting
    let backupPath: string | undefined;
    if (fs.existsSync(resolved)) {
      try {
        backupPath = `${resolved}.bak`;
        fs.copyFileSync(resolved, backupPath);
      } catch (bakErr) {
        console.warn('[FileTools] Failed to create backup:', bakErr);
      }
    }

    fs.writeFileSync(resolved, content, 'utf-8');
    const elapsed = Math.round(performance.now() - startTime);
    const backupNotice = backupPath
      ? ` (previous version preserved as ${path.basename(backupPath)})`
      : '';
    return {
      success: true,
      message: `File "${path.basename(resolved)}" saved successfully on ${path.dirname(resolved)}${backupNotice}, sir.`,
      data: {
        fileName: path.basename(resolved),
        path: resolved,
        backupPath,
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
