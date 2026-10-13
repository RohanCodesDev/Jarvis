import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridgeAPI } from './types/hud';

const desktopAPI: DesktopBridgeAPI = {
  getSystemInfo: async () => {
    return ipcRenderer.invoke('desktop:getSystemInfo');
  },
  logActivity: async (item) => {
    return ipcRenderer.invoke('desktop:logActivity', item);
  },
  hasApiKey: async () => {
    return ipcRenderer.invoke('desktop:hasApiKey');
  },
  setApiKey: async (key: string) => {
    return ipcRenderer.invoke('desktop:setApiKey', key);
  },
  deleteApiKey: async () => {
    return ipcRenderer.invoke('desktop:deleteApiKey');
  },
  getSettings: async () => {
    return ipcRenderer.invoke('desktop:getSettings');
  },
  saveSettings: async (settings) => {
    return ipcRenderer.invoke('desktop:saveSettings', settings);
  },
  validateApiKey: async (key: string) => {
    return ipcRenderer.invoke('desktop:validateApiKey', key);
  },
  hasGroqKey: async () => {
    return ipcRenderer.invoke('desktop:hasGroqKey');
  },
  setGroqKey: async (key: string) => {
    return ipcRenderer.invoke('desktop:setGroqKey', key);
  },
  deleteGroqKey: async () => {
    return ipcRenderer.invoke('desktop:deleteGroqKey');
  },
  validateGroqKey: async (key: string) => {
    return ipcRenderer.invoke('desktop:validateGroqKey', key);
  },
  getAvailableModels: async (provider?: 'openrouter' | 'groq' | 'ollama') => {
    return ipcRenderer.invoke('desktop:getAvailableModels', provider);
  },
  sendChatMessage: (params, onChunk) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: import('./types/hud').ChatStreamChunkEvent,
    ) => {
      if (data && data.streamId === params.streamId) {
        onChunk(data);
      }
    };

    ipcRenderer.on('desktop:chatChunk', handler);
    ipcRenderer.invoke('desktop:sendChatMessage', params).catch((err) => {
      onChunk({
        streamId: params.streamId,
        error: String(err),
        done: true,
      });
    });

    return () => {
      ipcRenderer.removeListener('desktop:chatChunk', handler);
      ipcRenderer.invoke('desktop:cancelChatMessage', params.streamId);
    };
  },
  cancelChatMessage: async (streamId: string) => {
    return ipcRenderer.invoke('desktop:cancelChatMessage', streamId);
  },
  onActivityEvent: (
    callback: (item: import('./types/hud').ActivityItem) => void,
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      item: import('./types/hud').ActivityItem,
    ) => {
      callback(item);
    };
    ipcRenderer.on('desktop:activityEvent', handler);
    return () => {
      ipcRenderer.removeListener('desktop:activityEvent', handler);
    };
  },
  transcribeAudio: async (params) => {
    return ipcRenderer.invoke('desktop:transcribeAudio', params);
  },
};

contextBridge.exposeInMainWorld('jarvisDesktop', desktopAPI);
