let isConnected = false;

const hostInput = document.getElementById('host');
const portInput = document.getElementById('port');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const status = document.getElementById('status');
const output = document.getElementById('output');
const commandInput = document.getElementById('commandInput');
const sendBtn = document.getElementById('sendBtn');

function updateConnectionState(connected) {
    isConnected = connected;
    
    hostInput.disabled = connected;
    portInput.disabled = connected;
    connectBtn.disabled = connected;
    disconnectBtn.disabled = !connected;
    commandInput.disabled = !connected;
    sendBtn.disabled = !connected;
    
    if (connected) {
        status.textContent = `Connected to ${hostInput.value}:${portInput.value}`;
        status.className = 'status connected';
        commandInput.focus();
    } else {
        status.textContent = 'Disconnected';
        status.className = 'status disconnected';
    }
}

function appendToOutput(text) {
    output.textContent += text;
    output.scrollTop = output.scrollHeight;
}

connectBtn.addEventListener('click', async () => {
    const host = hostInput.value.trim();
    const port = parseInt(portInput.value);
    
    if (!host || !port) {
        alert('Please enter both host and port');
        return;
    }
    
    try {
        connectBtn.disabled = true;
        connectBtn.textContent = 'Connecting...';
        
        const result = await window.electronAPI.telnetConnect(host, port);
        
        if (result.success) {
            updateConnectionState(true);
            appendToOutput(`\n--- ${result.message} ---\n`);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        alert(`Connection failed: ${error.message}`);
        appendToOutput(`\nConnection failed: ${error.message}\n`);
    } finally {
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect';
    }
});

disconnectBtn.addEventListener('click', async () => {
    try {
        await window.electronAPI.telnetDisconnect();
        updateConnectionState(false);
        appendToOutput('\n--- Disconnected ---\n');
    } catch (error) {
        console.error('Disconnect error:', error);
    }
});

sendBtn.addEventListener('click', sendCommand);

commandInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendCommand();
    }
});

async function sendCommand() {
    const command = commandInput.value.trim();
    if (!command || !isConnected) return;
    
    try {
        appendToOutput(`> ${command}\n`);
        const result = await window.electronAPI.telnetSend(command);
        
        if (!result.success) {
            appendToOutput(`Error: ${result.message}\n`);
        }
        
        commandInput.value = '';
    } catch (error) {
        appendToOutput(`Error sending command: ${error.message}\n`);
    }
}

window.electronAPI.onTelnetData((event, data) => {
    appendToOutput(data);
});

window.electronAPI.onTelnetDisconnected(() => {
    updateConnectionState(false);
    appendToOutput('\n--- Connection closed by server ---\n');
});

window.addEventListener('beforeunload', () => {
    window.electronAPI.removeAllListeners('telnet-data');
    window.electronAPI.removeAllListeners('telnet-disconnected');
});