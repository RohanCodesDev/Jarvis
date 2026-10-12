import React from 'react';
import {
  Settings,
  Database,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  MessageSquare,
} from 'lucide-react';
import type {
  SystemTelemetry,
  AssistantState,
  HudTheme,
} from '../../types/hud';

interface HeaderProps {
  telemetry: SystemTelemetry;
  assistantState: AssistantState;
  currentTheme?: HudTheme;
  onSelectTheme?: (theme: HudTheme) => void;
  onToggleMic: () => void;
  onToggleSpeaker: () => void;
  onOpenSettings: () => void;
  onOpenMemory: () => void;
  onToggleDrawer: () => void;
  messagesCount: number;
}

const THEMES: { id: HudTheme; label: string; color: string }[] = [
  { id: 'cyan', label: 'Arc Cyan', color: '#00f0ff' },
  { id: 'gold', label: 'Stark Gold', color: '#fbbf24' },
  { id: 'matrix', label: 'Matrix Emerald', color: '#10b981' },
  { id: 'crimson', label: 'Crimson Stealth', color: '#ef4444' },
  { id: 'violet', label: 'Quantum Violet', color: '#a855f7' },
];

export const Header: React.FC<HeaderProps> = ({
  telemetry,
  assistantState,
  currentTheme = 'cyan',
  onSelectTheme,
  onToggleMic,
  onToggleSpeaker,
  onOpenSettings,
  onOpenMemory,
  onToggleDrawer,
  messagesCount,
}) => {
  return (
    <header className="hud-header">
      {/* Top Left: jarvis Rc-19 + Theme Dots */}
      <div className="hud-brand-minimal">
        <span className="brand-text">jarvis Rc-19</span>
        <span
          className={`hud-status-orb ${assistantState}`}
          title={`Status: ${assistantState.toUpperCase()}`}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            marginLeft: '12px',
          }}
        >
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTheme?.(t.id)}
              title={`Switch Theme: ${t.label}`}
              style={{
                width: currentTheme === t.id ? '8px' : '5px',
                height: currentTheme === t.id ? '8px' : '5px',
                borderRadius: '50%',
                backgroundColor: t.color,
                boxShadow:
                  currentTheme === t.id ? `0 0 8px ${t.color}` : 'none',
                opacity: currentTheme === t.id ? 1 : 0.35,
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'all 0.2s ease',
              }}
            />
          ))}
        </div>
      </div>

      {/* Top Right: Icons and labels for each icon - pure borderless, no small divs */}
      <div className="hud-header-actions">
        <button
          className="hud-header-btn"
          title={telemetry.micEnabled ? 'Mute Microphone' : 'Engage Microphone'}
          onClick={onToggleMic}
        >
          {telemetry.micEnabled ? (
            <Mic size={15} />
          ) : (
            <MicOff size={15} color="var(--text-dim)" />
          )}
          <span>{telemetry.micEnabled ? 'Mic' : 'Muted'}</span>
        </button>

        <button
          className="hud-header-btn"
          title={
            telemetry.speakerEnabled
              ? 'Mute Speech Output'
              : 'Engage Speech Output'
          }
          onClick={onToggleSpeaker}
        >
          {telemetry.speakerEnabled ? (
            <Volume2 size={15} />
          ) : (
            <VolumeX size={15} color="var(--text-dim)" />
          )}
          <span>{telemetry.speakerEnabled ? 'Audio' : 'Muted'}</span>
        </button>

        <button
          className="hud-header-btn"
          onClick={onToggleDrawer}
          title="Open Communications History Drawer"
        >
          <MessageSquare size={15} />
          <span>Comms ({messagesCount})</span>
        </button>

        <button
          className="hud-header-btn"
          onClick={onOpenMemory}
          title="Inspect Persistent Memory Bank"
        >
          <Database size={15} />
          <span>Memory</span>
        </button>

        <button
          className="hud-header-btn"
          onClick={onOpenSettings}
          title="System & AI Parameters"
        >
          <Settings size={15} />
          <span>Settings</span>
        </button>
      </div>
    </header>
  );
};
