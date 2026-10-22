import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  MessageSquare,
  Terminal,
  Zap,
  Play,
  Pause,
  Clock,
  ShieldAlert,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import type { ChatMessage, ActivityItem } from '../../types/hud';
import type { WorkflowItem } from '../../services/automation/workflowTypes';

interface CommsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  activities?: ActivityItem[];
  onClearMessages: () => void;
}

const MessageBody: React.FC<{ text: string }> = ({ text }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!text || !text.includes('```')) {
    return (
      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {text}
      </div>
    );
  }

  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div style={{ wordBreak: 'break-word' }}>
      {parts.map((part, idx) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          const firstLine = lines[0].trim();
          const hasLang = /^[a-zA-Z0-9_\-]+$/.test(firstLine);
          const lang = hasLang ? firstLine : '';
          const code = (hasLang ? lines.slice(1) : lines).join('\n');

          const handleCopy = () => {
            navigator.clipboard.writeText(code).catch(() => {});
            setCopiedIndex(idx);
            setTimeout(() => setCopiedIndex(null), 1800);
          };

          return (
            <div
              key={idx}
              style={{
                margin: '6px 0',
                borderRadius: '4px',
                border: '1px solid rgba(0, 240, 255, 0.25)',
                backgroundColor: 'rgba(2, 8, 16, 0.85)',
                overflow: 'hidden',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '3px 8px',
                  backgroundColor: 'rgba(0, 240, 255, 0.08)',
                  fontSize: '9.5px',
                  color: 'var(--hud-cyan)',
                }}
              >
                <span>{lang ? lang.toUpperCase() : 'CODE'}</span>
                <button
                  className="hud-btn"
                  style={{
                    padding: '1px 5px',
                    fontSize: '9px',
                    minHeight: 'auto',
                    border: '1px solid rgba(0, 240, 255, 0.3)',
                  }}
                  onClick={handleCopy}
                >
                  {copiedIndex === idx ? 'COPIED ✓' : 'COPY'}
                </button>
              </div>
              <pre
                style={{
                  padding: '8px',
                  margin: 0,
                  fontSize: '11px',
                  color: 'var(--text-primary)',
                  overflowX: 'auto',
                }}
              >
                <code>{code}</code>
              </pre>
            </div>
          );
        }
        return (
          <span key={idx} style={{ whiteSpace: 'pre-wrap' }}>
            {part}
          </span>
        );
      })}
    </div>
  );
};

export const CommsDrawer: React.FC<CommsDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  activities = [],
  onClearMessages,
}) => {
  const [activeTab, setActiveTab] = useState<
    'messages' | 'activity' | 'automation'
  >('messages');
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [runningActionId, setRunningActionId] = useState<string | null>(null);

  const fetchWorkflows = () => {
    if (window.jarvisDesktop?.getWorkflows) {
      window.jarvisDesktop.getWorkflows().then(setWorkflows).catch(() => {});
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchWorkflows();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!window.jarvisDesktop?.onWorkflowUpdated) return;
    const unsub = window.jarvisDesktop.onWorkflowUpdated((updatedWf) => {
      setWorkflows((prev) => {
        const idx = prev.findIndex((w) => w.id === updatedWf.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = updatedWf;
          return copy;
        }
        return [updatedWf, ...prev];
      });
    });
    return unsub;
  }, []);

  const handleRunNow = async (id: string) => {
    if (!window.jarvisDesktop?.executeWorkflowNow) return;
    setRunningActionId(id);
    try {
      await window.jarvisDesktop.executeWorkflowNow(id);
      fetchWorkflows();
    } finally {
      setTimeout(() => setRunningActionId(null), 600);
    }
  };

  const handleToggle = async (id: string) => {
    if (!window.jarvisDesktop?.toggleWorkflow) return;
    await window.jarvisDesktop.toggleWorkflow(id);
    fetchWorkflows();
  };

  const handleDelete = async (id: string) => {
    if (!window.jarvisDesktop?.deleteWorkflow) return;
    await window.jarvisDesktop.deleteWorkflow(id);
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
  };

  const createPreset = async (
    type: 'briefing' | 'battery' | 'night' | 'sentry',
  ) => {
    if (!window.jarvisDesktop?.createWorkflow) return;
    if (type === 'briefing') {
      await window.jarvisDesktop.createWorkflow({
        name: 'Morning Protocol Briefing',
        triggerType: 'daily_time',
        triggerConfig: { targetTime: '09:00' },
        actionType: 'speech',
        actionPayload: {
          speechText:
            'Good morning, sir. System diagnostics are nominal. Ready for your directives.',
        },
      });
    } else if (type === 'battery') {
      await window.jarvisDesktop.createWorkflow({
        name: 'Battery Sentry Guard',
        triggerType: 'condition',
        triggerConfig: {
          condition: { metric: 'battery', operator: '<', value: 20 },
        },
        actionType: 'speech',
        actionPayload: {
          speechText:
            'Warning: Host battery has fallen below 20%. Please connect AC power.',
        },
      });
    } else if (type === 'night') {
      await window.jarvisDesktop.createWorkflow({
        name: 'Midnight Focus Protocol',
        triggerType: 'daily_time',
        triggerConfig: { targetTime: '23:00' },
        actionType: 'tool',
        actionPayload: {
          toolId: 'volume_control',
          args: { action: 'set', level: 15 },
        },
      });
    } else if (type === 'sentry') {
      await window.jarvisDesktop.createWorkflow({
        name: 'Diagnostics Heartbeat',
        triggerType: 'interval',
        triggerConfig: { intervalMinutes: 30 },
        actionType: 'tool',
        actionPayload: { toolId: 'system_diagnostics' },
      });
    }
    fetchWorkflows();
  };

  if (!isOpen) return null;

  return (
    <div className="comms-drawer-backdrop" onClick={onClose}>
      <div className="comms-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="comms-drawer-header">
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
            <button
              className="hud-btn"
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                color:
                  activeTab === 'automation'
                    ? 'var(--hud-cyan)'
                    : 'var(--text-dim)',
                borderColor:
                  activeTab === 'automation'
                    ? 'var(--hud-cyan)'
                    : 'transparent',
              }}
              onClick={() => {
                setActiveTab('automation');
                fetchWorkflows();
              }}
            >
              <Zap size={11} style={{ marginRight: '4px' }} />
              <span>
                AUTOMATION (
                {workflows.filter((w) => w.status === 'active').length})
              </span>
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
            {activeTab === 'automation' && (
              <button
                className="hud-btn hud-btn-icon"
                style={{ width: '26px', height: '26px' }}
                title="Refresh Workflows"
                onClick={fetchWorkflows}
              >
                <RefreshCw size={12} color="var(--hud-cyan)" />
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
                  <MessageBody text={m.text} />
                </div>
              ))
            )
          ) : activeTab === 'activity' ? (
            activities.length === 0 ? (
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
            )
          ) : (
            /* AUTOMATION TAB */
            <div>
              {/* Quick Presets Bar */}
              <div
                style={{
                  padding: '8px 10px',
                  marginBottom: '12px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(0, 240, 255, 0.05)',
                  border: '1px solid rgba(0, 240, 255, 0.2)',
                }}
              >
                <div
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--hud-cyan)',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  ⚡ Arm Preset Protocols
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                  }}
                >
                  <button
                    className="hud-btn"
                    style={{ padding: '3px 7px', fontSize: '10px' }}
                    onClick={() => createPreset('briefing')}
                  >
                    <Clock size={10} style={{ marginRight: '4px' }} />
                    09:00 Briefing
                  </button>
                  <button
                    className="hud-btn"
                    style={{ padding: '3px 7px', fontSize: '10px' }}
                    onClick={() => createPreset('battery')}
                  >
                    <ShieldAlert size={10} style={{ marginRight: '4px' }} />
                    Battery Guard &lt;20%
                  </button>
                  <button
                    className="hud-btn"
                    style={{ padding: '3px 7px', fontSize: '10px' }}
                    onClick={() => createPreset('sentry')}
                  >
                    <Cpu size={10} style={{ marginRight: '4px' }} />
                    System Sentry (30m)
                  </button>
                  <button
                    className="hud-btn"
                    style={{ padding: '3px 7px', fontSize: '10px' }}
                    onClick={() => createPreset('night')}
                  >
                    <Clock size={10} style={{ marginRight: '4px' }} />
                    23:00 Quiet Mode
                  </button>
                </div>
              </div>

              {/* Workflows List */}
              {workflows.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    color: 'var(--text-dim)',
                    marginTop: '30px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                  }}
                >
                  No autonomous protocols armed.
                  <div style={{ marginTop: '6px', fontSize: '10.5px' }}>
                    Arm a preset above or say &quot;in 5 minutes set volume to
                    20&quot; or &quot;every 15 minutes check battery&quot;.
                  </div>
                </div>
              ) : (
                workflows.map((wf) => {
                  const isActive = wf.status === 'active';
                  const isCompleted = wf.status === 'completed';
                  const isPaused = wf.status === 'paused';

                  const statusColor = isActive
                    ? 'var(--hud-cyan)'
                    : isCompleted
                      ? '#10b981'
                      : '#f59e0b';

                  let triggerDesc = '';
                  if (wf.triggerType === 'delay') {
                    const minsLeft = Math.max(
                      0,
                      Math.round((wf.nextRunMs - Date.now()) / 60000),
                    );
                    triggerDesc = isCompleted
                      ? 'One-shot executed'
                      : `Fires in ~${minsLeft}m (${new Date(wf.nextRunMs).toLocaleTimeString()})`;
                  } else if (wf.triggerType === 'interval') {
                    triggerDesc = `Every ${wf.triggerConfig.intervalMinutes}m (Next: ${new Date(wf.nextRunMs).toLocaleTimeString()})`;
                  } else if (wf.triggerType === 'daily_time') {
                    triggerDesc = `Daily @ ${wf.triggerConfig.targetTime} (Next: ${new Date(wf.nextRunMs).toLocaleTimeString()})`;
                  } else if (wf.triggerType === 'condition') {
                    triggerDesc = `Condition: ${wf.triggerConfig.condition?.metric.toUpperCase()} ${wf.triggerConfig.condition?.operator} ${wf.triggerConfig.condition?.value}%`;
                  }

                  let actionDesc = '';
                  if (wf.actionType === 'tool') {
                    actionDesc = `TOOL: ${wf.actionPayload.toolId}`;
                  } else if (wf.actionType === 'mission') {
                    actionDesc = `MISSION: "${wf.actionPayload.prompt || ''}"`;
                  } else if (wf.actionType === 'speech') {
                    actionDesc = `VOCAL: "${wf.actionPayload.speechText || ''}"`;
                  }

                  return (
                    <div
                      key={wf.id}
                      style={{
                        padding: '10px',
                        marginBottom: '8px',
                        borderRadius: '5px',
                        backgroundColor: 'rgba(6, 15, 28, 0.75)',
                        border: `1px solid ${
                          isActive
                            ? 'rgba(0, 240, 255, 0.35)'
                            : 'rgba(255, 255, 255, 0.1)'
                        }`,
                        boxShadow: isActive
                          ? '0 0 10px rgba(0, 240, 255, 0.1)'
                          : 'none',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '4px',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            fontSize: '12px',
                          }}
                        >
                          {wf.name}
                        </span>
                        <span
                          style={{
                            fontSize: '9.5px',
                            padding: '1px 6px',
                            borderRadius: '3px',
                            border: `1px solid ${statusColor}`,
                            color: statusColor,
                            textTransform: 'uppercase',
                          }}
                        >
                          {wf.status}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: '10.5px',
                          color: '#93c5fd',
                          marginBottom: '3px',
                        }}
                      >
                        ⏱ {triggerDesc}
                      </div>

                      <div
                        style={{
                          fontSize: '10px',
                          color: 'var(--hud-cyan)',
                          marginBottom: '6px',
                          opacity: 0.85,
                        }}
                      >
                        ⚡ {actionDesc}
                      </div>

                      {wf.lastResult && (
                        <div
                          style={{
                            fontSize: '9.5px',
                            color: 'var(--text-dim)',
                            marginBottom: '6px',
                          }}
                        >
                          Last Run: {wf.lastResult.message}
                        </div>
                      )}

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          gap: '6px',
                          marginTop: '6px',
                          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                          paddingTop: '6px',
                        }}
                      >
                        <button
                          className="hud-btn"
                          style={{
                            padding: '2px 7px',
                            fontSize: '9.5px',
                            minHeight: 'auto',
                            borderColor: 'rgba(0, 240, 255, 0.4)',
                          }}
                          disabled={runningActionId === wf.id}
                          onClick={() => handleRunNow(wf.id)}
                        >
                          <Play size={10} style={{ marginRight: '3px' }} />
                          {runningActionId === wf.id ? 'RUNNING...' : 'RUN NOW'}
                        </button>
                        <button
                          className="hud-btn"
                          style={{
                            padding: '2px 7px',
                            fontSize: '9.5px',
                            minHeight: 'auto',
                          }}
                          onClick={() => handleToggle(wf.id)}
                        >
                          {isActive ? (
                            <>
                              <Pause
                                size={10}
                                style={{ marginRight: '3px' }}
                              />
                              PAUSE
                            </>
                          ) : (
                            <>
                              <Play size={10} style={{ marginRight: '3px' }} />
                              RESUME
                            </>
                          )}
                        </button>
                        <button
                          className="hud-btn"
                          style={{
                            padding: '2px 6px',
                            fontSize: '9.5px',
                            minHeight: 'auto',
                            borderColor: 'rgba(239, 68, 68, 0.4)',
                            color: '#ef4444',
                          }}
                          onClick={() => handleDelete(wf.id)}
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
