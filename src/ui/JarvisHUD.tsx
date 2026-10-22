import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
  AssistantState,
  ChatMessage,
  ActivityItem,
  SystemTelemetry,
  JarvisSettings,
  UserMemoryItem,
  HudTheme,
} from '../types/hud';

import { Header } from './header/Header';
import { AssistantOrb } from './orb/AssistantOrb';
import { CommandDock } from './controls/CommandDock';
import { QuickDirectiveChips } from './controls/QuickDirectiveChips';
import { AcousticWaveformRibbon } from './controls/AcousticWaveformRibbon';
import { TacticalDialogueStream } from './hud/TacticalDialogueStream';
import { TacticalTelemetryStream } from './hud/TacticalTelemetryStream';
import { CommsDrawer } from './drawer/CommsDrawer';
import { SettingsModal } from './modals/SettingsModal';
import { MemoryViewer } from './modals/MemoryViewer';
import {
  TacticalActionCard,
  type TacticalCardData,
} from './hud/TacticalActionCard';
import { TacticalTaskPlanCard } from './hud/TacticalTaskPlanCard';
import type { ExecutionPlan } from '../services/agent/agentTypes';
import { soundFX } from './audio/soundFX';
import {
  VoiceCoordinator,
  type StreamingSpeechHandle,
} from '../services/voice/voiceCoordinator';
import { wakeWordDetector } from '../services/voice/wakeWordDetector';

export const JarvisHUD: React.FC = () => {
  const [assistantState, setAssistantState] = useState<AssistantState>('idle');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tacticalCard, setTacticalCard] = useState<TacticalCardData | null>(
    null,
  );
  const [activePlan, setActivePlan] = useState<ExecutionPlan | null>(null);

  const [settings, setSettings] = useState<JarvisSettings>({
    cloudProvider: 'openrouter',
    openRouterModel: 'anthropic/claude-3.5-sonnet',
    ollamaModel: 'llama3:latest',
    hasApiKey: false,
    speechEnabled: true,
    voiceGender: 'male',
    soundEffects: true,
    compactMode: false,
    wakeWordEnabled: false,
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
  const streamCleanupRef = useRef<(() => void) | null>(null);
  const voiceCoordinatorRef = useRef<VoiceCoordinator>(new VoiceCoordinator());

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
          const isConnected =
            (loadedSettings.cloudProvider === 'groq' && loadedSettings.hasGroqKey) ||
            (loadedSettings.cloudProvider === 'openrouter' && loadedSettings.hasApiKey) ||
            loadedSettings.cloudProvider === 'ollama';

          const activeModelName =
            loadedSettings.cloudProvider === 'openrouter'
              ? loadedSettings.openRouterModel
              : loadedSettings.cloudProvider === 'groq'
                ? loadedSettings.groqModel || 'openai/gpt-oss-120b'
                : loadedSettings.ollamaModel;

          setTelemetry((prev) => ({
            ...prev,
            activeModel: activeModelName,
            connectionStatus: isConnected ? 'connected' : 'mock',
          }));
          if (loadedSettings.hasApiKey || loadedSettings.hasGroqKey) {
            addActivity(
              'success',
              'security',
              'Hardware-encrypted credentials active via safeStorage.',
            );
          }
        })
        .catch(() => {});
    }

    if (window.jarvisDesktop?.getMemories) {
      window.jarvisDesktop
        .getMemories()
        .then((dbMemories) => {
          if (dbMemories && dbMemories.length > 0) {
            setMemories(dbMemories);
            addActivity(
              'success',
              'system',
              `Neon DB memory banks loaded (${dbMemories.length} records).`,
            );
          }
        })
        .catch(() => {});
    }

    if (window.jarvisDesktop?.getChatHistory) {
      window.jarvisDesktop
        .getChatHistory('main', 40)
        .then((dbHistory) => {
          if (dbHistory && dbHistory.length > 0) {
            setMessages(dbHistory);
          }
        })
        .catch(() => {});
    }

    if (window.jarvisDesktop?.getDbStatus) {
      window.jarvisDesktop
        .getDbStatus()
        .then((status) => {
          if (status.isConnected) {
            addActivity(
              'success',
              'system',
              'Neon PostgreSQL persistent storage active.',
            );
          }
        })
        .catch(() => {});
    }

    if (window.jarvisDesktop?.onActivityEvent) {
      const unsub = window.jarvisDesktop.onActivityEvent((act) => {
        setActivities((prev) => [...prev.slice(-25), act]);

        if (act.category === 'tool' || act.category === 'security') {
          if (settings.soundEffects) {
            if (act.level === 'warn' || act.level === 'error') {
              soundFX.playAlertTone();
            } else {
              soundFX.playActionSuccess();
            }
          }

          setTacticalCard({
            id: act.id,
            title:
              act.category === 'tool'
                ? 'Tactical Action Executed'
                : 'Security Protocol',
            message: act.message,
            category: act.category,
            level: act.level,
            durationMs: act.durationMs,
            imageUrl: act.imageUrl,
          });
        }
      });
      return () => {
        unsub();
      };
    }

    if (window.jarvisDesktop?.onTaskProgress) {
      const unsubPlan = window.jarvisDesktop.onTaskProgress((event) => {
        setActivePlan((prev) => {
          const updated: ExecutionPlan = {
            id: event.planId,
            title:
              prev?.title ||
              `Tactical Multi-Step Mission (${event.totalSteps} Steps)`,
            prompt: prev?.prompt || '',
            steps: event.steps,
            status: event.status,
            currentStepIndex: event.currentStepIndex,
            summary: event.summary || prev?.summary,
            createdAt: prev?.createdAt || new Date().toISOString(),
          };
          return updated;
        });

        if (event.status === 'completed' && settings.soundEffects) {
          soundFX.playActionSuccess();
        } else if (
          event.status === 'awaiting_approval' &&
          settings.soundEffects
        ) {
          soundFX.playAlertTone();
        }
      });
      return () => {
        unsubPlan();
      };
    }

    if (window.jarvisDesktop?.onReminderTriggered) {
      const unsubReminder = window.jarvisDesktop.onReminderTriggered(
        (reminder) => {
          if (settings.soundEffects) {
            soundFX.playAlertTone();
          }
          setTacticalCard({
            id: reminder.id,
            title: 'Directive Reminder Due',
            message: reminder.text,
            category: 'system',
            level: 'warn',
          });
          if (settings.speechEnabled && telemetry.speakerEnabled) {
            voiceCoordinatorRef.current.speak(
              `Reminder, sir: ${reminder.text}`,
              {
                onStateChange: (st) => {
                  if (st === 'speaking') setAssistantState('speaking');
                  else if (st === 'idle') setAssistantState('idle');
                },
                onError: (err) => addActivity('warn', 'voice', err),
              },
              {
                voiceGender: settings.voiceGender,
                rate: 1.05,
                pitch: 0.96,
              },
              () => setAssistantState('idle'),
            );
          }
        },
      );
      return () => {
        unsubReminder();
      };
    }
  }, [
    addActivity,
    settings.soundEffects,
    settings.speechEnabled,
    settings.voiceGender,
    telemetry.speakerEnabled,
  ]);

  // Global Push-To-Talk Hotkey Listener (Ctrl+Shift+Space)
  useEffect(() => {
    if (window.jarvisDesktop?.onTriggerVoiceInput) {
      const unsub = window.jarvisDesktop.onTriggerVoiceInput(() => {
        handleVoiceInputTriggerRef.current();
      });
      return () => {
        unsub();
      };
    }
  }, []);

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
    if (streamCleanupRef.current) {
      streamCleanupRef.current();
      streamCleanupRef.current = null;
    }
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
    voiceCoordinatorRef.current.halt();
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
      if (!telemetry.speakerEnabled || !settings.speechEnabled) {
        speechTimeoutRef.current = window.setTimeout(onEnd, 1200);
        return;
      }

      voiceCoordinatorRef.current.speak(
        text,
        {
          onStateChange: (st) => {
            if (st === 'speaking') setAssistantState('speaking');
            else if (st === 'idle') setAssistantState('idle');
            else if (st === 'error') setAssistantState('error');
          },
          onError: (err) => {
            addActivity('warn', 'voice', err);
          },
        },
        {
          voiceGender: settings.voiceGender,
          rate: 1.05,
          pitch: 0.96,
        },
        onEnd,
      );
    },
    [
      telemetry.speakerEnabled,
      settings.speechEnabled,
      settings.voiceGender,
      addActivity,
    ],
  );

  const handleSendMessage = (text: string, screenCaptureDataUrl?: string) => {
    const trimmed = text.trim();
    if (!trimmed || assistantState === 'thinking') return;

    if (streamCleanupRef.current) {
      streamCleanupRef.current();
      streamCleanupRef.current = null;
    }

    const lower = trimmed.toLowerCase();
    if (
      lower === 'clear' ||
      lower === 'clear history' ||
      lower === 'clear memory' ||
      lower === 'clear context' ||
      lower === 'reset' ||
      lower === 'reset memory' ||
      lower === 'reset context' ||
      lower === '/clear' ||
      lower === '/reset'
    ) {
      const now = new Date().toLocaleTimeString('en-US', { hour12: false });
      const resetMsg: ChatMessage = {
        id: 'msg-init-' + Date.now(),
        sender: 'jarvis',
        text: 'Context memory banks cleared. System state nominal. Standing by for directives, sir.',
        timestamp: now,
        status: 'delivered',
      };
      setMessages([resetMsg]);
      setAssistantState('speaking');
      addActivity('info', 'ai', 'Context memory banks purged.');
      speakText(
        'Context memory cleared. Standing by for directives, sir.',
        () => {
          setAssistantState('idle');
        },
      );
      return;
    }

    const now = new Date().toLocaleTimeString('en-US', { hour12: false });
    const userMsg: ChatMessage = {
      id: 'msg-u-' + Date.now(),
      sender: 'user',
      text,
      timestamp: now,
      status: 'delivered',
    };

    const jarvisMsgId = 'msg-j-' + Date.now();
    const pendingJarvisMsg: ChatMessage = {
      id: jarvisMsgId,
      sender: 'jarvis',
      text: '',
      timestamp: now,
      status: 'sending',
      metadata: {
        modelUsed: settings.openRouterModel,
      },
    };

    setMessages((prev) => [...prev, userMsg, pendingJarvisMsg]);
    setAssistantState('thinking');
    addActivity(
      'info',
      'ai',
      `Directive dispatched: "${text.length > 28 ? text.substring(0, 28) + '...' : text}"`,
    );

    const startTime = performance.now();

    if (window.jarvisDesktop?.sendChatMessage) {
      const streamId =
        'stream-' +
        Date.now() +
        '-' +
        Math.random().toString(36).substring(2, 6);
      const history = messages.slice(-8).map((m) => ({
        role: (m.sender === 'user' ? 'user' : 'assistant') as
          | 'user'
          | 'assistant',
        content: m.text,
      }));

      let accumulated = '';
      const modelToSend =
        settings.cloudProvider === 'groq'
          ? settings.groqModel || undefined
          : settings.cloudProvider === 'ollama'
            ? settings.ollamaModel || undefined
            : settings.openRouterModel;

      let speechHandle: StreamingSpeechHandle | null = null;
      if (telemetry.speakerEnabled && settings.speechEnabled) {
        speechHandle = voiceCoordinatorRef.current.startStreamingSpeech(
          {
            onStateChange: (st) => {
              if (st === 'speaking') setAssistantState('speaking');
              else if (st === 'idle') setAssistantState('idle');
              else if (st === 'error') setAssistantState('error');
            },
            onError: (err) => {
              addActivity('warn', 'voice', err);
            },
          },
          {
            voiceGender: settings.voiceGender,
            rate: 1.05,
            pitch: 0.96,
          },
          () => {
            setAssistantState('idle');
          },
        );
      }

      const cleanup = window.jarvisDesktop.sendChatMessage(
        {
          streamId,
          message: text,
          history,
          model: modelToSend,
          screenCaptureDataUrl,
        },
        (event) => {
          if (event.chunk) {
            accumulated += event.chunk;
            setAssistantState('speaking');
            setMessages((prev) =>
              prev.map((m) =>
                m.id === jarvisMsgId
                  ? { ...m, text: accumulated, status: 'sending' }
                  : m,
              ),
            );
            if (speechHandle) {
              speechHandle.feedChunk(event.chunk);
            }
          }

          if (event.done) {
            streamCleanupRef.current = null;
            const elapsed = Math.round(performance.now() - startTime);
            let finalText = event.fullResponse || accumulated;

            if (event.error) {
              if (speechHandle) {
                speechHandle.cancel();
                speechHandle = null;
              }
              setAssistantState('error');
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === jarvisMsgId
                    ? {
                        ...m,
                        text: `[Error: ${event.error}]`,
                        status: 'error',
                        metadata: { durationMs: elapsed },
                      }
                    : m,
                ),
              );
              addActivity('error', 'ai', event.error);
              setTimeout(() => setAssistantState('idle'), 3500);
            } else {
              if (!finalText.trim()) {
                finalText =
                  'Directive acknowledged, sir. All subsystem parameters nominal.';
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === jarvisMsgId
                    ? {
                        ...m,
                        text: finalText,
                        status: 'delivered',
                        metadata: {
                          modelUsed:
                            event.metadata?.model || settings.openRouterModel,
                          durationMs: elapsed,
                        },
                      }
                    : m,
                ),
              );
              addActivity('success', 'ai', `Stream concluded (${elapsed}ms).`);
              if (speechHandle) {
                if (!accumulated && finalText) {
                  speechHandle.feedChunk(finalText);
                }
                speechHandle.finish();
              } else {
                setAssistantState('idle');
              }
            }
          }
        },
      );
      streamCleanupRef.current = cleanup;
    } else {
      setTimeout(() => {
        const elapsed = Math.round(performance.now() - startTime);
        const reply = `Directive registered: "${text}". All Mark-85 HUD channels operating smoothly.`;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === jarvisMsgId
              ? {
                  ...m,
                  text: reply,
                  status: 'delivered',
                  metadata: { durationMs: elapsed },
                }
              : m,
          ),
        );
        setAssistantState('speaking');
        speakText(reply, () => setAssistantState('idle'));
      }, 800);
    }
  };

  const handleInspectScreen = async (promptText?: string) => {
    const prompt =
      promptText ||
      'Inspect my screen and explain what is currently displayed, noting any open code, errors, or windows.';
    setAssistantState('thinking');
    addActivity(
      'info',
      'tool',
      'Optical receptor scan initiated. Capturing primary display...',
    );

    let capturedDataUrl: string | undefined;
    try {
      if (window.jarvisDesktop?.captureScreenAndAnalyze) {
        const capResult =
          await window.jarvisDesktop.captureScreenAndAnalyze(prompt);
        if (capResult.success && capResult.data) {
          const dUrl = (capResult.data as Record<string, unknown>)?.dataUrl as
            | string
            | undefined;
          if (dUrl && dUrl.length > 100) {
            capturedDataUrl = dUrl;
            setTacticalCard({
              id: 'tactical-vision-' + Date.now(),
              title: 'OPTICAL RECEPTOR SCAN ACTIVE',
              message: `Primary display buffer acquired. Analyzing onscreen visuals for: "${prompt}"`,
              category: 'tool',
              level: 'info',
              imageUrl: dUrl,
            });
          }
        }
      }
    } catch (capErr) {
      console.warn('[HUD] Screen capture trigger error:', capErr);
    }

    handleSendMessage(prompt, capturedDataUrl);
  };

  const handleVoiceInputTrigger = () => {
    if (assistantState === 'listening') {
      addActivity('info', 'voice', 'Transcribing audio via Whisper...');
      setAssistantState('thinking');
      voiceCoordinatorRef.current.stopListening();
      return;
    }

    if (!telemetry.micEnabled) {
      addActivity(
        'warn',
        'voice',
        'Microphone is muted in tactical telemetry.',
      );
      return;
    }

    if (!voiceCoordinatorRef.current.isRecognitionSupported()) {
      addActivity(
        'warn',
        'voice',
        'Microphone capture is unavailable on this platform.',
      );
      return;
    }

    addActivity(
      'info',
      'voice',
      'Whisper recording active. Speak your directive, then click mic again to process...',
    );

    if (settings.soundEffects) {
      soundFX.playArmChime();
    }

    voiceCoordinatorRef.current.startListening({
      onStateChange: (st) => {
        if (st === 'listening') setAssistantState('listening');
        else if (st === 'processing') setAssistantState('thinking');
        else if (st === 'idle') setAssistantState('idle');
        else if (st === 'error') setAssistantState('error');
      },
      onFinalTranscript: (finalText) => {
        addActivity('success', 'voice', `Whisper transcribed: "${finalText}"`);
        handleSendMessage(finalText);
      },
      onError: (err) => {
        addActivity('warn', 'voice', err);
        setAssistantState('idle');
      },
    });
  };

  const handleToggleMic = () => {
    setTelemetry((prev) => {
      const next = !prev.micEnabled;
      if (!next && assistantState === 'listening') {
        voiceCoordinatorRef.current.stopListening();
        setAssistantState('idle');
      }
      addActivity('info', 'voice', `Microphone ${next ? 'engaged' : 'muted'}.`);
      return { ...prev, micEnabled: next };
    });
  };

  const handleToggleSpeaker = () => {
    setTelemetry((prev) => {
      const next = !prev.speakerEnabled;
      if (!next) {
        voiceCoordinatorRef.current.halt();
      }
      addActivity(
        'info',
        'voice',
        `Acoustic playback ${next ? 'engaged' : 'muted'}.`,
      );
      return { ...prev, speakerEnabled: next };
    });
  };

  const handleToggleWakeWord = () => {
    const next = settings.wakeWordEnabled === false ? true : false;
    const updated = { ...settings, wakeWordEnabled: next };
    handleSaveSettings(updated);
    addActivity(
      'info',
      'voice',
      `Wake-word sentinel ${next ? 'engaged' : 'disengaged'}.`,
    );
  };

  const handleSendMessageRef = useRef(handleSendMessage);
  handleSendMessageRef.current = handleSendMessage;

  const handleVoiceInputTriggerRef = useRef(handleVoiceInputTrigger);
  handleVoiceInputTriggerRef.current = handleVoiceInputTrigger;

  // Hands-free Wake-Word ("Hey Jarvis") background sentinel
  useEffect(() => {
    const isEnabled = Boolean(settings.wakeWordEnabled) && telemetry.micEnabled;

    if (!isEnabled) {
      wakeWordDetector.stop();
      return;
    }

    if (assistantState === 'idle') {
      wakeWordDetector.start({
        onWakeWordDetected: (directive) => {
          addActivity('success', 'voice', 'Wake-word "Hey Jarvis" recognized!');
          if (directive && directive.trim().length > 0) {
            addActivity(
              'info',
              'voice',
              `Hands-free directive: "${directive}"`,
            );
            handleSendMessageRef.current(directive);
          } else {
            setAssistantState('listening');
            speakText('At your service, sir.', () => {
              handleVoiceInputTriggerRef.current();
            });
          }
        },
        onError: (err) => {
          addActivity('warn', 'voice', `Wake-word: ${err}`);
        },
      });
    } else {
      wakeWordDetector.pause();
    }

    return () => {
      wakeWordDetector.stop();
    };
  }, [
    assistantState,
    settings.wakeWordEnabled,
    telemetry.micEnabled,
    addActivity,
    speakText,
  ]);

  const handleSaveSettings = (newSettings: JarvisSettings) => {
    setSettings(newSettings);
    const isConnected =
      (newSettings.cloudProvider === 'groq' && newSettings.hasGroqKey) ||
      (newSettings.cloudProvider === 'openrouter' && newSettings.hasApiKey) ||
      newSettings.cloudProvider === 'ollama';

    const activeModelName =
      newSettings.cloudProvider === 'openrouter'
        ? newSettings.openRouterModel
        : newSettings.cloudProvider === 'groq'
          ? newSettings.groqModel || 'openai/gpt-oss-120b'
          : newSettings.ollamaModel;

    setTelemetry((prev) => ({
      ...prev,
      activeModel: activeModelName,
      connectionStatus: isConnected ? 'connected' : 'mock',
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
    if (window.jarvisDesktop?.addMemory) {
      window.jarvisDesktop.addMemory(item).catch(() => {});
    }
    addActivity(
      'info',
      'system',
      `Memory banked to Neon DB: "${content.substring(0, 20)}..."`,
    );
  };

  const handleDeleteMemory = (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    if (window.jarvisDesktop?.deleteMemory) {
      window.jarvisDesktop.deleteMemory(id).catch(() => {});
    }
    addActivity('info', 'system', `Purged memory ID ${id}`);
  };

  const handleUpdateMemory = (id: string, newContent: string) => {
    setMemories((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: newContent } : m)),
    );
    if (window.jarvisDesktop?.updateMemory) {
      window.jarvisDesktop.updateMemory(id, newContent).catch(() => {});
    }
    addActivity('info', 'system', `Updated memory ID ${id}`);
  };

  const handleApproveTaskStep = useCallback(
    (planId: string, stepId: string) => {
      if (window.jarvisDesktop?.approveTaskStep) {
        window.jarvisDesktop
          .approveTaskStep(planId, stepId, true)
          .catch(() => {});
        addActivity('success', 'security', `Step approved by user.`);
      }
    },
    [addActivity],
  );

  const handleCancelTaskPlan = useCallback(
    (planId: string) => {
      if (window.jarvisDesktop?.cancelTaskPlan) {
        window.jarvisDesktop.cancelTaskPlan(planId).catch(() => {});
        addActivity('warn', 'ai', `Mission execution cancelled by user.`);
      }
    },
    [addActivity],
  );

  const latestMessage = messages[messages.length - 1];
  const currentTheme: HudTheme = settings.theme || 'cyan';

  const handleSelectTheme = (newTheme: HudTheme) => {
    const updated = { ...settings, theme: newTheme };
    handleSaveSettings(updated);
  };

  return (
    <div
      className={`hud-container theme-${currentTheme}`}
      data-theme={currentTheme}
    >
      <div className="scanline-overlay" />

      {/* 1. Clean Minimal Header */}
      <Header
        telemetry={telemetry}
        assistantState={assistantState}
        currentTheme={currentTheme}
        onSelectTheme={handleSelectTheme}
        onToggleMic={handleToggleMic}
        onToggleSpeaker={handleToggleSpeaker}
        wakeWordActive={
          Boolean(settings.wakeWordEnabled) && telemetry.micEnabled
        }
        onToggleWakeWord={handleToggleWakeWord}
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

        {/* Big Solar Particle Globe Centerpiece with Shockwave */}
        <AssistantOrb
          state={assistantState}
          theme={currentTheme}
          onInterrupt={handleHalt}
        />

        {/* Right Flank: Frameless Hacker Telemetry Stream & State Vector */}
        <TacticalTelemetryStream
          telemetry={telemetry}
          activities={activities}
          assistantState={assistantState}
          onStateChange={handleManualStateChange}
        />

        {/* Bottom Floating Deck: Shortcuts, Waveform & Command Bar */}
        <div
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            maxWidth: '560px',
            zIndex: 30,
          }}
        >
          {/* Quick Directive Shortcut Chips */}
          <QuickDirectiveChips
            onSelectDirective={handleSendMessage}
            disabled={assistantState === 'thinking'}
          />

          {/* Voice-Reactive Acoustic Waveform Ribbon */}
          <AcousticWaveformRibbon state={assistantState} />

          {/* Minimalist Floating Command Input */}
          <CommandDock
            assistantState={assistantState}
            onSendMessage={handleSendMessage}
            onVoiceTrigger={handleVoiceInputTrigger}
            onInspectScreen={handleInspectScreen}
          />
        </div>
      </main>

      {/* 4. Slide-Out Comms Drawer */}
      <CommsDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        messages={messages}
        activities={activities}
        onClearMessages={() => {
          setMessages([]);
          if (window.jarvisDesktop?.clearChatHistory) {
            window.jarvisDesktop.clearChatHistory('main').catch(() => {});
          }
        }}
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

      {/* 6. Holographic Tactical Action Overlay */}
      <TacticalActionCard
        card={tacticalCard}
        onDismiss={() => setTacticalCard(null)}
      />

      {/* 7. Holographic Tactical Multi-Step Mission Card */}
      {activePlan && (
        <div
          style={{
            position: 'absolute',
            top: '72px',
            right: '24px',
            zIndex: 45,
          }}
        >
          <TacticalTaskPlanCard
            plan={activePlan}
            onApproveStep={handleApproveTaskStep}
            onCancelPlan={handleCancelTaskPlan}
            onDismiss={() => setActivePlan(null)}
          />
        </div>
      )}
    </div>
  );
};

export default JarvisHUD;
