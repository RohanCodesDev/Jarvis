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
};

contextBridge.exposeInMainWorld('jarvisDesktop', desktopAPI);
