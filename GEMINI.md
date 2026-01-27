# Gemini Phone

Voice interface for Gemini Code via SIP/FreePBX. Call your AI, and your AI can call you.

## Project Overview

Gemini Phone gives your Gemini Code installation a phone number through FreePBX PBX integration:

- **Inbound**: Call an extension and talk to Claude - run commands, check status, ask questions
- **Outbound**: Your server can call YOU with alerts, then have a conversation about what to do

## Tech Stack

| Component | Technology |
| :--- | :--- |
| Language | Node.js (ES modules for CLI, CommonJS for voice-app) |
| SIP Server | drachtio-srf |
| Media Server | FreeSWITCH (via drachtio-fsmrf) |
| STT | OpenAI Whisper API |
| TTS | ElevenLabs API |
| AI Backend | Gemini CLI (via HTTP wrapper) |
| PBX | FreePBX (any SIP-compatible works) |
| Container | Docker Compose |

## Architecture

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
│  │  ┌─────────────────────────────────────────┐   │       │
│  │  │ drachtio  │  FreeSWITCH  │  Node.js     │   │       │
│  │  │ (SIP)     │  (Media)     │  (Logic)     │   │       │
│  │  └─────────────────────────────────────────┘   │       │
│  └────────────────────┬────────────────────────────┘       │
│                       │ HTTP                                │
│                       ↓                                      │
│  ┌─────────────────────────────────────────────────┐       │
│  │   gemini-api-server                              │       │
│  │   Wraps Gemini CLI with session management │       │
│  └─────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```text
gemini-phone/
├── GEMINI.md                 # This file
├── CONSTITUTION.md           # DevFlow 2.0 development principles
├── README.md                 # User-facing documentation
├── install.sh                # One-command installer
├── package.json              # Root package (hooks, linting, tests)
├── eslint.config.js          # ESLint configuration
├── docker-compose.yml        # Multi-container orchestration
├── .env.example              # Environment template
│
├── .gemini/commands/         # DevFlow slash commands
│   ├── feature.md            # /feature spec|start|ship
│   ├── test.md               # /test
│   ├── fix.md                # /fix [N]
│   ├── issues.md             # /issues
│   ├── investigate.md        # /investigate
│   ├── project.md            # /project
│   ├── batch.md              # /batch
│   └── design.md             # /design
│
├── cli/                      # Unified CLI tool
│   ├── package.json
│   ├── README.md
│   ├── bin/
│   │   ├── gemini-phone.js   # CLI entry point
│   │   └── cli-main.js       # Command definitions
│   ├── lib/
│   │   ├── commands/         # Command implementations
│   │   │   ├── setup.js      # Interactive setup wizard
│   │   │   ├── start.js      # Start services
│   │   │   ├── stop.js       # Stop services
│   │   │   ├── status.js     # Service status
│   │   │   ├── doctor.js     # Health checks
│   │   │   ├── api-server.js # Start API server standalone
│   │   │   ├── logs.js       # Tail service logs
│   │   │   ├── backup.js     # Create backups
│   │   │   ├── restore.js    # Restore backups
│   │   │   ├── update.js     # Self-update
│   │   │   ├── uninstall.js  # Clean removal
│   │   │   ├── config/       # Config subcommands
│   │   │   │   ├── show.js
│   │   │   │   ├── path.js
│   │   │   │   └── reset.js
│   │   │   └── device/       # Device subcommands
│   │   │       ├── add.js
│   │   │       ├── list.js
│   │   │       └── remove.js
│   │   ├── config.js         # Config read/write
│   │   ├── docker.js         # Docker compose wrapper
│   │   ├── network.js        # Network utilities
│   │   ├── platform.js       # Platform detection
│   │   ├── port-check.js     # Port availability checks
│   │   ├── prereqs.js        # Prerequisite checks
│   │   ├── prerequisites.js  # Pi-specific prereqs
│   │   ├── process-manager.js# PID-based process management
│   │   ├── utils.js          # Shared utilities
│   │   └── validators.js     # API key validation
│   └── test/                 # Test suite
│
├── voice-app/                # Docker container for voice handling
│   ├── Dockerfile
│   ├── package.json
│   ├── index.js              # Main entry point
│   ├── config/
│   │   └── devices.json      # Device configurations
│   ├── lib/
│   │   ├── audio-fork.js     # WebSocket audio streaming
│   │   ├── gemini-bridge.js  # HTTP client for Gemini API
│   │   ├── connection-retry.js # Connection retry logic
│   │   ├── conversation-loop.js  # Core conversation flow
│   │   ├── device-registry.js    # Multi-device management
│   │   ├── http-server.js    # Express server for audio/API
│   │   ├── logger.js         # Logging utility
│   │   ├── multi-registrar.js    # Multi-extension SIP registration
│   │   ├── outbound-handler.js   # Outbound call logic
│   │   ├── outbound-routes.js    # Outbound API endpoints
│   │   ├── outbound-session.js   # Outbound call sessions
│   │   ├── query-routes.js   # Query API endpoints
│   │   ├── registrar.js      # Single SIP registration
│   │   ├── sip-handler.js    # Inbound call handling
│   │   ├── tts-service.js    # ElevenLabs TTS
│   │   └── whisper-client.js # OpenAI Whisper STT
│   ├── DEPLOYMENT.md         # Production deployment guide
│   ├── README-OUTBOUND.md    # Outbound calling API docs
│   └── API-QUERY-CONTRACT.md # Query API specification
│
├── gemini-api-server/        # HTTP wrapper for Gemini CLI
│   ├── package.json
│   ├── server.js             # Express server
│   └── structured.js         # JSON validation helpers
│
├── docs/
│   └── TROUBLESHOOTING.md    # Troubleshooting guide
│
└── src/features/             # DevFlow feature specs (planning docs)
    └── */SPEC.md, PLAN.md, TASKS.md
```

## CLI Commands

```bash
# One-line install
curl -sSL https://raw.githubusercontent.com/jayis1/claude-phone-but-for-Gemini-and-freepbx/v2.3.0/install.sh | bash

# Setup and run
gemini-phone setup    # Interactive configuration
gemini-phone start    # Launch services
gemini-phone stop     # Stop services
gemini-phone status   # Check status
gemini-phone doctor   # Health checks
```

## Development

### Running Tests

```bash
npm test              # All tests
npm run test:cli      # CLI tests only
npm run test:voice-app # Voice app tests only
```

### Linting

```bash
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix issues
```

### DevFlow Commands

| Command | Purpose |
| :--- | :--- |
| `/feature spec [name]` | Create feature spec |
| `/feature start [name]` | Build with TDD |
| `/feature ship` | Review and merge |
| `/test` | Run tests |
| `/fix [N]` | Fix GitHub issue #N |
| `/investigate [problem]` | Debug without changing code |

## API Endpoints

### Voice App (port 3000)

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| POST | `/api/outbound-call` | Initiate outbound call |
| GET | `/api/call/:callId` | Get call status |
| GET | `/api/calls` | List active calls |
| POST | `/api/query` | Query device programmatically |
| GET | `/api/devices` | List configured devices |

### Gemini API Server (port 3333)

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| POST | `/ask` | Send prompt to Gemini |
| POST | `/ask-structured` | Send prompt, return JSON |
| POST | `/end-session` | Clean up session |
| GET | `/health` | Health check |

## Key Design Decisions

1. **CommonJS for voice-app** - Compatibility with drachtio ecosystem
2. **ES Modules for CLI** - Modern Node.js tooling
3. **Host networking mode** - Required for FreeSWITCH RTP
4. **Separate gemini-api-server** - Runs where Gemini CLI is installed
5. **Session-per-call** - Each call gets Gemini session for multi-turn context
6. **RTP ports 30000-30100** - Avoids conflict with standard PBX ports (e.g. 20000-20099)
7. **Config in ~/.gemini-phone** - User config separate from codebase

## Environment Variables

See `.env.example` for all variables. Key ones:

| Variable | Purpose |
| :--- | :--- |
| `EXTERNAL_IP` | Server LAN IP for RTP routing |
| `GEMINI_API_URL` | URL to gemini-api-server |
| `ELEVENLABS_API_KEY` | TTS API key |
| `OPENAI_API_KEY` | Whisper STT API key |
| `SIP_DOMAIN` | FreePBX server FQDN |
| `SIP_REGISTRAR` | SIP registrar address |

## Documentation

- [README.md](README.md) - User quickstart
- [cli/README.md](cli/README.md) - CLI reference
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) - Common issues
- [voice-app/DEPLOYMENT.md](voice-app/DEPLOYMENT.md) - Production deployment
- [voice-app/README-OUTBOUND.md](voice-app/README-OUTBOUND.md) - Outbound API
- [CONSTITUTION.md](CONSTITUTION.md) - DevFlow principles
