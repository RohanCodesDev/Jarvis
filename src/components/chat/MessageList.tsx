import React, { useEffect, useRef } from 'react';
import { Bot, User } from 'lucide-react';
import type { ChatMessage } from '../../types/hud';

interface MessageListProps {
  messages: ChatMessage[];
}

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="terminal-messages-flow" ref={scrollRef}>
      {messages.map((msg) => {
        const isUser = msg.sender === 'user';
        const isJarvis = msg.sender === 'jarvis';

        return (
          <div
            key={msg.id}
            className={`terminal-message-card ${isUser ? 'user' : 'jarvis'}`}
          >
            <div className={`terminal-avatar-callsign ${isUser ? 'user' : 'jarvis'}`}>
              {isUser ? <User size={14} /> : <Bot size={14} />}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  color: isUser ? '#93c5fd' : 'var(--hud-cyan)',
                  marginBottom: '2px',
                  letterSpacing: '0.08em',
                }}
              >
                {isUser ? '[OPERATOR // LOCAL]' : '[JARVIS // CORE]'}
              </div>

              <div className="terminal-bubble-content">
                {msg.text}
              </div>

              <div className="terminal-msg-meta">
                <span>{msg.timestamp}</span>
                {msg.metadata?.modelUsed && <span>• {msg.metadata.modelUsed}</span>}
                {msg.metadata?.durationMs && <span>• {msg.metadata.durationMs}ms</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
