import React, { useState } from 'react';
import { Send, Mic } from 'lucide-react';
import type { AssistantState } from '../../types/hud';

interface CommandDockProps {
  assistantState: AssistantState;
  onSendMessage: (text: string) => void;
  onVoiceTrigger: () => void;
}

export const CommandDock: React.FC<CommandDockProps> = ({
  assistantState,
  onSendMessage,
  onVoiceTrigger,
}) => {
  const [inputText, setInputText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || assistantState === 'thinking') return;
    onSendMessage(inputText);
    setInputText('');
  };

  return (
    <div className="floating-command-dock">
      <form className="command-input-bar" onSubmit={handleSubmit}>
        <input
          type="text"
          className="command-text-field"
          placeholder="Ask JARVIS anything..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={assistantState === 'thinking'}
        />

        <button
          type="button"
          className={`command-action-icon ${assistantState === 'listening' ? 'listening' : ''}`}
          title="Dictate with microphone"
          onClick={onVoiceTrigger}
        >
          <Mic size={18} />
        </button>

        <button
          type="submit"
          className="command-action-icon send-action"
          disabled={!inputText.trim() || assistantState === 'thinking'}
          title="Send directive"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};
