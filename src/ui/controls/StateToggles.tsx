import React from 'react';
import type { AssistantState } from '../../types/hud';

interface StateTogglesProps {
  currentState: AssistantState;
  onStateChange: (state: AssistantState) => void;
}

interface StateOption {
  id: AssistantState;
  label: string;
  color: string;
}

const STATE_OPTIONS: StateOption[] = [
  { id: 'idle', label: 'Idle', color: 'var(--state-idle)' },
  { id: 'listening', label: 'Listening', color: 'var(--state-listening)' },
  { id: 'thinking', label: 'Thinking', color: 'var(--state-thinking)' },
  { id: 'speaking', label: 'Speaking', color: 'var(--state-speaking)' },
  { id: 'error', label: 'Alert', color: 'var(--state-error)' },
];

export const StateToggles: React.FC<StateTogglesProps> = ({
  currentState,
  onStateChange,
}) => {
  return (
    <aside className="hud-state-rail" aria-label="Orb State Controller">
      <div className="state-rail-header">STATE</div>
      <div className="state-rail-list">
        {STATE_OPTIONS.map((item) => {
          const isActive = currentState === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`state-toggle-btn ${isActive ? 'active' : ''}`}
              onClick={() => onStateChange(item.id)}
              title={`Switch Orb state to ${item.label}`}
              style={{
                ['--state-accent' as any]: item.color,
              }}
            >
              <span className="state-toggle-indicator" />
              <span className="state-toggle-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
