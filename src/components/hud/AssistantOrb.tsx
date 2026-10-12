import React from 'react';
import { Sparkles, Mic, BrainCircuit, Volume2, AlertTriangle, Square } from 'lucide-react';
import type { AssistantState } from '../../types/hud';
import { GlobeParticleSphere, type CursorOptions } from './GlobeParticleSphere';
import { AudioWaveform } from './AudioWaveform';

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

  const getStateMeta = () => {
    switch (state) {
      case 'listening':
        return { label: 'AUDIO TRANSCRIBER ENGAGED', icon: Mic, code: 'VOX.RECV', accent: 'var(--hud-emerald)' };
      case 'thinking':
        return { label: 'SYNTACTIC REASONING MATRIX', icon: BrainCircuit, code: 'COGN.SYNC', accent: 'var(--hud-cyan)' };
      case 'speaking':
        return { label: 'VOCAL SYNTHESIS EMITTER', icon: Volume2, code: 'VOX.TRANSMIT', accent: 'var(--state-speaking)' };
      case 'error':
        return { label: 'SUBSYSTEM ANOMALY DETECTED', icon: AlertTriangle, code: 'SYS.FAULT', accent: 'var(--hud-crimson)' };
      case 'idle':
      default:
        return { label: 'SOLAR PARTICLE CORE STANDING BY', icon: Sparkles, code: 'SOLAR.IDLE', accent: 'var(--hud-cyan)' };
    }
  };

  const meta = getStateMeta();
  const IconComponent = meta.icon;

  return (
    <div className="hud-hero-stage">
      {/* Corner Telemetry Reticles */}
      <div className="stage-reticle-label top-left">
        <div>[SOLAR GLOBE // ORIGINKIT]</div>
        <div style={{ color: 'var(--hud-cyan)' }}>SPIN TILT: 0.38 RAD</div>
      </div>
      <div className="stage-reticle-label top-right">
        <div>[WEBGL2 // POINT SPRITES]</div>
        <div style={{ color: 'var(--hud-cyan)' }}>FIBONACCI LATTICE</div>
      </div>
      <div className="stage-reticle-label bottom-left">
        <div>CURSOR: {globe.cursor.mode?.toUpperCase()} ({globe.cursor.strength}%)</div>
        <div style={{ color: 'var(--text-dim)' }}>TWINKLE HARMONICS: ON</div>
      </div>
      <div className="stage-reticle-label bottom-right">
        <div>CORE MODE: {meta.code}</div>
        <div style={{ color: meta.accent }}>DENSITY: {globe.density}%</div>
      </div>

      {/* Massive Holographic Viewport & Big Solar Globe */}
      <div className="hero-orb-viewport">
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

      {/* Acoustic Frequency Waveform & State Status */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '-10px', zIndex: 10 }}>
        <AudioWaveform state={state} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
          <IconComponent size={13} color={meta.accent} />
          <span
            style={{
              fontFamily: 'var(--font-hud)',
              fontSize: '11.5px',
              letterSpacing: '0.14em',
              color: meta.accent,
              textTransform: 'uppercase',
            }}
          >
            {meta.label}
          </span>

          {state !== 'idle' && onInterrupt && (
            <button
              className="hud-btn"
              style={{
                borderColor: 'var(--hud-crimson)',
                color: 'var(--hud-crimson)',
                fontSize: '10px',
                padding: '2px 8px',
                marginLeft: '6px',
              }}
              onClick={onInterrupt}
              title="Abort Active Routine"
            >
              <Square size={10} />
              <span>HALT</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
