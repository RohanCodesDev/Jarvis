import React from 'react';
import { X, Trash2 } from 'lucide-react';
import type { ChatMessage } from '../../types/hud';

interface CommsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onClearMessages: () => void;
}

export const CommsDrawer: React.FC<CommsDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  onClearMessages,
}) => {
  if (!isOpen) return null;

  return (
    <div className="comms-drawer-backdrop" onClick={onClose}>
      <div className="comms-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="comms-drawer-header">
          <span>COMMUNICATIONS HISTORY</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              className="hud-btn hud-btn-icon"
              style={{ width: '26px', height: '26px' }}
              title="Purge Comms History"
              onClick={onClearMessages}
            >
              <Trash2 size={12} color="var(--text-dim)" />
            </button>
            <button
              className="hud-btn hud-btn-icon"
              style={{ width: '26px', height: '26px' }}
              onClick={onClose}
            >
              <X size={13} />
            </button>
          </div>
        </div>

        <div className="comms-drawer-messages">
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', marginTop: '40px', fontFamily: 'var(--font-mono)' }}>
              No messages logged.
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`drawer-msg-card ${m.sender}`}>
                <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: m.sender === 'user' ? '#93c5fd' : 'var(--hud-cyan)', marginBottom: '3px' }}>
                  {m.sender === 'user' ? '[OPERATOR]' : '[JARVIS]'} • {m.timestamp}
                </div>
                <div>{m.text}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
