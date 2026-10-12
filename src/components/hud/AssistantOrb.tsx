import React, { useState } from 'react';
import {
  JarvisOrb,
  type JarvisPaletteName,
  type JarvisState,
} from 'jarvis-ai-web-animation';
import { Sparkles, Mic, BrainCircuit, Volume2, AlertTriangle, Square, RefreshCw } from 'lucide-react';
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
  const [selectedPalette, setSelectedPalette] = useState<JarvisPaletteName>('cyan');

  // Map application assistant state to Three.js JarvisOrb state & palette
  const getOrbConfiguration = (): { orbState: JarvisState; effectivePalette: JarvisPaletteName } => {
    switch (state) {
      case 'listening':
        return {
          orbState: {
            energy: 1.25,
            rotationSpeed: 0.85,
            particleSpeed: 1.2,
            shellRadius: 1.18,
            ringSpread: 1.3,
            filamentOpacity: 0.95,
            coreScale: 1.15,
            bloom: 1.25,
          },
          effectivePalette: selectedPalette === 'ember' ? 'ember' : 'aurora',
        };
      case 'thinking':
        return {
          orbState: 'thinking',
          effectivePalette: selectedPalette,
        };
      case 'speaking':
        return {
          orbState: 'success',
          effectivePalette: selectedPalette,
        };
      case 'error':
        return {
          orbState: 'alert',
          effectivePalette: 'ember',
        };
      case 'idle':
      default:
        return {
          orbState: 'idle',
          effectivePalette: selectedPalette,
        };
    }
  };

  const { orbState, effectivePalette } = getOrbConfiguration();

  const getStateMeta = () => {
    switch (state) {
      case 'listening':
        return { label: 'AUDIO TRANSCRIBER ENGAGED', icon: Mic, code: 'VOX.RECV' };
      case 'thinking':
        return { label: 'SYNTACTIC REASONING MATRIX', icon: BrainCircuit, code: 'COGN.SYNC' };
      case 'speaking':
        return { label: 'VOCAL SYNTHESIS EMITTER', icon: Volume2, code: 'VOX.TRANSMIT' };
      case 'error':
        return { label: 'SUBSYSTEM ANOMALY DETECTED', icon: AlertTriangle, code: 'SYS.FAULT' };
      case 'idle':
      default:
        return { label: 'QUANTUM CORE STANDING BY', icon: Sparkles, code: 'CORE.IDLE' };
    }
  };

  const meta = getStateMeta();
  const IconComponent = meta.icon;

  return (
    <div className="hud-panel hud-orb-stage">
      {/* Corner Telemetry Reticles */}
      <div className="stage-reticle-label top-left">
        <div>[STARK.TECH // MARK-85]</div>
        <div style={{ color: 'var(--hud-cyan)' }}>FREQ: 1420.405 MHz</div>
      </div>
      <div className="stage-reticle-label top-right">
        <div>[SYS.STATUS: NOMINAL]</div>
        <div style={{ color: 'var(--hud-cyan)' }}>GRID: LAT 42.108° N</div>
      </div>
      <div className="stage-reticle-label bottom-left">
        <div>3D ORBIT: DRAG TO ROTATE</div>
        <div style={{ color: 'var(--text-dim)' }}>PARTICLES: GPU-ACCEL</div>
      </div>
      <div className="stage-reticle-label bottom-right">
        <div>CORE MODE: {meta.code}</div>
        <div style={{ color: 'var(--hud-cyan)' }}>DPR AUTO // 60 FPS</div>
      </div>

      {/* Holographic Ring Reticles & 3D Three.js Orb */}
      <div className="orb-hologram-viewport">
        <div className="holo-ring holo-ring-outer" />
        <div className="holo-ring holo-ring-middle" />
        <div className="holo-ring holo-ring-inner" />
        <div className="holo-radar-sweep" />

        <div className="orb-canvas-container" title="Interactive Three.js Core (Drag to Rotate)">
          <JarvisOrb
            size="panel"
            state={orbState}
            palette={effectivePalette}
            quality="auto"
            interactive={true}
            draggableSpin={true}
            breathing={true}
            intensity={1.15}
          />
        </div>
      </div>

      {/* Acoustic Frequency Waveform */}
      <AudioWaveform state={state} />

      {/* Subsystem State Headline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
        <IconComponent size={14} color="var(--hud-cyan)" />
        <span
          style={{
            fontFamily: 'var(--font-hud)',
            fontSize: '12.5px',
            letterSpacing: '0.12em',
            color: 'var(--hud-cyan)',
            textTransform: 'uppercase',
          }}
        >
          {meta.label}
        </span>
      </div>

      {/* Tactical Mood & Palette Controls */}
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
            <RefreshCw size={10} />
            PALETTES:
          </span>
          {(['cyan', 'aurora', 'ember'] as JarvisPaletteName[]).map((pal) => (
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
