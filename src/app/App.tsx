import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Terminal, Send, Mic, X, Trash2, ShieldCheck, Activity } from 'lucide-react';
import type {
  AssistantState,
  ChatMessage,
  ActivityItem,
  SystemTelemetry,
  JarvisSettings,
  UserMemoryItem,
} from '../types/hud';
import { Header } from '../components/hud/Header';
import { AssistantOrb } from '../components/hud/AssistantOrb';
import { SettingsModal } from '../components/settings/SettingsModal';
import { MemoryViewer } from '../components/settings/MemoryViewer';

export const App: React.FC = () => {
  const [assistantState, setAssistantState] = useState<AssistantState>('idle');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inputText, setInputText] = useState('');

  const [settings, setSettings] = useState<JarvisSettings>({
    cloudProvider: 'openrouter',
    openRouterModel: 'anthropic/claude-3.5-sonnet',
    ollamaModel: 'llama3:latest',
    hasApiKey: false,
    speechEnabled: true,
    voiceGender: 'male',
    soundEffects: true,
    compactMode: false,
  });

  const [telemetry, setTelemetry] = useState<SystemTelemetry>({
    cpuUsage: 3.4,
    memoryUsageMb: 82,
    activeModel: 'Claude 3.5 Sonnet',
    connectionStatus: 'mock',
    latencyMs: 12,
    speechEngine: 'browser-synthesis',
    micEnabled: true,
    speakerEnabled: true,
  });

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-init-1',
      sender: 'jarvis',
      text: 'Stark Industries Tactical Core initialized on Windows 11. Standing by for directives, sir.',
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      metadata: { modelUsed: 'Quantum Core MK-85', durationMs: 8 },
    },
  ]);

  const [activities, setActivities] = useState<ActivityItem[]>([
    {
      id: 'act-1',
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      level: 'info',
      category: 'system',
      message: 'Solar Particle Globe WebGL2 shader active. Hardware acceleration verified.',
    },
    {
      id: 'act-2',
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      level: 'success',
      category: 'security',
      message: 'Preload IPC bridge active. Sandboxed context isolation enforced.',
    },
  ]);

  const [memories, setMemories] = useState<UserMemoryItem[]>([
    {
      id: 'mem-1',
      content: 'Hardware target: Windows 11 Intel i3 laptop, low GPU overhead.',
      category: 'system',
      createdAt: '2026-10-12 11:42',
    },
    {
      id: 'mem-2',
      content: 'Interface: Minimalist Stark Industries HUD with dominant Solar Particle Globe.',
      category: 'preference',
      createdAt: '2026-10-12 11:43',
    },
  ]);

  const speechTimeoutRef = useRef<number | null>(null);

  const addActivity = useCallback((level: ActivityItem['level'], category: ActivityItem['category'], message: string) => {
    const item: ActivityItem = {
      id: 'act-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      level,
      category,
      message,
    };
    setActivities((prev) => [...prev.slice(-25), item]);

    if (window.jarvisDesktop?.logActivity) {
      window.jarvisDesktop.logActivity({ level, category, message }).catch(() => {});
    }
  }, []);

  // Check desktop bridge on mount
  useEffect(() => {
    if (window.jarvisDesktop?.getSystemInfo) {
      window.jarvisDesktop.getSystemInfo().then((info) => {
        addActivity('success', 'system', `Desktop Bridge active: ${info.platform} (${info.arch}), Electron ${info.electronVersion}`);
      }).catch((err) => {
        addActivity('warn', 'system', `Desktop bridge unavailable: ${err.message}`);
      });
    }
  }, [addActivity]);

  // Subtle telemetry pulse
  useEffect(() => {
    const timer = setInterval(() => {
      setTelemetry((prev) => ({
        ...prev,
        cpuUsage: Number((3.0 + Math.random() * 1.8).toFixed(1)),
        memoryUsageMb: 80 + Math.floor(Math.random() * 6),
      }));
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const handleHalt = useCallback(() => {
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setAssistantState('idle');
    addActivity('warn', 'ai', 'Manual directive override: Subsystem halted.');
  }, [addActivity]);

  const speakText = useCallback((text: string, onEnd: () => void) => {
    if (!telemetry.speakerEnabled || !settings.speechEnabled || !('speechSynthesis' in window)) {
      speechTimeoutRef.current = window.setTimeout(onEnd, 1400);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 0.95;

      utterance.onend = () => onEnd();
      utterance.onerror = () => onEnd();

      window.speechSynthesis.speak(utterance);
    } catch {
      onEnd();
    }
  }, [telemetry.speakerEnabled, settings.speechEnabled]);

  const handleSendMessage = (text: string) => {
    if (!text.trim() || assistantState === 'thinking') return;

    const now = new Date().toLocaleTimeString('en-US', { hour12: false });
    const userMsg: ChatMessage = {
      id: 'msg-u-' + Date.now(),
      sender: 'user',
      text,
      timestamp: now,
      status: 'delivered',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setAssistantState('thinking');
    addActivity('info', 'ai', `Directive received: "${text.length > 25 ? text.substring(0, 25) + '...' : text}"`);

    const startTime = performance.now();
    setTimeout(() => {
      const elapsed = Math.round(performance.now() - startTime);
      let responseText = `Directive registered: "${text}". All Mark-85 HUD channels operating smoothly.`;

      const lower = text.toLowerCase();
      if (lower.includes('diagnostic') || lower.includes('telemetry')) {
        responseText = `Tactical Diagnostics: Host platform is Windows 11 x64, Solar Particle Globe operating at 60 FPS, CPU load ${telemetry.cpuUsage}%, renderer memory ~${telemetry.memoryUsageMb}MB. All defensive protocols nominal.`;
      } else if (lower.includes('memory') || lower.includes('bank')) {
        responseText = `Accessing memory banks: ${memories.length} durable records indexed in local store. Sector integrity verified.`;
      } else if (lower.includes('audio') || lower.includes('harmonic')) {
        responseText = 'Acoustic visualizer synchronized. Harmonic carrier frequencies transmitting at 1420.4 MHz.';
      } else if (lower.includes('alert') || lower.includes('defcon')) {
        responseText = 'Defcon alert simulated. Quantum core shifting to amber alert matrix.';
        setAssistantState('error');
        addActivity('warn', 'security', 'Simulated Defcon-1 alert protocol activated.');
        return;
      }

      const jarvisMsg: ChatMessage = {
        id: 'msg-j-' + Date.now(),
        sender: 'jarvis',
        text: responseText,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        metadata: {
          modelUsed: 'JARVIS Core',
          durationMs: elapsed,
        },
      };

      setMessages((prev) => [...prev, jarvisMsg]);
      setAssistantState('speaking');
      addActivity('success', 'ai', `Synthesizing vocal response (${elapsed}ms).`);

      speakText(responseText, () => {
        setAssistantState('idle');
        addActivity('info', 'system', 'Voice playback complete. Core standing by.');
      });
    }, 1100);
  };

  const handleVoiceInputTrigger = () => {
    if (assistantState === 'listening') {
      setAssistantState('idle');
      addActivity('info', 'voice', 'Microphone capture closed.');
      return;
    }

    setAssistantState('listening');
    addActivity('info', 'voice', 'Audio transcriber engaged. Listening for vocal directive...');

    setTimeout(() => {
      setAssistantState('idle');
      handleSendMessage('Run complete desktop telemetry diagnostics');
    }, 2500);
  };

  const handleToggleMic = () => {
    setTelemetry((prev) => {
      const next = !prev.micEnabled;
      addActivity('info', 'voice', `Microphone ${next ? 'engaged' : 'muted'}.`);
      return { ...prev, micEnabled: next };
    });
  };

  const handleToggleSpeaker = () => {
    setTelemetry((prev) => {
      const next = !prev.speakerEnabled;
      if (!next && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      addActivity('info', 'voice', `Acoustic playback ${next ? 'engaged' : 'muted'}.`);
      return { ...prev, speakerEnabled: next };
    });
  };

  const handleSaveSettings = (newSettings: JarvisSettings) => {
    setSettings(newSettings);
    setTelemetry((prev) => ({
      ...prev,
      activeModel:
        newSettings.cloudProvider === 'openrouter'
          ? newSettings.openRouterModel
          : newSettings.ollamaModel,
    }));
    addActivity('success', 'system', 'Updated tactical parameters.');
  };

  const handleAddMemory = (content: string, category: UserMemoryItem['category']) => {
    const item: UserMemoryItem = {
      id: 'mem-' + Date.now(),
      content,
      category,
      createdAt: new Date().toLocaleString(),
    };
    setMemories((prev) => [item, ...prev]);
    addActivity('info', 'system', `Memory banked: "${content.substring(0, 20)}..."`);
  };

  const handleDeleteMemory = (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    addActivity('info', 'system', `Purged memory ID ${id}`);
  };

  const handleUpdateMemory = (id: string, newContent: string) => {
    setMemories((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: newContent } : m))
    );
    addActivity('info', 'system', `Updated memory ID ${id}`);
  };

  const latestMessage = messages[messages.length - 1];
  const recentActivities = activities.slice(-2).reverse();

  return (
    <div className="hud-container">
      <div className="scanline-overlay" />

      {/* 1. Clean Minimal Header */}
      <Header
        telemetry={telemetry}
        assistantState={assistantState}
        onToggleMic={handleToggleMic}
        onToggleSpeaker={handleToggleSpeaker}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenMemory={() => setMemoryOpen(true)}
        onToggleDrawer={() => setDrawerOpen(true)}
        messagesCount={messages.length}
      />

      {/* 2. Dominant Hero Center Stage (Big Orb) */}
      <main className="hud-hero-stage">
        {/* Floating Dialogue Toast (appears when there's an active message) */}
        {latestMessage && (
          <div className="floating-dialogue-card">
            <div className="floating-dialogue-header">
              <span>{latestMessage.sender === 'user' ? '[OPERATOR // DIRECTIVE]' : '[JARVIS // SYNTHESIS]'}</span>
              <span>{latestMessage.timestamp}</span>
            </div>
            <div className="floating-dialogue-text">
              {latestMessage.text}
            </div>
          </div>
        )}

        {/* Big Solar Particle Globe Centerpiece */}
        <AssistantOrb
          state={assistantState}
          onInterrupt={handleHalt}
        />

        {/* 3. Floating Command Dock (Bottom Center) */}
        <div className="floating-command-dock">
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
            {[
              { label: '[DIAGNOSTICS]', prompt: 'Run complete desktop telemetry diagnostics' },
              { label: '[MEMORY]', prompt: 'Query durable memory banks' },
              { label: '[AUDIO_TEST]', prompt: 'Initiate acoustic synthesis harmonic test' },
              { label: '[DEFCON_ALERT]', prompt: 'Simulate critical subsystem alert' },
            ].map((p, idx) => (
              <button
                key={idx}
                className="protocol-chip"
                style={{ fontSize: '9.5px', padding: '2px 8px' }}
                onClick={() => handleSendMessage(p.prompt)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <form
            className="command-input-bar"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText);
            }}
          >
            <Terminal size={14} color="var(--hud-cyan)" style={{ opacity: 0.8, marginLeft: '4px' }} />
            <input
              type="text"
              className="command-text-field"
              placeholder="Transmit directive to JARVIS... (Return to transmit)"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={assistantState === 'thinking'}
            />

            <button
              type="button"
              className="hud-btn hud-btn-icon"
              style={{ width: '30px', height: '30px' }}
              title="Dictate directive with voice"
              onClick={handleVoiceInputTrigger}
            >
              <Mic size={14} />
            </button>

            <button
              type="submit"
              className="hud-btn hud-btn-primary"
              style={{ padding: '6px 12px', fontSize: '11px' }}
              disabled={!inputText.trim() || assistantState === 'thinking'}
            >
              <Send size={12} />
              <span>Send</span>
            </button>
          </form>
        </div>
      </main>

      {/* 4. Single-line Telemetry Footer */}
      <footer
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 12px',
          minHeight: '26px',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color: 'var(--text-dim)',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <Activity size={12} color="var(--hud-cyan)" />
          <span style={{ color: 'var(--hud-cyan)' }}>SYS.LOG:</span>
          <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {recentActivities[0]?.message || 'Standby.'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#86efac' }}>
            <ShieldCheck size={11} style={{ display: 'inline', marginRight: '3px' }} />
            SANDBOX ENFORCED
          </span>
          <span>•</span>
          <span style={{ color: 'var(--hud-cyan)' }}>SEC.LEVEL // L0</span>
        </div>
      </footer>

      {/* 5. Slide-Out Comms Drawer */}
      {drawerOpen && (
        <div className="comms-drawer-backdrop" onClick={() => setDrawerOpen(false)}>
          <div className="comms-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="comms-drawer-header">
              <span>COMMUNICATIONS HISTORY</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  className="hud-btn hud-btn-icon"
                  style={{ width: '26px', height: '26px' }}
                  title="Purge Comms History"
                  onClick={() => setMessages([])}
                >
                  <Trash2 size={12} color="var(--text-dim)" />
                </button>
                <button
                  className="hud-btn hud-btn-icon"
                  style={{ width: '26px', height: '26px' }}
                  onClick={() => setDrawerOpen(false)}
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            <div className="comms-drawer-messages">
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-dim)', marginTop: '40px', fontFamily: 'var(--font-mono)' }}>
                  No messages logged.
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`drawer-msg-card ${m.sender}`}>
                    <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)', color: m.sender === 'user' ? '#93c5fd' : 'var(--hud-cyan)', marginBottom: '3px' }}>
                      {m.sender === 'user' ? '[OPERATOR]' : '[JARVIS]'} • {m.timestamp}
                    </div>
                    <div>{m.text}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
      />

      <MemoryViewer
        isOpen={memoryOpen}
        onClose={() => setMemoryOpen(false)}
        memories={memories}
        onAddMemory={handleAddMemory}
        onDeleteMemory={handleDeleteMemory}
        onUpdateMemory={handleUpdateMemory}
      />
    </div>
  );
};
