import React from 'react';
import { Terminal, Trash2 } from 'lucide-react';
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
    <div className="hud-panel hud-chat-column">
      <div className="chat-panel-container">
        <div className="chat-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={16} color="var(--cyan-primary)" />
            <span>COMMAND TERMINAL & DIALOGUE</span>
            <span className="hud-tag">{messages.length} MSGS</span>
          </div>

          <button
            className="hud-btn hud-btn-icon"
            style={{ width: '28px', height: '28px' }}
            title="Clear Chat History"
            onClick={onClearMessages}
          >
            <Trash2 size={13} color="var(--text-muted)" />
          </button>
        </div>

        <MessageList messages={messages} />

        <MessageComposer
          onSendMessage={onSendMessage}
          onVoiceInputTrigger={onVoiceInputTrigger}
          disabled={assistantState === 'thinking'}
        />
      </div>
    </div>
  );
};
