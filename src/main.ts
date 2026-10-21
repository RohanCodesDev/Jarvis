import {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  Tray,
  Menu,
  Notification,
  nativeImage,
  type IpcMainInvokeEvent,
} from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Catch and log uncaught exceptions so they don't trigger raw GUI error popups
process.on('uncaughtException', (err) => {
  console.error('[JARVIS Main Process Error]:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[JARVIS Main Process Rejection]:', reason);
});

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// Validate IPC sender to ensure requests only originate from our trusted main window
function isValidSender(event: IpcMainInvokeEvent): boolean {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  return event.sender.id === mainWindow.webContents.id;
}

import {
  storeApiKey,
  hasApiKey,
  deleteApiKey,
  isSecretStorageAvailable,
  storeGroqKey,
  hasGroqKey,
  deleteGroqKey,
  sanitizeApiKey,
} from './services/secretStore';
import { loadSettings, saveSettings } from './services/settingsStore';
import { aiManager } from './services/ai/aiManager';
import { whisperTranscriber } from './services/voice/whisperTranscriber';
import {
  shouldSearchWeb,
  searchWeb,
  buildSearchAugmentationPrompt,
} from './services/search/webSearchService';
import { databaseService } from './services/db/databaseService';
import { globalToolRegistry } from './services/tools/toolRegistry';
import { APPROVED_APPS } from './services/tools/appLauncher';
import {
  detectDirectIntent,
  parseModelDirectives,
} from './services/tools/intentDetector';
import { globalTaskPlanner } from './services/agent/taskPlanner';
import { globalTaskExecutor } from './services/agent/taskExecutor';
import type { ExecutionPlan } from './services/agent/agentTypes';
import { globalReminderService } from './services/scheduler/reminderService';

function setupIpcHandlers() {
  ipcMain.handle('desktop:getSystemInfo', async (event) => {
    if (!isValidSender(event)) {
      throw new Error('Unauthorized IPC sender');
    }
    return {
      platform: process.platform,
      arch: process.arch,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
    };
  });

  ipcMain.handle('desktop:logActivity', async (event, payload: unknown) => {
    if (!isValidSender(event)) {
      throw new Error('Unauthorized IPC sender');
    }
    if (typeof payload === 'object' && payload !== null) {
      const data = payload as Record<string, unknown>;
      console.log(
        `[HUD Activity] [${data.category || 'system'}] ${data.message || ''}`,
      );
    }
    return { success: true };
  });

  ipcMain.handle('desktop:hasApiKey', async (event) => {
    if (!isValidSender(event)) {
      throw new Error('Unauthorized IPC sender');
    }
    return hasApiKey();
  });

  ipcMain.handle('desktop:setApiKey', async (event, key: unknown) => {
    if (!isValidSender(event)) {
      throw new Error('Unauthorized IPC sender');
    }
    if (typeof key !== 'string' || !key.trim()) {
      return { success: false, error: 'Invalid API key provided' };
    }
    if (!isSecretStorageAvailable()) {
      return { success: false, error: 'OS secure storage unavailable on host' };
    }
    const success = storeApiKey(key);
    return { success, error: success ? undefined : 'Failed to encrypt secret' };
  });

  ipcMain.handle('desktop:deleteApiKey', async (event) => {
    if (!isValidSender(event)) {
      throw new Error('Unauthorized IPC sender');
    }
    const success = deleteApiKey();
    return { success };
  });

  ipcMain.handle('desktop:getSettings', async (event) => {
    if (!isValidSender(event)) {
      throw new Error('Unauthorized IPC sender');
    }
    const settings = loadSettings();
    settings.hasApiKey = hasApiKey();
    settings.hasGroqKey = hasGroqKey();
    return settings;
  });

  ipcMain.handle('desktop:hasGroqKey', async (event) => {
    if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
    return hasGroqKey();
  });

  ipcMain.handle('desktop:setGroqKey', async (event, key: unknown) => {
    if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
    if (typeof key !== 'string') {
      return { success: false, error: 'Invalid Groq API key' };
    }
    const sanitized = sanitizeApiKey(key);
    if (!sanitized) {
      return { success: false, error: 'Groq API key cannot be empty' };
    }
    const success = storeGroqKey(sanitized);
    return { success, error: success ? undefined : 'Failed to encrypt secret' };
  });

  ipcMain.handle('desktop:deleteGroqKey', async (event) => {
    if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
    return { success: deleteGroqKey() };
  });

  ipcMain.handle('desktop:validateGroqKey', async (event, key: unknown) => {
    if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
    if (typeof key !== 'string') {
      return { valid: false, error: 'Empty key provided' };
    }
    const sanitized = sanitizeApiKey(key);
    if (!sanitized) {
      return { valid: false, error: 'Groq API key cannot be empty' };
    }
    if (!sanitized.startsWith('gsk_')) {
      return {
        valid: false,
        error:
          'Groq API keys must begin with "gsk_". (Check if an OpenRouter or OpenAI key was entered by mistake)',
      };
    }
    try {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${sanitized}` },
      });
      if (res.ok) return { valid: true };
      if (res.status === 401) {
        return {
          valid: false,
          error:
            'Invalid API key: Groq rejected this key (401). Verify or create a free key at https://console.groq.com/keys',
        };
      }
      return { valid: false, error: `Groq error status ${res.status}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { valid: false, error: `Connection failed: ${msg}` };
    }
  });

  ipcMain.handle('desktop:saveSettings', async (event, payload: unknown) => {
    if (!isValidSender(event)) {
      throw new Error('Unauthorized IPC sender');
    }
    if (typeof payload !== 'object' || payload === null) {
      return { success: false };
    }
    const success = saveSettings(payload as Record<string, unknown>);
    return { success };
  });

  ipcMain.handle('desktop:validateApiKey', async (event, key: unknown) => {
    if (!isValidSender(event)) {
      throw new Error('Unauthorized IPC sender');
    }
    if (typeof key !== 'string' || !key.trim()) {
      return { valid: false, error: 'Empty key provided' };
    }
    return aiManager.validateOpenRouterKey(key);
  });

  ipcMain.handle(
    'desktop:getAvailableModels',
    async (event, provider?: unknown) => {
      if (!isValidSender(event)) {
        throw new Error('Unauthorized IPC sender');
      }
      return aiManager.getModels(
        typeof provider === 'string'
          ? (provider as 'openrouter' | 'groq' | 'ollama')
          : undefined,
      );
    },
  );

  ipcMain.handle(
    'desktop:cancelChatMessage',
    async (event, streamId: unknown) => {
      if (!isValidSender(event)) {
        throw new Error('Unauthorized IPC sender');
      }
      if (typeof streamId === 'string') {
        aiManager.cancelStream(streamId);
      }
      return { success: true };
    },
  );

  ipcMain.handle('desktop:sendChatMessage', async (event, payload: unknown) => {
    if (!isValidSender(event)) {
      throw new Error('Unauthorized IPC sender');
    }
    if (typeof payload !== 'object' || payload === null) {
      throw new Error('Invalid chat message payload');
    }
    const data = payload as {
      streamId: string;
      message: string;
      history?: Array<{
        role: 'user' | 'assistant' | 'system';
        content: string;
      }>;
      model?: string;
    };

    if (!data.streamId || !data.message) {
      throw new Error('streamId and message are required');
    }

    const messages = (data.history || []).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    messages.push({ role: 'user' as const, content: data.message });

    let searchContext: string | undefined;
    const settings = loadSettings();
    if (settings.webSearchEnabled !== false && shouldSearchWeb(data.message)) {
      try {
        const searchResults = await searchWeb(data.message);
        if (searchResults.length > 0) {
          searchContext = buildSearchAugmentationPrompt(
            data.message,
            searchResults,
          );
          if (!event.sender.isDestroyed()) {
            event.sender.send('desktop:activityEvent', {
              id: 'act-' + Date.now(),
              timestamp: new Date().toLocaleTimeString('en-US', {
                hour12: false,
              }),
              level: 'info',
              category: 'tool',
              message: `Live web intelligence acquired (${searchResults.length} sources) for "${data.message.length > 28 ? data.message.substring(0, 28) + '...' : data.message}"`,
            });
          }
        }
      } catch (searchErr) {
        console.warn('[Main] Live web search skipped:', searchErr);
      }
    }

    // Inject long-term user memories into AI reasoning context
    try {
      const memoryContext = await databaseService.formatMemoriesForPrompt();
      if (memoryContext) {
        searchContext = searchContext
          ? `${searchContext}\n\n${memoryContext}`
          : memoryContext;
      }
    } catch (memErr) {
      console.warn('[Main] Failed to load memory context:', memErr);
    }

    // Stage 6: Direct Multi-Step Plan Detection & Sequential Execution
    const multiPlan = globalTaskPlanner.createPlanFromPrompt(data.message);
    let directActionResultMessage: string | undefined;

    if (multiPlan && multiPlan.steps.length >= 2) {
      try {
        const executed = await globalTaskExecutor.executePlan(
          multiPlan,
          (prog) => {
            if (!event.sender.isDestroyed()) {
              event.sender.send('desktop:taskProgress', prog);
            }
          },
        );
        databaseService.saveTaskPlan(executed).catch(() => {});
        directActionResultMessage = `[SYSTEM AGENT MISSION SUMMARY:\n${executed.summary}]`;

        for (const step of executed.steps) {
          if (!event.sender.isDestroyed()) {
            event.sender.send('desktop:activityEvent', {
              id: 'act-' + Date.now(),
              timestamp: new Date().toLocaleTimeString('en-US', {
                hour12: false,
              }),
              level: step.status === 'completed' ? 'success' : 'warn',
              category: 'tool',
              message: `${step.description}: ${step.result?.message || step.error || 'Done'}`,
              durationMs: step.durationMs,
            });
          }
        }
      } catch (planErr) {
        console.warn('[Main] Multi-step plan execution error:', planErr);
      }
    } else {
      // Direct Single-Action Intent Detection & Execution
      const directAction = detectDirectIntent(data.message);
      if (directAction) {
        try {
          const actionResult = await globalToolRegistry.executeTool(
            directAction.toolId,
            directAction.args,
          );
          directActionResultMessage = `[SYSTEM TOOL RESULT: Tool "${directAction.toolId}" executed. Result: "${actionResult.message}"]`;
          if (!event.sender.isDestroyed()) {
            event.sender.send('desktop:activityEvent', {
              id: 'act-' + Date.now(),
              timestamp: new Date().toLocaleTimeString('en-US', {
                hour12: false,
              }),
              level: actionResult.success ? 'success' : 'warn',
              category: 'tool',
              message: actionResult.message,
              durationMs: actionResult.durationMs,
              imageUrl: (actionResult.data as any)?.dataUrl,
            });
          }
        } catch (toolErr) {
          console.warn('[Main] Direct action execution error:', toolErr);
        }
      }
    }

    if (directActionResultMessage) {
      searchContext = searchContext
        ? `${searchContext}\n\n${directActionResultMessage}`
        : directActionResultMessage;
    }

    // Archive user directive to persistent database
    databaseService
      .saveChatMessage({
        id: 'msg-u-' + Date.now(),
        sender: 'user',
        text: data.message,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        status: 'delivered',
      })
      .catch(() => {});

    aiManager.streamChat(
      data.streamId,
      {
        messages,
        model: data.model,
        searchContext,
      },
      (chunk) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('desktop:chatChunk', {
            streamId: data.streamId,
            chunk,
            done: false,
          });
        }
      },
      async (fullResponse, metadata) => {
        let finalResponseText = fullResponse;

        // Stage 6: Parse Model Multi-Step Plan Directives [PLAN: [...]]
        const modelPlan = globalTaskPlanner.parseModelPlanDirective(
          fullResponse,
          data.message,
        );
        if (modelPlan && modelPlan.steps.length >= 2) {
          try {
            finalResponseText = fullResponse
              .replace(/\[PLAN:\s*\[[\s\S]*?\]\s*\]/i, '')
              .replace(/\[PLAN:\s*[\s\S]+?\]/i, '')
              .trim();
            const executed = await globalTaskExecutor.executePlan(
              modelPlan,
              (prog) => {
                if (!event.sender.isDestroyed()) {
                  event.sender.send('desktop:taskProgress', prog);
                }
              },
            );
            databaseService.saveTaskPlan(executed).catch(() => {});
          } catch (planErr) {
            console.warn('[Main] Model plan execution error:', planErr);
          }
        } else {
          // Stage 5: Parse Model Directives [ACTION: toolId {...}]
          const parsed = parseModelDirectives(fullResponse);
          if (parsed.actions.length > 0) {
            finalResponseText = parsed.cleanedText;
            for (const action of parsed.actions) {
              try {
                const res = await globalToolRegistry.executeTool(
                  action.toolId,
                  action.args,
                );
                if (!event.sender.isDestroyed()) {
                  event.sender.send('desktop:activityEvent', {
                    id: 'act-' + Date.now(),
                    timestamp: new Date().toLocaleTimeString('en-US', {
                      hour12: false,
                    }),
                    level: res.success ? 'success' : 'warn',
                    category: 'tool',
                    message: res.message,
                    durationMs: res.durationMs,
                    imageUrl: (res.data as any)?.dataUrl,
                  });
                }
              } catch (actErr) {
                console.warn('[Main] Directive execution error:', actErr);
              }
            }
          }
        }

        if (!event.sender.isDestroyed()) {
          event.sender.send('desktop:chatChunk', {
            streamId: data.streamId,
            fullResponse: finalResponseText,
            done: true,
            metadata,
          });
        }
        // Archive assistant response to persistent database
        databaseService
          .saveChatMessage({
            id: 'msg-j-' + Date.now(),
            sender: 'jarvis',
            text: finalResponseText,
            timestamp: new Date().toLocaleTimeString('en-US', {
              hour12: false,
            }),
            status: 'delivered',
            metadata: {
              modelUsed: metadata?.model,
            },
          })
          .catch(() => {});
      },
      (error) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('desktop:chatChunk', {
            streamId: data.streamId,
            error,
            done: true,
          });
        }
      },
    );

    return { started: true };
  });

  ipcMain.handle('desktop:transcribeAudio', async (event, payload: unknown) => {
    if (!isValidSender(event)) {
      throw new Error('Unauthorized IPC sender');
    }
    if (typeof payload !== 'object' || payload === null) {
      return { text: '', source: 'mock', error: 'Invalid audio payload' };
    }
    const data = payload as { base64Audio: string; format?: string };
    if (!data.base64Audio) {
      return { text: '', source: 'mock', error: 'Audio data is empty' };
    }
    return whisperTranscriber.transcribe(data);
  });

  // Stage 4: Persistent Memory & Knowledge Banks (Neon PostgreSQL)
  ipcMain.handle('desktop:getMemories', async (event) => {
    if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
    return databaseService.getMemories();
  });

  ipcMain.handle('desktop:addMemory', async (event, payload: unknown) => {
    if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
    if (typeof payload !== 'object' || payload === null) {
      return { success: false, error: 'Invalid memory payload' };
    }
    return databaseService.addMemory(
      payload as import('./types/hud').UserMemoryItem,
    );
  });

  ipcMain.handle(
    'desktop:updateMemory',
    async (event, id: unknown, content: unknown) => {
      if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
      if (typeof id !== 'string' || typeof content !== 'string') {
        return { success: false, error: 'Invalid arguments' };
      }
      return databaseService.updateMemory(id, content);
    },
  );

  ipcMain.handle('desktop:deleteMemory', async (event, id: unknown) => {
    if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
    if (typeof id !== 'string') {
      return { success: false, error: 'Invalid memory ID' };
    }
    return databaseService.deleteMemory(id);
  });

  ipcMain.handle(
    'desktop:getChatHistory',
    async (event, conversationId?: unknown, limit?: unknown) => {
      if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
      return databaseService.getChatHistory(
        typeof conversationId === 'string' ? conversationId : undefined,
        typeof limit === 'number' ? limit : undefined,
      );
    },
  );

  ipcMain.handle(
    'desktop:saveChatMessage',
    async (event, message: unknown, conversationId?: unknown) => {
      if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
      if (typeof message !== 'object' || message === null) {
        return { success: false };
      }
      return databaseService.saveChatMessage(
        message as import('./types/hud').ChatMessage,
        typeof conversationId === 'string' ? conversationId : undefined,
      );
    },
  );

  ipcMain.handle(
    'desktop:clearChatHistory',
    async (event, conversationId?: unknown) => {
      if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
      return databaseService.clearChatHistory(
        typeof conversationId === 'string' ? conversationId : undefined,
      );
    },
  );

  ipcMain.handle('desktop:getDbStatus', async (event) => {
    if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
    return databaseService.getStatus();
  });

  // Stage 5: Desktop Actions & Windows Automation
  ipcMain.handle(
    'desktop:executeTool',
    async (event, toolId: unknown, args: unknown) => {
      if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
      if (typeof toolId !== 'string') {
        return { success: false, error: 'Invalid tool ID' };
      }
      return globalToolRegistry.executeTool(toolId, args);
    },
  );

  ipcMain.handle('desktop:getApprovedApps', async (event) => {
    if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
    return APPROVED_APPS;
  });

  ipcMain.handle('desktop:getSystemDiagnostics', async (event) => {
    if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
    return globalToolRegistry.executeTool('system_diagnostics', {});
  });

  ipcMain.handle('desktop:getToolAuditLogs', async (event) => {
    if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
    return globalToolRegistry.getAuditLogs();
  });

  // Stage 6: Agentic Task Execution & Multi-Step Missions
  ipcMain.handle('desktop:createTaskPlan', async (event, prompt: unknown) => {
    if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
    if (typeof prompt !== 'string') return null;
    return globalTaskPlanner.createPlanFromPrompt(prompt);
  });

  ipcMain.handle(
    'desktop:executeTaskPlan',
    async (event, planPayload: unknown) => {
      if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
      if (typeof planPayload !== 'object' || planPayload === null) {
        throw new Error('Invalid plan payload');
      }
      const plan = planPayload as ExecutionPlan;
      const executed = await globalTaskExecutor.executePlan(plan, (prog) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('desktop:taskProgress', prog);
        }
      });
      databaseService.saveTaskPlan(executed).catch(() => {});
      return executed;
    },
  );

  ipcMain.handle(
    'desktop:approveTaskStep',
    async (event, planId: unknown, stepId: unknown, approved: unknown) => {
      if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
      if (typeof planId !== 'string' || typeof stepId !== 'string') {
        return { success: false };
      }
      const ok = globalTaskExecutor.approveStep(
        planId,
        stepId,
        Boolean(approved),
      );
      return { success: ok };
    },
  );

  ipcMain.handle('desktop:cancelTaskPlan', async (event, planId: unknown) => {
    if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
    if (typeof planId !== 'string') return { success: false };
    const ok = globalTaskExecutor.cancelPlan(planId);
    return { success: ok };
  });

  ipcMain.handle('desktop:getTaskPlans', async (event) => {
    if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
    return databaseService.getTaskPlans();
  });

  // Stage 7: Scheduling, Reminders & Local Ollama
  ipcMain.handle(
    'desktop:createReminder',
    async (event, text: unknown, minutes: unknown) => {
      if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
      if (typeof text !== 'string') throw new Error('Invalid reminder text');
      const mins = typeof minutes === 'number' ? minutes : 5;
      return globalReminderService.createReminder({
        text,
        dueInMinutes: mins,
      });
    },
  );

  ipcMain.handle('desktop:getReminders', async (event) => {
    if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
    return globalReminderService.getAllReminders();
  });

  ipcMain.handle('desktop:dismissReminder', async (event, id: unknown) => {
    if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
    if (typeof id !== 'string') return { success: false };
    return { success: globalReminderService.dismissReminder(id) };
  });

  ipcMain.handle('desktop:validateOllama', async (event) => {
    if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
    return aiManager.validateOllama();
  });
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 660,
    backgroundColor: '#060a12',
    title: 'JARVIS Desktop HUD',
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.session.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      const allowed = ['media', 'audio-capture', 'speech'];
      if (
        allowed.includes(permission) &&
        mainWindow &&
        webContents.id === mainWindow.webContents.id
      ) {
        callback(true);
        return;
      }
      callback(false);
    },
  );

  mainWindow.webContents.session.setPermissionCheckHandler(
    (webContents, permission) => {
      const allowed = ['media', 'audio-capture', 'speech'];
      return (
        allowed.includes(permission) &&
        mainWindow !== null &&
        webContents !== null &&
        webContents.id === mainWindow.webContents.id
      );
    },
  );

  mainWindow.show();
  mainWindow.focus();

  // Minimize to tray on close
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

app.whenReady().then(() => {
  setupIpcHandlers();
  databaseService.initialize().catch((err) => {
    console.warn('[Main] Database initialization deferred:', err);
  });
  createWindow();

  // Stage 7: Global Hotkey (Ctrl+Alt+J)
  try {
    globalShortcut.register('CommandOrControl+Alt+J', () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible() && mainWindow.isFocused()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (shErr) {
    console.warn('[Main] Global shortcut registration failed:', shErr);
  }

  // Stage 7: System Tray Integration
  try {
    const iconBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZElEQVQ4T2NkoBAwUqifYdQAUjT8P3/y/8+fP9GNYmBghOsiRn4GBgZWkhw5asDfv38ZGP8xMDAw/kdz2v//DL9//vxpJMYAcgaQYAC9XE60VnIGkGAAvVxOtFZygTGy7cRoJgEAkY8+A7+yV9YAAAAASUVORK5CYII=';
    const trayIcon = nativeImage.createFromDataURL(
      `data:image/png;base64,${iconBase64}`,
    );
    tray = new Tray(trayIcon);
    tray.setToolTip('J.A.R.V.I.S. Desktop Assistant (Ctrl+Alt+J)');

    const trayMenu = Menu.buildFromTemplate([
      {
        label: 'Open JARVIS HUD',
        click: () => {
          mainWindow?.show();
          mainWindow?.focus();
        },
      },
      {
        label: 'System Diagnostics',
        click: async () => {
          mainWindow?.show();
          mainWindow?.focus();
          const res = await globalToolRegistry.executeTool(
            'system_diagnostics',
            {},
          );
          if (mainWindow) {
            mainWindow.webContents.send('desktop:activityEvent', {
              id: 'act-' + Date.now(),
              timestamp: new Date().toLocaleTimeString('en-US', {
                hour12: false,
              }),
              level: 'info',
              category: 'system',
              message: res.message,
            });
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Quit JARVIS',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray.setContextMenu(trayMenu);
    tray.on('click', () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (trayErr) {
    console.warn('[Main] System Tray setup error:', trayErr);
  }

  // Stage 7: Native Windows Notifications & Reminders
  globalReminderService.onReminderTrigger((reminder) => {
    try {
      if (Notification.isSupported()) {
        new Notification({
          title: 'J.A.R.V.I.S. Protocol Reminder',
          body: reminder.text,
        }).show();
      }
    } catch {}

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('desktop:reminderTriggered', reminder);
      mainWindow.webContents.send('desktop:activityEvent', {
        id: 'act-' + Date.now(),
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        level: 'warn',
        category: 'system',
        message: `Reminder Due: "${reminder.text}"`,
      });
    }
  });

  // Sync saved reminders from Neon PostgreSQL
  globalReminderService.syncFromDatabase().catch(() => {});

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
