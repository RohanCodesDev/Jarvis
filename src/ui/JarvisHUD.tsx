import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
  AssistantState,
  ChatMessage,
  ActivityItem,
  SystemTelemetry,
  JarvisSettings,
  UserMemoryItem,
} from '../types/hud';

import { Header } from './header/Header';
import { AssistantOrb } from './orb/AssistantOrb';
import { CommandDock } from './controls/CommandDock';
import { TacticalDialogueStream } from './hud/TacticalDialogueStream';
import { TacticalTelemetryStream } from './hud/TacticalTelemetryStream';
import { CommsDrawer } from './drawer/CommsDrawer';
import { SettingsModal } from './modals/SettingsModal';
import { MemoryViewer } from './modals/MemoryViewer';

export const JarvisHUD: React.FC = () => {
  const [assistantState, setAssistantState] = useState<AssistantState>('idle');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
      text: 'Hello sir. Systems are online and ready for your command.',
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
    },
  ]);

  const [activities, setActivities] = useState<ActivityItem[]>([
    {
      id: 'act-1',
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      level: 'info',
      category: 'system',
      message:
        'Solar Particle Globe WebGL2 shader active. Hardware acceleration verified.',
    },
    {
      id: 'act-2',
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      level: 'success',
      category: 'security',
      message:
        'Preload IPC bridge active. Sandboxed context isolation enforced.',
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
      content:
        'Interface: Minimalist Stark Industries HUD with dominant Solar Particle Globe.',
      category: 'preference',
      createdAt: '2026-10-12 11:43',
    },
  ]);

  const speechTimeoutRef = useRef<number | null>(null);

  const addActivity = useCallback(
    (
      level: ActivityItem['level'],
      category: ActivityItem['category'],
      message: string,
    ) => {
      const item: ActivityItem = {
        id:
          'act-' +
          Date.now() +
          '-' +
          Math.random().toString(36).substring(2, 5),
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        level,
        category,
        message,
      };
      setActivities((prev) => [...prev.slice(-25), item]);

      if (window.jarvisDesktop?.logActivity) {
        window.jarvisDesktop
          .logActivity({ level, category, message })
          .catch(() => {});
      }
    },
    [],
  );

  // Check desktop bridge and load persisted settings on mount
  useEffect(() => {
    if (window.jarvisDesktop?.getSystemInfo) {
      window.jarvisDesktop
        .getSystemInfo()
        .then((info) => {
          addActivity(
            'success',
            'system',
            `Desktop Bridge active: ${info.platform} (${info.arch}), Electron ${info.electronVersion}`,
          );
        })
        .catch((err) => {
          addActivity(
            'warn',
            'system',
            `Desktop bridge unavailable: ${err.message}`,
          );
        });
    }

    if (window.jarvisDesktop?.getSettings) {
      window.jarvisDesktop
        .getSettings()
        .then((loadedSettings) => {
          setSettings(loadedSettings);
          setTelemetry((prev) => ({
            ...prev,
            activeModel:
              loadedSettings.cloudProvider === 'openrouter'
                ? loadedSettings.openRouterModel
                : loadedSettings.ollamaModel,
            connectionStatus: loadedSettings.hasApiKey ? 'connected' : 'mock',
          }));
          if (loadedSettings.hasApiKey) {
            addActivity(
              'success',
              'security',
              'Hardware-encrypted credentials active via safeStorage.',
            );
          }
        })
        .catch(() => {});
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

  const handleManualStateChange = useCallback(
    (nextState: AssistantState) => {
      if (nextState === 'idle') {
        handleHalt();
      } else {
        if (speechTimeoutRef.current) {
          clearTimeout(speechTimeoutRef.current);
          speechTimeoutRef.current = null;
        }
        setAssistantState(nextState);
        addActivity(
          'info',
          'system',
          `Orb state changed: ${nextState.toUpperCase()}`,
        );
      }
    },
    [handleHalt, addActivity],
  );

  const speakText = useCallback(
    (text: string, onEnd: () => void) => {
      if (
        !telemetry.speakerEnabled ||
        !settings.speechEnabled ||
        !('speechSynthesis' in window)
      ) {
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
    },
    [telemetry.speakerEnabled, settings.speechEnabled],
  );

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
    setAssistantState('thinking');
    addActivity(
      'info',
      'ai',
      `Directive received: "${text.length > 25 ? text.substring(0, 25) + '...' : text}"`,
    );

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
        responseText =
          'Acoustic visualizer synchronized. Harmonic carrier frequencies transmitting at 1420.4 MHz.';
      } else if (lower.includes('alert') || lower.includes('defcon')) {
        responseText =
          'Defcon alert simulated. Quantum core shifting to amber alert matrix.';
        setAssistantState('error');
        addActivity(
          'warn',
          'security',
          'Simulated Defcon-1 alert protocol activated.',
        );
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
      addActivity(
        'success',
        'ai',
        `Synthesizing vocal response (${elapsed}ms).`,
      );

      speakText(responseText, () => {
        setAssistantState('idle');
        addActivity(
          'info',
          'system',
          'Voice playback complete. Core standing by.',
        );
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
    addActivity(
      'info',
      'voice',
      'Audio transcriber engaged. Listening for vocal directive...',
    );

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
      addActivity(
        'info',
        'voice',
        `Acoustic playback ${next ? 'engaged' : 'muted'}.`,
      );
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
      connectionStatus: newSettings.hasApiKey ? 'connected' : 'mock',
    }));
    if (window.jarvisDesktop?.saveSettings) {
      window.jarvisDesktop.saveSettings(newSettings).catch(() => {});
    }
    addActivity('success', 'system', 'Updated tactical parameters.');
  };

  const handleAddMemory = (
    content: string,
    category: UserMemoryItem['category'],
  ) => {
    const item: UserMemoryItem = {
      id: 'mem-' + Date.now(),
      content,
      category,
      createdAt: new Date().toLocaleString(),
    };
    setMemories((prev) => [item, ...prev]);
    addActivity(
      'info',
      'system',
      `Memory banked: "${content.substring(0, 20)}..."`,
    );
  };

  const handleDeleteMemory = (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    addActivity('info', 'system', `Purged memory ID ${id}`);
  };

  const handleUpdateMemory = (id: string, newContent: string) => {
    setMemories((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: newContent } : m)),
    );
    addActivity('info', 'system', `Updated memory ID ${id}`);
  };

  const latestMessage = messages[messages.length - 1];

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

      {/* 2. Dominant Hero Center Stage with Frameless Left & Right Hacker Flanks */}
      <main className="hud-hero-stage">
        {/* Left Flank: Frameless Hacker Dialogue Stream with Typewriter Animation */}
        <TacticalDialogueStream
          latestMessage={latestMessage}
          previousMessage={
            messages.length > 1 ? messages[messages.length - 2] : undefined
          }
          assistantState={assistantState}
        />

        {/* Big Solar Particle Globe Centerpiece */}
        <AssistantOrb state={assistantState} onInterrupt={handleHalt} />

        {/* Right Flank: Frameless Hacker Telemetry Stream & State Vector */}
        <TacticalTelemetryStream
          telemetry={telemetry}
          activities={activities}
          assistantState={assistantState}
          onStateChange={handleManualStateChange}
        />

        {/* Minimalist Floating Command Input */}
        <CommandDock
          assistantState={assistantState}
          onSendMessage={handleSendMessage}
          onVoiceTrigger={handleVoiceInputTrigger}
        />
      </main>

      {/* 4. Slide-Out Comms Drawer */}
      <CommsDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        messages={messages}
        activities={activities}
        onClearMessages={() => setMessages([])}
      />

      {/* 5. Modals */}
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

export default JarvisHUD;
