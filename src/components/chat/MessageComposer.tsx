import React, { useState } from 'react';
import { Send, Mic, Sparkles } from 'lucide-react';

interface MessageComposerProps {
  onSendMessage: (text: string) => void;
  onVoiceInputTrigger: () => void;
  disabled?: boolean;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  onVoiceInputTrigger,
  disabled = false,
}) => {
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (!inputText.trim() || disabled) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInputText(prompt);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
        {[
          'Run desktop system diagnostics',
          'What are my active memory items?',
          'Simulate voice audio response',
        ].map((p, idx) => (
          <button
            key={idx}
            className="hud-tag"
            style={{ cursor: 'pointer', background: 'rgba(0, 229, 255, 0.05)', whiteSpace: 'nowrap' }}
            onClick={() => handleQuickPrompt(p)}
          >
            <Sparkles size={10} style={{ display: 'inline', marginRight: '4px' }} />
            {p}
          </button>
        ))}
      </div>

      <div className="chat-composer">
        <input
          type="text"
          className="chat-input"
          placeholder="Command or query JARVIS... (Press Enter to send)"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />

        <button
          className="hud-btn hud-btn-icon"
          title="Dictate with voice"
          onClick={onVoiceInputTrigger}
          type="button"
        >
          <Mic size={16} />
        </button>

        <button
          className="hud-btn hud-btn-primary"
          onClick={handleSend}
          disabled={!inputText.trim() || disabled}
          type="button"
          style={{ opacity: !inputText.trim() || disabled ? 0.5 : 1 }}
        >
          <Send size={15} />
          <span>Send</span>
        </button>
      </div>
    </div>
  );
};
