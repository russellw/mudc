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
    // Escape HTML entities first
    let html = text.replace(/&/g, '&amp;')
                   .replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;')
                   .replace(/"/g, '&quot;')
                   .replace(/'/g, '&#39;');

    let result = '';
    let openSpanCount = 0;
    
    // Split by ANSI escape sequences while keeping them
    const parts = html.split(/(\x1b\[[0-9;]*m)/);
    
    for (let part of parts) {
        if (part.match(/\x1b\[([0-9;]*)m/)) {
            // This is an ANSI escape sequence
            const codes = part.match(/\x1b\[([0-9;]*)m/)[1];
            const codeArray = codes ? codes.split(';') : ['0'];
            
            // Check for reset
            if (codeArray.includes('0') || codes === '') {
                // Close all open spans
                result += '</span>'.repeat(openSpanCount);
                openSpanCount = 0;
            } else {
                // Build styles
                let styles = [];
                for (let code of codeArray) {
                    switch(code) {
                        case '30': styles.push('color: #000000'); break;
                        case '31': styles.push('color: #ff0000'); break;
                        case '32': styles.push('color: #00ff00'); break;
                        case '33': styles.push('color: #ffff00'); break;
                        case '34': styles.push('color: #0000ff'); break;
                        case '35': styles.push('color: #ff00ff'); break;
                        case '36': styles.push('color: #00ffff'); break;
                        case '37': styles.push('color: #ffffff'); break;
                        case '90': styles.push('color: #555555'); break;
                        case '91': styles.push('color: #ff5555'); break;
                        case '92': styles.push('color: #55ff55'); break;
                        case '93': styles.push('color: #ffff55'); break;
                        case '94': styles.push('color: #5555ff'); break;
                        case '95': styles.push('color: #ff55ff'); break;
                        case '96': styles.push('color: #55ffff'); break;
                        case '97': styles.push('color: #ffffff'); break;
                        case '40': styles.push('background-color: #000000'); break;
                        case '41': styles.push('background-color: #ff0000'); break;
                        case '42': styles.push('background-color: #00ff00'); break;
                        case '43': styles.push('background-color: #ffff00'); break;
                        case '44': styles.push('background-color: #0000ff'); break;
                        case '45': styles.push('background-color: #ff00ff'); break;
                        case '46': styles.push('background-color: #00ffff'); break;
                        case '47': styles.push('background-color: #ffffff'); break;
                        case '1': styles.push('font-weight: bold'); break;
                        case '4': styles.push('text-decoration: underline'); break;
                    }
                }
                
                if (styles.length > 0) {
                    result += `<span style="${styles.join('; ')}">`;
                    openSpanCount++;
                }
            }
        } else {
            // Regular text
            result += part;
        }
    }
    
    // Close any remaining open spans
    result += '</span>'.repeat(openSpanCount);
    
    return result;
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