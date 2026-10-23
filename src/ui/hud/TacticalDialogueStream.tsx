import React, { useRef, useEffect } from 'react';
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check if message is actively streaming tokens
  const isStreaming = latestMessage?.status === 'sending';
  const hasJarvisText =
    latestMessage?.sender === 'jarvis' && !!latestMessage.text;

  // Determine active text to display
  let activeText = '';
  if (hasJarvisText) {
    activeText = latestMessage.text;
  } else if (assistantState === 'thinking') {
    activeText = 'Scanning optical feed & analyzing visual buffers...';
  } else if (assistantState === 'listening') {
    activeText = 'Listening... Speak your command.';
  } else if (assistantState === 'error') {
    activeText = 'Alert. Visual receptor stream error.';
  } else {
    activeText =
      latestMessage?.text ||
      'Hello sir. Systems are online and ready for your command.';
  }

  // Typewriter for static transitions, but bypass for active live token streaming so text shows immediately
  const { displayedText, cursorVisible, isTyping } = useTypewriter(
    isStreaming ? '' : activeText,
  );

  const textToShow = isStreaming ? activeText : displayedText || activeText;

  // Auto-scroll to follow cursor as text streams
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [textToShow]);

  // Identify operator query
  const operatorText =
    latestMessage?.sender === 'user'
      ? latestMessage.text
      : previousMessage?.sender === 'user'
        ? previousMessage.text
        : null;

  return (
    <div className="hacker-dialogue-flank" aria-label="Messages Stream">
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

        <div className="hacker-typewriter-body" ref={scrollRef}>
          <span className="hacker-body-text">{textToShow}</span>
          <span
            className={`hacker-cursor ${cursorVisible || isStreaming || isTyping ? 'visible' : 'hidden'}`}
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
