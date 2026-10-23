import {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  Tray,
  Menu,
  Notification,
  nativeImage,
  dialog,
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
import { getTopWindowTitles } from './services/tools/screenCaptureTool';
import { globalWorkflowEngine } from './services/automation/workflowEngine';
import { analyzeDocumentFile } from './services/tools/documentReaderTool';

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

  async function streamVisionAnalysis(
    streamId: string,
    event: IpcMainInvokeEvent,
    messages: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
      imageUrl?: string;
    }>,
    model: string | undefined,
    capturedUrl: string,
  ) {
    const visionMessages = [...messages];
    const lastUserIdx = visionMessages.findLastIndex((m) => m.role === 'user');
    if (lastUserIdx >= 0) {
      visionMessages[lastUserIdx] = {
        ...visionMessages[lastUserIdx],
        imageUrl: capturedUrl,
      } as (typeof visionMessages)[0] & { imageUrl: string };
    }
    await aiManager.streamChat(
      streamId + '-vision',
      {
        messages: visionMessages,
        model,
        screenCaptureDataUrl: capturedUrl,
      },
      (chunk) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('desktop:chatChunk', {
            streamId,
            chunk,
            done: false,
          });
        }
      },
      async (visionResponse, visionMeta) => {
        const text =
          visionResponse.trim() || 'Visual analysis complete, sir.';
        if (!event.sender.isDestroyed()) {
          event.sender.send('desktop:chatChunk', {
            streamId,
            fullResponse: text,
            done: true,
            metadata: visionMeta,
          });
        }
        databaseService
          .saveChatMessage({
            id: 'msg-j-' + Date.now(),
            sender: 'jarvis',
            text,
            timestamp: new Date().toLocaleTimeString('en-US', {
              hour12: false,
            }),
            status: 'delivered',
            metadata: { modelUsed: visionMeta?.model },
          })
          .catch(() => {});
      },
      (visionErr) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('desktop:chatChunk', {
            streamId,
            error: visionErr,
            done: true,
          });
        }
      },
    );
  }

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
      screenCaptureDataUrl?: string;
      attachedDocument?: {
        fileName: string;
        filePath: string;
        summary: string;
        excerpt?: string;
      };
    };

    if (!data.streamId || !data.message) {
      throw new Error('streamId and message are required');
    }

    // Sliding-window cap to most recent 16 turns to optimize memory and context tokens
    const rawHistory = (data.history || []).slice(-16);
    const messages = rawHistory.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    messages.push({ role: 'user' as const, content: data.message });

    // Stage 6: Direct Multi-Step Plan Detection & Sequential Execution
    const multiPlan = globalTaskPlanner.createPlanFromPrompt(data.message);
    const directAction = !multiPlan ? detectDirectIntent(data.message) : null;

    let searchContext: string | undefined;

    // Stage 9: Inject attached active document context if present
    if (data.attachedDocument) {
      const docHeader = `[ATTACHED ACTIVE DOCUMENT: "${data.attachedDocument.fileName}" (${data.attachedDocument.filePath})\nEXECUTIVE INTELLIGENCE BRIEFING:\n${data.attachedDocument.summary}\n${data.attachedDocument.excerpt ? `\nEXCERPT:\n${data.attachedDocument.excerpt}` : ''}]`;
      searchContext = searchContext
        ? `${docHeader}\n\n${searchContext}`
        : docHeader;
    }

    // Inject active desktop window context if available
    try {
      const topWindows = await getTopWindowTitles();
      if (topWindows.length > 0) {
        const activeWinHeader = `[ACTIVE DESKTOP CONTEXT: Foreground application "${topWindows[0]}". Other open windows: ${topWindows.slice(1, 4).join(', ')}]`;
        searchContext = searchContext
          ? `${activeWinHeader}\n\n${searchContext}`
          : activeWinHeader;
      }
    } catch {}

    const settings = loadSettings();

    // Only query external web search if NOT an automated local action or multi-step plan
    if (
      settings.webSearchEnabled !== false &&
      !directAction &&
      !multiPlan &&
      shouldSearchWeb(data.message)
    ) {
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

    let directActionResultMessage: string | undefined;
    let screenCaptureDataUrl: string | undefined = data.screenCaptureDataUrl;

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
    } else if (directAction) {
      // Direct Single-Action Intent Detection & Execution
      try {
        const actionResult = await globalToolRegistry.executeTool(
          directAction.toolId,
          directAction.args,
        );
        if (
          directAction.toolId === 'analyze_screen' &&
          actionResult.success &&
          (actionResult.data as Record<string, unknown>)?.dataUrl
        ) {
          screenCaptureDataUrl = (
            actionResult.data as Record<string, unknown>
          ).dataUrl as string;
        }
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
            imageUrl: (actionResult.data as Record<string, unknown>)
              ?.dataUrl as string | undefined,
          });
        }
      } catch (toolErr) {
        console.warn('[Main] Direct action execution error:', toolErr);
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
        screenCaptureDataUrl,
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

        // VISION UPGRADE: intercept single-step capture_screen PLAN and route to analyze_screen
        if (
          modelPlan &&
          modelPlan.steps.length === 1 &&
          (modelPlan.steps[0].toolId === 'capture_screen' ||
            modelPlan.steps[0].toolId === 'analyze_screen')
        ) {
          try {
            finalResponseText = fullResponse
              .replace(/\[PLAN:\s*\[[\s\S]*?\]\s*\]/i, '')
              .replace(/\[PLAN:\s*[\s\S]+?\]/i, '')
              .trim();
            const capResult = await globalToolRegistry.executeTool(
              'analyze_screen',
              { query: data.message },
            );
            const capturedUrl = (
              capResult.data as Record<string, unknown>
            )?.dataUrl as string | undefined;
            if (capturedUrl && capturedUrl.length > 100) {
              if (!event.sender.isDestroyed()) {
                event.sender.send('desktop:activityEvent', {
                  id: 'act-' + Date.now(),
                  timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
                  level: 'info',
                  category: 'tool',
                  message: capResult.message,
                  durationMs: capResult.durationMs,
                  imageUrl: capturedUrl,
                });
              }
              await streamVisionAnalysis(
                data.streamId,
                event,
                messages,
                data.model,
                capturedUrl,
              );
              return; // vision stream handled completion
            }
          } catch (visionErr) {
            console.warn('[Main] Vision PLAN upgrade error:', visionErr);
          }
        } else if (modelPlan && modelPlan.steps.length >= 2) {
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
                // When an action directs a visual capture or inspection, stream the visual analysis
                if (
                  (action.toolId === 'analyze_screen' ||
                    action.toolId === 'capture_screen') &&
                  res.success &&
                  (res.data as Record<string, unknown>)?.dataUrl
                ) {
                  const capturedUrl = (
                    res.data as Record<string, unknown>
                  ).dataUrl as string;
                  await streamVisionAnalysis(
                    data.streamId,
                    event,
                    messages,
                    data.model,
                    capturedUrl,
                  );
                  return; // vision stream handled completion
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

  // Autonomous Workflows & System Automation
  ipcMain.handle('desktop:createWorkflow', async (event, params: unknown) => {
    if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
    return globalWorkflowEngine.createWorkflow(params as any);
  });

  ipcMain.handle('desktop:getWorkflows', async (event) => {
    if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
    return globalWorkflowEngine.getWorkflows();
  });

  ipcMain.handle('desktop:toggleWorkflow', async (event, id: unknown) => {
    if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
    if (typeof id !== 'string') return null;
    return globalWorkflowEngine.toggleWorkflow(id);
  });

  ipcMain.handle('desktop:deleteWorkflow', async (event, id: unknown) => {
    if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
    if (typeof id !== 'string') return { success: false };
    const success = await globalWorkflowEngine.deleteWorkflow(id);
    return { success };
  });

  ipcMain.handle('desktop:executeWorkflowNow', async (event, id: unknown) => {
    if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
    if (typeof id !== 'string') return { success: false, message: 'Invalid ID' };
    return globalWorkflowEngine.executeWorkflowNow(id);
  });

  // Multimodal Screen Vision & Visual Diagnostics
  ipcMain.handle(
    'desktop:captureScreenAndAnalyze',
    async (event, prompt?: unknown) => {
      if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
      const query =
        typeof prompt === 'string' ? prompt : 'Inspect desktop screen';
      return globalToolRegistry.executeTool('analyze_screen', { query });
    },
  );

  // Stage 9: Document & Local File Intelligence
  ipcMain.handle('desktop:selectDocument', async (event) => {
    if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
    if (!mainWindow) return { canceled: true };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Document for JARVIS Intelligence Synthesis',
      properties: ['openFile'],
      filters: [
        {
          name: 'Documents & Code',
          extensions: [
            'pdf',
            'txt',
            'md',
            'json',
            'csv',
            'log',
            'js',
            'jsx',
            'ts',
            'tsx',
            'py',
            'html',
            'css',
            'sql',
            'yaml',
            'yml',
            'xml',
            'rtf',
          ],
        },
        { name: 'PDF Documents (*.pdf)', extensions: ['pdf'] },
        { name: 'Markdown & Text (*.md, *.txt)', extensions: ['md', 'txt'] },
        {
          name: 'Source Code & Scripts',
          extensions: ['js', 'ts', 'tsx', 'jsx', 'py', 'sql', 'html', 'css'],
        },
        {
          name: 'Data Files (*.json, *.csv, *.yaml)',
          extensions: ['json', 'csv', 'yaml', 'yml'],
        },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const selected = result.filePaths[0];
    return {
      canceled: false,
      filePath: selected,
      fileName: path.basename(selected),
    };
  });

  ipcMain.handle(
    'desktop:analyzeDocument',
    async (
      event,
      filePath: unknown,
      options?: { query?: string; useAI?: boolean },
    ) => {
      if (!isValidSender(event)) throw new Error('Unauthorized IPC sender');
      if (typeof filePath !== 'string' || !filePath.trim()) {
        return {
          success: false,
          message: 'File path must be a non-empty string.',
          error: 'Invalid file path',
          durationMs: 0,
        };
      }
      return await analyzeDocumentFile(filePath, options);
    },
  );
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

    // Global Push-To-Talk Hotkey (Ctrl+Shift+Space)
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
      if (!mainWindow) return;
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      mainWindow.focus();
      mainWindow.webContents.send('desktop:triggerVoiceInput');
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

  // Autonomous Workflows & System Automation Trigger Handlers
  globalWorkflowEngine.onWorkflowTrigger((workflow, result) => {
    try {
      if (Notification.isSupported()) {
        new Notification({
          title: `Protocol Executed: ${workflow.name}`,
          body: result.message,
        }).show();
      }
    } catch {}

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('desktop:workflowTriggered', {
        workflow,
        result,
      });
      mainWindow.webContents.send('desktop:activityEvent', {
        id: 'act-' + Date.now(),
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        level: result.success ? 'info' : 'warn',
        category: 'system',
        message: `Workflow [${workflow.name}]: ${result.message}`,
      });
    }
  });

  globalWorkflowEngine.onWorkflowUpdated((workflow) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('desktop:workflowUpdated', workflow);
    }
  });

  // Sync saved reminders and workflows from Neon PostgreSQL
  globalReminderService.syncFromDatabase().catch(() => {});
  globalWorkflowEngine.syncFromDatabase().catch(() => {});

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
