const { contextBridge, ipcRenderer } = require('electron');
const { pathToFileURL } = require('url');

contextBridge.exposeInMainWorld('sisterStreamAPI', {
  getLibrary: () => ipcRenderer.invoke('get-library'),
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),

  // NEW: a helper for converting absolute file paths into valid file:/// URLs
  toFileUrl: (p) => pathToFileURL(p).href
});
