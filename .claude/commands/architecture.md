# System Architecture Overview

Provide a comprehensive overview of the Claude Code Manager architecture.

## High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│         User Interfaces (Clients)               │
│  ┌──────────────┐         ┌──────────────┐     │
│  │ Desktop App  │         │  Web Client  │     │
│  │   (Tauri)    │         │   (React)    │     │
│  └──────────────┘         └──────────────┘     │
└────────────┬────────────────────┬───────────────┘
             │                    │
             │  HTTP/WebSocket    │
             │                    │
┌────────────▼────────────────────▼───────────────┐
│          Backend API Server                     │
│          (Node.js + TypeScript)                 │
│  ┌───────────────────────────────────────────┐  │
│  │  Session Manager Service                  │  │
│  │  • Create/Delete/Switch Sessions          │  │
│  │  • Git branch management                  │  │
│  │  • Multi-session coordination             │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │  Claude Agent Integration                 │  │
│  │  • @anthropic-ai/claude-agent-sdk         │  │
│  │  • Message streaming                      │  │
│  │  • Context management                     │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │  Git Service                              │  │
│  │  • Branch create/checkout/merge           │  │
│  │  • Status checking                        │  │
│  │  • Diff generation                        │  │
│  └───────────────────────────────────────────┘  │
└────────────┬───────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│         Storage Layer                           │
│  ┌──────────────┐         ┌──────────────┐     │
│  │   SQLite     │         │  Git Repos   │     │
│  │  Database    │         │ (File System)│     │
│  │              │         │              │     │
│  │ • Sessions   │         │ • Project    │     │
│  │ • Messages   │         │   files      │     │
│  │ • Settings   │         │ • Branches   │     │
│  └──────────────┘         └──────────────┘     │
└─────────────────────────────────────────────────┘
```

## Technology Stack

### Desktop App (Tauri)
- **Framework**: Tauri 2.x
- **Frontend**: React + TypeScript
- **Backend**: Rust
- **UI Library**: Shadcn UI / Radix UI
- **Styling**: TailwindCSS
- **State**: Zustand + TanStack Query

### Backend Server
- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.x
- **Framework**: Fastify
- **Database**: better-sqlite3
- **Validation**: Zod
- **Testing**: Vitest

### Integration
- **Claude SDK**: @anthropic-ai/claude-agent-sdk
- **Version Control**: Git (via simple-git)

## Git-Based Session Isolation

### Strategy

Each session maps to a Git branch:

```
Repository Root
├── .git/
├── main (branch)
│   └── [Clean baseline]
├── session/sess_abc123 (branch)
│   └── [Session 1 work]
├── session/sess_def456 (branch)
│   └── [Session 2 work]
└── session/sess_ghi789 (branch)
    └── [Session 3 work]
```

### Session Lifecycle

```
1. CREATE SESSION
   User: "New session: Add authentication"
   ↓
   Backend: Check if Git repo
   ↓
   Backend: Create branch session/sess_abc123 from main
   ↓
   Backend: Store session in DB
   ↓
   Backend: Initialize Claude Agent SDK
   ↓
   Frontend: Show session in sidebar

2. WORK IN SESSION
   User: Sends messages to Claude
   ↓
   Backend: Claude Agent SDK processes
   ↓
   Backend: File changes happen on session branch
   ↓
   Backend: Save messages to DB
   ↓
   Frontend: Display responses

3. SWITCH SESSION
   User: Clicks different session
   ↓
   Backend: Save current session state
   ↓
   Backend: git checkout session/sess_def456
   ↓
   Backend: Initialize Agent SDK for new session
   ↓
   Frontend: Load session messages from DB
   ↓
   Frontend: Display new session

4. CLOSE SESSION
   User: "Done with this session"
   ↓
   Backend: Offer options:
     - Merge to main
     - Keep branch for later
     - Delete branch
   ↓
   User chooses option
   ↓
   Backend: Execute Git operation
   ↓
   Backend: Update session status in DB
```

### Why Git Branches?

✅ **Natural isolation**: File changes don't conflict
✅ **Version control**: Built-in history per session
✅ **Familiar**: Developers already understand branches
✅ **Lightweight**: No Docker overhead
✅ **Mergeable**: Standard Git merge workflow

## Data Model

### Database Schema (SQLite)

```sql
-- Sessions
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
  metadata JSON,                      -- { model, settings, etc }
  is_active BOOLEAN DEFAULT 0
);

-- Messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,                 -- user/assistant
  content TEXT NOT NULL,
  tool_calls JSON,                    -- File edits, bash commands
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Git State
CREATE TABLE session_git_state (
  session_id TEXT PRIMARY KEY,
  current_commit TEXT,
  uncommitted_files JSON,
  stash_ref TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSON NOT NULL,
  scope TEXT,                         -- global / workspace:{path}
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Design

### REST Endpoints

```
POST   /api/sessions               Create new session
GET    /api/sessions               List all sessions
GET    /api/sessions/:id           Get session details
PATCH  /api/sessions/:id           Update session
DELETE /api/sessions/:id           Delete session

GET    /api/sessions/:id/messages  Get session messages
POST   /api/sessions/:id/messages  Send message (initiates stream)

GET    /api/sessions/:id/git       Get Git status
POST   /api/sessions/:id/git/merge Merge session to main

GET    /api/settings               Get settings
PATCH  /api/settings               Update settings
```

### WebSocket

```
ws://localhost:3000/api/sessions/:id/stream

Client → Server:
{
  "type": "message",
  "content": "Add a login form"
}

Server → Client:
{
  "type": "content_chunk",
  "content": "I'll help you add a login form..."
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

## Component Responsibilities

### Desktop App (Tauri)

**Frontend (React)**:
- Session list sidebar
- Chat interface
- Settings panel
- File explorer
- Message rendering

**Backend (Rust)**:
- IPC commands
- File system access
- Native OS integration
- System tray

### Backend Server

**Session Manager**:
- CRUD operations for sessions
- Session lifecycle management
- Concurrent session coordination

**Claude Agent Integration**:
- Initialize Agent SDK per session
- Stream messages
- Handle tool calls
- Manage context

**Git Service**:
- Check Git installation
- Verify Git repository
- Create/checkout branches
- Get status and diffs
- Merge branches

**Storage Service**:
- SQLite operations
- Message persistence
- Settings management

## Concurrency Model

### Multiple Active Sessions

```
Backend maintains pool of Agent SDK instances:

SessionPool {
  sessions: Map<SessionId, AgentInstance>

  getOrCreate(sessionId):
    if exists: return cached instance
    else: initialize new instance with session context

  sendMessage(sessionId, message):
    agent = getOrCreate(sessionId)
    return agent.stream(message)

  cleanup(sessionId):
    agent = sessions.get(sessionId)
    agent.dispose()
    sessions.delete(sessionId)
}
```

### Session Timeout

Idle sessions are cleaned up after 30 minutes:
- Agent SDK instance disposed
- Session marked inactive in DB
- Can be resumed later (reload from DB)

## File System Layout

```
~/.claude-code-manager/
├── data/
│   └── sessions.db           # SQLite database
├── config/
│   └── settings.json         # Global settings
└── logs/
    └── app.log               # Application logs

User's Project Directory:
/Users/user/my-project/
├── .git/                     # Git repository
│   ├── refs/heads/main
│   ├── refs/heads/session/sess_abc123
│   └── refs/heads/session/sess_def456
├── src/                      # Project files
└── ...
```

## Security Considerations

### API Authentication
- **Phase 1**: No auth (localhost only)
- **Phase 2**: Simple token-based auth
- **Phase 3**: OAuth2/JWT for multi-user

### File System Access
- Tauri security model restricts file access
- User must explicitly select directories
- No arbitrary file system access

### Anthropic API Key
- Stored in system keychain (via Tauri)
- Never exposed to frontend
- Backend handles all API calls

## Performance Considerations

### Lazy Loading
- Session list: Load metadata only
- Messages: Load on-demand per session
- Git operations: Cache status

### Streaming
- WebSocket for real-time updates
- Chunked message delivery
- Backpressure handling

### Database
- SQLite WAL mode for concurrency
- Indexes on foreign keys
- Prepared statements

## Scalability

### Current Design (Single User)
- Local SQLite database
- Single backend process
- Multiple Agent SDK instances

### Future Multi-User
- PostgreSQL for shared state
- Redis for session management
- Horizontal scaling of backend

## Development Architecture

### Monorepo Structure

```
claude-code-manager/
├── apps/
│   ├── desktop/      # Tauri app
│   └── web/          # Web client
├── packages/
│   ├── server/       # Backend API
│   ├── shared/       # Shared types
│   └── ui/           # Shared components
└── docs/             # Documentation
```

### Build System
- **Turborepo**: Monorepo orchestration
- **PNPM**: Package management
- **TypeScript**: Type checking
- **Vitest**: Unit testing
- **Playwright**: E2E testing

## Deployment

### Desktop App
- Tauri builds native binary
- Embedded backend server
- Auto-updates via Tauri updater

### Self-Hosted
- Backend runs as service
- Web client served as static files
- Access via LAN or Tailscale

---

For more details, see:
- `.claude/architecture/git-session-strategy.md`
- `.claude/architecture/api-design.md`
- `.claude/architecture/data-model.md`
