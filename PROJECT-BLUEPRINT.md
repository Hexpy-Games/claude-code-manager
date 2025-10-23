# Claude Code Manager - Project Blueprint

> **Status**: Blueprint Complete - Ready for Development
> **Last Updated**: 2025-01-23

## Executive Summary

Claude Code Manager is a self-hosted, GUI-based session manager for Claude Code that brings the familiar Claude.ai interface to your local machine while solving key pain points:

1. **Lost Context**: Terminal sessions lose history when closed
2. **Multi-Session Management**: Difficult to work on multiple projects
3. **Terminal Limitations**: Not everyone prefers terminal UI
4. **Device Accessibility**: Can't check work from mobile devices

### Solution Approach

- **Git-Based Isolation**: Each session = isolated Git branch
- **Persistent Storage**: SQLite for conversation history
- **Native Desktop**: Tauri for lightweight, fast Mac app
- **Self-Hosted API**: Node.js backend for multi-device access
- **Quality First**: TDD with comprehensive testing and code review

---

## Architecture Overview

### High-Level Design

```
┌─────────────────────────────────────────────────┐
│         Desktop App (Tauri)                     │
│         React + TypeScript + Rust               │
└──────────────────┬──────────────────────────────┘
                   │ HTTP/WebSocket
                   ↓
┌─────────────────────────────────────────────────┐
│         Backend Server                          │
│         Node.js + TypeScript + Fastify          │
│  ┌───────────────────────────────────────────┐  │
│  │  Session Manager                          │  │
│  │  Git Service                              │  │
│  │  Claude Agent SDK Integration             │  │
│  └───────────────────────────────────────────┘  │
└──────────────────┬──────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────┐
│         Storage Layer                           │
│         SQLite + Git Repositories               │
└─────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Desktop** | Tauri 2.x | Native performance, small bundle, Rust security |
| **Frontend** | React + TypeScript | Mature, component-based, type-safe |
| **UI Library** | Shadcn UI / Radix UI | Accessible, customizable, modern |
| **Backend** | Fastify + TypeScript | Fast, low overhead, excellent TS support |
| **Integration** | Claude Agent SDK | Official Anthropic SDK, production-ready |
| **Database** | SQLite (better-sqlite3) | Embedded, zero-config, fast for single-user |
| **Git** | simple-git | Comprehensive Git operations in Node.js |
| **Testing** | Vitest + Playwright | Fast unit tests, robust E2E testing |
| **Linting** | Biome | Fast, all-in-one linter and formatter |
| **Build** | Turborepo + pnpm | Efficient monorepo builds, fast installs |

---

## Git-Based Session Strategy

### Core Concept

**Each session = isolated Git branch from main**

```
Repository:
├── main (branch)
│   └── Clean baseline
├── session/sess_abc123 (branch)
│   └── Feature: Add authentication
├── session/sess_def456 (branch)
│   └── Feature: Refactor API
└── session/sess_ghi789 (branch)
    └── Bugfix: Fix login error
```

### Session Lifecycle

```
1. CREATE
   User: "New session: Add auth"
   → Check Git repo exists (prompt to init if not)
   → Create branch: session/{uuid} from main
   → Store session in SQLite
   → Initialize Claude Agent SDK

2. WORK
   User: Sends messages to Claude
   → Agent SDK processes on session branch
   → File changes isolated to branch
   → Messages saved to database

3. SWITCH
   User: Selects different session
   → Save current state
   → git checkout session/other_id
   → Load session messages
   → Continue working

4. CLOSE/MERGE
   User: "Done with session"
   Options:
   - Merge to main → Standard Git merge
   - Keep branch → Save for later
   - Delete branch → Discard work
```

### Benefits

✅ **Natural Isolation**: Git prevents file conflicts
✅ **Familiar Workflow**: Developers understand branches
✅ **Version Control**: Built-in history per session
✅ **Lightweight**: No Docker overhead
✅ **Standard Tooling**: Use normal Git commands

### Requirements

- ⚠️ **Git Required**: Projects must use Git
- 💡 **Auto-Initialize**: App prompts to run `git init` if needed

---

## Development Workflow

### Phase-Gate Quality Process

Every feature MUST follow this strict sequence:

```
1. 📝 Use Case Doc       → What and why
2. 🧪 Test Case Doc      → How to test
3. ❌ Write Tests (RED)  → Failing tests first
4. ✅ Implementation     → Make tests pass (GREEN)
5. ♻️  Refactor          → Improve code quality
6. 🔍 Code Review        → Automated agent review
7. ✓  Run All Tests      → Unit + E2E must pass
8. 🚀 Merge              → Only if everything passes
```

### Quality Gates

**Before ANY Merge**:
- ✅ All unit tests pass
- ✅ All E2E tests pass
- ✅ Code coverage ≥ 80%
- ✅ No linting errors
- ✅ Code review approved
- ✅ TypeScript strict mode (no `any`)

### Documentation-First Approach

Every feature needs:
1. **use-case.md** - User stories, acceptance criteria, success metrics
2. **test-case.md** - Unit, integration, and E2E test scenarios
3. **implementation.md** - Technical notes (optional)

Templates available in `docs/features/TEMPLATE-*.md`

---

## Project Structure

```
claude-code-manager/
├── apps/
│   ├── desktop/              # Tauri desktop app
│   │   ├── src/              # React frontend
│   │   │   ├── components/   # UI components
│   │   │   ├── hooks/        # React hooks
│   │   │   ├── stores/       # State management
│   │   │   └── lib/          # Utilities
│   │   └── src-tauri/        # Rust backend
│   │       ├── src/
│   │       │   ├── main.rs
│   │       │   └── commands.rs
│   │       └── Cargo.toml
│   └── web/                  # Web client (Phase 4)
│       └── src/
│
├── packages/
│   ├── server/               # Backend API server
│   │   ├── src/
│   │   │   ├── index.ts      # Entry point
│   │   │   ├── server.ts     # Fastify app
│   │   │   ├── routes/       # API routes
│   │   │   ├── services/     # Business logic
│   │   │   │   ├── session-manager.ts
│   │   │   │   ├── git-service.ts
│   │   │   │   └── claude-agent.ts
│   │   │   ├── db/           # Database
│   │   │   │   ├── schema.sql
│   │   │   │   └── client.ts
│   │   │   └── types/        # TypeScript types
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── shared/               # Shared types and utilities
│   │   ├── src/
│   │   │   ├── types/        # Shared TypeScript types
│   │   │   └── utils/        # Shared utilities
│   │   └── package.json
│   │
│   └── ui/                   # Shared UI components (optional)
│       └── src/
│
├── docs/
│   ├── features/             # Feature specs
│   │   ├── TEMPLATE-use-case.md
│   │   ├── TEMPLATE-test-case.md
│   │   └── 001-session-creation/
│   │       ├── use-case.md
│   │       └── test-case.md
│   ├── architecture/         # System design
│   │   ├── git-session-strategy.md
│   │   └── api-design.md
│   └── development/          # Dev guides
│       └── testing-guide.md
│
├── .claude/
│   └── commands/             # Claude Code slash commands
│       ├── start-feature.md  # /start-feature
│       ├── review-ready.md   # /review-ready
│       ├── session-guide.md  # /session-guide
│       └── architecture.md   # /architecture
│
├── CLAUDE.md                 # Project context (read by Claude Code)
├── GUIDELINES.md             # Development workflow
├── PROJECT-BLUEPRINT.md      # This file
├── README.md                 # Project overview
├── package.json              # Root package
├── pnpm-workspace.yaml       # Monorepo config
├── turbo.json                # Build pipeline
├── tsconfig.json             # TypeScript base config
├── biome.json                # Linting/formatting
├── .gitignore                # Git ignore
└── .env.example              # Environment template
```

---

## Data Model

### Database Schema (SQLite)

```sql
-- Sessions table
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                -- sess_abc123
  title TEXT NOT NULL,                -- "Add authentication"
  root_directory TEXT NOT NULL,       -- /path/to/project
  branch_name TEXT NOT NULL,          -- session/sess_abc123
  base_branch TEXT DEFAULT 'main',    -- main
  git_status TEXT,                    -- clean/modified/conflict
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_message_at TIMESTAMP,
  metadata JSON,                      -- { model, settings }
  is_active BOOLEAN DEFAULT 0
);

-- Messages table
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,                 -- user/assistant
  content TEXT NOT NULL,
  tool_calls JSON,                    -- File edits, bash commands
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Git state tracking
CREATE TABLE session_git_state (
  session_id TEXT PRIMARY KEY,
  current_commit TEXT,
  uncommitted_files JSON,
  stash_ref TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Settings table
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSON NOT NULL,
  scope TEXT,                         -- global / workspace:{path}
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Design

### REST Endpoints

```
# Sessions
POST   /api/sessions               Create new session
GET    /api/sessions               List all sessions
GET    /api/sessions/:id           Get session details
PATCH  /api/sessions/:id           Update session
DELETE /api/sessions/:id           Delete session

# Messages
GET    /api/sessions/:id/messages  Get session messages
POST   /api/sessions/:id/messages  Send message (starts stream)

# Git operations
GET    /api/sessions/:id/git       Get Git status
POST   /api/sessions/:id/git/merge Merge session to main
POST   /api/sessions/:id/git/checkout  Switch session branch

# Settings
GET    /api/settings               Get all settings
GET    /api/settings/:key          Get specific setting
PATCH  /api/settings               Update settings
```

### WebSocket (Message Streaming)

```
ws://localhost:3000/api/sessions/:id/stream

Client → Server:
{
  "type": "message",
  "content": "Add a login form"
}

Server → Client (streaming):
{
  "type": "content_chunk",
  "content": "I'll help you add..."
}

{
  "type": "tool_call",
  "tool": "write_file",
  "args": { "path": "login.tsx", "content": "..." }
}

{
  "type": "done"
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-3) - MVP

**Week 1: Project Setup**
- [x] Initialize monorepo with Turborepo
- [x] Configure TypeScript, linting, testing
- [x] Set up documentation structure
- [x] Create development guidelines
- [ ] Install dependencies

**Week 2: Backend Core**
- [ ] Database schema and SQLite client
- [ ] Session CRUD service
- [ ] Git service (check, create branch, checkout)
- [ ] Basic Fastify server with REST API
- [ ] Claude Agent SDK integration

**Week 3: Desktop App Basics**
- [ ] Tauri app skeleton
- [ ] Session list UI component
- [ ] Basic chat interface
- [ ] Connect to backend API
- [ ] Message display and input

### Phase 2: Core Features (Weeks 4-6)

**Week 4: Session Management**
- [ ] Create/delete/rename sessions in UI
- [ ] Root directory selection
- [ ] Git repository validation
- [ ] Session switching logic
- [ ] Active session indicator

**Week 5: Real-Time Chat**
- [ ] WebSocket integration
- [ ] Message streaming
- [ ] Tool call visualization
- [ ] File change previews
- [ ] Error handling and retry

**Week 6: Persistence & Resume**
- [ ] Save all messages to database
- [ ] Session state serialization
- [ ] Resume conversations
- [ ] Context reconstruction
- [ ] Search and filter sessions

### Phase 3: Polish (Weeks 7-9)

**Week 7: Settings Management**
- [ ] Settings UI panel
- [ ] Global settings (API key, model, theme)
- [ ] Workspace-specific settings
- [ ] Settings sync to backend
- [ ] Claude Code config integration

**Week 8: Enhanced UX**
- [ ] File explorer in session view
- [ ] Syntax highlighting for code
- [ ] Keyboard shortcuts
- [ ] Dark/light theme toggle
- [ ] System tray integration

**Week 9: Testing & Bug Fixes**
- [ ] Comprehensive E2E tests
- [ ] Performance optimization
- [ ] Bug fixes from testing
- [ ] Documentation updates
- [ ] Beta release preparation

### Phase 4: Self-Hosted (Weeks 10-12)

**Week 10: Web Client**
- [ ] Port desktop UI to web app
- [ ] Responsive design for mobile
- [ ] PWA support
- [ ] Deploy as static site

**Week 11: Multi-Device Access**
- [ ] Backend listens on 0.0.0.0
- [ ] mDNS discovery for LAN
- [ ] QR code for easy connection
- [ ] Session sync across devices

**Week 12: Security & Launch**
- [ ] Simple token authentication
- [ ] HTTPS with self-signed certs
- [ ] Rate limiting
- [ ] Audit logging
- [ ] v1.0 release

---

## Development Commands

### Slash Commands (for Claude Code sessions)

Use these in Claude Code while developing:

- `/start-feature` - Begin new feature with TDD workflow
- `/review-ready` - Run all quality checks before merge
- `/session-guide` - Show quick reference guide
- `/architecture` - Review system architecture

### Terminal Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm dev              # Start all packages in dev mode

# Testing
pnpm test             # Run all tests
pnpm test:unit        # Unit tests only
pnpm test:e2e         # E2E tests only
pnpm test:coverage    # Coverage report

# Code Quality
pnpm lint             # Check code style
pnpm lint:fix         # Auto-fix issues
pnpm typecheck        # TypeScript type checking

# Build
pnpm build            # Build all packages

# Clean
pnpm clean            # Remove build artifacts
```

---

## Key Design Decisions

### Why Tauri over Electron?

✅ **Smaller bundle**: ~10MB vs ~150MB
✅ **Better performance**: Native Rust backend
✅ **Lower memory**: Uses system webview
❌ **Smaller ecosystem**: Fewer resources

**Decision**: Tauri for native Mac app, can add Electron later for Windows if needed

### Why SQLite over PostgreSQL?

✅ **Zero configuration**: Embedded database
✅ **Portable**: Single file database
✅ **Fast for single-user**: No network overhead
❌ **No native networking**: But we have API layer

**Decision**: SQLite for local storage, can migrate to PostgreSQL for multi-user later

### Why Git Branches over Docker?

✅ **Lightweight**: No Docker daemon required
✅ **Familiar**: Developers know Git
✅ **Fast**: No container startup
❌ **Less isolation**: Shared system dependencies

**Decision**: Git branches for session isolation, Docker optional in future

### Why Fastify over Express?

✅ **Faster**: Better performance benchmarks
✅ **Modern**: Built for async/await
✅ **TypeScript**: First-class TS support
❌ **Smaller community**: Fewer plugins

**Decision**: Fastify for speed and TypeScript, Express valid alternative

---

## Success Metrics

### MVP Success Criteria (Phase 1-2)

- [ ] Create and manage sessions ✓
- [ ] Persistent conversation history ✓
- [ ] Run multiple sessions concurrently ✓
- [ ] Git branch isolation working ✓
- [ ] Claude Agent SDK integration ✓
- [ ] No crashes or data loss ✓

### V1.0 Success Criteria (Phase 3-4)

- [ ] Web client for mobile access ✓
- [ ] Settings management UI ✓
- [ ] < 500ms response latency ✓
- [ ] Polished, intuitive UI ✓
- [ ] 80%+ test coverage ✓
- [ ] Complete documentation ✓

### User Success Metrics

- **Session creation**: < 2 seconds
- **Message response**: Streams immediately
- **App startup**: < 1 second
- **Memory usage**: < 200MB idle
- **Reliability**: 99.9% uptime

---

## Getting Started

### For Developers Starting Work

1. **Read Core Documents**
   ```bash
   cat CLAUDE.md         # Project context
   cat GUIDELINES.md     # Workflow
   cat PROJECT-BLUEPRINT.md  # This file
   ```

2. **Set Up Environment**
   ```bash
   pnpm install
   cp .env.example .env
   # Add your ANTHROPIC_API_KEY to .env
   ```

3. **Start Claude Code Session**
   ```bash
   claude
   ```

4. **Use Slash Commands**
   ```
   /session-guide        # Get oriented
   /start-feature        # Begin first feature
   ```

5. **Follow TDD Workflow**
   - Write use case doc
   - Write test case doc
   - Write failing tests
   - Implement feature
   - Run `/review-ready`
   - Merge when all checks pass

### First Feature to Implement

**Suggested**: "Git Repository Validation Service"
- Small, well-defined scope
- Core functionality needed by other features
- Good for learning the workflow
- Lots of test cases to practice TDD

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Claude SDK API changes | High | Pin version, monitor releases |
| Git conflicts in concurrent sessions | Medium | Warn users, provide merge tools |
| SQLite database corruption | High | Regular backups, WAL mode |
| Lost API keys | Medium | Store in system keychain |
| Session state loss | High | Auto-save, transaction safety |

---

## References

### External Documentation

- [Claude Agent SDK](https://docs.claude.com/en/docs/claude-code/sdk/sdk-overview)
- [Tauri Documentation](https://tauri.app/)
- [Fastify Documentation](https://fastify.dev/)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)

### Internal Documentation

- `CLAUDE.md` - AI assistant project context
- `GUIDELINES.md` - Development workflow and standards
- `README.md` - User-facing project overview
- `docs/features/` - Feature specifications
- `docs/architecture/` - System design docs

---

## Next Steps

1. **Initialize Git Repository**
   ```bash
   cd claude-code-manager
   git init
   git add .
   git commit -m "Initial commit: Project blueprint"
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Start First Feature**
   - Read guidelines
   - Use `/start-feature`
   - Follow TDD workflow

4. **Build Incrementally**
   - One feature at a time
   - All tests passing before moving on
   - Documentation up to date

---

**Blueprint Status**: ✅ Complete - Ready to Build

This blueprint provides everything needed to start development. All decisions are documented, quality processes are defined, and the path forward is clear.

**Let's build something great!** 🚀
