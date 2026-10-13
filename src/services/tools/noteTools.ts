import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ToolExecutionResult } from './toolTypes';

function getNotesFilePath(): string {
  return path.join(os.homedir(), 'Desktop', 'JARVIS_Notes.md');
}

export async function addQuickNote(
  content: string,
): Promise<ToolExecutionResult> {
  const startTime = performance.now();
  const cleanContent = content.trim();

  if (!cleanContent) {
    return {
      success: false,
      message: 'Note content cannot be empty.',
      error: 'Empty note content',
      durationMs: 0,
    };
  }

  const filePath = getNotesFilePath();
  const timestamp = new Date().toLocaleString('en-US', { hour12: false });
  const entry = `- **[${timestamp}]**: ${cleanContent}\n`;

  try {
    if (!fs.existsSync(filePath)) {
      const header = '# J.A.R.V.I.S. Tactical Memos & Notes\n\n';
      fs.writeFileSync(filePath, header + entry, 'utf-8');
    } else {
      fs.appendFileSync(filePath, entry, 'utf-8');
    }

    const elapsed = Math.round(performance.now() - startTime);
    return {
      success: true,
      message: `Note archived to Desktop/JARVIS_Notes.md: "${cleanContent}"`,
      data: { content: cleanContent, filePath },
      durationMs: elapsed,
    };
  } catch (err: unknown) {
    const elapsed = Math.round(performance.now() - startTime);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Failed to archive note: ${msg}`,
      error: msg,
      durationMs: elapsed,
    };
  }
}

export async function readQuickNotes(): Promise<ToolExecutionResult> {
  const startTime = performance.now();
  const filePath = getNotesFilePath();

  if (!fs.existsSync(filePath)) {
    return {
      success: true,
      message: 'You have no saved notes on your Desktop yet, sir.',
      data: { notes: [] },
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const lines = raw
      .split('\n')
      .filter((l) => l.startsWith('- **['))
      .slice(-3); // get last 3 notes

    const elapsed = Math.round(performance.now() - startTime);
    if (lines.length === 0) {
      return {
        success: true,
        message: 'No active notes recorded, sir.',
        data: { notes: [] },
        durationMs: elapsed,
      };
    }

    const summary = lines.join('\n');
    return {
      success: true,
      message: `Latest archived notes:\n${summary}`,
      data: { notes: lines },
      durationMs: elapsed,
    };
  } catch (err: unknown) {
    const elapsed = Math.round(performance.now() - startTime);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Failed to read notes: ${msg}`,
      error: msg,
      durationMs: elapsed,
    };
  }
}
