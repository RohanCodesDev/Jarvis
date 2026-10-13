import React, { useEffect, useState } from 'react';

export interface TacticalCardData {
  id: string;
  title: string;
  message: string;
  category: 'tool' | 'security' | 'system';
  durationMs?: number;
  imageUrl?: string;
  level?: 'info' | 'success' | 'warn' | 'error';
}

interface TacticalActionCardProps {
  card: TacticalCardData | null;
  onDismiss: () => void;
}

export const TacticalActionCard: React.FC<TacticalActionCardProps> = ({
  card,
  onDismiss,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (card) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }, 4500);
      return () => clearTimeout(timer);
    }
    setVisible(false);
  }, [card, onDismiss]);

  if (!card) return null;

  const isWarn = card.level === 'warn' || card.level === 'error';
  const accentColor = isWarn
    ? 'var(--hud-crimson, #ff2255)'
    : 'var(--hud-cyan, #00f0ff)';
  const glowColor = isWarn
    ? 'rgba(255, 34, 85, 0.45)'
    : 'rgba(0, 240, 255, 0.45)';

  return (
    <div
      onClick={() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }}
      style={{
        position: 'fixed',
        top: '72px',
        right: '24px',
        zIndex: 9999,
        width: '320px',
        background: 'rgba(6, 12, 24, 0.88)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${accentColor}`,
        borderRadius: '8px',
        padding: '12px 14px',
        boxShadow: `0 8px 32px rgba(0, 0, 0, 0.6), 0 0 16px ${glowColor}`,
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: visible ? 1 : 0,
        transform: visible
          ? 'translateY(0) scale(1)'
          : 'translateY(-12px) scale(0.96)',
        cursor: 'pointer',
        userSelect: 'none',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {/* Top Header Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: accentColor,
              boxShadow: `0 0 8px ${accentColor}`,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: accentColor,
              textTransform: 'uppercase',
            }}
          >
            {card.title}
          </span>
        </div>

        {card.durationMs !== undefined && (
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '10px',
              color: 'var(--text-dim, rgba(255,255,255,0.5))',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '1px 6px',
              borderRadius: '4px',
            }}
          >
            ⚡ {card.durationMs}ms
          </span>
        )}
      </div>

      {/* Message Content */}
      <div
        style={{
          fontFamily: 'var(--font-sans, sans-serif)',
          fontSize: '12px',
          color: '#ffffff',
          lineHeight: '1.4',
          marginBottom: card.imageUrl ? '8px' : '0',
        }}
      >
        {card.message}
      </div>

      {/* Screenshot Thumbnail Preview if available */}
      {card.imageUrl && (
        <div
          style={{
            marginTop: '8px',
            borderRadius: '4px',
            overflow: 'hidden',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            maxHeight: '130px',
          }}
        >
          <img
            src={card.imageUrl}
            alt="Tactical Screen Preview"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              objectFit: 'cover',
            }}
          />
        </div>
      )}
    </div>
  );
};
