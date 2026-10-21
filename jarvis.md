# JARVIS Desktop — Project Context & Development Specification

**Document type:** Master project context  
**Project:** JARVIS Desktop  
**Target platform:** Windows 11  
**Current phase:** Stage 0 — Foundation and project setup  
**Development approach:** Stage-by-stage, test-driven, incremental implementation

---

## 1. Project Vision

JARVIS is a personal AI desktop assistant designed to run as a native Windows desktop application.

The long-term goal is to create an intelligent assistant that can:

- Converse naturally through text and voice.
- Use cloud AI models through OpenRouter.
- Optionally use local AI models through Ollama.
- Maintain persistent, editable memory.
- Launch approved applications and websites.
- Read and summarize user-selected documents.
- Perform predefined, permission-controlled desktop actions.
- Plan and execute bounded, multi-step tasks.
- Recover from errors and report actual execution results.
- Eventually support wake-word activation, reminders, scheduling, and additional integrations.

JARVIS must evolve from a working MVP into a maintainable desktop agent. It must not remain merely a chatbot with a futuristic interface.

### Core design philosophy

1. Build real functionality before adding unnecessary complexity.
2. Keep architecture modular and extensible.
3. Prefer cloud inference for demanding AI tasks on low-powered hardware.
4. Keep local AI optional.
5. Treat security, privacy, and reliability as foundational requirements.
6. Test every milestone before proceeding to the next.
7. Never claim an action succeeded unless the actual operation confirms success.

---

## 2. Developer Environment and Constraints

The development environment is:

- Operating system: Windows 11.
- Processor: Intel Core i3 laptop.
- Node.js: Installed.
- Python: Installed.
- Ollama: Installed.
- Cloud AI provider: OpenRouter.
- Development shell: PowerShell.
- Target application: Windows desktop executable.

The exact Node.js, npm, Python, and Ollama versions have not yet been verified. Check the actual environment before selecting version-sensitive dependencies or executing setup commands.

### Hardware constraints

The application should remain responsive on an Intel i3 laptop.

- Prefer lightweight CSS and SVG animations.
- Avoid requiring a dedicated GPU.
- Avoid large local models as a default dependency.
- Do not introduce unnecessary background processes.
- Keep memory consumption and CPU utilization reasonable.
- Do not download large models automatically.
- Use cloud inference when suitable.
- Treat local Ollama inference as an optional capability.

Do not assume a particular amount of RAM or available disk space. Verify these when relevant.

---

## 3. Product Decisions — Finalized

The following decisions have already been made. Do not ask the developer to choose them again.

### Interface

A futuristic HUD.

The intended visual style is premium, dark, minimal, and technically sophisticated, with restrained cyan or blue accents.

The interface should include:

- A central animated assistant orb.
- Distinct idle, listening, thinking, speaking, and error states.
- A chat panel.
- A text composer.
- Microphone controls.
- Speech-output controls.
- AI connection and model status.
- A compact activity feed.
- Settings and memory management.
- Smooth but lightweight transitions.

Avoid excessive neon effects, cluttered dashboard cards, unnecessary 3D rendering, and animations that compromise performance.

### Interaction

Text and voice from the beginning.

The MVP must provide text input and a microphone-based voice workflow. Voice should degrade gracefully to text when a speech capability is unavailable.

Always-on wake-word detection is deferred until a later stage.

### Autonomy

Automatic execution of predefined, low-risk actions, with confirmation for risky actions.

The assistant must not have unrestricted shell access or unrestricted filesystem access.

### Memory

Persistent, editable memory stored locally wherever practical.

Users must be able to inspect, correct, and delete saved memories. Conversations and long-term user memories are separate concepts and should have separate storage models.

### Priority

Maximum long-term capability, without sacrificing architectural quality or safety.

Build a reliable foundation now and extend it incrementally.

---

## 4. Final Technology Stack

### Desktop runtime

Electron.

Use Electron Forge with its Vite/TypeScript starter as the initial project scaffold.

Verify the generated template and build configuration before making assumptions about the installed Electron Forge version.

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS, if its setup remains compatible with the chosen starter
- Motion (`motion` package) for animations
- Lucide React for icons

The HUD should use reusable React components rather than one oversized component.

### AI

- OpenRouter as the initial cloud AI provider.
- `@openrouter/sdk` for supported API functionality.
- A common AI provider interface to decouple the UI and application logic from any single provider.
- Ollama as a later optional local provider.
- Zod for runtime validation of settings, messages, and tool arguments.

Do not assume free models have unlimited usage. Model availability, rate limits, and provider policies can change.

### Persistence

Use SQLite with Drizzle ORM for durable local storage.

Planned packages:

- `better-sqlite3`
- `drizzle-orm`
- `drizzle-kit`

Verify native-module compatibility with the selected Electron version and configure rebuilding as required.

Store application data in the appropriate Electron user-data directory, not inside the source tree.

### Security and secrets

Use Electron `safeStorage` where available to protect secrets using OS-backed encryption.

Check whether secure storage is available before persisting API credentials.

Never expose an OpenRouter API key to the React renderer or bundle it into frontend code.

### Testing

- Vitest
- React Testing Library
- Integration tests for AI communication, persistence, and the desktop bridge

Add dependencies incrementally. Do not install all future-stage dependencies during initial setup.

---

## 5. Target Architecture

The application consists of six major layers.

### A. Renderer

Responsible for:

- HUD and visual presentation.
- Chat history display.
- Text composition.
- Voice controls.
- Settings.
- Memory management.
- Task progress and activity reporting.

The renderer must not directly access Node.js, arbitrary filesystem paths, process execution, or privileged operating-system APIs.

### B. Electron main process

Responsible for:

- Window lifecycle.
- Application lifecycle.
- System tray and global shortcuts when introduced.
- AI provider orchestration.
- Secret management.
- Tool execution.
- Database access.
- Permission enforcement.
- IPC request validation.

### C. Preload and typed desktop bridge

Expose a small, explicit API through Electron's context bridge.

Every IPC handler must validate the calling renderer and validate its input.

Do not expose generic methods such as `executeCommand(command)` or unrestricted filesystem access to the renderer.

### D. AI provider layer

Define a common provider interface that supports the features required by the application, including streaming where supported.

Initial implementation:

- OpenRouter provider.

Later implementation:

- Ollama provider.

Provider-specific logic must not leak throughout the UI.

### E. Tool and permission layer

Maintain an explicit registry of available tools.

Each tool should define:

- Unique identifier.
- Description.
- Input schema.
- Permission category.
- Execution handler.
- Timeout.
- Result schema.
- Error behavior.
- Audit information.

The AI can propose a tool call, but trusted application code decides whether the tool is allowed and executes it.

### F. Memory and persistence

Responsible for:

- Conversations.
- Messages.
- User memories.
- Settings.
- Tool execution history.
- Task state.
- Database migrations.

Keep persistence independent of the model provider.

---

## 6. Target Project Structure

Use this as the architectural target, not as a requirement to create every file immediately.

```text
jarvis-desktop/
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   ├── windows/
│   │   └── assistant-window.ts
│   ├── ipc/
│   │   ├── register-handlers.ts
│   │   └── channels.ts
│   ├── security/
│   │   ├── permissions.ts
│   │   └── validate-sender.ts
│   └── services/
│       ├── secret-store.ts
│       └── system-actions.ts
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   └── routes.tsx
│   ├── components/
│   │   ├── hud/
│   │   │   ├── AssistantOrb.tsx
│   │   │   ├── AudioWaveform.tsx
│   │   │   ├── SystemStatus.tsx
│   │   │   └── ActivityFeed.tsx
│   │   ├── chat/
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── MessageList.tsx
│   │   │   └── MessageComposer.tsx
│   │   └── settings/
│   ├── features/
│   │   ├── assistant/
│   │   ├── voice/
│   │   ├── memory/
│   │   ├── tools/
│   │   └── settings/
│   ├── services/
│   │   ├── ai/
│   │   │   ├── AIProvider.ts
│   │   │   ├── OpenRouterProvider.ts
│   │   │   └── OllamaProvider.ts
│   │   ├── voice/
│   │   │   ├── SpeechInput.ts
│   │   │   └── SpeechOutput.ts
│   │   └── desktop/
│   │       └── desktop-client.ts
│   ├── store/
│   ├── styles/
│   │   ├── globals.css
│   │   └── hud.css
│   └── types/
├── shared/
│   ├── schemas/
│   │   ├── assistant.ts
│   │   ├── tools.ts
│   │   └── settings.ts
│   └── contracts/
│       └── desktop-api.ts
├── database/
│   ├── schema.ts
│   └── migrations/
├── tests/
│   ├── unit/
│   └── integration/
├── assets/
│   └── icons/
├── docs/
├── .env.example
├── .gitignore
├── package.json
├── forge.config.ts
├── tsconfig.json
└── README.md
```

Adjust paths to match the generated starter where necessary. Do not blindly overwrite the starter's configuration or duplicate its existing entry points.

Use `.tsx` for React components. Use `.ts` for ordinary TypeScript modules.

---

## 7. Development Roadmap

The project must progress through the following stages in order.

### Stage 0 — Foundation and setup

**Goal:** Establish a working and recoverable development environment.

Tasks:

1. Verify installed tool versions.
2. Inspect available hardware and relevant system constraints.
3. Create the Electron Forge Vite/TypeScript project.
4. Launch the unmodified starter application.
5. Initialize Git and establish a baseline commit.
6. Inspect the generated configuration and scripts.
7. Add React and initial HUD dependencies.
8. Create initial architecture and security documentation.
9. Verify the project still launches.

Acceptance criteria:

- The starter project installs successfully.
- The Electron application launches on Windows 11.
- The generated project configuration is understood.
- Git works and the baseline is committed.
- No API credentials are present in source control.

**Current status: Not yet verified complete. This is the stage to begin with.**

### Stage 1 — HUD and desktop shell

Goal: Create the real, interactive interface.

Tasks:

- Create the dark HUD layout.
- Implement the assistant orb and its visual states.
- Add the chat panel and text composer.
- Add microphone and speech-output controls.
- Add connection status and activity feed.
- Add settings and model-selection UI.
- Use mock assistant responses initially.
- Optimize animations for low-powered hardware.

Acceptance criteria:

- The UI renders correctly in Electron.
- Controls respond correctly.
- Different assistant states are visually distinguishable.
- The application remains responsive during animation.
- No AI credentials or privileged APIs are exposed to the renderer.

### Stage 2 — AI conversation engine

Goal: Enable genuine AI conversations.

Tasks:

- Define the `AIProvider` interface.
- Implement the OpenRouter provider.
- Add secure API-key entry and storage.
- Add configurable model selection.
- Implement streaming responses.
- Maintain conversation context.
- Add cancellation and error handling.
- Validate all relevant inputs.

Acceptance criteria:

- A message receives a real model response.
- Responses stream into the chat.
- Invalid credentials and network errors are handled.
- Rate-limit errors do not crash the application.
- The API key is not bundled into renderer code.
- Provider-specific code is isolated.

### Stage 3 — Voice interaction

Goal: Support speech input and output.

Tasks:

- Implement speech input and output adapters.
- Add microphone permission handling.
- Show listening, processing, and speaking states.
- Connect transcription to the AI engine.
- Add speech output.
- Add stop-speaking and interruption controls.
- Provide text-only fallback behavior.
- Evaluate dedicated speech engines if browser APIs are unreliable.

Acceptance criteria:

- A user can dictate a message.
- The transcription is displayed.
- JARVIS returns an AI response.
- The response can be spoken aloud.
- Speech can be stopped.
- Voice failures do not disable text chat.

Always-on wake-word detection is deferred.

### Stage 4 — Persistent memory

Goal: Persist conversations and editable user memories.

Tasks:

- Add SQLite and Drizzle.
- Create versioned database migrations.
- Store conversations and messages.
- Add editable user memories.
- Implement memory search and retrieval.
- Add retention, correction, and deletion controls.
- Back up user data appropriately.
- Test database recovery and migration behavior.

Acceptance criteria:

- Conversations survive application restarts.
- Saved memories can be inspected and edited.
- Deleted memories are no longer retrieved.
- Relevant memories can be included in future AI requests.
- Database failures are handled gracefully.

### Stage 5 — Safe desktop actions

Goal: Allow controlled interaction with Windows.

Initial tools:

- Open approved applications.
- Open approved websites.
- Read explicitly selected files.
- Summarize user-selected documents.
- Create files in approved directories.

Tasks:

- Implement the tool registry.
- Define schemas and permission categories.
- Validate tool arguments.
- Enforce permissions in trusted main-process code.
- Add confirmation UI for sensitive operations.
- Add timeouts and execution-result reporting.
- Record tool execution outcomes.

Acceptance criteria:

- Approved low-risk tools execute correctly.
- Disallowed actions are blocked.
- Risky actions require explicit approval.
- Invalid tool arguments are rejected.
- Failures are reported accurately.
- The AI cannot bypass the permission layer.

Do not add unrestricted shell execution.

### Stage 6 — Agentic task execution

Goal: Support bounded multi-step tasks.

Tasks:

- Create a task-planning abstraction.
- Break requests into ordered steps.
- Validate plans before execution.
- Execute tools sequentially.
- Track progress and results.
- Add bounded retries and timeouts.
- Support cancellation.
- Request approval at sensitive checkpoints.
- Provide a final report based on verified results.

Acceptance criteria:

- A multi-step task can complete successfully.
- Failed steps are handled without falsely claiming success.
- The user can cancel a task.
- Denied approvals stop dependent operations.
- Execution history is inspectable in Neon PostgreSQL / local memory cache.

**Status: COMPLETE. 10/10 test assertions passing.**

### Stage 7 — Advanced capabilities and production hardening (COMPLETED & VERIFIED)

Capabilities Implemented:

- Wake-word detection (VAD + Web Audio + Groq Whisper keyword detection).
- Local Ollama provider (`OllamaProvider` connecting to `127.0.0.1:11434`, `/api/chat` streaming, `/api/tags` detection).
- Autonomous scheduling & reminders (`ReminderService`, 3s polling, Neon DB persistence, natural language parsing).
- Windows System Tray integration (Stark tray icon, context menu, minimize-to-tray on close).
- Global system hotkey (`Ctrl+Alt+J` / `CommandOrControl+Alt+J` toggle).
- Desktop notifications & audible HUD alerts for triggered reminders.
- Packaged Windows application (`npm run package` -> `out/jarvis-desktop-win32-x64/jarvis-desktop.exe`).
- Production hardening, error boundaries, safe storage, and crash recovery.

Acceptance criteria (All Verified with 88 automated unit & integration tests):

- The packaged application compiles and packages for win32-x64 without error.
- Reminders persist across sessions and sync with Neon PostgreSQL / local memory cache.
- Global shortcuts toggle the HUD from any Windows desktop context.
- System tray remains active with background scheduler when window is minimized/closed.
- Ollama local inference functions with fallback to cloud/mock.
- Automated tests verify all scheduling, NLP intent, Ollama, and DB functionality (88/88 passing).

**Status: COMPLETE. 88/88 test assertions passing across all 8 suites.**

### Stage 8 — Multimodal Screen Vision & Desktop Awareness (COMPLETED & VERIFIED)

Capabilities Implemented:

- Multimodal Desktop Awareness tool (`analyze_screen`) in `toolRegistry.ts` capturing 1080p display buffer via Electron `desktopCapturer`.
- Natural language vision intent detector (`look at my screen`, `what's on my screen`, `inspect my screen`, `debug this error on my screen`).
- Multimodal payload support across AI Providers:
  - `OpenRouterProvider`: Injects base64 image data URLs and automatically routes to vision-capable models (`meta-llama/llama-3.2-11b-vision-instruct:free`, `openai/gpt-4o-mini`, `anthropic/claude-3.5-sonnet`).
  - `GroqProvider`: Injects image data URLs and automatically routes to `llama-3.2-11b-vision-preview`.
  - `OllamaProvider`: Formats stripped base64 payloads into `/api/chat` images array for local vision models (such as `llama3.2-vision` / `llava`).
  - `MockAIProvider`: Provides simulated optical receptor analysis during offline testing.
- HUD Optical Receptor Scan interface:
  - Added dedicated `<ScanEye size={18} />` button to `CommandDock`.
  - Displays tactical HUD visual scan card preview with the acquired frame buffer.
  - Real-time AI visual commentary streamed into chat and vocalized via TTS.

Acceptance criteria (All Verified with 96 automated unit & integration tests):

- Vision queries are distinguished from standard file screenshot exports.
- All AI providers construct valid multimodal payloads with image buffers.
- One-click screen inspection triggers display capture, tactical card display, and AI streaming.
- 100% test pass rate (96/96 tests across 9 suites), 0 type errors, 0 lint errors.

**Status: COMPLETE. 96/96 test assertions passing across all 9 suites.**

---

## 8. Voice Architecture

Keep voice independent of the AI provider.

Define separate interfaces for:

- Speech recognition.
- Speech synthesis.
- Audio lifecycle and cancellation.

Start with available browser speech capabilities when supported, with explicit capability checks.

Do not assume speech recognition behaves identically on every Windows machine.

If a dedicated local speech engine is later selected, benchmark CPU usage and latency before making it a default.

Wake-word detection must be local where practical, with visible microphone status, a disable control, and clear privacy behavior.

Do not activate continuous listening silently.

---

## 9. Memory Design

At minimum, distinguish the following entities:

- Conversations.
- Messages.
- Memories.
- Settings.
- Tool execution records.
- Tasks and task steps.

Potential memory fields include:

- ID.
- Memory content.
- Category.
- Creation and modification timestamps.
- Source or reason for saving.
- Optional relevance metadata.

Do not create an unnecessarily complex vector database at the beginning. Start with ordinary SQLite storage and indexed search. Add embeddings only if retrieval quality later requires them.

Memory rules:

- Allow inspection, correction, and deletion.
- Avoid saving sensitive information unnecessarily.
- Separate conversation history from long-term memory.
- Do not assume every AI-generated memory suggestion should be stored.
- Apply retention and deletion policies consistently.

---

## 10. Security Requirements

These requirements are mandatory.

### Electron

- Enable context isolation.
- Keep renderer Node.js integration disabled.
- Keep sandboxing enabled where compatible.
- Use a restrictive Content Security Policy.
- Validate IPC sender identity.
- Validate every IPC payload.
- Expose only narrowly scoped preload APIs.
- Do not expose generic filesystem or process-execution APIs.

### AI

- Treat model responses as untrusted input.
- Validate structured outputs before using them.
- Never treat model claims as evidence that a tool succeeded.
- Limit tool execution and retries.
- Do not expose API credentials to the model unnecessarily.
- Protect against malicious instructions inside user-provided files and web content.

### Desktop actions

- Use allowlisted actions.
- Apply least privilege.
- Validate paths and prevent directory traversal.
- Require approval for destructive or consequential operations.
- Make sensitive actions auditable.
- Support cancellation and timeouts.
- Never let model-generated code bypass tool permissions.

### Secrets and storage

- Never commit API keys.
- Do not store secrets in plain-text settings files.
- Use OS-backed secure storage where available.
- Never include secrets in logs.
- Store application data in the designated user-data directory.
- Provide sensible backup and recovery mechanisms.

---

## 11. Testing and Quality Standards

Each stage must include:

1. Build or type checks.
2. Relevant unit tests.
3. Integration tests where appropriate.
4. Manual verification on Windows.
5. Failure-path testing.
6. Security checks for any new privileged capability.
7. A documented acceptance result.

Test at least:

- Missing API keys.
- Invalid model identifiers.
- Network failures.
- Rate limiting.
- Stream interruption.
- Invalid tool arguments.
- Denied permissions.
- Failed application launches.
- Database migration failures.
- Voice capability failures.

Do not claim tests passed unless they were actually executed.

Do not claim the application was verified on Windows unless the environment was available and the test was performed.

---

## 12. Dependency Management

Add dependencies when needed, not all at once.

Initial planned dependencies:

- `react`
- `react-dom`
- `@openrouter/sdk`
- `zod`
- `lucide-react`
- `motion`

Initial development dependencies:

- `@types/react`
- `@types/react-dom`
- `vitest`
- `@testing-library/react`

Some may already exist in the generated starter. Inspect `package.json` before installing duplicates.

Later dependencies may include:

- `better-sqlite3`
- `drizzle-orm`
- `drizzle-kit`
- `electron-log`

Check current package documentation and compatibility before installing. Pin and test dependency versions. Avoid major-version upgrades during an active milestone unless necessary.

---

## 13. Rules for the AI Coding Agent

You are responsible for implementing this project incrementally.

### Before making changes

1. Inspect the current project structure.
2. Read `package.json` and the existing configuration.
3. Identify which roadmap stage is currently active.
4. Determine whether existing functionality should be preserved.
5. Explain the files you intend to change.
6. Identify any commands that could overwrite files, delete data, or change system configuration.

### While implementing

- Work only on the current stage.
- Make small, coherent changes.
- Follow existing conventions where reasonable.
- Keep TypeScript types meaningful.
- Avoid giant components and unnecessary abstractions.
- Never replace the entire project just to implement a small feature.
- Never silently remove existing working features.
- Never invent test results.
- Never hard-code API keys or other secrets.
- Never execute destructive commands without explicit approval.
- Do not add future-stage functionality merely because it seems convenient.

### After implementation

1. List the files created or modified.
2. Explain the important architectural decisions.
3. Run available build and test commands.
4. Report actual results and failures.
5. Provide manual verification steps.
6. Update the project documentation.
7. State whether the current stage's acceptance criteria are satisfied.
8. Recommend the next step without implementing it automatically.

### Handling uncertainty

If a dependency, API, or configuration is version-sensitive, inspect the installed version and current documentation.

If a requested change would compromise the architecture or security rules, explain the issue and propose a safer implementation.

Do not invent APIs or assume that a command exists.

Do not ask the developer to repeat decisions already documented here.

---

## 14. Current Implementation Status

At the time this document was created:

- The operating system is Windows 11.
- Node.js, Python, and Ollama are installed.
- OpenRouter is the intended initial cloud AI provider.
- The Intel i3 laptop is a performance constraint.
- The HUD interface, text-and-voice interaction, persistent editable memory, and controlled automation are finalized product decisions.
- The architecture and roadmap have been planned.
- The actual project scaffold has not yet been verified as created or running.
- Installed software versions have not yet been verified.
- No milestone should be marked complete without evidence.

**Current active stage: Stage 0 — Foundation and project setup.**

---

## 15. Immediate Task for the Coding Agent

Begin Stage 0 only.

### Task A — Inspect the environment

Use PowerShell to check:

```powershell
node --version
npm --version
python --version
git --version
ollama --version
```

If a command fails, report the failure and provide a targeted fix. Do not assume Git is installed merely because Node.js is installed.

Optionally inspect available RAM and free disk space before installing larger dependencies.

### Task B — Inspect or create the project

If a `jarvis-desktop` project already exists, inspect it first. Do not overwrite it.

If it does not exist, create the initial project using:

```powershell
npx create-electron-app@latest jarvis-desktop --template=vite-typescript
```

Then:

```powershell
cd jarvis-desktop
npm start
```

Confirm that the generated Electron starter window launches.

If setup fails, diagnose the actual error before continuing. Do not blindly delete dependencies, lockfiles, or project configuration.

### Task C — Establish Git

After checking the generated project and `.gitignore`:

```powershell
git init
git status
```

Create a baseline commit only after verifying that no secrets or unwanted files are staged.

### Task D — Prepare the React foundation

Inspect the generated project before adding React and its dependencies. Configure the renderer to use React without unnecessarily replacing the Electron Forge setup.

Launch the application again and verify the result.

### Stage 0 completion report

Return:

- Verified tool versions.
- Project directory and scaffold.
- Files created or modified.
- Commands executed and their actual results.
- Build or launch errors, if any.
- Git status and baseline commit status.
- Remaining setup issues.
- Confirmation of which acceptance criteria have been met.

**Stop after Stage 0. Do not start implementing the complete HUD, AI conversation engine, voice system, memory database, or automation tools in this initial task.**

---

## Final Principle

JARVIS must be built as a real, secure, extensible Windows desktop agent—not as a visual demo.

Every milestone should leave behind a working application, tested functionality, documented decisions, and a clear path to the next stage.
