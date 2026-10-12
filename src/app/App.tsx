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
    cpuUsage: 4.2,
    memoryUsageMb: 82,
    activeModel: 'Claude 3.5 Sonnet (Stage 1 Mock)',
    connectionStatus: 'mock',
    latencyMs: 14,
    speechEngine: 'browser-synthesis',
    micEnabled: true,
    speakerEnabled: true,
  });

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-init-1',
      sender: 'jarvis',
      text: 'Good day. JARVIS HUD online and standing by. Subsystems operating within normal parameters on Windows 11.',
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      metadata: { modelUsed: 'System Core', durationMs: 12 },
    },
  ]);

  const [activities, setActivities] = useState<ActivityItem[]>([
    {
      id: 'act-1',
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      level: 'info',
      category: 'system',
      message: 'Electron runtime initialized. Preload sandbox active.',
    },
    {
      id: 'act-2',
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      level: 'success',
      category: 'security',
      message: 'Restricted CSP verified. Node integration disabled.',
    },
  ]);

  const [memories, setMemories] = useState<UserMemoryItem[]>([
    {
      id: 'mem-1',
      content: 'User operating on Windows 11 Intel i3 laptop environment.',
      category: 'system',
      createdAt: '2026-10-12 11:42',
    },
    {
      id: 'mem-2',
      content: 'Prefers dark futuristic HUD with cyan accents and low-overhead animations.',
      category: 'preference',
      createdAt: '2026-10-12 11:43',
    },
  ]);

  const speechTimeoutRef = useRef<number | null>(null);

  // Add activity log and mirror to main process via desktop bridge
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

  // Fetch verified system info through preload bridge on mount
  useEffect(() => {
    if (window.jarvisDesktop?.getSystemInfo) {
      window.jarvisDesktop.getSystemInfo().then((info) => {
        addActivity('success', 'system', `Desktop Bridge verified: ${info.platform} (${info.arch}), Electron ${info.electronVersion}`);
      }).catch((err) => {
        addActivity('warn', 'system', `Desktop bridge unavailable: ${err.message}`);
      });
    }
  }, [addActivity]);

  // Periodic simulated telemetry fluctuation (low overhead, ~3s interval)
  useEffect(() => {
    const timer = setInterval(() => {
      setTelemetry((prev) => ({
        ...prev,
        cpuUsage: Number((3.5 + Math.random() * 2.5).toFixed(1)),
        memoryUsageMb: 80 + Math.floor(Math.random() * 8),
      }));
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  // Stop speech playback and halt active speech
  const handleHalt = useCallback(() => {
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setAssistantState('idle');
    addActivity('warn', 'ai', 'User triggered subsystem halt / interrupt.');
  }, [addActivity]);

  // Speak text using browser SpeechSynthesis if enabled
  const speakText = useCallback((text: string, onEnd: () => void) => {
    if (!telemetry.speakerEnabled || !settings.speechEnabled || !('speechSynthesis' in window)) {
      speechTimeoutRef.current = window.setTimeout(onEnd, 1500);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 0.95;

      utterance.onend = () => {
        onEnd();
      };
      utterance.onerror = () => {
        onEnd();
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      onEnd();
    }
  }, [telemetry.speakerEnabled, settings.speechEnabled]);

  // Handle sending a chat message
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
    addActivity('info', 'ai', `User input received: "${text.length > 30 ? text.substring(0, 30) + '...' : text}"`);

    // Simulate AI reasoning and generate contextual mock response
    const startTime = performance.now();
    setTimeout(() => {
      const elapsed = Math.round(performance.now() - startTime);
      let responseText = `I have received your command: "${text}". All desktop interfaces are operating under Stage 1 protocol.`;

      const lower = text.toLowerCase();
      if (lower.includes('diagnostic') || lower.includes('status')) {
        responseText = `System diagnostic report: Host platform is Windows 11 x64, Electron sandbox active, CPU load ${telemetry.cpuUsage}%, renderer memory footprint ~${telemetry.memoryUsageMb}MB. No anomalies detected.`;
      } else if (lower.includes('memory')) {
        responseText = `You currently have ${memories.length} durable memory records in your local store. Stage 4 will connect SQLite and Drizzle ORM for automated memory indexing.`;
      } else if (lower.includes('voice') || lower.includes('speak')) {
        responseText = 'Voice synthesis subsystem verified. Audio pipeline is responsive with harmonic frequency modulation.';
      } else if (lower.includes('who are you') || lower.includes('jarvis')) {
        responseText = 'I am JARVIS, an autonomous personal AI desktop agent designed for Windows 11. Currently operating in Stage 1 HUD mode.';
      }

      const jarvisMsg: ChatMessage = {
        id: 'msg-j-' + Date.now(),
        sender: 'jarvis',
        text: responseText,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        metadata: {
          modelUsed: settings.openRouterModel.split('/')[1] || 'Stage 1 Mock',
          durationMs: elapsed,
        },
      };

      setMessages((prev) => [...prev, jarvisMsg]);
      setAssistantState('speaking');
      addActivity('success', 'ai', `Response generated (${elapsed}ms). Synthesizing speech.`);

      speakText(responseText, () => {
        setAssistantState('idle');
        addActivity('info', 'system', 'Voice playback concluded. Ready for next prompt.');
      });
    }, 1100);
  };

  // Trigger voice capture (mock or speech recognition)
  const handleVoiceInputTrigger = () => {
    if (assistantState === 'listening') {
      setAssistantState('idle');
      addActivity('info', 'voice', 'Microphone capture stopped.');
      return;
    }

    setAssistantState('listening');
    addActivity('info', 'voice', 'Microphone capture opened. Listening for speech...');

    // Simulate transcribed voice dictation after listening pause
    setTimeout(() => {
      setAssistantState('idle');
      handleSendMessage('Simulate voice audio response');
    }, 2400);
  };

  const handleToggleMic = () => {
    setTelemetry((prev) => {
      const next = !prev.micEnabled;
      addActivity('info', 'voice', `Microphone ${next ? 'enabled' : 'muted'}.`);
      return { ...prev, micEnabled: next };
    });
  };

  const handleToggleSpeaker = () => {
    setTelemetry((prev) => {
      const next = !prev.speakerEnabled;
      if (!next && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      addActivity('info', 'voice', `Speech output ${next ? 'enabled' : 'muted'}.`);
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
    addActivity('success', 'system', 'Updated system preferences and AI model target.');
  };

  const handleAddMemory = (content: string, category: UserMemoryItem['category']) => {
    const item: UserMemoryItem = {
      id: 'mem-' + Date.now(),
      content,
      category,
      createdAt: new Date().toLocaleString(),
    };
    setMemories((prev) => [item, ...prev]);
    addActivity('info', 'system', `Added memory: "${content.substring(0, 25)}..."`);
  };

  const handleDeleteMemory = (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    addActivity('info', 'system', `Deleted memory record ID ${id}`);
  };

  const handleUpdateMemory = (id: string, newContent: string) => {
    setMemories((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: newContent } : m))
    );
    addActivity('info', 'system', `Updated memory record ID ${id}`);
  };

  return (
    <div className="hud-container">
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
            addActivity('info', 'system', `Manual state override: ${st.toUpperCase()}`);
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
            addActivity('info', 'system', 'Chat terminal buffer cleared.');
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
