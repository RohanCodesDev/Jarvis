import React from 'react';
import type { ChatMessage } from '../../types/hud';

interface DialogueToastProps {
  message?: ChatMessage;
}

export const DialogueToast: React.FC<DialogueToastProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="floating-dialogue-card">
      <div className="floating-dialogue-header">
        <span>{message.sender === 'user' ? 'YOU' : 'JARVIS'}</span>
        <span>{message.timestamp}</span>
      </div>
      <div className="floating-dialogue-text">{message.text}</div>
    </div>
  );
};
