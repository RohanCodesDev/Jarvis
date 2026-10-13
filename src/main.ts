import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

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
      (fullResponse, metadata) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('desktop:chatChunk', {
            streamId: data.streamId,
            fullResponse,
            done: true,
            metadata,
          });
        }
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
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
