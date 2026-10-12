import React from 'react';
import type {
  SystemTelemetry,
  ActivityItem,
  AssistantState,
} from '../../types/hud';
import { useTypewriter } from '../hooks/useTypewriter';

interface TacticalTelemetryStreamProps {
  telemetry: SystemTelemetry;
  activities: ActivityItem[];
  assistantState: AssistantState;
  onStateChange: (state: AssistantState) => void;
}

const MODES: {
  id: AssistantState;
  label: string;
  code: string;
  color: string;
}[] = [
  { id: 'idle', label: 'IDLE', code: '0x01', color: 'var(--state-idle)' },
  {
    id: 'listening',
    label: 'LISTEN',
    code: '0x02',
    color: 'var(--state-listening)',
  },
  {
    id: 'thinking',
    label: 'THINK',
    code: '0x03',
    color: 'var(--state-thinking)',
  },
  {
    id: 'speaking',
    label: 'SPEAK',
    code: '0x04',
    color: 'var(--state-speaking)',
  },
  { id: 'error', label: 'ALERT', code: '0x05', color: 'var(--state-error)' },
];

export const TacticalTelemetryStream: React.FC<
  TacticalTelemetryStreamProps
> = ({ telemetry, activities, assistantState, onStateChange }) => {
  const latestActivity = activities[activities.length - 1];
  const activityText = latestActivity
    ? `[${latestActivity.category.toUpperCase()}] ${latestActivity.message}`
    : '[SYSTEM] Core telemetry synchronized.';

  const { displayedText: typedActivity, cursorVisible } = useTypewriter(
    activityText,
    { speed: 14 },
  );

  // Generate tactical CPU load bar: [||||||....]
  const cpuPercent = Math.min(100, Math.max(0, telemetry.cpuUsage));
  const totalBars = 12;
  const activeBars = Math.max(
    1,
    Math.min(totalBars, Math.round((cpuPercent / 100) * totalBars * 8)),
  );
  const barString =
    '[' +
    '|'.repeat(activeBars) +
    '.'.repeat(Math.max(0, totalBars - activeBars)) +
    ']';

  return (
    <div
      className="hacker-telemetry-flank"
      aria-label="Tactical Telemetry Stream"
    >
      {/* 1. Header */}
      <div className="hacker-stream-header right-align">
        <span className="hacker-meta">HOST_TELEMETRY // WIN11</span>
        <span className="hacker-tag">// MATRIX_DIAG</span>
      </div>

      {/* 2. Raw Terminal Telemetry Metrics */}
      <div className="hacker-telemetry-block">
        <div className="hacker-stat-row">
          <span className="stat-label">CPU.LOAD</span>
          <span className="stat-divider">::</span>
          <span className="stat-val accent">
            {barString} {telemetry.cpuUsage.toFixed(1)}%
          </span>
        </div>

        <div className="hacker-stat-row">
          <span className="stat-label">MEM.ALLOC</span>
          <span className="stat-divider">::</span>
          <span className="stat-val">
            {telemetry.memoryUsageMb} MB // 64-BIT
          </span>
        </div>

        <div className="hacker-stat-row">
          <span className="stat-label">SHADER.GL</span>
          <span className="stat-divider">::</span>
          <span className="stat-val">WEBGL2 // 60 FPS</span>
        </div>

        <div className="hacker-stat-row">
          <span className="stat-label">SECURITY</span>
          <span className="stat-divider">::</span>
          <span className="stat-val highlight">DPAPI_ENCRYPTED</span>
        </div>

        <div className="hacker-stat-row">
          <span className="stat-label">ACTIVE.MDL</span>
          <span className="stat-divider">::</span>
          <span className="stat-val truncate" title={telemetry.activeModel}>
            {telemetry.activeModel.split('/')[1] || telemetry.activeModel}
          </span>
        </div>

        <div className="hacker-stat-row">
          <span className="stat-label">LINK.LAT</span>
          <span className="stat-divider">::</span>
          <span className="stat-val">
            {telemetry.latencyMs}ms //{' '}
            {telemetry.connectionStatus.toUpperCase()}
          </span>
        </div>
      </div>

      {/* 3. Live Typewritten Event Stream */}
      <div className="hacker-live-events">
        <div className="events-title">// REALTIME_LOG:</div>
        <div className="event-typewriter-line">
          <span className="event-prefix">&gt; </span>
          <span className="event-content">{typedActivity}</span>
          <span
            className={`hacker-cursor ${cursorVisible ? 'visible' : 'hidden'}`}
          >
            █
          </span>
        </div>
      </div>

      {/* 4. Hacker State Mode Controller (Raw Text, No Bulky Div Containers) */}
      <div className="hacker-modes-block">
        <div className="modes-title">// CORE_VECTOR:</div>
        <div className="modes-list">
          {MODES.map((m) => {
            const isActive = assistantState === m.id;
            return (
              <button
                key={m.id}
                type="button"
                className={`hacker-mode-item ${isActive ? 'active' : ''}`}
                onClick={() => onStateChange(m.id)}
                style={{ ['--mode-color' as any]: m.color }}
              >
                <span className="mode-bracket">{isActive ? '[•]' : '[ ]'}</span>
                <span className="mode-name">{m.label}</span>
                <span className="mode-code">::{m.code}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TacticalTelemetryStream;
