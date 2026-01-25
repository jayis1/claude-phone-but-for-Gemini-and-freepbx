# Gemini Phone

![Gemini Phone](assets/logo.png)

Voice interface for Gemini Code via SIP/3CX. Call your AI, and your AI can call you.

## What's New in v2.1.2

🎵 **Hold Music** - No more dead air! Music plays while AI "thinks" (customizable).
🐍 **Python Brain** - Execute Python scripts via the new `/run-python` endpoint.
📞 **FreePBX Support** - Full compatibility with Asterisk/FreePBX.
💻 **Interactive Terminal** - Run Gemini CLI commands directly from Mission Control.
🛡️ **Enhanced Mission Control** - HTTPS support, Unified Logging, and FreePBX status.

## What is this?

Gemini Phone gives your Gemini Code installation a phone number. You can:

- **Inbound**: Call an extension and talk to Gemini - run commands, check status, ask questions
- **Outbound**: Your server can call YOU with alerts, then have a conversation about what to do
- **Monitor**: View all services in a unified dashboard with real-time stats
- **Customize**: Configure voice and speed settings per device

## Architecture

Gemini Phone v2.1.9 uses a 3-tier architecture:

```text
┌─────────────────────────────────────────────┐
│  Voice App (Port 3434)                      │
│  🎙️ Ears & Mouth - SIP/RTP handling        │
│  + FreePBX / 3CX Integration                │
│  + YouTube DJ Hold Music 🎵                 │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│  Inference Brain (Port 4000)                │
│  🧠 The Brain - AI reasoning & decisions    │
│  + Python Script Execution 🐍               │
│  + yt-dlp Audio Streaming                   │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│  API Server (Port 3333)                     │
│  ⚡ The Hands - Tool execution & actions    │
│  + Interactive CLI Terminal                 │
└─────────────────────────────────────────────┘

All monitored by Mission Control (HTTPS Port 3030)
```

## Prerequisites

| Requirement | Where to Get It | Notes |
| :--- | :--- | :--- |
| **SIP PBX Account** | 3CX / FreePBX / Asterisk | Any SIP-compliant server |
| **ElevenLabs API Key** | [elevenlabs.io](https://elevenlabs.io/) | For text-to-speech |
| **OpenAI API Key** | [platform.openai.com](https://platform.openai.com/) | For Whisper STT |
| **Gemini Code CLI** | [geminicli.com](https://geminicli.com/) | Requires Gemini subscription |

## Platform Support

| Platform | Status |
| :--- | :--- |
| **macOS** | Fully supported |
| **Linux** | Fully supported (including Raspberry Pi) |
| **Windows** | Not supported (may work with WSL) |

## Quick Start

### 1. Install

```bash
curl -sSL https://raw.githubusercontent.com/jayis1/networkschucks-phone-but-for-gemini/v2.1.9/install.sh | bash
```

The installer performs the following steps:

1. **System Checks**: Verifies Node.js 18+, Docker, and git are installed.
2. **Cloning**: Clones the repository to `~/.gemini-phone-cli`.
3. **Dependencies**: Installs local CLI dependencies.
4. **Command Setup**: Makes the `gemini-phone` command easy to use.

### 2. Setup

```bash
gemini-phone setup
```

The interactive setup wizard helps you:

1. **Choose Mode**: Voice Server, API Server, or Both (All-in-One).
2. **Configure PBX**: Connect to **3CX** or **FreePBX**.
3. **API Keys**: Enter your ElevenLabs and OpenAI keys.

## New in v2.1.9

- **Fixed**: Mission Control now correctly connects to Voice App (Red Dot Fix).
- **Fixed**: Auto-Update button logic.
- **Auto-Update**: One-click update from Mission Control dashboard.
- **Provider Switching**: Hot-swap between 3CX and FreePBX.
- **Setup UI**: Dedicated configuration page for easy PBX setup.
- **YouTube DJ Brain**: The AI now plays dynamic hold music from YouTube (Lofi Beats). 🎧

### 3. Start

```bash
gemini-phone start
```

## Deployment Modes

### All-in-One (Single Machine)

Best for: Mac or Linux server that's always on and has Gemini Code installed.

```text
┌─────────────────────────────────────────────────────────────┐
│  Your Phone                                                  │
│      │                                                       │
│      ↓ Call extension 9000                                  │
│  ┌───────────────────────┐                                  │
│  │   3CX / FreePBX       │  ← Cloud/Local PBX               │
│  └──────┬────────────────┘                                  │
│         │                                                    │
│         │ SIP                                                │
│         ↓                                                    │
│  ┌───────────────────────┐                                  │
│  │   Gemini Phone        │  ← Running "Both" mode           │
│  │  (Voice + API Server) │                                  │
│  └───────────────────────┘                                  │
└─────────────────────────────────────────────────────────────┘
```

**Setup:**

```bash
gemini-phone setup    # Select "Both"
gemini-phone start    # Launches Docker + API server
```

### Split Mode (Pi + API Server)

Best for: Dedicated Pi for voice services, Gemini running on your main machine.

```text
┌─────────────────────────────────────────────────────────────┐
│  Your Phone                                                  │
│      │                                                       │
│      ↓ Call extension 9000                                  │
│  ┌───────────────────────┐                                  │
│  │   3CX / FreePBX       │  ← Cloud/Local PBX               │
│  └──────┬────────────────┘                                  │
│         │                                                    │
│         ↓                                                    │

│  ┌─────────────┐         ┌─────────────────────┐           │
│  │ Raspberry Pi │   ←→   │ Mac/Linux with      │           │
│  │ (voice-app)  │  HTTP  │ Claude Code CLI     │           │
│  └─────────────┘         │ (claude-api-server) │           │
│                          └─────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

**On your Pi (Voice Server):**

```bash
gemini-phone setup    # Select "Voice Server", enter API server IP when prompted
gemini-phone start    # Launches Docker containers
```

**On your Mac/Linux (API Server):**

```bash
gemini-phone api-server    # Starts Gemini API wrapper on port 3333
```

Note: On the API server machine, you don't need to run `gemini-phone setup` first - the `api-server` command works standalone.

## CLI Commands

| Command | Description |
| :--- | :--- |
| `gemini-phone setup` | Interactive configuration wizard |
| `gemini-phone start` | Start services based on installation type |
| `gemini-phone stop` | Stop all services |
| `gemini-phone status` | Show service status |
| `gemini-phone doctor` | Health check for dependencies and services |
| `gemini-phone api-server [--port N]` | Start API server standalone (default: 3333) |
| `gemini-phone device add` | Add a new device/extension |
| `gemini-phone device list` | List configured devices |
| `gemini-phone device remove <name>` | Remove a device |
| `gemini-phone logs [service]` | Tail logs (voice-app, drachtio, freeswitch) |
| `gemini-phone config show` | Display configuration (secrets redacted) |
| `gemini-phone config path` | Show config file location |
| `gemini-phone config reset` | Reset configuration |
| `gemini-phone backup` | Create configuration backup |
| `gemini-phone restore` | Restore from backup |
| `gemini-phone update` | Update Gemini Phone |
| `gemini-phone uninstall` | Complete removal |

## Device Personalities

Each SIP extension can have its own identity with a unique name, voice, and personality prompt:

```bash
gemini-phone device add
```

Example devices:

- **Morpheus** (ext 9000) - General assistant
- **Cephanie** (ext 9002) - Storage monitoring bot

## Mission Control Dashboard

Access the unified dashboard at `http://your-server-ip:3030`

**Features:**

- **2x2 Grid Layout**: View all services simultaneously
  - Voice App (top-left) - Voice customization & Terminal
  - API Server (top-right) - Interactive endpoints
  - Inference Brain (bottom-left) - Model selection & Activity Log
  - System Monitor (bottom-right) - Live stats

- **Status Indicators**:
  - Real-time dots for FreePBX, Drachtio, Brain, and Python status.

- **Real-time Monitoring**:
  - CPU & Memory usage
  - Active calls counter
  - System uptime
  - Live log stream (last 10 entries, auto-refresh every 5s)

- **Quick Actions**:
  - Refresh stats
  - Clear logs

## Voice Customization

Configure voice and speed settings per device via the Voice App dashboard (`http://your-server-ip:3434`):

**Available Voices** (10 ElevenLabs options):

- Rachel, Antoni, Elli, Josh, Arnold
- Adam, Sam, Bella, Charlie, Daniel

**Speed Control**:

- Range: 0.5x to 2.0x
- Real-time adjustment
- Per-device settings
- Persistent across calls

**How to Use**:

1. Visit Voice App dashboard
2. Select device from dropdown
3. Choose voice and adjust speed slider
4. Click "Save Settings"
5. Settings apply to all future calls for that device

## Dashboards

All services provide interactive web dashboards:

| Service | Port | URL | Features |
| :--- | :--- | :--- | :--- |
| **Mission Control** | 3030 | `http://localhost:3030` | Unified view, system stats, logs |
| **Voice App** | 3434 | `http://localhost:3434` | Voice/speed config, API endpoints |
| **Inference Brain** | 4000 | `http://localhost:4000` | Model selection, endpoints |
| **API Server** | 3333 | `http://localhost:3333` | Interactive endpoints, testing |

## API Endpoints

### Voice App (Port 3434)

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| POST | `/api/outbound-call` | Initiate an outbound call |
| GET | `/api/call/:callId` | Get call status |
| GET | `/api/calls` | List active calls |
| POST | `/api/query` | Query a device programmatically |
| GET | `/api/devices` | List configured devices |
| POST | `/api/config/voice` | Update voice for device |
| POST | `/api/config/speed` | Update speech speed |
| GET | `/api/config` | Get device config |
| GET | `/health` | Health check |

### Mission Control (Port 3030)

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| GET | `/api/system-stats` | CPU, memory, uptime |
| GET | `/api/active-calls` | Active calls count |
| GET | `/api/logs` | System logs |
| DELETE | `/api/logs` | Clear logs |
| GET | `/health` | Health check |

See [Outbound API Reference](voice-app/README-OUTBOUND.md) for details.

## Troubleshooting

### Quick Diagnostics

```bash
gemini-phone doctor    # Automated health checks
gemini-phone status    # Service status
gemini-phone logs      # View logs
```

### Common Issues

| Problem | Likely Cause | Solution |
| :--- | :--- | :--- |
| Calls connect but no audio | Wrong external IP | Re-run `gemini-phone setup`, verify LAN IP |
| Extension not registering | 3CX SBC not running | Check 3CX admin panel |
| "Sorry, something went wrong" | API server unreachable | Check `gemini-phone status` |
| Port conflict on startup | 3CX SBC using port 5060 | Setup auto-detects this; re-run setup |

### Manual Node.js Installation

If the installer fails to install Node.js automatically (common on some restricted Debian/Ubuntu systems), run:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
```

Then run the installer again.

### Gemini CLI

The installer will automatically install the Gemini CLI (@google/gemini-cli) if it's not found.

If you prefer to install it manually:

```bash
npm install -g @google/gemini-cli
```

### Alternative: Run via Docker

For security and isolation, you can run the Gemini CLI directly from a docker container:

```bash
docker run --rm -it us-docker.pkg.dev/gemini-code-dev/gemini-cli/sandbox:0.1.1
```

If you have the CLI installed locally, you can also force sandbox mode:

```bash
gemini --sandbox -y -p "your prompt here"
```

See [Troubleshooting Guide](docs/TROUBLESHOOTING.md) for more.

## Configuration

Configuration is stored in `~/.gemini-phone/config.json` with restricted permissions (chmod 600).

```bash
gemini-phone config show    # View config (secrets redacted)
gemini-phone config path    # Show file location
```

## Development

```bash
# Run tests
npm test

# Lint
npm run lint
npm run lint:fix
```

## Documentation

- [CLI Reference](cli/README.md) - Detailed CLI documentation
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions
- [Outbound API](voice-app/README-OUTBOUND.md) - Outbound calling API reference
- [Deployment](voice-app/DEPLOYMENT.md) - Production deployment guide
- [FreePBX Guide](docs/FREEPBX.md) - Setup for FreePBX / Asterisk
- [Gemini Code Skill](docs/GEMINI-CODE-SKILL.md) - Build a "call me" skill for Gemini Code

## License

MIT

**
<!-- Fun Footer -->
```text
    .-----------------.
    |  Hi, I'm Gemini |
    |      Phone!     |
    |  .-----------.  |
    |  |  /*\\  _  |  |
    |  | |   | | | |  |
    |  | \\*/  |*| |  |
    |  '-----------'  |
    | [1] [2] [3] |\  |
    | [4] [5] [6] | | |
    | [7] [8] [9] | | |
    | [*] [0] [#] | | |
    '-------------' | |
      |*______**|**/

```
