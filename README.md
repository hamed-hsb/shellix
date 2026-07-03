# Shellix

Shellix is a modern, customizable, cross-platform terminal emulator designed for
seamless local shell, SSH, and Telnet management. Built for developers who need a
powerful yet intuitive interface, Shellix streamlines your command-line workflow
with a clean, extensible, and high-performance design.

Built with **Go + [Wails v2](https://wails.io)** on the backend and
**TypeScript + [xterm.js](https://xtermjs.org)** on the frontend, it ships as a
native desktop app for **Linux, Windows, and macOS**.

---

## Features

### Core engine (Phase 1)
- Real pseudo-terminal per session — `creack/pty` on Unix, **ConPTY** on Windows.
- Launches the OS default shell (Zsh/Bash/Sh, or PowerShell/cmd on Windows) with
  `TERM=xterm-256color` for full colour.
- Full ANSI/256-colour rendering, keyboard I/O and live resize via xterm.js
  (with an opt-in WebGL renderer and a DOM fallback).

### Interface (Phase 2)
- **Tabs** — open, close, switch, and double-click to rename.
- **Split panes** — split any pane horizontally or vertically, drag the divider
  to resize, and nest splits arbitrarily.
- **Theming** — a JSON settings file for colour schemes, fonts (Nerd/Powerline),
  font size, line height, cursor and opacity. Changes apply live to every pane.
- **Remappable keyboard shortcuts** with a `Mod` (Cmd on macOS, Ctrl elsewhere)
  convention.

### Protocols (Phase 3)
- **SSH** — password and private-key auth (with passphrase), a real remote PTY
  and window-size propagation.
- **Telnet** — IAC-aware client for network equipment, with NAWS window sizing.
- **Serial** — scaffolded (`internal/session/serial.go`); see the roadmap.

### Productivity (Phase 4)
- **Command palette** (`Mod+Shift+P`) — fuzzy search over every action: tabs,
  splits, theme switching, new SSH/Telnet connections and saved profiles.
- **Connection profiles** — save SSH/Telnet connections to `profiles.json` and
  reconnect from the palette.

---

## Default keyboard shortcuts

| Action              | Shortcut            |
| ------------------- | ------------------- |
| New tab             | `Mod+Shift+T`       |
| Close tab           | `Mod+Shift+W`       |
| Next / previous tab | `Ctrl+Tab` / `Ctrl+Shift+Tab` |
| Split right         | `Mod+Shift+E`       |
| Split down          | `Mod+Shift+D`       |
| Close pane          | `Mod+Shift+X`       |
| Command palette     | `Mod+Shift+P`       |

`Mod` = **Cmd** on macOS, **Ctrl** on Linux/Windows. All bindings are editable
in the config file.

---

## Getting started

### Prerequisites
- **Go** 1.23+
- **Node.js** 18+ and npm
- **Wails CLI**: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- **Platform dependencies:**
  - **Linux (older, WebKit 4.0):** `sudo apt install libgtk-3-dev libwebkit2gtk-4.0-dev`
  - **Linux (Debian 13+/newer, WebKit 4.1):** `sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev`
    — then build/run with the `webkit2_41` tag (see below).
  - **Windows:** WebView2 runtime (preinstalled on Windows 11 / recent 10).
  - **macOS:** Xcode command-line tools.

Run `wails doctor` to verify your environment.

### Develop
```bash
wails dev                        # WebKit 4.0
wails dev -tags webkit2_41       # WebKit 4.1 (Debian 13+, recent distros)
```
Hot-reloads both the Go backend and the frontend.

### Build a production binary
```bash
wails build                             # current platform → build/bin/
wails build -tags webkit2_41            # Linux with WebKit 4.1
wails build -platform windows/amd64
wails build -platform darwin/universal
wails build -platform linux/amd64
```

---

## Configuration

Settings and profiles live under the OS config directory:

| Platform | Path |
| -------- | ---- |
| Linux    | `~/.config/shellix/` |
| macOS    | `~/Library/Application Support/shellix/` |
| Windows  | `%AppData%\shellix\` |

`config.json` is created on first run. Example:

```json
{
  "scheme": "shellix-dark",
  "schemes": {},
  "appearance": {
    "fontFamily": "\"JetBrainsMono Nerd Font\", Menlo, Consolas, monospace",
    "fontSize": 14,
    "lineHeight": 1.2,
    "letterSpacing": 0,
    "opacity": 1,
    "cursorBlink": true,
    "cursorStyle": "block"
  },
  "shell": "",
  "keybindings": {
    "newTab": "Mod+Shift+T",
    "commandPalette": "Mod+Shift+P"
  }
}
```

Run **“Show Config File Path”** from the command palette to locate it. For
Powerline/Nerd Font glyphs, install a patched font (e.g.
[Nerd Fonts](https://www.nerdfonts.com/)) and set `appearance.fontFamily`.

`profiles.json` stores saved connections and is written with `0600` permissions
since it may contain credentials.

---

## Project structure

```
main.go                     Wails app entry, window options
app.go                      Bound methods exposed to the frontend
internal/
  session/                  Session manager + backends
    backend.go              Backend interface (Read/Write/Resize/Kind)
    manager.go              Lifecycle, output pump, exit handling
    local_unix.go           PTY shell (creack/pty)
    local_windows.go        PTY shell (ConPTY)
    ssh.go                  SSH backend (x/crypto/ssh)
    telnet.go               Telnet backend (IAC/NAWS)
    serial.go               Serial backend (stub)
  config/                   config.json persistence
  profile/                  profiles.json persistence
frontend/src/
  backend/api.ts            Typed bridge over Wails bindings + events
  terminal/TerminalView.ts  One xterm.js instance bound to a session
  layout/SplitTree.ts       Binary split-pane tree
  app/                      Workspace, TabBar, CommandPalette, ConnectionDialog
  config/                   Theme, config and profile models
```

---

## Roadmap

- **Serial port** connections (`go.bug.st/serial`).
- **SSH host-key verification** against `known_hosts` (currently stubbed).
- **Integrated file browser** side panel for local and remote (SFTP) files.
- SSH key manager UI.

---

## License

[MIT](LICENSE) © 2026 hamed-dev
