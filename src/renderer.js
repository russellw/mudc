let isConnected = false;
let mudDatabase = null;
let windowFocused = true;
let soundAlertsEnabled = true;
let currentMudConfig = null;

const mudSelect = document.getElementById('mudSelect');
const hostInput = document.getElementById('host');
const portInput = document.getElementById('port');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const soundAlertsCheckbox = document.getElementById('soundAlerts');
const status = document.getElementById('status');
const output = document.getElementById('output');
const commandInput = document.getElementById('commandInput');
const sendBtn = document.getElementById('sendBtn');

function updateConnectionState(connected) {
    isConnected = connected;
    
    mudSelect.disabled = connected;
    connectBtn.disabled = connected;
    disconnectBtn.disabled = !connected;
    commandInput.disabled = !connected;
    sendBtn.disabled = !connected;
    
    if (connected) {
        hostInput.disabled = true;
        portInput.disabled = true;
        status.textContent = `Connected to ${hostInput.value}:${portInput.value}`;
        status.className = 'status connected';
        commandInput.focus();
    } else {
        status.textContent = 'Disconnected';
        status.className = 'status disconnected';
        // Re-enable host/port based on MUD selection
        onMudSelectionChange();
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

// Load MUD database and populate dropdown
async function loadMudDatabase() {
    try {
        const result = await window.electronAPI.loadMudDatabase();
        if (result.success) {
            mudDatabase = result.data;
            populateMudDropdown();
            
            if (result.usingDefault) {
                appendToOutput('Created muds.json from defaults. You can edit this file to customize your MUD list.\n\n');
            }
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Failed to load MUD database:', error);
        mudSelect.innerHTML = '<option value="custom">Custom Connection</option>';
        appendToOutput(`Failed to load MUD database: ${error.message}\n\n`);
    }
}

function populateMudDropdown() {
    mudSelect.innerHTML = '';
    
    if (mudDatabase && mudDatabase.muds) {
        mudDatabase.muds.forEach(mud => {
            const option = document.createElement('option');
            option.value = mud.id;
            option.textContent = mud.name;
            option.title = mud.description;
            mudSelect.appendChild(option);
        });
        
        // Set default to first non-custom MUD entry
        const firstNonCustomMud = mudDatabase.muds.find(mud => !mud.custom);
        if (firstNonCustomMud) {
            mudSelect.value = firstNonCustomMud.id;
            hostInput.value = firstNonCustomMud.host;
            portInput.value = firstNonCustomMud.port;
            hostInput.disabled = true;
            portInput.disabled = true;
            currentMudConfig = firstNonCustomMud;
        }
    }
}

function onMudSelectionChange() {
    const selectedMudId = mudSelect.value;
    
    if (!mudDatabase) return;
    
    const selectedMud = mudDatabase.muds.find(mud => mud.id === selectedMudId);
    currentMudConfig = selectedMud;
    
    if (selectedMud && !selectedMud.custom) {
        hostInput.value = selectedMud.host;
        portInput.value = selectedMud.port;
        hostInput.disabled = true;
        portInput.disabled = true;
    } else {
        hostInput.disabled = false;
        portInput.disabled = false;
        if (selectedMudId === 'custom') {
            hostInput.value = 'localhost';
            portInput.value = '4000';
        }
    }
}

mudSelect.addEventListener('change', onMudSelectionChange);

// Handle sound alerts checkbox
soundAlertsCheckbox.addEventListener('change', () => {
    soundAlertsEnabled = soundAlertsCheckbox.checked;
});

// Track window focus for sound alerts
window.addEventListener('focus', () => {
    windowFocused = true;
});

window.addEventListener('blur', () => {
    windowFocused = false;
});

function playAlertSound() {
    if (!soundAlertsEnabled || windowFocused) return;
    
    // Create and play a simple beep sound
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
}

async function executeAutoCommands() {
    if (!currentMudConfig || !currentMudConfig.autoCommands || currentMudConfig.autoCommands.length === 0) {
        return;
    }
    
    appendToOutput('\n--- Executing auto-commands ---\n');
    
    for (let i = 0; i < currentMudConfig.autoCommands.length; i++) {
        const command = currentMudConfig.autoCommands[i];
        
        // Wait a bit before sending each command to allow server processing
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!isConnected) {
            appendToOutput('--- Auto-commands stopped: disconnected ---\n');
            break;
        }
        
        try {
            appendToOutput(`> ${command}\n`);
            const result = await window.electronAPI.telnetSend(command, true);
            
            if (!result.success) {
                appendToOutput(`Error sending auto-command: ${result.message}\n`);
            }
        } catch (error) {
            appendToOutput(`Error sending auto-command "${command}": ${error.message}\n`);
        }
    }
    
    if (isConnected) {
        appendToOutput('--- Auto-commands completed ---\n\n');
        commandInput.focus(); // Restore focus after auto-commands
    }
}

// Load MUD database on startup
loadMudDatabase();

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
            
            // Execute auto-commands after a short delay to allow connection to stabilize
            setTimeout(() => {
                executeAutoCommands();
            }, 1500);
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
    if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        sendCommand();
    }
});

async function sendCommand() {
    const rawCommand = commandInput.value;
    // Remove trailing newlines and replace internal newlines with %r
    const command = rawCommand.replace(/\n+$/, '').replace(/\n/g, '%r');
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
    playAlertSound();
});

window.electronAPI.onTelnetDisconnected(() => {
    updateConnectionState(false);
    appendToOutput('\n--- Connection closed by server ---\n');
});

window.addEventListener('beforeunload', () => {
    window.electronAPI.removeAllListeners('telnet-data');
    window.electronAPI.removeAllListeners('telnet-disconnected');
});