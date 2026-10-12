import React, { useState, useEffect } from 'react';
import { Cpu, ShieldCheck, Settings, Database, Mic, MicOff, Volume2, VolumeX, Radio, Globe } from 'lucide-react';
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
        <div className="hud-brand-symbol">
          <Radio size={18} />
        </div>
        <div className="hud-title-wrap">
          <div className="hud-title">
            <span>JARVIS</span>
            <span className="hud-tag">MK-85 // HUD</span>
          </div>
          <span className="hud-sub-title">STARK INDUSTRIES TACTICAL AVIONICS</span>
        </div>
      </div>

      <div className="hud-telemetry-cluster">
        <div className="hud-telemetry-node">
          <span className={`hud-status-orb ${assistantState}`} />
          <span>SYS.STATE: <strong>{assistantState.toUpperCase()}</strong></span>
        </div>

        <div className="hud-telemetry-node">
          <Cpu size={13} color="var(--hud-cyan)" />
          <span>LOAD: <strong>{telemetry.cpuUsage}%</strong></span>
        </div>

        <div className="hud-telemetry-node">
          <ShieldCheck size={13} color="#86efac" />
          <span>MODEL: <strong>{telemetry.activeModel.split(' ')[0]}</strong></span>
        </div>

        <div className="hud-telemetry-node">
          <Globe size={13} color="var(--hud-cyan)" />
          <span>LINK: <strong>STABLE</strong></span>
        </div>

        <div className="hud-telemetry-node">
          <span className="hud-tag" style={{ color: 'var(--hud-cyan)' }}>
            {timeStr || '12:00:00'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          className="hud-btn hud-btn-icon"
          title={telemetry.micEnabled ? 'Mute Microphone' : 'Engage Microphone'}
          onClick={onToggleMic}
          style={{ borderColor: telemetry.micEnabled ? 'var(--hud-cyan)' : 'var(--hud-cyan-border)' }}
        >
          {telemetry.micEnabled ? <Mic size={15} /> : <MicOff size={15} color="var(--text-dim)" />}
        </button>

        <button
          className="hud-btn hud-btn-icon"
          title={telemetry.speakerEnabled ? 'Mute Speech Output' : 'Engage Speech Output'}
          onClick={onToggleSpeaker}
          style={{ borderColor: telemetry.speakerEnabled ? 'var(--hud-cyan)' : 'var(--hud-cyan-border)' }}
        >
          {telemetry.speakerEnabled ? <Volume2 size={15} /> : <VolumeX size={15} color="var(--text-dim)" />}
        </button>

        <button
          className="hud-btn"
          onClick={onOpenMemory}
          title="Inspect Persistent Memory Bank"
        >
          <Database size={14} />
          <span>Memory</span>
        </button>

        <button
          className="hud-btn"
          onClick={onOpenSettings}
          title="System & AI Parameters"
        >
          <Settings size={14} />
          <span>Config</span>
        </button>
      </div>
    </header>
  );
};
