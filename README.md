# Claude Code Manager

> A self-hosted, GUI-based session manager for Claude Code with multi-device support

## Overview

Claude Code Manager brings the familiar Claude.ai interface to your local machine while adding powerful session management capabilities. Keep your conversation history, work on multiple projects simultaneously, and access everything from your Mac, iPhone, or any device on your network.

## Key Features

- **Persistent Sessions**: Never lose context again - all conversations saved locally
- **Git-Based Isolation**: Each session runs on its own Git branch for true isolation
- **Multi-Session Support**: Work on multiple projects concurrently
- **Self-Hosted**: Runs on your Mac, accessible from any device on your network
- **Claude.ai-Like Interface**: Familiar, polished UI you already know
- **Easy Settings Management**: Configure Claude Code through a clean UI

## Why Claude Code Manager?

### Problems We Solve

1. **Lost Context**: Terminal-based Claude Code loses history when you quit
2. **Single Session Limitation**: Can't easily switch between multiple projects
3. **Terminal UI**: Not everyone is comfortable with terminal interfaces
4. **Device Lock-In**: Can't check progress from your phone or tablet

### Our Solution

- Git branches for session isolation
- SQLite for persistent conversation storage
- Beautiful desktop app built with Tauri
- Optional web interface for multi-device access

## Architecture

```
Desktop App (Tauri)
       ↓
Backend Server (Node.js + TypeScript)
       ↓
Claude Agent SDK → Anthropic API
       ↓
SQLite + Git Repositories
```

**Tech Stack**:
- **Desktop**: Tauri 2.x (Rust + React)
- **Backend**: Node.js + TypeScript + Fastify
- **Integration**: Claude Agent SDK
- **Storage**: SQLite + Git
- **Testing**: Vitest + Playwright

## Quick Start

> **Note**: Project is in active development. This section will be updated as features are completed.

```bash
# Clone repository
git clone https://github.com/your-username/claude-code-manager.git
cd claude-code-manager

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Add your ANTHROPIC_API_KEY

# Start development
pnpm dev
```

## Development

### Prerequisites

- **Node.js** 18+
- **pnpm** 8+
- **Rust** (for Tauri)
- **Git**

### Project Structure

```
claude-code-manager/
├── apps/
│   ├── desktop/          # Tauri desktop app
│   └── web/              # Web client (future)
├── packages/
│   ├── server/           # Backend API server
│   ├── shared/           # Shared types and utilities
│   └── ui/               # Shared UI components
├── docs/
│   ├── features/         # Feature specifications
│   ├── architecture/     # System design docs
│   └── development/      # Development guides
├── .claude/
│   └── commands/         # Claude Code slash commands
├── CLAUDE.md             # Project context for Claude Code
├── GUIDELINES.md         # Development workflow
└── README.md             # This file
```

### Development Workflow

We follow a strict Test-Driven Development (TDD) process with phase gates:

```
1. Documentation First  → Write use-case and test-case docs
2. Tests First (TDD)    → Write failing tests
3. Implementation       → Make tests pass
4. Code Review          → Automated review
5. Quality Gates        → All tests must pass
6. Merge                → Only if everything passes
```

**Read [`GUIDELINES.md`](./GUIDELINES.md) for detailed workflow.**

### Slash Commands

When working in Claude Code:

- `/start-feature` - Begin new feature with TDD workflow
- `/review-ready` - Run all quality checks before merge
- `/session-guide` - Show development quick reference
- `/architecture` - Review system architecture

### Running Tests

```bash
# Run all tests
pnpm test

# Run unit tests
pnpm test:unit

# Run E2E tests
pnpm test:e2e

# Check coverage
pnpm test:coverage

# Lint
pnpm lint
```

### Quality Requirements

- ✅ All tests passing
- ✅ Code coverage ≥ 80%
- ✅ No linting errors
- ✅ Code review passed
- ✅ Documentation complete

## Git-Based Sessions

### How It Works

Each session creates an isolated Git branch:

```
main
 ├─ session/sess_abc123  (Session: "Add authentication")
 ├─ session/sess_def456  (Session: "Refactor API")
 └─ session/sess_ghi789  (Session: "Fix bug #123")
```

### Benefits

- **True Isolation**: File changes don't conflict between sessions
- **Version Control**: Built-in history per session
- **Easy Merging**: Standard Git merge workflow when done
- **Familiar**: Developers already understand branches

### Requirements

- Projects must use Git
- If not initialized, app will prompt to run `git init`

## Current Status & Roadmap

> **Latest**: ✅ **Phase 2 COMPLETE** - Desktop UI fully functional with E2E tests
> **Next**: Phase 3 - MVP Polish (Performance, UX, Visual improvements)
> **Details**: See [PROGRESS.md](./PROGRESS.md) and [PHASE-2-SUMMARY.md](./PHASE-2-SUMMARY.md)

### ✅ Phase 1: Backend Core (COMPLETE)
- ✅ Project setup and monorepo configuration
- ✅ Backend API with session management (CRUD, switch)
- ✅ Git integration service (branches, status, checkout)
- ✅ Claude Code CLI integration (headless mode)
- ✅ Message persistence (SQLite)
- ✅ WebSocket streaming (real-time responses)
- ✅ REST API with validation (Fastify + Zod)
- ✅ **BONUS**: Git operations (merge, conflict detection, branch deletion)
- ✅ **BONUS**: Enhanced settings management (get all, delete)
- **Tests**: 232 passing, 5 skipped

### ✅ Phase 2: Desktop UI Basics (COMPLETE)
- ✅ Tauri project setup (Tauri 2.x + React 18 + TypeScript)
- ✅ API client (REST + WebSocket with reconnection and error handling)
- ✅ Session list component with Zustand state management
- ✅ Chat interface with streaming support
- ✅ Settings panel UI (model, theme - **NO API KEY**, managed by Claude CLI)
- ✅ Integration (all components working together)
- ✅ **Critical fixes**: API key architecture, backend config, dev server
- ✅ **E2E tests**: Playwright infrastructure and basic test suite
- ✅ **Polish**: Loading states, error states, empty states everywhere
- **Tests**: 170 unit + 7 E2E passing, 95.6% coverage
- **Status**: Fully functional desktop app ready for manual testing

### 📅 Phase 3: MVP Polish
- [ ] Loading & error states
- [ ] Performance optimization (virtualization)
- [ ] Data persistence improvements
- [ ] Keyboard shortcuts
- [ ] Visual polish and animations
- [ ] Comprehensive testing

### 📅 Phase 4: Self-Hosted
- [ ] Web client (port desktop UI)
- [ ] Multi-device access
- [ ] mDNS discovery for LAN
- [ ] Optional authentication
- [ ] Mobile-friendly responsive design

## Documentation

- **[PROGRESS.md](./PROGRESS.md)** - Current development status and roadmap
- **[CLAUDE.md](./CLAUDE.md)** - Project context for AI assistants
- **[GUIDELINES.md](./GUIDELINES.md)** - Development workflow and standards
- **[MVP-ROADMAP.md](./docs/MVP-ROADMAP.md)** - MVP scope and timeline
- **[docs/features/](./docs/features/)** - Feature specifications
- **[docs/architecture/](./docs/architecture/)** - System design
- **[docs/development/](./docs/development/)** - Development guides

## Contributing

This project follows strict quality standards:

1. Read [`GUIDELINES.md`](./GUIDELINES.md) first
2. Use `/start-feature` to begin new work
3. Write tests before code (TDD)
4. Run `/review-ready` before merging
5. All quality gates must pass

### Getting Started with Development

```bash
# 1. Read project context
cat CLAUDE.md
cat GUIDELINES.md

# 2. Start Claude Code in project directory
cd claude-code-manager
claude

# 3. Use slash commands
/session-guide
/start-feature

# 4. Follow TDD workflow
```

## License

[MIT License](./LICENSE)

## Acknowledgments

- Built with [Claude Code](https://claude.ai/code)
- Powered by [Anthropic's Claude API](https://anthropic.com)
- Desktop app framework: [Tauri](https://tauri.app)
- Backend framework: [Fastify](https://fastify.dev)

---

**Status**: 🚧 In Active Development

This project is being built following TDD principles with comprehensive test coverage and documentation. Check the [Issues](../../issues) page for current work and progress.
