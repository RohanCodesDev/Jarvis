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
  const clean = input.trim();
  const lower = clean.toLowerCase();

  // 1. Screen Capture
  const screenshotTriggers = [
    'take screenshot',
    'capture screen',
    'take a screenshot',
    'screenshot',
    'capture display',
    'screen capture',
  ];
  if (screenshotTriggers.some((t) => lower.includes(t))) {
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
  if (lockTriggers.some((t) => lower.includes(t))) {
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
  if (netTriggers.some((t) => lower.includes(t))) {
    return {
      toolId: 'network_diagnostics',
      args: {},
      confidence: 'high',
    };
  }

  // 4. Clipboard Controls
  if (
    lower === 'read clipboard' ||
    lower.includes('check clipboard') ||
    lower.includes('what is on my clipboard') ||
    lower.includes("what's on my clipboard") ||
    lower.includes('read my clipboard')
  ) {
    return {
      toolId: 'clipboard_control',
      args: { action: 'read' },
      confidence: 'high',
    };
  }
  const copyMatch = clean.match(
    /(?:copy to clipboard[:\s]+|copy this to clipboard[:\s]+)(.+)/i,
  );
  if (copyMatch && copyMatch[1]) {
    return {
      toolId: 'clipboard_control',
      args: { action: 'write', text: copyMatch[1].trim() },
      confidence: 'high',
    };
  }

  // 5. Display Brightness Controls
  if (
    lower.includes('check brightness') ||
    lower.includes('what is my brightness') ||
    lower === 'brightness'
  ) {
    return {
      toolId: 'brightness_control',
      args: { action: 'get' },
      confidence: 'high',
    };
  }
  const dimTriggers = [
    'dim brightness',
    'dim my brightness',
    'dim the brightness',
    'dim screen',
    'dim display',
    'dim my screen',
    'dim the screen',
    'lower brightness',
    'lower my brightness',
    'lower the brightness',
    'reduce brightness',
    'decrease brightness',
    'turn down brightness',
    'darker screen',
    'darker display',
  ];
  if (dimTriggers.some((t) => lower.includes(t))) {
    return {
      toolId: 'brightness_control',
      args: { action: 'set', level: 35 },
      confidence: 'high',
    };
  }

  const raiseTriggers = [
    'increase brightness',
    'raise brightness',
    'brighten screen',
    'turn up brightness',
    'boost brightness',
    'brighter screen',
    'max brightness',
    'full brightness',
  ];
  if (raiseTriggers.some((t) => lower.includes(t))) {
    return {
      toolId: 'brightness_control',
      args: { action: 'set', level: 85 },
      confidence: 'high',
    };
  }

  const brightnessMatch = lower.match(
    /(?:set\s+)?(?:the\s+|my\s+)?brightness(?:\s+to)?\s*(\d{1,3})%?/i,
  );
  if (brightnessMatch && brightnessMatch[1]) {
    const level = parseInt(brightnessMatch[1], 10);
    if (!isNaN(level)) {
      return {
        toolId: 'brightness_control',
        args: { action: 'set', level },
        confidence: 'high',
      };
    }
  }

  // 6. Direct Platform Searches (YouTube, GitHub, Google)
  const ytMatch = clean.match(
    /(?:search youtube for|find on youtube|search yt for)\s+(.+)/i,
  );
  if (ytMatch && ytMatch[1]) {
    return {
      toolId: 'direct_search',
      args: { platform: 'youtube', query: ytMatch[1].trim() },
      confidence: 'high',
    };
  }
  const ghMatch = clean.match(/(?:search github for|find on github)\s+(.+)/i);
  if (ghMatch && ghMatch[1]) {
    return {
      toolId: 'direct_search',
      args: { platform: 'github', query: ghMatch[1].trim() },
      confidence: 'high',
    };
  }
  const googleMatch = clean.match(
    /(?:search google for|google for|look up on google)\s+(.+)/i,
  );
  if (googleMatch && googleMatch[1]) {
    return {
      toolId: 'direct_search',
      args: { platform: 'google', query: googleMatch[1].trim() },
      confidence: 'high',
    };
  }

  // 7. Quick Notes / Memos
  if (
    lower === 'read notes' ||
    lower.includes('read my notes') ||
    lower.includes('check notes')
  ) {
    return {
      toolId: 'quick_note',
      args: { action: 'read' },
      confidence: 'high',
    };
  }
  const noteMatch = clean.match(
    /(?:take a note[:\s]+|take note[:\s]+|note[:\s]+|save note[:\s]+)(.+)/i,
  );
  if (noteMatch && noteMatch[1]) {
    return {
      toolId: 'quick_note',
      args: { action: 'add', content: noteMatch[1].trim() },
      confidence: 'high',
    };
  }

  // 8. Close Application (e.g. "close spotify", "exit chrome", "close calculator")
  const closePrefixRegex =
    /^(?:close|exit|terminate|kill|quit)\s+([a-z0-9\s]+)$/i;
  const closeMatch = lower.match(closePrefixRegex);
  if (closeMatch && closeMatch[1]) {
    const candidateName = closeMatch[1].trim();
    const matchedApp = findApprovedApp(candidateName);
    if (matchedApp) {
      return {
        toolId: 'close_app',
        args: { app: matchedApp.id },
        confidence: 'high',
      };
    }
  }

  // 9. Volume Control
  if (
    lower === 'mute' ||
    lower.includes('mute audio') ||
    lower.includes('mute volume') ||
    lower.includes('mute sound')
  ) {
    return {
      toolId: 'volume_control',
      args: { action: 'mute' },
      confidence: 'high',
    };
  }
  if (
    lower === 'unmute' ||
    lower.includes('unmute audio') ||
    lower.includes('unmute volume')
  ) {
    return {
      toolId: 'volume_control',
      args: { action: 'unmute' },
      confidence: 'high',
    };
  }
  if (
    lower.includes('volume up') ||
    lower.includes('increase volume') ||
    lower === 'louder'
  ) {
    return {
      toolId: 'volume_control',
      args: { action: 'up' },
      confidence: 'high',
    };
  }
  if (
    lower.includes('volume down') ||
    lower.includes('decrease volume') ||
    lower === 'quieter'
  ) {
    return {
      toolId: 'volume_control',
      args: { action: 'down' },
      confidence: 'high',
    };
  }
  const setVolumeMatch = lower.match(
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

  // 10. Media Playback Control
  const mediaPauseTriggers = [
    'pause music',
    'pause song',
    'stop music',
    'pause playback',
  ];
  if (mediaPauseTriggers.some((t) => lower.includes(t))) {
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
  if (mediaPlayTriggers.some((t) => lower.includes(t))) {
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
  if (mediaNextTriggers.some((t) => lower.includes(t))) {
    return {
      toolId: 'media_control',
      args: { action: 'next' },
      confidence: 'high',
    };
  }
  const mediaPrevTriggers = ['previous song', 'previous track', 'last song'];
  if (mediaPrevTriggers.some((t) => lower.includes(t))) {
    return {
      toolId: 'media_control',
      args: { action: 'previous' },
      confidence: 'high',
    };
  }

  // 11. Battery & Hardware Telemetry
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
  if (batteryTriggers.some((t) => lower.includes(t))) {
    return {
      toolId: 'system_diagnostics',
      args: {},
      confidence: 'high',
    };
  }

  // 12. Direct Web URL launcher (e.g. "open https://...", "go to youtube.com")
  const urlRegex =
    /(?:open|go to|navigate to|browse to)\s+(https?:\/\/[^\s]+|[a-z0-9-]+\.(?:com|org|net|io|edu|gov|dev)[^\s]*)/i;
  const urlMatch = lower.match(urlRegex);
  if (urlMatch && urlMatch[1]) {
    return {
      toolId: 'open_url',
      args: { url: urlMatch[1] },
      confidence: 'high',
    };
  }

  // 13. Open Application (e.g. "open spotify", "launch visual studio code", "start calc")
  const appPrefixRegex = /^(?:open|launch|start|run|play)\s+([a-z0-9\s]+)$/i;
  const appMatch = lower.match(appPrefixRegex);
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
