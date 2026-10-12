import React from 'react';
import type { AssistantState } from '../../types/hud';

interface AudioWaveformProps {
  state: AssistantState;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({ state }) => {
  const isActive = state === 'speaking' || state === 'listening';

  return (
    <div
      className={`waveform-deck ${isActive ? 'waveform-active' : ''}`}
      title={`Acoustic Visualizer: ${state.toUpperCase()}`}
    >
      {[...Array(24)].map((_, i) => {
        // Calculate harmonic heights
        const delay = (i % 6) * 0.08;
        const duration = state === 'speaking' ? 0.35 + (i % 4) * 0.1 : 0.6;
        
        return (
          <span
            key={i}
            className="wave-frequency-bar"
            style={{
              backgroundColor:
                state === 'error'
                  ? 'var(--hud-crimson)'
                  : state === 'listening'
                  ? 'var(--hud-emerald)'
                  : state === 'speaking'
                  ? 'var(--hud-cyan)'
                  : 'rgba(0, 240, 255, 0.4)',
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
            }}
          />
        );
      })}
    </div>
  );
};
