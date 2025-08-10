const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const net = require('net');
const fs = require('fs');

let mainWindow;
let telnetSocket = null;
let enableLogging = false;
let reconnectAttempts = 0;
let maxReconnectAttempts = 100;
let reconnectDelay = 3000; // Start with 3 seconds
let reconnectTimer = null;
let lastConnectionInfo = null; // Store host/port for reconnection

const mudLogPath = path.join(__dirname, '..', 'log.txt');

function logMudOutput(data) {
  if (!enableLogging) return;
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

  mainWindow.maximize();

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
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
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

function attemptReconnect() {
  if (reconnectAttempts >= maxReconnectAttempts || !lastConnectionInfo) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('telnet-reconnect-failed', {
        attempts: reconnectAttempts,
        maxAttempts: maxReconnectAttempts
      });
    }
    reconnectAttempts = 0;
    return;
  }

  reconnectAttempts++;
  const delay = Math.min(reconnectDelay * Math.pow(1.5, reconnectAttempts - 1), 30000); // Max 30 seconds
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('telnet-reconnecting', {
      attempt: reconnectAttempts,
      maxAttempts: maxReconnectAttempts,
      delaySeconds: Math.round(delay / 1000)
    });
  }

  reconnectTimer = setTimeout(() => {
    connectToTelnetServer(lastConnectionInfo.host, lastConnectionInfo.port, true);
  }, delay);
}

function connectToTelnetServer(host, port, isReconnect = false) {
  if (telnetSocket) {
    telnetSocket.destroy();
  }

  telnetSocket = new net.Socket();
  
  telnetSocket.connect(port, host, () => {
    if (!isReconnect) {
      enableLogging = false; // Reset logging state on new connection
      lastConnectionInfo = { host, port }; // Store for potential reconnection
    }
    reconnectAttempts = 0; // Reset reconnection attempts on successful connection
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (isReconnect) {
        mainWindow.webContents.send('telnet-reconnected', `Reconnected to ${host}:${port}`);
      } else {
        mainWindow.webContents.send('telnet-connected', `Connected to ${host}:${port}`);
      }
    }
  });

  telnetSocket.on('data', (data) => {
    const dataString = data.toString();
    logMudOutput(dataString);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('telnet-data', dataString);
    }
  });

  telnetSocket.on('error', (error) => {
    if (isReconnect) {
      // If this is a reconnection attempt, try again
      attemptReconnect();
    } else {
      // If this is the initial connection, report error immediately
      throw new Error(error.message);
    }
  });

  telnetSocket.on('close', (hadError) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('telnet-disconnected');
    }
    telnetSocket = null;
    
    // Start reconnection attempts if this wasn't a deliberate disconnect
    if (lastConnectionInfo && !hadError) {
      attemptReconnect();
    }
  });
}

ipcMain.handle('telnet-connect', async (event, host, port) => {
  return new Promise((resolve, reject) => {
    if (telnetSocket) {
      telnetSocket.destroy();
    }

    telnetSocket = new net.Socket();
    
    telnetSocket.connect(port, host, () => {
      enableLogging = false; // Reset logging state on new connection
      lastConnectionInfo = { host, port }; // Store for potential reconnection
      reconnectAttempts = 0; // Reset reconnection attempts on successful connection
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

    telnetSocket.on('close', (hadError) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('telnet-disconnected');
      }
      telnetSocket = null;
      
      // Start reconnection attempts if this wasn't a deliberate disconnect
      if (lastConnectionInfo && !hadError) {
        attemptReconnect();
      }
    });
  });
});

ipcMain.handle('telnet-send', async (event, data, isAutoCommand = false) => {
  if (telnetSocket && !telnetSocket.destroyed) {
    if (!isAutoCommand) {
      enableLogging = true; // Enable logging when user sends first command
    }
    // Replace ' !' at end of command with '!'
    let s = data.replace(/ !$/, '!');
    s = s.replace(/ \?$/, '?');
    s = s.replace(/^' /, "'");
    // If string begins with ' followed by letter, make letter uppercase
    s = s.replace(/^(')([a-z])/, (match, p1, p2) => p1 + p2.toUpperCase());
    telnetSocket.write(s + '\r\n');
    return { success: true };
  }
  return { success: false, message: 'Not connected' };
});

ipcMain.handle('telnet-disconnect', async () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  lastConnectionInfo = null; // Clear connection info to prevent reconnection
  reconnectAttempts = 0;
  
  if (telnetSocket) {
    telnetSocket.destroy();
    telnetSocket = null;
    return { success: true };
  }
  return { success: false, message: 'Not connected' };
});

ipcMain.handle('load-mud-database', async () => {
  try {
    const userMudPath = path.join(__dirname, '..', 'muds.json');
    const defaultMudPath = path.join(__dirname, '..', 'muds.default.json');
    
    let data;
    let usingDefault = false;
    
    // Try to load user's custom MUD list first
    try {
      data = fs.readFileSync(userMudPath, 'utf8');
    } catch (error) {
      // If user file doesn't exist, copy default and use it
      try {
        const defaultData = fs.readFileSync(defaultMudPath, 'utf8');
        fs.writeFileSync(userMudPath, defaultData);
        data = defaultData;
        usingDefault = true;
      } catch (defaultError) {
        throw new Error(`Cannot load MUD database: ${defaultError.message}`);
      }
    }
    
    return { 
      success: true, 
      data: JSON.parse(data),
      usingDefault: usingDefault
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
});