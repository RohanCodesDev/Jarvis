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

  // 1. Battery & Hardware Telemetry
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

  // 2. Direct Web URL launcher (e.g. "open https://...", "go to youtube.com")
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

  // 3. Open Application (e.g. "open spotify", "launch visual studio code", "start calc")
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
        // Fallback for empty or invalid JSON: treat as empty object
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
