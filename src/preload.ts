import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridgeAPI } from './types/hud';

const desktopAPI: DesktopBridgeAPI = {
  getSystemInfo: async () => {
    return ipcRenderer.invoke('desktop:getSystemInfo');
  },
  logActivity: async (item) => {
    return ipcRenderer.invoke('desktop:logActivity', item);
  },
};

contextBridge.exposeInMainWorld('jarvisDesktop', desktopAPI);
