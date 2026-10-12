import React from 'react';
import type { AssistantState, HudTheme } from '../../types/hud';
import { GlobeParticleSphere, type CursorOptions } from './GlobeParticleSphere';

interface AssistantOrbProps {
  state: AssistantState;
  theme?: HudTheme;
  onInterrupt?: () => void;
}

export const AssistantOrb: React.FC<AssistantOrbProps> = ({
  state,
  theme = 'cyan',
  onInterrupt,
}) => {
  // Compute dynamic Globe Particle parameters based on state and theme
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
          dotSize: 110,
          size: 98,
          cursor: { mode: 'attract', strength: 75, reach: 45 },
        };
      case 'thinking':
        return {
          colors: ['#1d4ed8', '#3b82f6', '#60a5fa', '#a5f3fc', '#ffffff'],
          speed: 60,
          density: 92,
          dotSize: 100,
          size: 96,
          cursor: { mode: 'repel', strength: 50, reach: 35 },
        };
      case 'speaking':
        return {
          colors: ['#0284c7', '#38bdf8', '#7dd3fc', '#bae6fd', '#ffffff'],
          speed: 52,
          density: 82,
          dotSize: 120,
          size: 98,
          cursor: { mode: 'repel', strength: 50, reach: 35 },
        };
      case 'error':
        return {
          colors: ['#b91c1c', '#ef4444', '#f97316', '#fef08a'],
          speed: 88,
          density: 80,
          dotSize: 110,
          size: 97,
          cursor: { mode: 'repel', strength: 90, reach: 50 },
        };
      case 'idle':
      default: {
        const themeColors: Record<HudTheme, string[]> = {
          cyan: ['#0055ff', '#00d4ff', '#a5f3fc'],
          gold: ['#b45309', '#f59e0b', '#fde68a'],
          matrix: ['#047857', '#10b981', '#6ee7b7'],
          crimson: ['#991b1b', '#ef4444', '#fca5a5'],
          violet: ['#6b21a8', '#a855f7', '#d8b4fe'],
        };
        return {
          colors: themeColors[theme] || themeColors.cyan,
          speed: 32,
          density: 70,
          dotSize: 100,
          size: 97,
          cursor: { mode: 'repel', strength: 50, reach: 30 },
        };
      }
    }
  };

  const globe = getGlobeParameters();

  return (
    <div
      className="hero-orb-viewport"
      onClick={state !== 'idle' ? onInterrupt : undefined}
    >
      {/* Ethereal Thinking Radial Aura directly at the back of the orb */}
      <div
        className={`orb-thinking-glow ${state === 'thinking' ? 'active' : ''}`}
      />

      <div className="orb-canvas-container">
        <GlobeParticleSphere
          state={state}
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
