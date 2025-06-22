const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const net = require('net');
const fs = require('fs');

let mainWindow;
let telnetSocket = null;

const mudLogPath = path.join(__dirname, '..', 'log.txt');

function logMudOutput(data) {
  // Strip ANSI escape sequences for clean log file
  const cleanData = data.replace(/\x1b\[[0-9;]*m/g, '');
  fs.appendFileSync(mudLogPath, cleanData);
}

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

  const errorLogPath = path.join(__dirname, '..', 'error.log');
  
  function logError(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(errorLogPath, logEntry);
    console.log(message); // Also log to console
  }

  // Enable all error logging
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    logError(`[RENDERER-${level}] ${message} (${sourceId}:${line})`);
  });

  // Log any unhandled exceptions
  process.on('uncaughtException', (error) => {
    logError(`Uncaught Exception: ${error.stack || error.message}`);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logError(`Unhandled Rejection: ${reason} at ${promise}`);
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (telnetSocket) {
    telnetSocket.destroy();
  }
  
  // Add a delay before quitting to capture any exit errors
  setTimeout(() => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }, 2000);
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
      const dataString = data.toString();
      logMudOutput(dataString);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('telnet-data', dataString);
      }
    });

    telnetSocket.on('error', (error) => {
      reject({ success: false, message: error.message });
    });

    telnetSocket.on('close', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('telnet-disconnected');
      }
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