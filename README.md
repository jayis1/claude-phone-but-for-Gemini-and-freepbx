# 🤖 Gemini AI Call Center

### The "AI Employees" for your FreePBX System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Gemini](https://img.shields.io/badge/AI-Gemini%201.5-blue)](https://deepmind.google/technologies/gemini/)
[![FreePBX](https://img.shields.io/badge/PBX-FreePBX-green)](https://www.freepbx.org/)

**Turn your FreePBX system into an AI Call Center in minutes.**
Gemini Phone allows you to deploy fully autonomous "AI Employees" (Stacks) that live on your phone network. They can answer calls, transfer customers, take messages, and even call each other to coordinate tasks.

---

## 🚀 Quick Start (One-Line Install)

Run this on any Linux machine (Ubuntu/Debian/Pi) on the same LAN as your FreePBX:

```bash
curl -sSL https://raw.githubusercontent.com/jayis1/claude-phone-but-for-Gemini-and-freepbx/WEEDsMARTIX1.1.2/install.sh | bash
```

Run setup:

```bash
gemini-phone setup
gemini-phone mesh start   # Launch the 3-Node AI Cluster
```

---

## 🏢 What is an "AI Call Center"?

Instead of just one AI bot, this system orchestrates **Teams of AIs**.

### The Architecture (WEEDsMARTIX 1.0)

- **The One (Mission Control)**: A central orchestrator (Port 3030) that listens to all agents and visualizes the network.
- **The Mesh (AI Employees)**: A 3-node interconnected cluster:

| Agent | Port | Role | Personality |
| :--- | :--- | :--- | :--- |
| **Morpheus** | 5060 | L1 Support | The Mentor. Filters noise. |
| **Neo** | 5070 | Specialist | The One. Solves problems. |
| **Trinity** | 5080 | Empathy | The Heart. Handles sensitive calls. |

- **Synx PBX**: Auto-magically configures your FreePBX via API.

---

## 🧠 Features

- **Multi-Modal AI**: Powered by Gemini 1.5 Pro/Flash.
- **Natural Voice**: Ultra-low latency TTS via ElevenLabs.
- **Smart Routing**: AIs can use the PBX to transfer calls.
- **"Synx PBX"**: One-click provisioning of Extensions, Trunks, and Inbound Routes on FreePBX.
- **Mission Control ("The One")**: Real-time dashboard and event bus.
- **Elite Mesh Architecture**: Inter-AI calling via internal SIP mesh.

### Technical Architecture Diagram

![System Architecture](docs/technical_architecture.png)

```mermaid
graph TD
    subgraph "The One (Orchestrator)"
        MC[Mission Control :3030]
    end

    subgraph "The Mesh (SIP Cluster)"
        M[Morpheus :5060] <-->|SIP| N[Neo :5070]
        N <-->|SIP| T[Trinity :5080]
        T <-->|SIP| M
    end
    
    MC <-->|Events| M
    MC <-->|Events| N
    MC <-->|Events| T
    
    Users[Phones/PSTN] <-->|SIP| FreePBX[FreePBX Server]
    FreePBX <-->|SIP Trunk| M
    FreePBX <-->|SIP Trunk| N
    FreePBX <-->|SIP Trunk| T
```

---

## 🛠️ Usage

### CLI Commands

Everything is managed via the `gemini-phone` tool.

| Command | Description |
| :--- | :--- |
| `gemini-phone setup` | Hardware/Network wizard. |
| `gemini-phone mesh start` | **NEW**: Wake up the full 3-Node Cluster. |
| `gemini-phone mesh stop` | Stop the cluster. |
| `gemini-phone mesh status` | See status of all nodes. |
| `gemini-phone doctor` | Diagnose connectivity/network issues. |
| `gemini-phone stack deploy [N]` | Deploy individual stacks manually. |

### Mission Control

Visit `http://YOUR_SERVER_IP:3030` to access the GUI.

- **Green Dot**: Online & Registered with PBX.
- **Red Dot**: Offline (Check `gemini-phone doctor`).
- **Apply Config**: Force FreePBX to reload settings.

---

## 🔧 Advanced: Inter-AI Communication

Your AI agents can talk to each other!
Because they are standard SIP extensions, you can set up scenarios where:

1. **Morpheus** receives an inbound call.
2. User asks a complex math question.
3. **Morpheus** says "Hold on, let me ask the professor."
4. **Morpheus** initiates a second call leg to **Trinity** (Ext 9010).
5. AIs converse, solve the problem, and report back to the user.

*(Future update: creating "Conference Room" scenarios for multi-agent swarms)*

---

## 📦 Requirements

- **Linux Server** (Ubuntu 20.04+, Debian 11+, Raspberry Pi OS 64-bit)
- **FreePBX Server** (v15+) on the same LAN.
- **Gemini API Key** (Google AI Studio)
- **ElevenLabs API Key** (Voice)
- **OpenAI API Key** (Whisper STT)

---

## 🤝 Contributing

We are building the future of open-source AI telephony.

- **Repo**: `jayis1/claude-phone-but-for-Gemini-and-freepbx`
- **Issues**: Submit bugs on GitHub.
- **Feature Requests**: Join the discussion.

---
*Built with ❤️ by NetworkChuck Community & The "Antigravity" Agent*
