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
  return (
    <header className="hud-header">
      {/* Top Left: jarvis Rc-19 */}
      <div className="hud-brand-minimal">
        <span className="brand-text">jarvis Rc-19</span>
        <span
          className={`hud-status-orb ${assistantState}`}
          title={`Status: ${assistantState.toUpperCase()}`}
        />
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
