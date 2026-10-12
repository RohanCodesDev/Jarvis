import React, { useState, useEffect } from 'react';
import { Cpu, ShieldCheck, Settings, Database, Mic, MicOff, Volume2, VolumeX, Radio } from 'lucide-react';
import type { SystemTelemetry, AssistantState } from '../../types/hud';

interface HeaderProps {
  telemetry: SystemTelemetry;
  assistantState: AssistantState;
  onToggleMic: () => void;
  onToggleSpeaker: () => void;
  onOpenSettings: () => void;
  onOpenMemory: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  telemetry,
  assistantState,
  onToggleMic,
  onToggleSpeaker,
  onOpenSettings,
  onOpenMemory,
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
    <header className="hud-panel hud-header">
      <div className="hud-brand">
        <Radio className="hud-logo-icon" />
        <div className="hud-title">
          <span>JARVIS</span>
          <span className="hud-version-badge">OS // V1.0 HUD</span>
        </div>
      </div>

      <div className="hud-telemetry-bar">
        <div className="telemetry-item">
          <span className={`status-dot ${assistantState}`} />
          <span>STATUS: <strong>{assistantState.toUpperCase()}</strong></span>
        </div>

        <div className="telemetry-item">
          <Cpu size={14} color="var(--cyan-primary)" />
          <span>SYS CORE: <strong>{telemetry.cpuUsage}%</strong></span>
        </div>

        <div className="telemetry-item">
          <ShieldCheck size={14} color="#86efac" />
          <span>MODEL: <strong>{telemetry.activeModel}</strong></span>
        </div>

        <div className="telemetry-item">
          <span className="hud-tag">{timeStr || '00:00:00'}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          className="hud-btn hud-btn-icon"
          title={telemetry.micEnabled ? 'Mute Microphone' : 'Enable Microphone'}
          onClick={onToggleMic}
          style={{ borderColor: telemetry.micEnabled ? 'var(--cyan-primary)' : 'var(--border-subtle)' }}
        >
          {telemetry.micEnabled ? <Mic size={16} /> : <MicOff size={16} color="var(--text-muted)" />}
        </button>

        <button
          className="hud-btn hud-btn-icon"
          title={telemetry.speakerEnabled ? 'Mute Speech Output' : 'Enable Speech Output'}
          onClick={onToggleSpeaker}
          style={{ borderColor: telemetry.speakerEnabled ? 'var(--cyan-primary)' : 'var(--border-subtle)' }}
        >
          {telemetry.speakerEnabled ? <Volume2 size={16} /> : <VolumeX size={16} color="var(--text-muted)" />}
        </button>

        <button
          className="hud-btn"
          onClick={onOpenMemory}
          title="Inspect Long-Term Memory"
        >
          <Database size={15} />
          <span>Memory</span>
        </button>

        <button
          className="hud-btn"
          onClick={onOpenSettings}
          title="Configure System & AI Provider"
        >
          <Settings size={15} />
          <span>Settings</span>
        </button>
      </div>
    </header>
  );
};
