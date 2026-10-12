import React, { useState } from 'react';
import { Sparkles, Mic, BrainCircuit, Volume2, AlertTriangle, Square, Palette } from 'lucide-react';
import type { AssistantState } from '../../types/hud';
import { GlobeParticleSphere, type CursorOptions } from './GlobeParticleSphere';
import { AudioWaveform } from './AudioWaveform';

interface AssistantOrbProps {
  state: AssistantState;
  onStateChange: (newState: AssistantState) => void;
  onInterrupt?: () => void;
}

type GlobePaletteName = 'cyan' | 'aurora' | 'solar' | 'ember';

export const AssistantOrb: React.FC<AssistantOrbProps> = ({
  state,
  onStateChange,
  onInterrupt,
}) => {
  const [selectedPalette, setSelectedPalette] = useState<GlobePaletteName>('cyan');

  // Compute dynamic Globe Particle parameters based on state & selected palette
  const getGlobeParameters = (): {
    colors: string[];
    speed: number;
    density: number;
    dotSize: number;
    size: number;
    cursor: CursorOptions;
  } => {
    // If state is error, always flare in crimson/ember regardless of palette
    if (state === 'error') {
      return {
        colors: ['#b91c1c', '#ef4444', '#f97316', '#fef08a'],
        speed: 88,
        density: 80,
        dotSize: 110,
        size: 82,
        cursor: { mode: 'repel', strength: 90, reach: 50 },
      };
    }

    // Palette base colors
    const getPaletteColors = (baseVariant: 'idle' | 'listening' | 'thinking' | 'speaking'): string[] => {
      if (selectedPalette === 'solar') {
        if (baseVariant === 'listening') return ['#059669', '#10b981', '#fbbf24', '#ffffff'];
        if (baseVariant === 'thinking') return ['#ea580c', '#f59e0b', '#00f0ff', '#ffffff'];
        if (baseVariant === 'speaking') return ['#f59e0b', '#fbbf24', '#38bdf8', '#ffffff'];
        return ['#d97706', '#f59e0b', '#fef3c7'];
      }

      if (selectedPalette === 'aurora') {
        if (baseVariant === 'listening') return ['#059669', '#10b981', '#a855f7', '#ffffff'];
        if (baseVariant === 'thinking') return ['#4f46e5', '#7c3aed', '#c084fc', '#ffffff'];
        if (baseVariant === 'speaking') return ['#8b5cf6', '#a855f7', '#38bdf8', '#ffffff'];
        return ['#6366f1', '#8b5cf6', '#c084fc', '#e0e7ff'];
      }

      if (selectedPalette === 'ember') {
        if (baseVariant === 'listening') return ['#d97706', '#f59e0b', '#ef4444', '#ffffff'];
        if (baseVariant === 'thinking') return ['#b91c1c', '#ea580c', '#fbbf24', '#ffffff'];
        if (baseVariant === 'speaking') return ['#ea580c', '#f97316', '#fed7aa', '#ffffff'];
        return ['#991b1b', '#dc2626', '#f97316', '#fed7aa'];
      }

      // Default: Stark Mark-85 Cyan
      if (baseVariant === 'listening') return ['#059669', '#10b981', '#34d399', '#67e8f9'];
      if (baseVariant === 'thinking') return ['#0077ff', '#00d4ff', '#818cf8', '#ffffff'];
      if (baseVariant === 'speaking') return ['#0284c7', '#38bdf8', '#7dd3fc', '#ffffff'];
      return ['#0055ff', '#00d4ff', '#a5f3fc'];
    };

    switch (state) {
      case 'listening':
        return {
          colors: getPaletteColors('listening'),
          speed: 48,
          density: 85,
          dotSize: 105,
          size: 88,
          cursor: { mode: 'attract', strength: 75, reach: 42 },
        };
      case 'thinking':
        return {
          colors: getPaletteColors('thinking'),
          speed: 85,
          density: 95,
          dotSize: 80,
          size: 74,
          cursor: { mode: 'repel', strength: 80, reach: 45 },
        };
      case 'speaking':
        return {
          colors: getPaletteColors('speaking'),
          speed: 52,
          density: 78,
          dotSize: 125,
          size: 84,
          cursor: { mode: 'repel', strength: 65, reach: 35 },
        };
      case 'idle':
      default:
        return {
          colors: getPaletteColors('idle'),
          speed: 32,
          density: 70,
          dotSize: 85,
          size: 80,
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
    <div className="hud-panel hud-orb-stage">
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

      {/* Holographic Ring Reticles & Solar Particle Globe */}
      <div className="orb-hologram-viewport">
        <div className="holo-ring holo-ring-outer" />
        <div className="holo-ring holo-ring-middle" />
        <div className="holo-ring holo-ring-inner" />
        <div className="holo-radar-sweep" />

        <div
          className="orb-canvas-container"
          style={{ width: '340px', height: '340px' }}
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

      {/* Acoustic Frequency Waveform */}
      <AudioWaveform state={state} />

      {/* Subsystem State Headline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
        <IconComponent size={14} color={meta.accent} />
        <span
          style={{
            fontFamily: 'var(--font-hud)',
            fontSize: '12px',
            letterSpacing: '0.12em',
            color: meta.accent,
            textTransform: 'uppercase',
          }}
        >
          {meta.label}
        </span>
      </div>

      {/* Tactical State & Palette Controls */}
      <div className="stage-control-panel">
        <div className="state-button-group">
          {(['idle', 'listening', 'thinking', 'speaking', 'error'] as AssistantState[]).map((st) => (
            <button
              key={st}
              className={`hud-btn ${state === st ? 'hud-btn-primary' : ''}`}
              style={{ fontSize: '10.5px', padding: '4px 10px' }}
              onClick={() => onStateChange(st)}
            >
              {st}
            </button>
          ))}

          {state !== 'idle' && onInterrupt && (
            <button
              className="hud-btn"
              style={{
                borderColor: 'var(--hud-crimson)',
                color: 'var(--hud-crimson)',
                fontSize: '10.5px',
                padding: '4px 10px',
              }}
              onClick={onInterrupt}
              title="Abort Active Routine"
            >
              <Square size={11} />
              <span>HALT</span>
            </button>
          )}
        </div>

        <div className="palette-selector-strip">
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Palette size={11} />
            PALETTES:
          </span>
          {(['cyan', 'aurora', 'solar', 'ember'] as GlobePaletteName[]).map((pal) => (
            <button
              key={pal}
              className={`palette-chip ${selectedPalette === pal ? 'active' : ''}`}
              onClick={() => setSelectedPalette(pal)}
            >
              {pal.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
