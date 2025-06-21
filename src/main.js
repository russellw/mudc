const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const net = require('net');

let mainWindow;
let telnetSocket = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (telnetSocket) {
    telnetSocket.destroy();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('telnet-connect', async (event, host, port) => {
  return new Promise((resolve, reject) => {
    if (telnetSocket) {
      telnetSocket.destroy();
    }

    telnetSocket = new net.Socket();
    
    telnetSocket.connect(port, host, () => {
      resolve({ success: true, message: `Connected to ${host}:${port}` });
    });

    telnetSocket.on('data', (data) => {
      mainWindow.webContents.send('telnet-data', data.toString());
    });

    telnetSocket.on('error', (error) => {
      reject({ success: false, message: error.message });
    });

    telnetSocket.on('close', () => {
      mainWindow.webContents.send('telnet-disconnected');
      telnetSocket = null;
    });
  });
});

ipcMain.handle('telnet-send', async (event, data) => {
  if (telnetSocket && !telnetSocket.destroyed) {
    telnetSocket.write(data + '\r\n');
    return { success: true };
  }
  return { success: false, message: 'Not connected' };
});

ipcMain.handle('telnet-disconnect', async () => {
  if (telnetSocket) {
    telnetSocket.destroy();
    telnetSocket = null;
    return { success: true };
  }
  return { success: false, message: 'Not connected' };
});