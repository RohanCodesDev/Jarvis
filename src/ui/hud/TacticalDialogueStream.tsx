import React from 'react';
import type { ChatMessage, AssistantState } from '../../types/hud';
import { useTypewriter } from '../hooks/useTypewriter';

interface TacticalDialogueStreamProps {
  latestMessage?: ChatMessage;
  previousMessage?: ChatMessage;
  assistantState: AssistantState;
}

export const TacticalDialogueStream: React.FC<TacticalDialogueStreamProps> = ({
  latestMessage,
  previousMessage,
  assistantState,
}) => {
  // Determine active text to display with typewriter animation
  let activeText =
    latestMessage?.text ||
    'Stark Industries Core initialized. Standing by for directives, sir.';

  if (assistantState === 'thinking') {
    activeText = 'COGNITIVE ENGINE ENGAGED // Synthesizing response stream...';
  } else if (assistantState === 'listening') {
    activeText =
      'ACOUSTIC CAPTURE ACTIVE // Monitoring harmonic voice frequencies...';
  } else if (assistantState === 'error') {
    activeText =
      'DEFCON-1 ALERT MATRIX ENGAGED // Core defensive override simulated.';
  }

  const { displayedText, cursorVisible, isTyping } = useTypewriter(activeText);

  // Identify operator query if the latest was jarvis or if previous was user
  const operatorText =
    latestMessage?.sender === 'user'
      ? latestMessage.text
      : previousMessage?.sender === 'user'
        ? previousMessage.text
        : null;

  return (
    <div
      className="hacker-dialogue-flank"
      aria-label="Tactical Dialogue Stream"
    >
      {/* 1. Technical Stream Header */}
      <div className="hacker-stream-header">
        <span className="hacker-tag">// DIRECTIVE_CONSOLE</span>
        <span className="hacker-meta">CH-01 [0x85_TGT]</span>
      </div>

      {/* 2. Previous Operator Directive (Dimmed Hologram) */}
      {operatorText && (
        <div className="hacker-operator-line">
          <span className="hacker-prompt-symbol">&gt;</span>
          <span className="hacker-operator-label">OPERATOR:</span>
          <span className="hacker-operator-content">
            &ldquo;{operatorText}&rdquo;
          </span>
        </div>
      )}

      {/* 3. Real-Time Dynamic Typewriter Stream */}
      <div className="hacker-response-line">
        <div className="hacker-response-meta">
          <span className="hacker-prefix">
            {assistantState === 'thinking'
              ? ':: COGNITIVE_INFERENCE'
              : assistantState === 'listening'
                ? ':: ACOUSTIC_STREAM'
                : assistantState === 'error'
                  ? ':: ALERT_OVERRIDE'
                  : ':: JARVIS_OUTPUT'}
          </span>
          <span className="hacker-timestamp">
            [
            {latestMessage?.timestamp ||
              new Date().toLocaleTimeString('en-US', { hour12: false })}
            ]
          </span>
        </div>

        <div className="hacker-typewriter-body">
          <span className="hacker-body-text">{displayedText}</span>
          <span
            className={`hacker-cursor ${cursorVisible || isTyping ? 'visible' : 'hidden'}`}
          >
            █
          </span>
        </div>
      </div>

      {/* 4. Tactical Coordinate / Telemetry Subscript */}
      <div className="hacker-stream-footer">
        <span>STATUS: {assistantState.toUpperCase()}</span>
        <span>•</span>
        <span>ENCRYPT: OS_DPAPI</span>
        <span>•</span>
        <span>FPS: 60</span>
      </div>
    </div>
  );
};

export default TacticalDialogueStream;
