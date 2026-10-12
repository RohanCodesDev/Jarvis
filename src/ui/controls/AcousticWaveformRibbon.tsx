import React, { useRef, useEffect } from 'react';
import type { AssistantState } from '../../types/hud';

interface AcousticWaveformRibbonProps {
  state: AssistantState;
}

export const AcousticWaveformRibbon: React.FC<AcousticWaveformRibbonProps> = ({
  state,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let phase = 0;

    const render = () => {
      animId = requestAnimationFrame(render);
      phase += 0.04;

      const w = canvas.width;
      const h = canvas.height;
      const midY = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Determine activity amplitude and bar count based on state
      const isListening = state === 'listening';
      const isSpeaking = state === 'speaking';
      const isThinking = state === 'thinking';

      const barCount = 36;
      const barSpacing = w / barCount;
      const barWidth = 2.5;

      ctx.save();

      // Read CSS variable for dynamic theme color
      const computedColor =
        getComputedStyle(canvas).getPropertyValue('--hud-cyan').trim() ||
        '#00f0ff';

      ctx.fillStyle = computedColor;
      ctx.shadowColor = computedColor;
      ctx.shadowBlur = isListening || isSpeaking ? 12 : 6;

      for (let i = 0; i < barCount; i++) {
        const x = i * barSpacing + barSpacing / 2;
        const normDist = 1 - Math.abs(i - barCount / 2) / (barCount / 2); // 0 at edges, 1 at center
        const bellCurve = Math.sin(normDist * (Math.PI / 2));

        let amp = 2; // base idle amplitude

        if (isListening) {
          // Energetic acoustic frequency capture
          const freq = Math.sin(phase * 4 + i * 0.7) * 0.5 + 0.5;
          const jitter = Math.sin(phase * 9 + i * 1.5) * 0.3;
          amp = 3 + (freq + jitter) * 14 * bellCurve;
        } else if (isSpeaking) {
          // Rhythmic speech cadence
          const speechMod = Math.sin(phase * 3.2 + i * 0.4) * 0.5 + 0.5;
          amp = 3 + speechMod * 11 * bellCurve;
        } else if (isThinking) {
          // Hypnotic cognitive wave
          const thinkPulse = Math.sin(phase * 2.5 - i * 0.3) * 0.5 + 0.5;
          amp = 2 + thinkPulse * 6 * bellCurve;
        } else {
          // Gentle ambient breathing wave
          const wave = Math.sin(phase * 1.6 + i * 0.35) * 0.5 + 0.5;
          amp = 2 + wave * 4 * bellCurve;
        }

        const barHeight = Math.max(2, amp);
        const yTop = midY - barHeight / 2;

        ctx.globalAlpha = 0.3 + 0.65 * bellCurve;
        ctx.fillRect(x - barWidth / 2, yTop, barWidth, barHeight);
      }

      ctx.restore();
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [state]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '24px',
        pointerEvents: 'none',
        userSelect: 'none',
        marginBottom: '6px',
      }}
    >
      <canvas
        ref={canvasRef}
        width={320}
        height={24}
        style={{
          display: 'block',
          background: 'transparent',
        }}
      />
    </div>
  );
};

export default AcousticWaveformRibbon;
