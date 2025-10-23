# Claude Code Manager - Project Context

## Project Overview

**Claude Code Manager** is a self-hosted, GUI-based session manager for Claude Code that provides:
- Persistent conversation history across sessions
- Multi-session support with Git-based isolation
- Claude.ai-like interface running locally on Mac
- Self-hosted backend for multi-device access (Mac, iPhone, etc.)
- Easy settings management for Claude Code

## Core Architecture

### Technology Stack
- **Desktop**: Tauri 2.x (Rust + React/TypeScript)
- **Backend**: Node.js + TypeScript + Fastify
- **Storage**: SQLite + File System
- **Integration**: Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
- **Testing**: Vitest (unit) + Playwright (e2e)

### System Components

```
Desktop App (Tauri) ←→ Backend API (Node.js) ←→ Claude Agent SDK ←→ Anthropic API
                             ↓
                        SQLite + Git
```

## Git-Based Session Strategy

**KEY CONCEPT**: Each session = isolated Git branch

### How It Works
1. User creates session → Create branch `session/{session-id}` from `main`
2. All changes happen on session branch → Automatic isolation
3. Switch sessions → Git checkout different branch
4. Close session → Merge to main, keep branch, or delete

### Requirements
- **Only Git repositories supported**: Projects must use Git
- If no Git: Prompt user to initialize (`git init`)
- Never mix sessions: One active branch per session

### Session Lifecycle
```
main
 ├─ session/sess_abc123  (Session 1: "Add authentication")
 ├─ session/sess_def456  (Session 2: "Refactor API")
 └─ session/sess_ghi789  (Session 3: "Fix bug #123")
```

## Development Workflow (MANDATORY)

### Phase-Gate Quality Process

Every feature MUST follow this sequence:

```
1. Use Case Document     → Define expected behavior
2. Test Case Document    → Define test scenarios
3. Write Tests (TDD)     → Write failing tests first
4. Implementation        → Write code to pass tests
5. Code Review           → Run code-reviewer agent
6. Run All Tests         → Unit + E2E must pass
7. Merge                 → Only if all checks pass ✓
```

### Document Structure

```
docs/
├── features/
│   ├── {feature-number}-{feature-name}/
│   │   ├── use-case.md          ← What it does
│   │   ├── test-case.md         ← How to test it
│   │   └── implementation.md    ← Technical notes
│   └── TEMPLATE-*.md            ← Templates for new features
└── architecture/
    └── *.md                     ← System design docs
```

### Rules
- ❌ **NO CODE without tests**
- ❌ **NO MERGE without passing tests**
- ❌ **NO SKIP code review**
- ✅ **YES to TDD** (Test-Driven Development)
- ✅ **YES to documentation first**

## Testing Requirements

### Unit Tests (Vitest)
- **Coverage Target**: 80% minimum
- **Location**: `*.test.ts` next to implementation
- **Run Before Commit**: Always

```bash
pnpm test:unit
```

### E2E Tests (Playwright)
- **Critical User Flows**: Must be tested
- **Location**: `apps/*/e2e/`
- **Run Before Merge**: Always

```bash
pnpm test:e2e
```

### Test-Driven Development (TDD)
1. Write test that fails (Red)
2. Write minimal code to pass (Green)
3. Refactor (Refactor)
4. Repeat

## Code Standards

### TypeScript
- **Strict Mode**: Enabled
- **No `any`**: Use proper types or `unknown`
- **Zod Schemas**: For runtime validation

### Naming Conventions
- **Files**: `kebab-case.ts`
- **Components**: `PascalCase.tsx`
- **Functions**: `camelCase()`
- **Constants**: `UPPER_SNAKE_CASE`
- **Types**: `PascalCase` (prefix with `T` for type-only)

### Git Commits
- **Format**: `type(scope): description`
- **Types**: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`
- **Example**: `feat(sessions): add Git branch creation`

## Project Structure

```
claude-code-manager/
├── apps/
│   ├── desktop/              # Tauri app (Rust + React)
│   └── web/                  # Web client (React)
├── packages/
│   ├── server/               # Backend API (Node.js + TS)
│   ├── shared/               # Shared types and utils
│   └── ui/                   # Shared UI components
├── docs/
│   ├── features/             # Feature specs and test cases
│   ├── architecture/         # System design
│   └── development/          # Dev guides
├── .claude/
│   └── commands/             # Project slash commands
├── CLAUDE.md                 # This file
└── GUIDELINES.md             # Detailed workflow guide
```

## Key Features

### 1. Session Management
- Create/delete/rename sessions
- List all sessions (like Claude.ai left panel)
- Switch between active sessions
- Each session has isolated Git branch

### 2. Conversation Persistence
- All messages saved to SQLite
- Resume conversations from any session
- Context preserved across app restarts

### 3. Multi-Session Support
- Run multiple sessions concurrently
- Each session on separate Git branch
- Backend manages Agent SDK instances

### 4. Settings Management
- Global settings (API keys, model, theme)
- Workspace settings (per-project configs)
- UI for editing settings easily

### 5. Self-Hosted Access
- Backend API server (Fastify)
- Access from Mac desktop app
- Access from web client (iPhone, iPad, other devices)
- mDNS discovery on LAN

## Slash Commands

Use these commands in Claude Code sessions:

- `/start-feature` - Begin new feature with TDD workflow
- `/review-ready` - Run code review and all tests before merge
- `/session-guide` - Show session-specific guidelines
- `/architecture` - Review system architecture

## Common Tasks

### Starting a New Feature
```bash
# 1. Run slash command
/start-feature

# 2. Follow prompts to create use-case and test-case docs
# 3. Write tests first
# 4. Implement feature
# 5. Run /review-ready before merging
```

### Before Merging
```bash
# Run this command - it will:
# - Run code-reviewer agent
# - Run all unit tests
# - Run all e2e tests
# - Check test coverage
# - Verify no linting errors
/review-ready
```

## External Resources

- **Claude Agent SDK**: https://docs.claude.com/en/docs/claude-code/sdk/sdk-overview
- **Tauri Docs**: https://tauri.app/
- **Fastify Docs**: https://fastify.dev/

## Session Initialization

When starting a development session:

1. Read this file (CLAUDE.md)
2. Read GUIDELINES.md for detailed workflow
3. Review current feature docs in `docs/features/`
4. Check Git branch (`git branch --show-current`)
5. Verify tests pass before starting (`pnpm test`)

---

**Remember**: Quality over speed. Every line of code should be tested, reviewed, and documented.
