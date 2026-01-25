# Feature Specification: Dedicated Inference Server

## Problem

Currently, `gemini-api-server` handles both the HTTP interface for voice and the execution of the Gemini CLI. This couples the "Brain" (Conversation Logic) with the "Hands" (Tool Execution), limiting the ability to have complex reasoning, memory management, or model switching independent of the tool execution environment.

## Proposed Solution: 3-Tier Architecture

Split the system into three distinct components:

1. **Voice App** (Frontend)
    * Handles SIP/RTP, TTS (ElevenLabs), and STT (Whisper).
    * Forwards user text to the **Inference Server**.

2. **Inference Server** (The "Brain" - *NEW*)
    * **Responsibility**: Manages the conversation state, system prompts, memory, and decision making.
    * **Logic**: Receives text from Voice App. Decides if it's a casual chat or if it needs to use a tool.
    * **Communication**:
        * If it needs to run a command, it sends a request to the **Execution Server**.
        * If it's just chatting, it replies directly to Voice App.
    * **Stack**: Node.js or Python (FastAPI/Flask) for better LLM integration.

3. **Execution Server** (The "Hands" - formerly `gemini-api-server`)
    * **Responsibility**: strictly executing tools/commands via `gemini-cli`.
    * **Logic**: Dumb execution. Receives "Run this command" -> Runs it -> Returns output.
    * **Security**: Sandbox for tool execution.

## Benefits

* **Better AI**: The Inference Server can use a more powerful model (e.g., Gemini 1.5 Pro via generic API) for reasoning, while instructing the CLI to do specific tasks.
* **Decoupling**: We can restart the "Brain" without killing the "Hands" (long-running jobs).
* **Scalability**: The Inference Server can manage multiple sessions more effectively than spawning heavy CLI processes for every turn?

## Architecture Diagram

```mermaid
graph TD
    User((User)) <-->|SIP/RTP| VoiceApp[Voice App]
    VoiceApp <-->|HTTP| Inference[Inference Server (Brain)]
    Inference <-->|HTTP/JSON| Tools[Execution Server (Hands)]
    Tools -->|Spawns| CLI[Gemini CLI]
```

## Questions for User

1. Is this the separation of concerns you are looking for?
2. Should the **Inference Server** communicate with the Gemini API *directly* (via Google SDK) to generate responses, and only call the **Execution Server** when it generates a tool call?
3. Or should the Inference Server just act as a proxy that manages context but still relies on `gemini-cli` for the actual generation? (Option 1 is significantly "Better AI").
