# Ready - Become Instant Project Expert

Load all project context, architecture, workflow, and work history to become instantly ready to work on this project with complete understanding.

## What This Does

This command makes you an **instant expert** by loading:
- ✅ Project vision and goals
- ✅ Complete architecture understanding
- ✅ Development workflow and quality standards
- ✅ Current implementation status
- ✅ Full work history and progress
- ✅ All features and documentation
- ✅ Current session context

After running `/ready`, you can answer ANY question about this project with accuracy and confidence.

---

## Context Loading Sequence

### 1. Core Project Documentation

Read foundational documents:

**CLAUDE.md** - Project overview, architecture, workflow
**.claude/development/GUIDELINES.md** - Detailed development process, TDD, quality gates
**README.md** - Project introduction and setup

### 2. Work History & Progress

Check all progress and history:

**.claude/development/PROGRESS.md** - Track record of what's been accomplished
**.claude/testing/TESTING.md** - Testing status and coverage reports
**.claude/development/PHASE-*-SUMMARY.md** - Phase completion summaries

View recent commits:
```bash
git log --oneline -20
```

### 3. Current Session State

Understand where we are now:

```bash
# Current branch
git branch --show-current

# Last commit
git log -1 --oneline

# Files changed in this session
git diff --name-only main..HEAD

# Uncommitted changes
git status --short
```

### 4. Architecture Deep Dive

Review complete system architecture:

Read `.claude/commands/architecture.md` - Complete architecture documentation

Understand:
- Technology stack and why each was chosen
- Git-based session isolation strategy
- Data model and API design
- Component responsibilities
- Concurrency model

### 5. Feature Documentation

Review all implemented and planned features:

```bash
# List all feature docs
ls -la .claude/features/

# Read each feature's use-case.md, test-case.md, implementation.md
```

Key features to understand:
- Session management (create/delete/switch)
- Git branch integration
- Conversation persistence
- Settings management
- Multi-session support

### 6. Codebase Structure

Map out the code organization:

```
claude-code-manager/
├── apps/
│   ├── desktop/          # Tauri (Rust + React)
│   └── web/              # Web client (React)
├── packages/
│   ├── server/           # Backend API (Node.js + TS)
│   ├── shared/           # Shared types/utils
│   └── ui/               # Shared components
├── docs/
│   ├── features/         # Feature specs
│   └── architecture/     # System design
└── .claude/
    └── commands/         # This file!
```

Check implementation status:
```bash
# Count source files
find packages apps -name "*.ts" -o -name "*.tsx" | grep -v node_modules | wc -l

# Count test files
find packages apps -name "*.test.ts" | grep -v node_modules | wc -l
```

### 7. Quality Status

Check testing and quality metrics:

```bash
# Test configuration
ls -la *config.ts vitest.config.ts playwright.config.ts 2>/dev/null

# Check package.json for test scripts
grep -A 5 '"scripts"' package.json | grep test
```

### 8. Dependencies & Integrations

Verify key dependencies are installed:

```bash
# Claude Agent SDK
grep "@anthropic-ai/claude-agent-sdk" package.json

# Tauri
grep "@tauri-apps" package.json

# Fastify
grep "fastify" apps/server/package.json
```

---

## Expert Knowledge Acquired

After running `/ready`, you will know:

### 🎯 Project Vision
- **What**: Self-hosted, GUI-based session manager for Claude Code
- **Why**: Persistent conversations, multi-session support, Git isolation
- **Who**: Developers wanting Claude.ai experience locally
- **Innovation**: Git branches for session isolation (unique approach!)

### 🏗️ Architecture
- **Desktop**: Tauri 2.x (Rust + React/TypeScript)
- **Backend**: Node.js + TypeScript + Fastify
- **Storage**: SQLite (messages) + Git (session isolation)
- **Integration**: Claude Agent SDK
- **Testing**: Vitest (unit) + Playwright (e2e)

### 📋 Development Workflow

**Phase-Gate Process** (MANDATORY):
```
1. Use Case Doc → 2. Test Case Doc → 3. Write Tests (TDD) →
4. Implementation → 5. Code Review → 6. Full Test Suite → 7. Merge
```

**Quality Standards**:
- ❌ No code without tests
- ❌ No merge without 80% coverage
- ❌ No skip code review
- ✅ Documentation before code
- ✅ TDD mandatory

### 🔧 Git-Based Session Strategy

**Core Innovation**: Each session = isolated Git branch

```
main
 ├─ session/sess_abc123  (Session 1: "Add authentication")
 ├─ session/sess_def456  (Session 2: "Refactor API")
 └─ session/sess_ghi789  (Session 3: "Fix bug #123")
```

**Benefits**:
- Natural file isolation
- Built-in version control per session
- Easy to merge/discard changes
- No container overhead
- Familiar Git workflow

### 📊 Current Status

Review and report:
- Current development phase
- Active session branch
- Recent accomplishments (from docs/development/PROGRESS.md)
- Next planned features
- Test coverage status

### 💻 Code Standards

- **Files**: `kebab-case.ts`
- **Components**: `PascalCase.tsx`
- **Functions**: `camelCase()`
- **Constants**: `UPPER_SNAKE_CASE`
- **Types**: `PascalCase`
- **Commits**: `type(scope): description`

### 🧪 Testing Requirements

- **Unit Tests**: Vitest, `*.test.ts` next to implementation
- **E2E Tests**: Playwright, `apps/*/e2e/`
- **Coverage**: 80% minimum
- **TDD**: Red → Green → Refactor

---

## Summary Report Template

After loading all context, provide this structured summary:

```markdown
# 🚀 Ready - Project Expert Mode Activated

## 📌 Project Identity
Claude Code Manager is a [complete description in 1-2 sentences]

## 📍 Current Status
- **Phase**: [Current development phase]
- **Branch**: `[current-branch-name]`
- **Last Commit**: [commit message]
- **Active Work**: [what's being developed now]
- **Files Changed**: [N files modified/added]

## 🏗️ Architecture at a Glance
[3-5 key architectural decisions with brief explanations]

1. **Git-Based Session Isolation**: Each session = Git branch for natural isolation
2. **[Another key decision]**: [Why it matters]
3. ...

## 🛠️ Technology Stack
| Layer | Technology | Purpose |
|-------|------------|---------|
| Desktop | Tauri 2.x | Native Mac app with web frontend |
| Frontend | React + TS | UI components and state |
| Backend | Node.js + Fastify | API server and Agent SDK integration |
| Database | SQLite | Conversation persistence |
| Integration | Claude Agent SDK | Official Anthropic integration |
| Testing | Vitest + Playwright | Unit + E2E tests |

## 📈 Progress Summary
[From PROGRESS.md - recent accomplishments]

**Completed**:
- ✅ [Feature 1]
- ✅ [Feature 2]

**In Progress**:
- 🔄 [Current work]

**Next**:
- 📋 [Upcoming features]

## 📊 Quality Metrics
- **Code Coverage**: [X]% (target: 80%)
- **Test Files**: [N] test files
- **Documented Features**: [N] features
- **Open Issues**: [N] (if tracked)

## 🎯 Development Philosophy
1. **Quality over speed**: Every line tested, reviewed, documented
2. **TDD mandatory**: Write tests before code
3. **Phase-gate process**: No skipping steps
4. **Documentation first**: Define behavior before implementation

## 🧠 I Am Now Expert In

✅ Complete project architecture and design decisions
✅ Git-based session isolation strategy
✅ Development workflow and quality gates
✅ Current implementation status and history
✅ Technology stack and integration points
✅ Testing requirements and standards
✅ Code standards and conventions
✅ Feature roadmap and priorities

## 💬 Ready to Answer

I can now accurately answer questions like:
- "Why use Git branches instead of containers?"
- "How does session switching work?"
- "What's the data model for conversations?"
- "How is the Claude Agent SDK integrated?"
- "What testing is required before merge?"
- "How do I start a new feature?"
- Any other question about architecture, code, process, or status!

---

**Status**: 🟢 READY - I am now a complete expert on this project!
```

---

## When to Use `/ready`

Run this command:

- ✅ **At start of every session** - Load full context
- ✅ **After a break** - Refresh your memory
- ✅ **When answering questions** - Ensure accurate responses
- ✅ **Before planning work** - Understand current state
- ✅ **When reviewing code** - Full context for review
- ✅ **When stuck** - Reconnect with project vision

## What You Gain

After `/ready`, you will:

1. **Understand the vision** - Why this project exists
2. **Know the architecture** - How everything fits together
3. **Follow the workflow** - Proper development process
4. **See the history** - What's been built and why
5. **Track the progress** - Where we are and what's next (from .claude/development/PROGRESS.md)
6. **Apply standards** - Code quality requirements
7. **Answer anything** - Complete expert knowledge

---

**Result**: You are instantly ready to work on this project with complete context, deep understanding, and accurate knowledge of everything from vision to implementation details.
