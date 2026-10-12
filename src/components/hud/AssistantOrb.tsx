import React from 'react';
import type { AssistantState } from '../../types/hud';
import { GlobeParticleSphere, type CursorOptions } from './GlobeParticleSphere';

interface AssistantOrbProps {
  state: AssistantState;
  onInterrupt?: () => void;
}

export const AssistantOrb: React.FC<AssistantOrbProps> = ({
  state,
  onInterrupt,
}) => {
  // Compute dynamic Globe Particle parameters based on state
  const getGlobeParameters = (): {
    colors: string[];
    speed: number;
    density: number;
    dotSize: number;
    size: number;
    cursor: CursorOptions;
  } => {
    switch (state) {
      case 'listening':
        return {
          colors: ['#059669', '#10b981', '#34d399', '#67e8f9'],
          speed: 48,
          density: 85,
          dotSize: 105,
          size: 92,
          cursor: { mode: 'attract', strength: 75, reach: 45 },
        };
      case 'thinking':
        return {
          colors: ['#0077ff', '#00d4ff', '#818cf8', '#ffffff'],
          speed: 85,
          density: 95,
          dotSize: 80,
          size: 78,
          cursor: { mode: 'repel', strength: 80, reach: 45 },
        };
      case 'speaking':
        return {
          colors: ['#0284c7', '#38bdf8', '#7dd3fc', '#ffffff'],
          speed: 52,
          density: 78,
          dotSize: 125,
          size: 88,
          cursor: { mode: 'repel', strength: 65, reach: 35 },
        };
      case 'error':
        return {
          colors: ['#b91c1c', '#ef4444', '#f97316', '#fef08a'],
          speed: 88,
          density: 80,
          dotSize: 110,
          size: 85,
          cursor: { mode: 'repel', strength: 90, reach: 50 },
        };
      case 'idle':
      default:
        return {
          colors: ['#0055ff', '#00d4ff', '#a5f3fc'],
          speed: 32,
          density: 70,
          dotSize: 85,
          size: 86,
          cursor: { mode: 'repel', strength: 50, reach: 30 },
        };
    }
  };

  const globe = getGlobeParameters();

  return (
    <div className="hero-orb-viewport" onClick={state !== 'idle' ? onInterrupt : undefined}>
      <div
        className="orb-canvas-container"
        title="Interactive Solar Particle Globe (Hover/Interact with Cursor)"
      >
        <GlobeParticleSphere
          colors={globe.colors}
          speed={globe.speed}
          density={globe.density}
          dotSize={globe.dotSize}
          size={globe.size}
          cursor={globe.cursor}
          background="transparent"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
};

