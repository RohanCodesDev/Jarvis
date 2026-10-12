import React from 'react';
import { Terminal, Trash2, Lock } from 'lucide-react';
import type { ChatMessage, AssistantState } from '../../types/hud';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';

interface ChatPanelProps {
  messages: ChatMessage[];
  assistantState: AssistantState;
  onSendMessage: (text: string) => void;
  onVoiceInputTrigger: () => void;
  onClearMessages: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  assistantState,
  onSendMessage,
  onVoiceInputTrigger,
  onClearMessages,
}) => {
  return (
    <div className="hud-panel hud-chat-terminal">
      <div className="terminal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={15} color="var(--hud-cyan)" />
          <span>COMMS UPLINK // TACTICAL DIALOGUE</span>
          <span className="hud-tag" style={{ color: '#86efac' }}>
            <Lock size={10} style={{ display: 'inline', marginRight: '3px' }} />
            AES-256
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="hud-tag">{messages.length} LOGS</span>
          <button
            className="hud-btn hud-btn-icon"
            style={{ width: '26px', height: '26px' }}
            title="Purge Comms Buffer"
            onClick={onClearMessages}
          >
            <Trash2 size={12} color="var(--text-dim)" />
          </button>
        </div>
      </div>

      <MessageList messages={messages} />

      <MessageComposer
        onSendMessage={onSendMessage}
        onVoiceInputTrigger={onVoiceInputTrigger}
        disabled={assistantState === 'thinking'}
      />
    </div>
  );
};
