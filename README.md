# MUD Client (mudc)

A modern Multi-User Dungeon (MUD) client built with Electron, designed for connecting to text-based online role-playing games.

## Features

### Connection Management
- **MUD Database**: Built-in database of popular MUDs with easy selection
- **Custom Connections**: Support for connecting to any MUD with manual host/port entry
- **User Customization**: Edit your own MUD list via `muds.json` (gitignored for personal preferences)

### Display & Interface
- **ANSI Color Support**: Full support for ANSI escape sequences with proper color rendering
- **Terminal-style UI**: Classic black background with green text for authentic MUD experience
- **Scrollable Output**: Auto-scrolling output window with proper text wrapping

### Automation Features
- **Auto-Commands**: Execute predefined commands automatically after connecting to each MUD
- **Configurable Delays**: Smart timing between commands for proper server processing
- **Per-MUD Settings**: Different auto-commands for different MUDs

### User Experience
- **Sound Alerts**: Audio notifications when receiving output while window is unfocused
- **Activity Logging**: All MUD output logged to `log.txt` with ANSI codes stripped for clean text
- **Connection Status**: Clear visual indicators for connection state
- **Keyboard Shortcuts**: Enter key to send commands, focus management

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run the Application**
   ```bash
   npm start
   ```

3. **Development Mode** (with DevTools)
   ```bash
   npm run dev
   ```

4. **Build for Distribution**
   ```bash
   npm run build
   ```

## Configuration

### MUD Database
- `muds.default.json` - Default MUD list (version controlled)
- `muds.json` - Your personal MUD list (created automatically, gitignored)

### Auto-Commands
Each MUD entry can include an `autoCommands` array:
```json
{
  "id": "example-mud",
  "name": "Example MUD", 
  "host": "mud.example.com",
  "port": 4000,
  "autoCommands": [
    "config color on",
    "config pagelength 0",
    "look"
  ]
}
```

### Sound Alerts
- Toggle sound notifications with the "Sound Alerts" checkbox
- Alerts only play when the window is not focused
- Helps track activity while multitasking

## File Structure

```
src/
├── main.js          # Electron main process
├── preload.js       # Secure IPC bridge
├── renderer.html    # UI layout and styling
└── renderer.js      # Client logic and MUD interaction

muds.default.json    # Default MUD database
muds.json           # User's customized MUD list (auto-created)
log.txt             # MUD output log (ANSI-stripped)
```

## Technologies Used

- **Electron**: Cross-platform desktop app framework
- **Node.js**: TCP socket connections for telnet protocol
- **Web Audio API**: Sound notifications
- **CSS**: Terminal-style UI styling

## Contributing

This project was created as a demonstration of Claude Code capabilities. Feel free to fork and extend with additional MUD client features.

## License

MIT
