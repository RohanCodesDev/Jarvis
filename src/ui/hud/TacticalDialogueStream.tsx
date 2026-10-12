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
    'Hello sir. Systems are online and ready for your command.';

  if (assistantState === 'thinking') {
    activeText = 'Thinking... Processing your request.';
  } else if (assistantState === 'listening') {
    activeText = 'Listening... Speak your command.';
  } else if (assistantState === 'error') {
    activeText = 'Alert. Defensive protocol simulated.';
  }

  const { displayedText, cursorVisible, isTyping } = useTypewriter(activeText);

  // Identify operator query
  const operatorText =
    latestMessage?.sender === 'user'
      ? latestMessage.text
      : previousMessage?.sender === 'user'
        ? previousMessage.text
        : null;

  return (
    <div
      className="hacker-dialogue-flank"
      aria-label="Messages Stream"
    >
      {/* 1. Clean Header */}
      <div className="hacker-stream-header">
        <span className="hacker-tag">// MESSAGES</span>
        <span className="hacker-meta">LIVE</span>
      </div>

      {/* 2. Previous User Query */}
      {operatorText && (
        <div className="hacker-operator-line">
          <span className="hacker-prompt-symbol">&gt;</span>
          <span className="hacker-operator-label">YOU:</span>
          <span className="hacker-operator-content">
            &ldquo;{operatorText}&rdquo;
          </span>
        </div>
      )}

      {/* 3. Real-Time Typewriter Stream */}
      <div className="hacker-response-line">
        <div className="hacker-response-meta">
          <span className="hacker-prefix">
            {assistantState === 'thinking'
              ? 'JARVIS (thinking...)'
              : assistantState === 'listening'
                ? 'JARVIS (listening...)'
                : assistantState === 'error'
                  ? 'SYSTEM ALERT'
                  : 'JARVIS'}
          </span>
          <span className="hacker-timestamp">
            {latestMessage?.timestamp ||
              new Date().toLocaleTimeString('en-US', { hour12: false })}
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

      {/* 4. Minimal Status Footer */}
      <div className="hacker-stream-footer">
        <span>STATUS: {assistantState.toUpperCase()}</span>
        <span>•</span>
        <span>SECURE</span>
      </div>
    </div>
  );
};

export default TacticalDialogueStream;

