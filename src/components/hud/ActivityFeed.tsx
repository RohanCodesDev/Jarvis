import React from 'react';
import { Activity, ShieldCheck, CheckCircle2, AlertTriangle, AlertCircle, Terminal } from 'lucide-react';
import type { ActivityItem } from '../../types/hud';

interface ActivityFeedProps {
  activities: ActivityItem[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities }) => {
  const getLevelIcon = (level: ActivityItem['level']) => {
    switch (level) {
      case 'success':
        return <CheckCircle2 size={11} color="#86efac" />;
      case 'warn':
        return <AlertTriangle size={11} color="#fde047" />;
      case 'error':
        return <AlertCircle size={11} color="#fca5a5" />;
      case 'info':
      default:
        return <Terminal size={11} color="var(--hud-cyan)" />;
    }
  };

  const recentActivities = activities.slice(-2).reverse();

  return (
    <footer className="hud-panel hud-footer-deck">
      <div className="activity-terminal-badge">
        <Activity size={13} color="var(--hud-cyan)" />
        <span>SYS.TELEMETRY</span>
      </div>

      <div className="activity-telemetry-ticker">
        {recentActivities.map((act) => (
          <div key={act.id} className={`ticker-log-item ${act.level}`}>
            <span style={{ color: 'var(--text-dim)', marginRight: '6px' }}>[{act.timestamp}]</span>
            <span style={{ marginRight: '5px' }}>{getLevelIcon(act.level)}</span>
            <span style={{ color: 'var(--hud-cyan-dim)', marginRight: '6px' }}>[{act.category.toUpperCase()}]</span>
            <span>{act.message}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dim)' }}>
        <span className="hud-tag" style={{ color: '#86efac', borderColor: 'rgba(134, 239, 172, 0.3)' }}>
          <ShieldCheck size={11} style={{ display: 'inline', marginRight: '3px' }} />
          SANDBOX OK
        </span>
        <span className="hud-tag" style={{ color: 'var(--hud-cyan)' }}>
          SEC.RING // L0
        </span>
      </div>
    </footer>
  );
};
