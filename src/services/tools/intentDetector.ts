import { findApprovedApp } from './appLauncher';

export interface DetectedAction {
  toolId: string;
  args: Record<string, unknown>;
  confidence: 'high' | 'model';
}

export interface ParsedDirectiveResult {
  cleanedText: string;
  actions: DetectedAction[];
}

/**
 * Fast-path heuristic detection for common user voice and text commands.
 * Runs instantly before querying the LLM to minimize latency for high-frequency actions.
 */
export function detectDirectIntent(input: string): DetectedAction | null {
  if (!input) return null;
  const clean = input.trim().toLowerCase();

  // 1. Screen Capture
  const screenshotTriggers = [
    'take screenshot',
    'capture screen',
    'take a screenshot',
    'screenshot',
    'capture display',
    'screen capture',
  ];
  if (screenshotTriggers.some((t) => clean.includes(t))) {
    return {
      toolId: 'capture_screen',
      args: {},
      confidence: 'high',
    };
  }

  // 2. Lock Workstation
  const lockTriggers = [
    'lock pc',
    'lock computer',
    'lock workstation',
    'secure workstation',
    'lock screen',
    'lock windows',
  ];
  if (lockTriggers.some((t) => clean.includes(t))) {
    return {
      toolId: 'lock_workstation',
      args: {},
      confidence: 'high',
    };
  }

  // 3. Network & Connectivity Telemetry
  const netTriggers = [
    'check wifi',
    'wifi status',
    'check network',
    'network status',
    'internet status',
    'ping check',
    'check connection',
  ];
  if (netTriggers.some((t) => clean.includes(t))) {
    return {
      toolId: 'network_diagnostics',
      args: {},
      confidence: 'high',
    };
  }

  // 4. Volume Control
  if (
    clean === 'mute' ||
    clean.includes('mute audio') ||
    clean.includes('mute volume') ||
    clean.includes('mute sound')
  ) {
    return {
      toolId: 'volume_control',
      args: { action: 'mute' },
      confidence: 'high',
    };
  }
  if (
    clean === 'unmute' ||
    clean.includes('unmute audio') ||
    clean.includes('unmute volume')
  ) {
    return {
      toolId: 'volume_control',
      args: { action: 'unmute' },
      confidence: 'high',
    };
  }
  if (
    clean.includes('volume up') ||
    clean.includes('increase volume') ||
    clean === 'louder'
  ) {
    return {
      toolId: 'volume_control',
      args: { action: 'up' },
      confidence: 'high',
    };
  }
  if (
    clean.includes('volume down') ||
    clean.includes('decrease volume') ||
    clean === 'quieter'
  ) {
    return {
      toolId: 'volume_control',
      args: { action: 'down' },
      confidence: 'high',
    };
  }
  const setVolumeMatch = clean.match(
    /(?:set volume to|volume to|set volume)\s*(\d{1,3})%?/i,
  );
  if (setVolumeMatch && setVolumeMatch[1]) {
    const level = parseInt(setVolumeMatch[1], 10);
    if (!isNaN(level)) {
      return {
        toolId: 'volume_control',
        args: { action: 'set', level },
        confidence: 'high',
      };
    }
  }

  // 5. Media Playback Control
  const mediaPauseTriggers = [
    'pause music',
    'pause song',
    'stop music',
    'pause playback',
  ];
  if (mediaPauseTriggers.some((t) => clean.includes(t))) {
    return {
      toolId: 'media_control',
      args: { action: 'play_pause' },
      confidence: 'high',
    };
  }
  const mediaPlayTriggers = [
    'play music',
    'resume music',
    'resume playback',
    'unpause music',
  ];
  if (mediaPlayTriggers.some((t) => clean.includes(t))) {
    return {
      toolId: 'media_control',
      args: { action: 'play_pause' },
      confidence: 'high',
    };
  }
  const mediaNextTriggers = [
    'next song',
    'next track',
    'skip song',
    'skip track',
  ];
  if (mediaNextTriggers.some((t) => clean.includes(t))) {
    return {
      toolId: 'media_control',
      args: { action: 'next' },
      confidence: 'high',
    };
  }
  const mediaPrevTriggers = ['previous song', 'previous track', 'last song'];
  if (mediaPrevTriggers.some((t) => clean.includes(t))) {
    return {
      toolId: 'media_control',
      args: { action: 'previous' },
      confidence: 'high',
    };
  }

  // 6. Battery & Hardware Telemetry
  const batteryTriggers = [
    'check battery',
    'battery status',
    'battery percentage',
    'battery level',
    'how much battery',
    'system diagnostics',
    'system stats',
    'ram usage',
    'system status',
  ];
  if (batteryTriggers.some((t) => clean.includes(t))) {
    return {
      toolId: 'system_diagnostics',
      args: {},
      confidence: 'high',
    };
  }

  // 7. Direct Web URL launcher (e.g. "open https://...", "go to youtube.com")
  const urlRegex =
    /(?:open|go to|navigate to|browse to)\s+(https?:\/\/[^\s]+|[a-z0-9-]+\.(?:com|org|net|io|edu|gov|dev)[^\s]*)/i;
  const urlMatch = clean.match(urlRegex);
  if (urlMatch && urlMatch[1]) {
    return {
      toolId: 'open_url',
      args: { url: urlMatch[1] },
      confidence: 'high',
    };
  }

  // 8. Open Application (e.g. "open spotify", "launch visual studio code", "start calc")
  const appPrefixRegex = /^(?:open|launch|start|run|play)\s+([a-z0-9\s]+)$/i;
  const appMatch = clean.match(appPrefixRegex);
  if (appMatch && appMatch[1]) {
    const candidateName = appMatch[1].trim();
    const matchedApp = findApprovedApp(candidateName);
    if (matchedApp) {
      return {
        toolId: 'open_app',
        args: { app: matchedApp.id },
        confidence: 'high',
      };
    }
  }

  return null;
}

/**
 * Parses [ACTION: toolId {jsonArgs}] directives emitted in LLM output.
 * Returns the cleaned response text (for display and TTS) alongside parsed actions.
 */
export function parseModelDirectives(rawText: string): ParsedDirectiveResult {
  if (!rawText) {
    return { cleanedText: '', actions: [] };
  }

  const actions: DetectedAction[] = [];
  const actionRegex = /\[ACTION:\s*([a-zA-Z0-9_]+)\s*(\{[\s\S]*?\})\]/g;

  const cleanedText = rawText
    .replace(actionRegex, (_match, toolId, rawJson) => {
      try {
        const args = JSON.parse(rawJson);
        actions.push({
          toolId: toolId.trim(),
          args: typeof args === 'object' && args !== null ? args : {},
          confidence: 'model',
        });
        return '';
      } catch {
        actions.push({
          toolId: toolId.trim(),
          args: {},
          confidence: 'model',
        });
        return '';
      }
    })
    .trim();

  return {
    cleanedText,
    actions,
  };
}
