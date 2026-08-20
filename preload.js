/* ============ 墨阁 · 预加载脚本（安全暴露窗口控制 API） ============ */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mogeWindow', {
  isElectron: true,
  minimize: () => ipcRenderer.send('window-minimize'),
  toggleMaximize: () => ipcRenderer.send('window-maximize-toggle'),
  close: () => ipcRenderer.send('window-close')
});

contextBridge.exposeInMainWorld('mogeBackup', {
  chooseFolder: () => ipcRenderer.invoke('backup-select-folder'),
  writeExternal: payload => ipcRenderer.invoke('backup-write-external', payload)
});

contextBridge.exposeInMainWorld('mogeAI', {
  keyStatus: profileId => ipcRenderer.invoke('ai-key-status', profileId),
  migrateLegacyKey: profileId => ipcRenderer.invoke('ai-migrate-legacy-key', profileId),
  saveKey: (profileId, key) => ipcRenderer.invoke('ai-save-key', profileId, key),
  chat: (config, messages) => ipcRenderer.invoke('ai-chat', config, messages)
});
