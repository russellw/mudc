const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  telnetConnect: (host, port) => ipcRenderer.invoke('telnet-connect', host, port),
  telnetSend: (data) => ipcRenderer.invoke('telnet-send', data),
  telnetDisconnect: () => ipcRenderer.invoke('telnet-disconnect'),
  loadMudDatabase: () => ipcRenderer.invoke('load-mud-database'),
  onTelnetData: (callback) => ipcRenderer.on('telnet-data', callback),
  onTelnetDisconnected: (callback) => ipcRenderer.on('telnet-disconnected', callback),
  onTelnetConnected: (callback) => ipcRenderer.on('telnet-connected', callback),
  onTelnetReconnecting: (callback) => ipcRenderer.on('telnet-reconnecting', callback),
  onTelnetReconnected: (callback) => ipcRenderer.on('telnet-reconnected', callback),
  onTelnetReconnectFailed: (callback) => ipcRenderer.on('telnet-reconnect-failed', callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});