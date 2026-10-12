import React, { useState, useEffect } from 'react';
import { Cpu, ShieldCheck, Settings, Database, Mic, MicOff, Volume2, VolumeX, Radio, MessageSquare } from 'lucide-react';
import type { SystemTelemetry, AssistantState } from '../../types/hud';

interface HeaderProps {
  telemetry: SystemTelemetry;
  assistantState: AssistantState;
  onToggleMic: () => void;
  onToggleSpeaker: () => void;
  onOpenSettings: () => void;
  onOpenMemory: () => void;
  onToggleDrawer: () => void;
  messagesCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  telemetry,
  assistantState,
  onToggleMic,
  onToggleSpeaker,
  onOpenSettings,
  onOpenMemory,
  onToggleDrawer,
  messagesCount,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-US', { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="hud-header">
      <div className="hud-brand">
        <div className="hud-brand-symbol">
          <Radio size={16} />
        </div>
        <div className="hud-title">
          <span>JARVIS</span>
          <span className="hud-tag">MK-85</span>
        </div>
        <div className="hud-status-node" style={{ marginLeft: '6px' }}>
          <span className={`hud-status-orb ${assistantState}`} />
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            {assistantState.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="hud-telemetry-center">
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Cpu size={12} color="var(--hud-cyan)" />
          <span>CORE: <strong>{telemetry.cpuUsage}%</strong></span>
        </div>
        <div>•</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <ShieldCheck size={12} color="#86efac" />
          <span>MODEL: <strong>{telemetry.activeModel.split(' ')[0]}</strong></span>
        </div>
        <div>•</div>
        <span>FREQ: <strong>1420 MHZ</strong></span>
        <div>•</div>
        <span className="hud-tag" style={{ color: 'var(--hud-cyan)' }}>
          {timeStr || '12:00:00'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          className="hud-btn hud-btn-icon"
          title={telemetry.micEnabled ? 'Mute Microphone' : 'Engage Microphone'}
          onClick={onToggleMic}
          style={{ borderColor: telemetry.micEnabled ? 'var(--hud-cyan)' : 'var(--hud-cyan-border)' }}
        >
          {telemetry.micEnabled ? <Mic size={14} /> : <MicOff size={14} color="var(--text-dim)" />}
        </button>

        <button
          className="hud-btn hud-btn-icon"
          title={telemetry.speakerEnabled ? 'Mute Speech Output' : 'Engage Speech Output'}
          onClick={onToggleSpeaker}
          style={{ borderColor: telemetry.speakerEnabled ? 'var(--hud-cyan)' : 'var(--hud-cyan-border)' }}
        >
          {telemetry.speakerEnabled ? <Volume2 size={14} /> : <VolumeX size={14} color="var(--text-dim)" />}
        </button>

        <button
          className="hud-btn"
          onClick={onToggleDrawer}
          title="Open Communications History Drawer"
        >
          <MessageSquare size={13} />
          <span>Comms ({messagesCount})</span>
        </button>

        <button
          className="hud-btn hud-btn-icon"
          onClick={onOpenMemory}
          title="Inspect Persistent Memory Bank"
        >
          <Database size={14} />
        </button>

        <button
          className="hud-btn hud-btn-icon"
          onClick={onOpenSettings}
          title="System & AI Parameters"
        >
          <Settings size={14} />
        </button>
      </div>
    </header>
  );
};
