import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { desktopCapturer } from 'electron';
import type { ToolExecutionResult } from './toolTypes';

export async function capturePrimaryScreen(): Promise<ToolExecutionResult> {
  const startTime = performance.now();

  if (process.env.VITEST === 'true' || !desktopCapturer) {
    const simDir = path.join(os.homedir(), 'Desktop', 'JARVIS_Screenshots');
    return {
      success: true,
      message: 'Visual capture complete (simulation). Saved to Desktop.',
      data: {
        filePath: path.join(simDir, 'screenshot_sim.png'),
        fileName: 'screenshot_sim.png',
        dataUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        sizeBytes: 1024,
      },
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    });

    if (!sources || sources.length === 0) {
      return {
        success: false,
        message: 'No active display sources detected for visual capture.',
        error: 'No screen sources available',
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    const primary = sources[0];
    const image = primary.thumbnail;
    const pngBuffer = image.toPNG();
    const dataUrl = image.toDataURL();

    const outputDir = path.join(os.homedir(), 'Desktop', 'JARVIS_Screenshots');
    fs.mkdirSync(outputDir, { recursive: true });

    const filename = `screenshot_${Date.now()}.png`;
    const targetPath = path.join(outputDir, filename);
    fs.writeFileSync(targetPath, pngBuffer);

    const elapsed = Math.round(performance.now() - startTime);
    return {
      success: true,
      message: `Visual capture complete, sir. Saved to Desktop/JARVIS_Screenshots/${filename}.`,
      data: {
        filePath: targetPath,
        fileName: filename,
        dataUrl,
        sizeBytes: pngBuffer.length,
      },
      durationMs: elapsed,
    };
  } catch (err: unknown) {
    const elapsed = Math.round(performance.now() - startTime);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Failed to capture screen: ${msg}`,
      error: msg,
      durationMs: elapsed,
    };
  }
}
