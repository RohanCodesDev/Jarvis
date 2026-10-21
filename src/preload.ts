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
  getMemories: async () => {
    return ipcRenderer.invoke('desktop:getMemories');
  },
  addMemory: async (item) => {
    return ipcRenderer.invoke('desktop:addMemory', item);
  },
  updateMemory: async (id, content) => {
    return ipcRenderer.invoke('desktop:updateMemory', id, content);
  },
  deleteMemory: async (id) => {
    return ipcRenderer.invoke('desktop:deleteMemory', id);
  },
  getChatHistory: async (conversationId, limit) => {
    return ipcRenderer.invoke('desktop:getChatHistory', conversationId, limit);
  },
  saveChatMessage: async (message, conversationId) => {
    return ipcRenderer.invoke(
      'desktop:saveChatMessage',
      message,
      conversationId,
    );
  },
  clearChatHistory: async (conversationId) => {
    return ipcRenderer.invoke('desktop:clearChatHistory', conversationId);
  },
  getDbStatus: async () => {
    return ipcRenderer.invoke('desktop:getDbStatus');
  },
  executeTool: async (toolId, args) => {
    return ipcRenderer.invoke('desktop:executeTool', toolId, args);
  },
  getApprovedApps: async () => {
    return ipcRenderer.invoke('desktop:getApprovedApps');
  },
  getSystemDiagnostics: async () => {
    return ipcRenderer.invoke('desktop:getSystemDiagnostics');
  },
  getToolAuditLogs: async () => {
    return ipcRenderer.invoke('desktop:getToolAuditLogs');
  },
  createTaskPlan: async (prompt) => {
    return ipcRenderer.invoke('desktop:createTaskPlan', prompt);
  },
  executeTaskPlan: async (plan) => {
    return ipcRenderer.invoke('desktop:executeTaskPlan', plan);
  },
  approveTaskStep: async (planId, stepId, approved) => {
    return ipcRenderer.invoke(
      'desktop:approveTaskStep',
      planId,
      stepId,
      approved,
    );
  },
  cancelTaskPlan: async (planId) => {
    return ipcRenderer.invoke('desktop:cancelTaskPlan', planId);
  },
  getTaskPlans: async () => {
    return ipcRenderer.invoke('desktop:getTaskPlans');
  },
  onTaskProgress: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: import('./services/agent/agentTypes').PlanProgressEvent,
    ) => callback(data);
    ipcRenderer.on('desktop:taskProgress', handler);
    return () => {
      ipcRenderer.removeListener('desktop:taskProgress', handler);
    };
  },
  createReminder: async (text, minutes) => {
    return ipcRenderer.invoke('desktop:createReminder', text, minutes);
  },
  getReminders: async () => {
    return ipcRenderer.invoke('desktop:getReminders');
  },
  dismissReminder: async (id) => {
    return ipcRenderer.invoke('desktop:dismissReminder', id);
  },
  onReminderTriggered: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: import('./services/scheduler/reminderTypes').ReminderItem,
    ) => callback(data);
    ipcRenderer.on('desktop:reminderTriggered', handler);
    return () => {
      ipcRenderer.removeListener('desktop:reminderTriggered', handler);
    };
  },
  validateOllama: async () => {
    return ipcRenderer.invoke('desktop:validateOllama');
  },
  captureScreenAndAnalyze: async (prompt) => {
    return ipcRenderer.invoke('desktop:captureScreenAndAnalyze', prompt);
  },
};

contextBridge.exposeInMainWorld('jarvisDesktop', desktopAPI);
