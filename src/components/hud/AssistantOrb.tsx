import React from 'react';
import { Sparkles, Mic, BrainCircuit, Volume2, AlertTriangle, Square } from 'lucide-react';
import type { AssistantState } from '../../types/hud';
import { AudioWaveform } from './AudioWaveform';

interface AssistantOrbProps {
  state: AssistantState;
  onStateChange: (newState: AssistantState) => void;
  onInterrupt?: () => void;
}

export const AssistantOrb: React.FC<AssistantOrbProps> = ({
  state,
  onStateChange,
  onInterrupt,
}) => {
  const getStateInfo = () => {
    switch (state) {
      case 'listening':
        return { label: 'Listening to Audio', desc: 'Audio capture stream active', icon: Mic };
      case 'thinking':
        return { label: 'Synthesizing Response', desc: 'Processing reasoning pipeline', icon: BrainCircuit };
      case 'speaking':
        return { label: 'Vocal Output Active', desc: 'Speaking synthesized audio', icon: Volume2 };
      case 'error':
        return { label: 'Subsystem Alert', desc: 'Diagnostics required', icon: AlertTriangle };
      case 'idle':
      default:
        return { label: 'Core Standing By', desc: 'Awaiting prompt or voice activation', icon: Sparkles };
    }
  };

  const stateInfo = getStateInfo();
  const IconComponent = stateInfo.icon;

  return (
    <div className="hud-panel hud-orb-column">
      <div className={`orb-stage state-${state}`}>
        <div className="orb-ring orb-ring-outer" />
        <div className="orb-ring orb-ring-middle" />
        <div className="orb-ring orb-ring-inner" />
        <div className="orb-core">
          <div className="orb-core-glint" />
          <IconComponent
            size={32}
            color={
              state === 'error'
                ? '#ffffff'
                : state === 'thinking'
                ? '#ffffff'
                : '#ffffff'
            }
            style={{
              filter: 'drop-shadow(0 0 6px rgba(0, 0, 0, 0.6))',
              transition: 'transform 0.3s ease',
            }}
          />
        </div>
      </div>

      <AudioWaveform state={state} />

      <div className="orb-state-indicator">
        <span className="orb-state-pill">{stateInfo.label}</span>
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
        {stateInfo.desc}
      </div>

      <div className="orb-controls">
        {(['idle', 'listening', 'thinking', 'speaking', 'error'] as AssistantState[]).map((st) => (
          <button
            key={st}
            className={`hud-btn ${state === st ? 'hud-btn-primary' : ''}`}
            style={{ fontSize: '11px', padding: '5px 9px' }}
            onClick={() => onStateChange(st)}
          >
            {st}
          </button>
        ))}

        {state !== 'idle' && onInterrupt && (
          <button
            className="hud-btn"
            style={{ borderColor: 'var(--state-error)', color: 'var(--state-error)', fontSize: '11px', padding: '5px 9px' }}
            onClick={onInterrupt}
            title="Interrupt/Halt Current Activity"
          >
            <Square size={12} />
            <span>Halt</span>
          </button>
        )}
      </div>
    </div>
  );
};
