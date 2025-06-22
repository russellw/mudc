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
    const coloredHtml = parseAnsiColors(text);
    output.innerHTML += coloredHtml;
    output.scrollTop = output.scrollHeight;
}

function parseAnsiColors(text) {
    const ansiColorMap = {
        '30': 'color: #000000',    // black
        '31': 'color: #ff0000',    // red
        '32': 'color: #00ff00',    // green
        '33': 'color: #ffff00',    // yellow
        '34': 'color: #0000ff',    // blue
        '35': 'color: #ff00ff',    // magenta
        '36': 'color: #00ffff',    // cyan
        '37': 'color: #ffffff',    // white
        '90': 'color: #555555',    // bright black (dark gray)
        '91': 'color: #ff5555',    // bright red
        '92': 'color: #55ff55',    // bright green
        '93': 'color: #ffff55',    // bright yellow
        '94': 'color: #5555ff',    // bright blue
        '95': 'color: #ff55ff',    // bright magenta
        '96': 'color: #55ffff',    // bright cyan
        '97': 'color: #ffffff',    // bright white
        '40': 'background-color: #000000',  // black background
        '41': 'background-color: #ff0000',  // red background
        '42': 'background-color: #00ff00',  // green background
        '43': 'background-color: #ffff00',  // yellow background
        '44': 'background-color: #0000ff',  // blue background
        '45': 'background-color: #ff00ff',  // magenta background
        '46': 'background-color: #00ffff',  // cyan background
        '47': 'background-color: #ffffff',  // white background
        '1': 'font-weight: bold',           // bold
        '4': 'text-decoration: underline',  // underline
        '0': ''                             // reset
    };

    // Escape HTML entities first
    let html = text.replace(/&/g, '&amp;')
                   .replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;')
                   .replace(/"/g, '&quot;')
                   .replace(/'/g, '&#39;');

    // Parse ANSI escape sequences
    html = html.replace(/\x1b\[([0-9;]*)m/g, (match, codes) => {
        if (!codes) codes = '0';
        
        const codeArray = codes.split(';');
        let styles = [];
        
        for (let code of codeArray) {
            if (code === '0' || code === '') {
                return '</span>';
            }
            if (ansiColorMap[code]) {
                styles.push(ansiColorMap[code]);
            }
        }
        
        if (styles.length > 0) {
            return `<span style="${styles.join('; ')}">`;
        }
        return '';
    });

    return html;
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