import React, { useEffect, useRef } from 'react';
import { Bot, User, Terminal } from 'lucide-react';
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
    <div className="chat-messages-scroll" ref={scrollRef}>
      {messages.map((msg) => {
        const isUser = msg.sender === 'user';
        const isJarvis = msg.sender === 'jarvis';

        return (
          <div
            key={msg.id}
            className={`chat-message-row ${isUser ? 'user' : 'jarvis'}`}
          >
            <div className={`chat-avatar ${isUser ? 'user' : 'jarvis'}`}>
              {isUser ? <User size={16} /> : isJarvis ? <Bot size={16} /> : <Terminal size={16} />}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="chat-bubble">
                {msg.text}
              </div>

              <div className="message-meta">
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
