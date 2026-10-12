import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { ChatPanel } from '../components/chat/ChatPanel';
import { ActivityFeed } from '../components/hud/ActivityFeed';
import { SettingsModal } from '../components/settings/SettingsModal';
import { MemoryViewer } from '../components/settings/MemoryViewer';

export const App: React.FC = () => {
  const [assistantState, setAssistantState] = useState<AssistantState>('idle');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);

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
    cpuUsage: 3.8,
    memoryUsageMb: 84,
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
      text: 'Stark Industries Tactical Avionics online. Holographic quantum core initialized on Windows 11. Standing by for directives, sir.',
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
      message: 'Three.js orbital physics engine mounted. Adaptive quality enabled.',
    },
    {
      id: 'act-2',
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      level: 'success',
      category: 'security',
      message: 'Sandboxed preload bridge verified. Zero privileged surface exposed.',
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
      content: 'Interface preference: Stark Industries futuristic holographic HUD with Three.js 3D Orb.',
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
        cpuUsage: Number((3.2 + Math.random() * 2.1).toFixed(1)),
        memoryUsageMb: 82 + Math.floor(Math.random() * 6),
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
    const now = new Date().toLocaleTimeString('en-US', { hour12: false });
    const userMsg: ChatMessage = {
      id: 'msg-u-' + Date.now(),
      sender: 'user',
      text,
      timestamp: now,
      status: 'delivered',
    };

    setMessages((prev) => [...prev, userMsg]);
    setAssistantState('thinking');
    addActivity('info', 'ai', `Direct input received: "${text.length > 25 ? text.substring(0, 25) + '...' : text}"`);

    const startTime = performance.now();
    setTimeout(() => {
      const elapsed = Math.round(performance.now() - startTime);
      let responseText = `Directive registered: "${text}". All Mark-85 HUD channels operating smoothly.`;

      const lower = text.toLowerCase();
      if (lower.includes('diagnostic') || lower.includes('telemetry')) {
        responseText = `Tactical Diagnostics: Host architecture is Windows 11 x64, Three.js orbital physics operating smoothly, CPU load at ${telemetry.cpuUsage}%, memory footprint ~${telemetry.memoryUsageMb}MB. All defensive protocols nominal.`;
      } else if (lower.includes('memory') || lower.includes('bank')) {
        responseText = `Accessing memory banks: ${memories.length} durable records indexed in local store. All sectors encrypted.`;
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

  return (
    <div className="hud-container">
      <div className="scanline-overlay" />

      <Header
        telemetry={telemetry}
        assistantState={assistantState}
        onToggleMic={handleToggleMic}
        onToggleSpeaker={handleToggleSpeaker}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenMemory={() => setMemoryOpen(true)}
      />

      <main className="hud-body">
        <AssistantOrb
          state={assistantState}
          onStateChange={(st) => {
            setAssistantState(st);
            addActivity('info', 'system', `Manual core state: ${st.toUpperCase()}`);
          }}
          onInterrupt={handleHalt}
        />

        <ChatPanel
          messages={messages}
          assistantState={assistantState}
          onSendMessage={handleSendMessage}
          onVoiceInputTrigger={handleVoiceInputTrigger}
          onClearMessages={() => {
            setMessages([]);
            addActivity('info', 'system', 'Comms buffer purged.');
          }}
        />
      </main>

      <ActivityFeed activities={activities} />

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
