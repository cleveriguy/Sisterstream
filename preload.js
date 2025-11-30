const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sisterStreamAPI', {
  getLibrary: () => ipcRenderer.invoke('get-library'),
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data)
});
