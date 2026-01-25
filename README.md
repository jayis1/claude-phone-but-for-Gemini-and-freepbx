# Gemini Phone

![Gemini Phone](assets/logo.png)

Voice interface for Gemini Code via SIP/3CX. Call your AI, and your AI can call you.

## What is this?

Gemini Phone gives your Gemini Code installation a phone number. You can:

- **Inbound**: Call an extension and talk to Gemini - run commands, check status, ask questions
- **Outbound**: Your server can call YOU with alerts, then have a conversation about what to do

## Prerequisites

| Requirement | Where to Get It | Notes |
| :--- | :--- | :--- |
| **3CX Cloud Account** | [3cx.com](https://www.3cx.com/) | Free tier works |
| **ElevenLabs API Key** | [elevenlabs.io](https://elevenlabs.io/) | For text-to-speech |
| **OpenAI API Key** | [platform.openai.com](https://platform.openai.com/) | For Whisper speech-to-text |
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
curl -sSL https://raw.githubusercontent.com/jayis1/networkschucks-phone-but-for-gemini/v1.1.2/install.sh | bash
```

The installer performs the following steps:

1. **System Checks**: Verifies Node.js 18+, Docker, and git are installed (and offers to install them).
2. **Cloning**: Clones the repository to `~/.gemini-phone-cli`.
3. **Dependencies**: Installs local CLI dependencies.
4. **Command Setup**: Makes the `gemini-phone` command easy to use.
   - **Linux**: Automatically creates a shortcut so you can run the program.
     - **Non-root**: Shortcut in `~/.local/bin` (updates `~/.bashrc`, `~/.zshrc`, or `~/.config/fish/config.fish`).
     - **Root**: Global shortcut in `/usr/local/bin`.
     *What this means for you:* You don't need to configure anything. Just open a new terminal window after installing, and you can type `gemini-phone` to get started.
   - **macOS**: Installs the command to `/usr/local/bin` (may require password for sudo).

### 2. Setup

```bash
gemini-phone setup
```

The setup wizard asks what you're installing:

| Type | Use Case | What It Configures |
| :--- | :--- | :--- |
| **Voice Server** | Pi or dedicated voice box | Docker containers, connects to remote API server |
| **API Server** | Mac/Linux with Claude Code | Just the Claude API wrapper |
| **Both** | All-in-one single machine | Everything on one box |

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
│  ┌─────────────┐                                            │
│  │     3CX     │  ← Cloud PBX                               │
│  └──────┬──────┘                                            │
│         │                                                    │
│         ↓                                                    │
│  ┌─────────────────────────────────────────────┐           │
│  │     Single Server (Mac/Linux)                │           │
│  │  ┌───────────┐    ┌───────────────────┐    │           │
│  │  │ voice-app │ ←→ │ gemini-api-server │    │           │
│  │  │ (Docker)  │    │ (Gemini Code CLI) │    │           │
│  │  └───────────┘    └───────────────────┘    │           │
│  └─────────────────────────────────────────────┘           │
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
│  ┌─────────────┐                                            │
│  │     3CX     │  ← Cloud PBX                               │
│  └──────┬──────┘                                            │
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

## API Endpoints

The voice-app exposes these endpoints on port 3000:

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| POST | `/api/outbound-call` | Initiate an outbound call |
| GET | `/api/call/:callId` | Get call status |
| GET | `/api/calls` | List active calls |
| POST | `/api/query` | Query a device programmatically |
| GET | `/api/devices` | List configured devices |

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
