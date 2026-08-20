/* ============ 墨阁 · 预加载脚本（安全暴露窗口控制 API） ============ */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mogeWindow', {
  isElectron: true,
  minimize: () => ipcRenderer.send('window-minimize'),
  toggleMaximize: () => ipcRenderer.send('window-maximize-toggle'),
  close: () => ipcRenderer.send('window-close')
});

contextBridge.exposeInMainWorld('mogeAI', {
  keyStatus: () => ipcRenderer.invoke('ai-key-status'),
  saveKey: key => ipcRenderer.invoke('ai-save-key', key),
  chat: (config, messages) => ipcRenderer.invoke('ai-chat', config, messages)
});
