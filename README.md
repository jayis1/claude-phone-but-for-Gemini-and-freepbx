# Gemini Phone (v42.0) 🧠🔗🛰️

![Gemini Phone](assets/logo.png)

Voice interface for Gemini Code via FreePBX/SIP. Call your AI, and your AI can call you.

## What's New in v4.2.0

+ 🏗️ **Multi-Stack Orchestration** - Run multiple independent Gemini Phone instances on a single server! Each stack gets its own isolated SIP trunk, Voice App, and Logic Engine. Perfect for assigning different AI personalities (e.g., "Sales", "Support") to different phone numbers.
+ 🖥️ **Stacks Dashboard** - A new Mission Control page to visualize, deploy, and manage your telephony stacks in real-time.
+ 🛠️ **CLI Power** - New `gemini-phone stack` commands to deploy and manage stacks from the terminal.

## What's New in v4.0.0

+ 🛠️ **Native Gemini SDK** - Replaced the external `gemini` CLI dependency with the native `@google/generative-ai` SDK. This fixes issues where the `gemini` command was not found in Mission Control and provides a more robust, faster integration.
+ 🚀 **Unified Versioning** - All components (CLI, Voice App, API Server, Mission Control) are now synchronized to v4.1.02.

## What's New in v4.0.13

+ 🕵️‍♂️ **Smarter Doctor** - Upgraded `gemini-phone doctor` to use real **UDP SIP OPTIONS** packets for checking PBX connectivity. No more "inconclusive" warnings due to TCP failures.
+ 🔧 **Mission Control Fixes** - Resolved 404 errors for legacy inference endpoints and fixed the System Stats widget crash by ensuring correct API routing.
+ 📦 **Install Stability** - Fixed the installer crash related to the removal of the legacy `inference-server` directory.

## What's New in v3.6.1

+ 🐍💀 **Python-Free Architecture** - Completely removed the legacy `inference-server` and Python dependencies. The system is now 100% Node.js for maximum stability and speed.
+ 🔧 **Clean Stack** - Stripped all vestigial code, logs, and health checks related to the old "Brain Proxy".

## What's New in v3.6.0

+ 🧠🔗🛰️ **The Skill Cluster: 8 Distinct Intelligence Webhooks** - Your AI just got a massive brain upgrade. You can now configure up to 8 distinct n8n webhooks in Mission Control. Use Slot 1 for general reasoning and Slots 2-8 for specialized "Skills" like calendar, IoT, or business automation.

## What's New in v3.5.1

+ 🧠🖱️ **Dynamic Logic: n8n Injection UI** - Introducing the dedicated "Logic Engine" page in Mission Control. Inject n8n webhook URLs and credentials in real-time while updating your stack, without ever needing to re-run the CLI setup.

## What's New in v3.5.0

+ 🧠🔗 **The Hybrid Core: Webhooks + REST API** - Gemini Phone now supports a dual-path n8n integration. Use Webhooks for lightning-fast voice reasoning and the REST API for secure, deep health diagnostics.

## What's New in v3.4.1

+ 🛠️ **UX Upgrade: Interactive n8n Setup** - Added `N8N_WEBHOOK_URL` to the `gemini-phone setup` wizard. Now you can configure your n8n logic engine without touching a text editor.

## What's New in v3.4.0

+ 🧠 **Intelligence Upgrade: n8n Bridge** - Gemini Phone now supports routing its reasoning requests directly to **n8n**. Upgrade your AI's brain with 500+ integrations and visual skill building.

## What's New in v3.3.5

+ 🛠️ **Hotfix: Self-Healing Storage** - Added automatic directory creation for storage and mission control data. No more "Directory missing" errors on startup or health checks.

## What's New in v3.3.4

+ 🩺 **Hotfix: Doctor Stability** - Fixed a crash in the `gemini-phone doctor` command when run as the root user. Improved internal path resolution for version reporting.

## What's New in v3.3.3

+ 🩺 **Hotfix: Root User Persistence** - Resolved health check failures when running as root by ensuring data directories are audited using absolute paths and fixing the `doctor` output for clearer debugging.

## What's New in v3.3.2

+ 🩺 **Hotfix: Persistence & Health Checks** - Fixed `gemini-phone doctor` false negatives by moving storage audits to the global config directory and correcting the `EXTERNAL_IP` lookup logic.

## What's New in v3.3.1

+ 🎨 **UI Overhaul: Dashboard Interactivity** - Major improvements to button clickability and visual feedback on the TipTop dashboard. Added glow effects, hover states, and explicit z-index management to resolve "unpressable" buttons.

## What's New in v3.2.9

+ 🚀 **Hotfix: Dashboard Interactivity** - Fixed "Refresh" button visibility/usability and resolved proxy stability issues causing "Play" button failures.

## What's New in v3.2.8

+ 🩺 **Doctor 2.0 Expansion** - The `gemini-phone doctor` command now performs deep diagnostics on Mission Control connectivity, storage write permissions for recordings/notes, and validates `EXTERNAL_IP` against local interfaces to prevent RTP issues.

## What's New in v3.2.7

+ 🔉 **Hotfix: Playback Stability** - Optimized recording playback with streaming support and persistent audio elements to prevent browser interruptions.

## What's New in v3.2.6

+ 🚑 **Hotfix: Mission Control Fix** - Resolved a critical structural error in the dashboard HTML that caused the page to fail to render correctly.

## What's New in v3.2.5

+ 💅 **Hotfix: UI Repair** - Fixed broken layout containers and mangled CSS transparency in the Mission Control dashboard.

## What's New in v3.2.4

+ 🚑 **Hotfix: Playback Fix** - Resolved a proxy issue in Mission Control that blocked call recording playback.

## What's New in v3.2.3

+ 🚑 **Hotfix: Docker YAML Fix** - Resolved an interpolation error in the generated `docker-compose.yml` that blocked startup.

## What's New in v3.2.2

+ 🚑 **Hotfix: Persistence & Recordings** - Fixed missing volume mount for FreeSWITCH that blocked recordings.
+ 💾 **Note Persistence** - TipTop notes are now saved to disk and survive restarts.
+ 🎨 **UI Fixes** - Repaired corrupted CSS colors in the Mission Control dashboard.

## What's New in v3.2.0

+ 📼 **Call Recordings** - Full audio recording of every conversation (Inbound & Outbound).
+ ▶️ **Playback Support** - Play recordings directly from the Mission Control "Recent Calls" UI.
+ 💾 **Persistence** - Data volumes added so logs, recordings, and settings survive restarts.
+ 🚑 **Crash Fixes** - Fixed Mission Control `server.js` startup crash and API history 404s.

## What's New in v3.0.1

+ ⚡ **One-Click Universal Provisioning** - Automated Extension and Outbound Route creation via FreePBX M2M API.
+ 🧬 **Hardware Scaling** - Dedicated support for NVIDIA (NVENC) and AMD (ROCm) GPUs kept for future-proofing.
+ 🔇 **Silent Build Mode** - Hidden Docker build/pull logs for a cleaner terminal.

+ ⚙️ **Web Settings Dashboard** - Full configuration via Gear icon (no CLI needed for API keys).
+ 📊 **htop Integration** - Real-time colorful system stats directly in Mission Control.
+ 💎 **The Beautiful Stack** - A cohesive 4-part system working in harmony.
+ grid-cols-2 **Mission Control 2.0** - Stunning 2x2 grid dashboard for total system oversight.

+ 🐍 **Python Brain** - Execute Python scripts via the new `/run-python` endpoint.
+ 📞 **FreePBX Only** - Simplified stack strictly for FreePBX/Asterisk.

## What is this?

Gemini Phone gives your Gemini Code installation a phone number. It's a "Beautiful Stack" of 4 powerful components:

1. **Mission Control** (The Dashboard) - Unified generic interface.
2. **Voice App** (The Ears & Mouth) - SIP/RTP handling & TTS/STT.
3. **n8n Skill Cluster** (The Mind) - Modular AI logic & skill automation.
4. **Gemini API Server** (The Hands) - Tool execution & CLI access.

## Architecture

![Architecture Flow](assets/architecture_flow.png)

```text
┌─────────────────────────────────────────────────────────────┐
│  Phone Call                                                  │
│      │                                                       │
│      ↓ Call extension 9000                                  │
│  ┌─────────────┐                                            │
│  │   FreePBX   │  ← PBX routes the call                    │
│  └──────┬──────┘                                            │
│         │ SIP                                               │
│         ↓                                                    │
│  ┌─────────────────────────────────────────────────┐       │
│  │           voice-app (Docker)                     │       │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────┐ │       │
│  │  │   drachtio   │  │ FreeSWITCH   │  │ Node.js │ │       │
│  │  │    (SIP)     │  │   (Media)    │  │ (Logic) │ │       │
│  │  └──────┬───────┘  └──────┬───────┘  └────┬────┘ │       │
│  └─────────┼─────────────────┼───────────────┼─────┘       │
│            │                 │               │             │
│            ↓                 ↓               ↓             │
│  ┌──────────────────┐  ┌───────────┐  ┌────────────────┐   │
│  │  n8n Skill Cluster│  │  Gemini  │  │ Mission Control │   │
│  │  (8 Webhooks)    │←─┤   API     │  │   (Dashboard)  │   │
│  └──────────────────┘  └───────────┘  └────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

| Requirement | Where to Get It | Notes |
| :--- | :--- | :--- |
| **SIP PBX Account** | FreePBX / Asterisk | Any SIP-compliant server |
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
curl -sSL https://raw.githubusercontent.com/jayis1/claude-phone-but-for-Gemini-and-freepbx/main/install.sh | bash
```

The installer performs the following steps:

```text
🔍 Checking prerequisites...

Platform: linux (x86_64)

  ✓ Node.js v20.20.0 (requires >=18.0.0)
  ✓ Docker v29.2.0
  ✓ Docker Compose v5.0.2 (plugin)
  ✓ Disk space 34.8GB free (requires >=2GB)
  ✓ Network: ✓ npm ✓ docker ✓ nodesource
```

### 2. Setup

```bash
gemini-phone setup
```

The interactive setup wizard helps you:

1. **Choose Mode**: Voice Server, API Server, or Both (All-in-One).
2. **Configure PBX**: Connect to your **FreePBX** or SIP server.
3. **API Keys**: Enter your ElevenLabs and OpenAI keys.

### 3. Start

```bash
gemini-phone start
```

### 4. Update (When new versions are released)

```bash
gemini-phone update
```

This single command will:

1. Check for the latest version.
2. Pull new Docker images.
3. Update the CLI tools.
4. Restart services automatically.

## Previous Updates (v2.1.x) 🚀

+ **Multi-Provider Switching**:
  + Hot-swap between **FreePBX** and **Asterisk** directly from Mission Control.
  + **Smart Profiles**: The system remembers your credentials for each provider, so switching is just one click.
  + **Standalone Restart**: Automatically restarts the Voice App service (no Docker requirement) to apply changes immediately.

+ **Mission Control UI 2.0**:
  + **Custom Modals**: Replaced ugly browser alerts with sleek, dark-mode confirmation dialogs.
  + **Smart Update Button**: Always visible with intelligent behavior:
    + ✅ **Up-to-Date?**: Click to force a re-install (useful for debugging).
    + 🚀 **Update Available?**: Click to one-tap update your entire stack.

+ **Infrastructure**:
  + **Red Dot Fix**: Solved port conflicts to ensure Mission Control always sees the Voice App.

## Deployment Modes

### All-in-One (Single Machine)

Best for: Mac or Linux server that's always on and has Gemini Code installed.

```text
┌─────────────────────────────────────────────────────────────┐
│  Your Phone                                                  │
│      │                                                       │
│      ↓ Call extension 9000                                  │
│  ┌───────────────────────┐                                  │
│  │   FreePBX / Asterisk  │  ← Cloud/Local PBX               │
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
│  │   FreePBX / Asterisk  │  ← Cloud/Local PBX               │
│  └──────┬────────────────┘                                  │
│         │                                                    │
│         ↓                                                    │

│  ┌─────────────┐         ┌─────────────────────┐           │
│  │ Raspberry Pi │   ←→   │ Mac/Linux with      │           │
│  │ (voice-app)  │  HTTP  │ Gemini Code CLI     │           │
│  └─────────────┘         │ (gemini-api-server) │           │
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

### Dual-LXC / Satellite SBC Mode

Best for: High-stability Proxmox setups where FreePBX and Gemini live in separate containers.

```text
┌───────────────────────────────┐      ┌───────────────────────────────┐
│     LXC 101 (FreePBX)         │      │     LXC 102 (Gemini Phone)    │
│  IP: 172.16.1.83              │      │  IP: 172.16.1.81              │
│  Standard SIP (Port 5060)     │ ◀──▶ │  Satellite SBC (Port 5060)    │
└───────────────────────────────┘      └───────────────────────────────┘
```

**Setup on Gemini LXC:**

1. Run `gemini-phone setup`.
2. When asked **"Installing on same server as FreePBX?"**, select **No**.
3. Enter the IP of your FreePBX LXC.
4. Gemini will now act as a remote SBC, allowing both systems to use Port 5060 without conflict.

## Proxmox & LXC Compatibility

If running inside a Proxmox LXC container, ensure the following settings are enabled in the Proxmox Web UI (Options -> Features):

+ ✅ **Nesting**: Required for Docker to run inside LXC.
+ ✅ **FUSE**: Optional, but improves storage performance.

### GPU Passthrough in LXC

To use AMD/NVIDIA acceleration in Proxmox, add these lines to your `/etc/pve/lxc/ID.conf` on the **host**:

```text
lxc.cgroup2.devices.allow: c 226:* rwm
lxc.mount.entry: /dev/kfd dev/kfd none bind,optional,create=file
lxc.mount.entry: /dev/dri dev/dri none bind,optional,create=dir
```

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

+ **Morpheus** (ext 9000) - General assistant
+ **Cephanie** (ext 9002) - Storage monitoring bot

## Mission Control Dashboard

Access the unified dashboard at `http://your-server-ip:3030`

**Features:**

+ **2x2 Grid Layout**: View all services simultaneously
  + Voice App (top-left) - Voice customization & Terminal
  + API Server (top-right) - Interactive endpoints
  + Inference Brain (bottom-left) - Model selection & Activity Log
  + System Monitor (bottom-right) - Live stats

+ **Status Indicators**:
  + Real-time dots for FreePBX, Drachtio, Brain, and Python status.

+ **Quick Access**:
+ **📊 htop view** (one-click access)
+ **⚙️ Settings Gear**: Configure API keys and SIP settings directly in browser
  
+ **Real-time Monitoring**:
  + CPU & Memory usage
  + Active calls counter
  + System uptime
  + Live log stream (last 10 entries, auto-refresh every 5s)

+ **Quick Actions**:
  + Refresh stats
  + Clear logs

## Voice Customization

Configure voice and speed settings per device via the Voice App dashboard (`http://your-server-ip:3000`):

**Available Voices** (10 ElevenLabs options):

+ Rachel, Antoni, Elli, Josh, Arnold
+ Adam, Sam, Bella, Charlie, Daniel

**Speed Control**:

+ Range: 0.5x to 2.0x
+ Real-time adjustment
+ Per-device settings
+ Persistent across calls

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
| **Voice App** | 3000 | `http://localhost:3000` | Voice/speed config, API endpoints |
| **Inference Brain** | 4000 | `http://localhost:4000` | Model selection, endpoints |
| **API Server** | 3333 | `http://localhost:3333` | Interactive endpoints, testing |

## API Endpoints

### Voice App (Port 3000)

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
| Extension not registering | FreePBX/Asterisk issue | Check PBX admin panel |
| "Sorry, something went wrong" | API server unreachable | Check `gemini-phone status` |
| Port conflict on startup | PBX using port 5060 | Setup auto-detects this; re-run setup |
| Calls fail with 503 error | SIP "Cause 34" | No Trunk/Outbound Route; see [Solve Guide](docs/TROUBLESHOOTING_CAUSE_34.md) |

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

+ [CLI Reference](cli/README.md) - Detailed CLI documentation
+ [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions
+ [Outbound API](voice-app/README-OUTBOUND.md) - Outbound calling API reference
+ [Deployment](voice-app/DEPLOYMENT.md) - Production deployment guide
+ [FreePBX Guide](docs/FREEPBX.md) - Setup for FreePBX / Asterisk
+ [SIP Cause 34 Guide](docs/TROUBLESHOOTING_CAUSE_34.md) - Fix "No circuit/channel" 503 errors
+ [Gemini Code Skill](docs/GEMINI-CODE-SKILL.md) - Build a "call me" skill for Gemini Code

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
