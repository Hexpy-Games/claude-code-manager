# Testing Guide - Claude Code Manager

> **Important**: This project uses **Claude Code CLI in headless mode**, NOT direct Anthropic API calls.
> No API key configuration is needed in the app - Claude CLI manages authentication.

## Architecture Overview

```
Desktop App (Tauri + React)
       ↓ HTTP/WebSocket
Backend Server (Fastify)
       ↓ subprocess exec
Claude Code CLI (headless mode)
       ↓ authenticated requests
Anthropic API
```

---

## Prerequisites

### 1. Claude Code CLI Installation

The backend requires Claude Code CLI to be installed and configured:

```bash
# Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Configure your API key (one-time setup)
claude configure

# Verify installation
claude --version
```

### 2. Development Tools

- **Node.js** 18+
- **pnpm** 8+
- **Rust** (for Tauri)
- **Git**

---

## Quick Start

### Option 1: Automated Startup (macOS)

```bash
# Make script executable (first time only)
chmod +x start-dev.sh

# Start both backend and desktop app
./start-dev.sh
```

This script will:
- ✅ Check Claude CLI is installed
- ✅ Create .env if needed
- ✅ Start backend server in new terminal
- ✅ Start desktop app in new terminal
- ✅ Open the Tauri desktop window

### Option 2: Manual Startup

**Terminal 1 - Backend Server:**
```bash
cd /Users/yeonwoo/dev/claude-code-manager
pnpm --filter @claude-code-manager/server dev
```

Wait for: `✅ Server listening on http://0.0.0.0:3000`

**Terminal 2 - Desktop App:**
```bash
cd /Users/yeonwoo/dev/claude-code-manager/apps/desktop
pnpm dev
```

The Tauri desktop window should open automatically.

---

## Running Tests

### Unit Tests

```bash
# Run all unit tests
pnpm test

# Run backend tests only
pnpm --filter @claude-code-manager/server test

# Run frontend tests only
pnpm --filter @claude-code-manager/desktop test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage
```

**Current Test Stats:**
- ✅ Backend: 232 tests passing, 5 skipped (237 total)
- ✅ Frontend: 170 tests passing (15 test files)
- ✅ Total: 402 tests passing
- ✅ Coverage: 95.6% overall

### E2E Tests

E2E tests use Playwright and test the full application stack:

```bash
# Run E2E tests (headless)
cd apps/desktop
pnpm test:e2e

# Run E2E tests with UI
pnpm test:e2e:ui

# Run E2E tests in debug mode
pnpm test:e2e:debug
```

**E2E Test Coverage:**
- ✅ App loads and displays UI
- ✅ Session list renders correctly
- ✅ Settings panel functionality
- ✅ Empty states display
- ✅ Loading states work

### Type Checking

```bash
# Check types across all packages
pnpm typecheck
```

### Linting

```bash
# Lint all packages
pnpm lint

# Auto-fix linting issues
pnpm lint:fix
```

---

## Manual Testing Checklist

### 1. Backend Health Check

```bash
# With backend running, verify health endpoint
curl http://localhost:3000/health

# Expected response:
{"status":"ok"}
```

### 2. Desktop App Smoke Test

With both backend and desktop app running:

**Session Management:**
- [ ] Click "New Session" button
- [ ] Fill in session title (e.g., "Test Session")
- [ ] Select a Git repository path
- [ ] Click "Create" - session should appear in left sidebar
- [ ] Click on the session to activate it
- [ ] Session should show active indicator
- [ ] Click delete button on session
- [ ] Confirm deletion dialog
- [ ] Session should be removed

**Chat Interface:**
- [ ] Select an active session
- [ ] Type a message in the input field
- [ ] Press Enter or click Send
- [ ] Message should appear in chat area
- [ ] Wait for Claude's response (may take a few seconds)
- [ ] Response should stream in
- [ ] Both messages should be saved

**Settings Panel:**
- [ ] Click "Settings" button in header
- [ ] Verify API key notice is displayed
- [ ] Change model selection
- [ ] Change theme selection
- [ ] Click "Save"
- [ ] Success message should appear
- [ ] Click "Chat" to return to chat view

**Empty States:**
- [ ] With no sessions: verify "No sessions yet" message
- [ ] With no messages in session: verify "No messages yet" message
- [ ] With no active session: verify "Select a session to start chatting"

**Error Handling:**
- [ ] Stop backend server
- [ ] Try to create a session
- [ ] Should show error message with network error
- [ ] Restart backend
- [ ] App should recover and work normally

---

## Troubleshooting

### Backend Won't Start

```bash
# Check Claude CLI is installed
claude --version

# If not installed:
npm install -g @anthropic-ai/claude-code

# Configure API key
claude configure

# Check Claude CLI is working
claude -p "Hello" --output-format stream-json
```

### Desktop App Can't Connect to Backend

```bash
# Verify backend is running
curl http://localhost:3000/health

# Check backend logs for errors
# (should be visible in Terminal 1)

# Verify port 3000 is not in use by another process
lsof -i :3000
```

### Tests Failing

```bash
# Clean and reinstall dependencies
pnpm clean
pnpm install

# Run tests with verbose output
pnpm test -- --reporter=verbose

# Check for TypeScript errors
pnpm typecheck
```

### E2E Tests Timing Out

```bash
# Ensure both servers can start
pnpm --filter @claude-code-manager/server dev  # Terminal 1
pnpm --filter @claude-code-manager/desktop dev  # Terminal 2

# Verify Playwright browsers are installed
cd apps/desktop
npx playwright install
```

---

## Development Workflow

### Making Changes

1. **Create feature branch** (if using Git)
2. **Write tests first** (TDD approach)
3. **Implement feature**
4. **Run quality checks:**
   ```bash
   pnpm typecheck  # Type safety
   pnpm lint       # Code style
   pnpm test       # Unit tests
   ```
5. **Manual testing** with app running
6. **Commit changes**

### Before Pushing

```bash
# Run full quality check
pnpm typecheck && pnpm lint && pnpm test

# Expected result: All checks passing
```

---

## Performance Testing

### Backend Performance

```bash
# Test backend response time
time curl http://localhost:3000/health

# Load test (requires `ab` or `wrk`)
ab -n 100 -c 10 http://localhost:3000/health
```

### Frontend Performance

- Open DevTools (F12) in desktop app
- Check Network tab for request timing
- Check Performance tab for rendering issues
- Monitor memory usage in Task Manager

---

## Security Testing

### CORS Configuration

Backend is configured to allow all origins in development:

```typescript
// packages/server/src/server.ts
corsOrigin: true  // Development only!
```

**For production**, this should be restricted:

```typescript
corsOrigin: ['https://yourdomain.com', 'tauri://localhost']
```

### Content Security Policy

Tauri CSP is currently set to `null` for development:

```json
// apps/desktop/src-tauri/tauri.conf.json
"security": {
  "csp": null
}
```

**For production**, define a strict CSP.

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
```

---

## Test Data Management

### Database Location

- **Development**: `~/.claude-code-manager/data/sessions.db`
- **Tests**: In-memory SQLite database (`:memory:`)

### Cleaning Test Data

```bash
# Remove development database
rm -f ~/.claude-code-manager/data/sessions.db

# Database will be recreated on next backend start
```

---

## Debugging

### Backend Debugging

```bash
# Start with debug logging
LOG_LEVEL=debug pnpm --filter @claude-code-manager/server dev

# Enable Node.js inspector
node --inspect packages/server/dist/index.js
```

### Frontend Debugging

```bash
# Open DevTools in Tauri app
# macOS: Cmd+Opt+I
# Windows/Linux: Ctrl+Shift+I

# Or enable remote debugging
RUST_LOG=debug pnpm dev
```

### Claude CLI Debugging

```bash
# Test Claude CLI directly
claude -p "Test message" --output-format stream-json

# Check Claude CLI logs
cat ~/.claude/logs/latest.log
```

---

## Additional Resources

- **Tauri Docs**: https://tauri.app/
- **Fastify Docs**: https://fastify.dev/
- **Playwright Docs**: https://playwright.dev/
- **Vitest Docs**: https://vitest.dev/
- **Claude Code Docs**: https://docs.claude.com/claude-code

---

**Questions or Issues?**

Check the [GUIDELINES.md](./GUIDELINES.md) for development workflow, or open an issue on GitHub.
