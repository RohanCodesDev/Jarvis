import React, { useState } from 'react';
import { X, Trash2, MessageSquare, Terminal } from 'lucide-react';
import type { ChatMessage, ActivityItem } from '../../types/hud';

interface CommsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  activities?: ActivityItem[];
  onClearMessages: () => void;
}

export const CommsDrawer: React.FC<CommsDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  activities = [],
  onClearMessages,
}) => {
  const [activeTab, setActiveTab] = useState<'messages' | 'activity'>(
    'messages',
  );

  if (!isOpen) return null;

  return (
    <div className="comms-drawer-backdrop" onClick={onClose}>
      <div className="comms-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="comms-drawer-header">
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="hud-btn"
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                color:
                  activeTab === 'messages'
                    ? 'var(--hud-cyan)'
                    : 'var(--text-dim)',
                borderColor:
                  activeTab === 'messages' ? 'var(--hud-cyan)' : 'transparent',
              }}
              onClick={() => setActiveTab('messages')}
            >
              <MessageSquare size={11} style={{ marginRight: '4px' }} />
              <span>TRANSCRIPTS ({messages.length})</span>
            </button>
            <button
              className="hud-btn"
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                color:
                  activeTab === 'activity'
                    ? 'var(--hud-cyan)'
                    : 'var(--text-dim)',
                borderColor:
                  activeTab === 'activity' ? 'var(--hud-cyan)' : 'transparent',
              }}
              onClick={() => setActiveTab('activity')}
            >
              <Terminal size={11} style={{ marginRight: '4px' }} />
              <span>TACTICAL LOGS ({activities.length})</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {activeTab === 'messages' && (
              <button
                className="hud-btn hud-btn-icon"
                style={{ width: '26px', height: '26px' }}
                title="Purge Comms History"
                onClick={onClearMessages}
              >
                <Trash2 size={12} color="var(--text-dim)" />
              </button>
            )}
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
          {activeTab === 'messages' ? (
            messages.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  color: 'var(--text-dim)',
                  marginTop: '40px',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                No messages logged.
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`drawer-msg-card ${m.sender}`}>
                  <div
                    style={{
                      fontSize: '9.5px',
                      fontFamily: 'var(--font-mono)',
                      color:
                        m.sender === 'user' ? '#93c5fd' : 'var(--hud-cyan)',
                      marginBottom: '3px',
                    }}
                  >
                    {m.sender === 'user' ? '[OPERATOR]' : '[JARVIS]'} •{' '}
                    {m.timestamp}
                  </div>
                  <div>{m.text}</div>
                </div>
              ))
            )
          ) : activities.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                color: 'var(--text-dim)',
                marginTop: '40px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              No tactical events logged.
            </div>
          ) : (
            activities
              .slice()
              .reverse()
              .map((act) => (
                <div
                  key={act.id}
                  style={{
                    padding: '8px 10px',
                    marginBottom: '6px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(6, 15, 28, 0.65)',
                    borderLeft: `2px solid ${
                      act.level === 'error'
                        ? '#ef4444'
                        : act.level === 'warn'
                          ? '#f59e0b'
                          : act.level === 'success'
                            ? '#10b981'
                            : 'var(--hud-cyan)'
                    }`,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      color: 'var(--text-dim)',
                      marginBottom: '2px',
                      fontSize: '9.5px',
                    }}
                  >
                    <span>[{act.category.toUpperCase()}]</span>
                    <span>{act.timestamp}</span>
                  </div>
                  <div style={{ color: 'var(--text-primary)' }}>
                    {act.message}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
};
