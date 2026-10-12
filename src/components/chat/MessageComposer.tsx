import React, { useState } from 'react';
import { Send, Mic, Terminal } from 'lucide-react';

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

  const protocols = [
    { label: '[PROTO: DIAGNOSTICS]', prompt: 'Run complete desktop telemetry diagnostics' },
    { label: '[PROTO: MEMORY_BANK]', prompt: 'Query durable memory banks' },
    { label: '[PROTO: AUDIO_TEST]', prompt: 'Initiate acoustic synthesis harmonic test' },
    { label: '[PROTO: DEFCON_ALERT]', prompt: 'Simulate critical subsystem alert' },
  ];

  return (
    <div className="terminal-composer-area">
      <div className="protocol-chip-scroll">
        {protocols.map((p, idx) => (
          <button
            key={idx}
            className="protocol-chip"
            onClick={() => setInputText(p.prompt)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="composer-input-row">
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
          <Terminal
            size={13}
            color="var(--hud-cyan)"
            style={{ position: 'absolute', left: '12px', pointerEvents: 'none', opacity: 0.7 }}
          />
          <input
            type="text"
            className="terminal-text-input"
            style={{ paddingLeft: '32px' }}
            placeholder="Enter directive or voice query... (Return to transmit)"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
          />
        </div>

        <button
          className="hud-btn hud-btn-icon"
          title="Engage Voice Dictation"
          onClick={onVoiceInputTrigger}
          type="button"
        >
          <Mic size={15} />
        </button>

        <button
          className="hud-btn hud-btn-primary"
          onClick={handleSend}
          disabled={!inputText.trim() || disabled}
          type="button"
          style={{ opacity: !inputText.trim() || disabled ? 0.45 : 1 }}
        >
          <Send size={13} />
          <span>Transmit</span>
        </button>
      </div>
    </div>
  );
};
