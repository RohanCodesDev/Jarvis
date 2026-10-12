import React from 'react';
import type { AssistantState } from '../../types/hud';

interface AudioWaveformProps {
  state: AssistantState;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({ state }) => {
  const isActive = state === 'speaking' || state === 'listening';

  return (
    <div className={`waveform-bars ${isActive ? 'waveform-active' : ''}`} title={`Voice Activity: ${state}`}>
      {[...Array(12)].map((_, i) => (
        <span
          key={i}
          className="wave-bar"
          style={{
            backgroundColor:
              state === 'error'
                ? 'var(--state-error)'
                : state === 'listening'
                ? 'var(--state-listening)'
                : state === 'thinking'
                ? 'var(--state-thinking)'
                : 'var(--cyan-primary)',
            animationDuration: state === 'speaking' ? `${0.4 + (i % 5) * 0.1}s` : '0.8s',
          }}
        />
      ))}
    </div>
  );
};
