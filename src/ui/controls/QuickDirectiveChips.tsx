import React from 'react';

interface QuickDirectiveChipsProps {
  onSelectDirective: (command: string) => void;
  disabled?: boolean;
}

const DIRECTIVES = [
  { label: 'Diagnostics', cmd: 'Run complete desktop telemetry diagnostics' },
  { label: 'Memory Bank', cmd: 'Inspect memory banks' },
  { label: 'Security Check', cmd: 'Perform security diagnostics' },
  { label: 'Audio Harmonic', cmd: 'Harmonic carrier frequencies check' },
];

export const QuickDirectiveChips: React.FC<QuickDirectiveChipsProps> = ({
  onSelectDirective,
  disabled,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        width: '100%',
        marginBottom: '4px',
        userSelect: 'none',
      }}
    >
      {DIRECTIVES.map((d) => (
        <button
          key={d.label}
          type="button"
          disabled={disabled}
          onClick={() => onSelectDirective(d.cmd)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-dim)',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.06em',
            cursor: disabled ? 'not-allowed' : 'pointer',
            padding: '2px 4px',
            outline: 'none',
            transition: 'all 0.18s ease',
            opacity: disabled ? 0.4 : 0.8,
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.color = 'var(--hud-cyan)';
              e.currentTarget.style.textShadow = '0 0 8px var(--hud-cyan-glow)';
              e.currentTarget.style.opacity = '1';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-dim)';
            e.currentTarget.style.textShadow = 'none';
            e.currentTarget.style.opacity = disabled ? '0.4' : '0.8';
          }}
        >
          <span
            style={{
              color: 'var(--hud-cyan)',
              opacity: 0.6,
              marginRight: '3px',
            }}
          >
            [
          </span>
          {d.label}
          <span
            style={{
              color: 'var(--hud-cyan)',
              opacity: 0.6,
              marginLeft: '3px',
            }}
          >
            ]
          </span>
        </button>
      ))}
    </div>
  );
};

export default QuickDirectiveChips;
