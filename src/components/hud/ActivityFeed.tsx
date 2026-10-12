import React from 'react';
import { Activity, Shield, Info, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import type { ActivityItem } from '../../types/hud';

interface ActivityFeedProps {
  activities: ActivityItem[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities }) => {
  const getLevelIcon = (level: ActivityItem['level']) => {
    switch (level) {
      case 'success':
        return <CheckCircle2 size={12} color="#86efac" />;
      case 'warn':
        return <AlertTriangle size={12} color="#fde047" />;
      case 'error':
        return <AlertCircle size={12} color="#fca5a5" />;
      case 'info':
      default:
        return <Info size={12} color="var(--cyan-primary)" />;
    }
  };

  // Show up to the 2 most recent activities in the footer bar
  const recentActivities = activities.slice(-2).reverse();

  return (
    <footer className="hud-panel hud-footer">
      <div className="activity-badge">
        <Activity size={14} color="var(--cyan-primary)" />
        <span>ACTIVITY FEED</span>
      </div>

      <div className="activity-stream">
        {recentActivities.map((act) => (
          <div key={act.id} className={`activity-line ${act.level}`}>
            <span className="time">[{act.timestamp}]</span>
            <span style={{ marginRight: '6px' }}>{getLevelIcon(act.level)}</span>
            <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>[{act.category.toUpperCase()}]</span>
            <span>{act.message}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
        <Shield size={12} color="#86efac" />
        <span style={{ fontSize: '10.5px' }}>SANDBOX ENFORCED</span>
      </div>
    </footer>
  );
};
