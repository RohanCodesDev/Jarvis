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
  color: string;
}[] = [
  { id: 'idle', label: 'Idle', color: 'var(--state-idle)' },
  { id: 'listening', label: 'Listening', color: 'var(--state-listening)' },
  { id: 'thinking', label: 'Thinking', color: 'var(--state-thinking)' },
  { id: 'speaking', label: 'Speaking', color: 'var(--state-speaking)' },
  { id: 'error', label: 'Alert', color: 'var(--state-error)' },
];

export const TacticalTelemetryStream: React.FC<
  TacticalTelemetryStreamProps
> = ({ telemetry, activities, assistantState, onStateChange }) => {
  const latestActivity = activities[activities.length - 1];
  const activityText = latestActivity
    ? latestActivity.message
    : 'System online and ready.';

  const { displayedText: typedActivity, cursorVisible } = useTypewriter(
    activityText,
    { speed: 14 },
  );

  // Generate tactical CPU load bar: [||||||....]
  const cpuPercent = Math.min(100, Math.max(0, telemetry.cpuUsage));
  const totalBars = 10;
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
      aria-label="System Telemetry"
    >
      {/* 1. Clean Header */}
      <div className="hacker-stream-header right-align">
        <span className="hacker-tag">// STATUS</span>
        <span className="hacker-meta">SYSTEM</span>
      </div>

      {/* 2. Simple System Metrics */}
      <div className="hacker-telemetry-block">
        <div className="hacker-stat-row">
          <span className="stat-label">CPU</span>
          <span className="stat-divider">:</span>
          <span className="stat-val accent">
            {barString} {telemetry.cpuUsage.toFixed(1)}%
          </span>
        </div>

        <div className="hacker-stat-row">
          <span className="stat-label">Memory</span>
          <span className="stat-divider">:</span>
          <span className="stat-val">
            {telemetry.memoryUsageMb} MB
          </span>
        </div>

        <div className="hacker-stat-row">
          <span className="stat-label">Model</span>
          <span className="stat-divider">:</span>
          <span className="stat-val truncate" title={telemetry.activeModel}>
            {telemetry.activeModel.split('/')[1] || telemetry.activeModel}
          </span>
        </div>

        <div className="hacker-stat-row">
          <span className="stat-label">Security</span>
          <span className="stat-divider">:</span>
          <span className="stat-val highlight">Encrypted</span>
        </div>

        <div className="hacker-stat-row">
          <span className="stat-label">Ping</span>
          <span className="stat-divider">:</span>
          <span className="stat-val">
            {telemetry.latencyMs} ms
          </span>
        </div>
      </div>

      {/* 3. Real-Time Activity Log */}
      <div className="hacker-live-events">
        <div className="events-title">// ACTIVITY:</div>
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

      {/* 4. Simple State Mode Selector */}
      <div className="hacker-modes-block">
        <div className="modes-title">// MODE:</div>
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
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TacticalTelemetryStream;

