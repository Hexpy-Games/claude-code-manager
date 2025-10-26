# MVP Roadmap - Claude Code Manager

> **Goal**: Working desktop app where users can create sessions, chat with Claude, and have conversations persist
> **Timeline**: 3-4 weeks (aggressive) / 6-8 weeks (comfortable)
> **Success Criteria**: User can manage multiple Claude Code sessions with Git isolation and persistent history

---

## MVP Core Features

### What's IN the MVP ✅

1. **Session Management**
   - Create new session (with Git branch)
   - List all sessions
   - Switch between sessions
   - Delete session

2. **Git Integration**
   - Check if directory is Git repo
   - Create session branch from main
   - Checkout session branch when switching

3. **Chat Interface**
   - Send messages to Claude
   - Display streaming responses
   - Show tool calls (file edits, bash commands)
   - Message history

4. **Persistence**
   - Save all messages to SQLite
   - Load conversation history when opening session
   - Resume from where you left off

5. **Basic Desktop UI**
   - Session list sidebar
   - Chat interface
   - Simple settings (API key, model)

### What's OUT of MVP ❌

- ❌ Multiple concurrent sessions (run one at a time)
- ❌ File explorer integration
- ❌ Web client / multi-device access
- ❌ Advanced settings
- ❌ Keyboard shortcuts
- ❌ System tray integration
- ❌ Session search/filter
- ❌ Git merge UI
- ❌ Context summarization
- ❌ Auto-updates

---

## Phase 0: Foundation (Week 0 - Setup)

**Goal**: Development environment ready

### Tasks

#### 0.1 Install Dependencies ⏱️ 30 min
```bash
pnpm install
```

**Success**: No errors, all packages installed

#### 0.2 Set Up Environment ⏱️ 15 min
```bash
cp .env.example .env
# Add ANTHROPIC_API_KEY
```

**Success**: `.env` file created with API key

#### 0.3 Verify TypeScript Setup ⏱️ 15 min
```bash
pnpm typecheck
```

**Success**: TypeScript compiles without errors

#### 0.4 Create First Test ⏱️ 30 min
- Create a simple test to verify testing setup works
- Run `pnpm test:unit`

**Success**: Test suite runs

**Total Week 0**: ~2 hours

---

## Phase 1: Backend Core (Week 1)

**Goal**: Backend API that can manage sessions and integrate with Claude SDK

### 1.1 Database Setup ⏱️ 4-6 hours

**Feature**: `001-database-setup`

#### Tasks
1. **Use Case Document** (30 min)
   - Document database schema
   - Define CRUD operations

2. **Test Cases** (1 hour)
   - Unit tests for database client
   - Test session CRUD
   - Test message persistence

3. **Implementation** (2-3 hours)
   - Create `apps/server/src/db/schema.sql`
   - Create `apps/server/src/db/client.ts`
   - Implement SQLite connection with better-sqlite3
   - Create migrations system (simple)

4. **Code Review & Tests** (1 hour)

**Files**:
```
apps/server/src/
├── db/
│   ├── schema.sql
│   ├── client.ts
│   └── client.test.ts
```

**Success Criteria**:
- ✅ Database creates tables
- ✅ Can insert/query sessions
- ✅ Can insert/query messages
- ✅ Tests pass with 80%+ coverage

---

### 1.2 Git Service ⏱️ 6-8 hours

**Feature**: `002-git-service`

#### Tasks
1. **Use Case Document** (1 hour)
   - Document Git operations needed
   - Define error cases

2. **Test Cases** (1.5 hours)
   - Test Git installation check
   - Test repository validation
   - Test branch creation
   - Test branch checkout
   - Test error scenarios

3. **Implementation** (3-4 hours)
   - Create `apps/server/src/services/git-service.ts`
   - Implement using `simple-git` library
   - Methods:
     - `checkGitInstalled()`
     - `isGitRepo(path)`
     - `initRepo(path)`
     - `createBranch(name, base)`
     - `checkoutBranch(name)`
     - `getCurrentBranch()`
     - `getBranchList()`

4. **Code Review & Tests** (1.5 hours)

**Files**:
```
apps/server/src/
├── services/
│   ├── git-service.ts
│   └── git-service.test.ts
```

**Success Criteria**:
- ✅ All Git operations work
- ✅ Error handling for missing Git
- ✅ Error handling for non-Git directories
- ✅ Tests pass with 80%+ coverage

---

### 1.3 Session Manager Service ⏱️ 8-10 hours

**Feature**: `003-session-manager`

#### Tasks
1. **Use Case Document** (1 hour)
   - Session lifecycle
   - State management

2. **Test Cases** (2 hours)
   - Test session creation
   - Test session retrieval
   - Test session deletion
   - Test session switching
   - Test error cases

3. **Implementation** (4-5 hours)
   - Create `apps/server/src/services/session-manager.ts`
   - Methods:
     - `createSession(title, rootDirectory)`
     - `getSession(id)`
     - `listSessions()`
     - `deleteSession(id)`
     - `switchSession(id)`
   - Integrate with GitService and Database

4. **Code Review & Tests** (2 hours)

**Files**:
```
apps/server/src/
├── services/
│   ├── session-manager.ts
│   └── session-manager.test.ts
```

**Success Criteria**:
- ✅ Can create session with Git branch
- ✅ Can list all sessions
- ✅ Can delete session
- ✅ Database updated correctly
- ✅ Tests pass with 80%+ coverage

---

### 1.4 Claude Agent Integration ⏱️ 6-8 hours

**Feature**: `004-claude-agent-integration`

#### Tasks
1. **Use Case Document** (1 hour)
   - Message sending/receiving
   - Streaming responses
   - Tool call handling

2. **Test Cases** (1.5 hours)
   - Test message sending (mocked SDK)
   - Test response handling
   - Test streaming
   - Test tool calls

3. **Implementation** (3-4 hours)
   - Create `apps/server/src/services/claude-agent.ts`
   - Initialize Claude Agent SDK
   - Methods:
     - `sendMessage(sessionId, message)`
     - `streamMessage(sessionId, message)` (returns async iterator)
   - Save messages to database

4. **Code Review & Tests** (1.5 hours)

**Files**:
```
apps/server/src/
├── services/
│   ├── claude-agent.ts
│   └── claude-agent.test.ts
```

**Success Criteria**:
- ✅ Can send message to Claude
- ✅ Can receive streaming response
- ✅ Tool calls captured
- ✅ Messages saved to database
- ✅ Tests pass (with mocked SDK)

---

### 1.5 REST API Routes ⏱️ 6-8 hours

**Feature**: `005-rest-api`

#### Tasks
1. **Use Case Document** (1 hour)
   - API endpoint specifications
   - Request/response schemas

2. **Test Cases** (1.5 hours)
   - Integration tests for each endpoint
   - Test error responses

3. **Implementation** (3-4 hours)
   - Create `apps/server/src/server.ts` (Fastify app)
   - Create routes:
     - `POST /api/sessions` - Create session
     - `GET /api/sessions` - List sessions
     - `GET /api/sessions/:id` - Get session
     - `DELETE /api/sessions/:id` - Delete session
     - `GET /api/sessions/:id/messages` - Get messages
   - Validation with Zod

4. **Code Review & Tests** (1.5 hours)

**Files**:
```
apps/server/src/
├── server.ts
├── routes/
│   ├── sessions.ts
│   ├── sessions.test.ts
│   ├── messages.ts
│   └── messages.test.ts
└── index.ts (entry point)
```

**Success Criteria**:
- ✅ All endpoints work
- ✅ Request validation
- ✅ Error responses formatted
- ✅ Integration tests pass

---

### 1.6 WebSocket for Streaming ⏱️ 4-6 hours

**Feature**: `006-websocket-streaming`

#### Tasks
1. **Use Case Document** (30 min)
   - WebSocket protocol
   - Message format

2. **Test Cases** (1 hour)
   - Test WebSocket connection
   - Test message streaming
   - Test disconnect handling

3. **Implementation** (2-3 hours)
   - Add `@fastify/websocket`
   - Create WebSocket route: `ws://localhost:3000/api/sessions/:id/stream`
   - Stream Claude responses to client

4. **Code Review & Tests** (1.5 hours)

**Files**:
```
apps/server/src/
├── routes/
│   ├── stream.ts
│   └── stream.test.ts
```

**Success Criteria**:
- ✅ WebSocket connection works
- ✅ Messages stream in real-time
- ✅ Client receives all chunks
- ✅ Proper error handling

---

**Total Phase 1**: ~35-45 hours (1 week full-time, 2 weeks part-time)

**Phase 1 Milestone**: Backend server running, API tested, can create sessions and send messages via API/WebSocket

---

## Phase 2: Desktop UI Basics (Week 2)

**Goal**: Basic Tauri app with session list and chat interface

### 2.1 Tauri Project Setup ⏱️ 3-4 hours

**Feature**: `007-tauri-setup`

#### Tasks
1. **Initialize Tauri App** (1 hour)
   ```bash
   cd apps/desktop
   pnpm create tauri-app
   ```
   - Choose React + TypeScript
   - Configure build

2. **Configure Tauri** (1 hour)
   - Set app name, identifier
   - Configure window size
   - Set up permissions

3. **Basic App Structure** (1-2 hours)
   - Create component folders
   - Set up routing (if needed)
   - Configure TailwindCSS + Shadcn UI

**Files**:
```
apps/desktop/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/
│   └── lib/
├── src-tauri/
│   ├── src/main.rs
│   ├── tauri.conf.json
│   └── Cargo.toml
└── package.json
```

**Success Criteria**:
- ✅ Tauri app opens
- ✅ Window displays
- ✅ Can build for development

---

### 2.2 API Client ⏱️ 3-4 hours

**Feature**: `008-api-client`

#### Tasks
1. **Create API Client** (2 hours)
   - Create `apps/desktop/src/lib/api-client.ts`
   - Methods for all REST endpoints
   - WebSocket client for streaming

2. **Test API Client** (1-2 hours)
   - Mock backend responses
   - Test each method

**Files**:
```
apps/desktop/src/
├── lib/
│   ├── api-client.ts
│   └── api-client.test.ts
```

**Success Criteria**:
- ✅ API client can call backend
- ✅ WebSocket client connects
- ✅ Error handling works

---

### 2.3 Session List Component ⏱️ 6-8 hours

**Feature**: `009-session-list-ui`

#### Tasks
1. **Use Case Document** (30 min)
   - Session list behavior
   - Interactions

2. **Component Implementation** (3-4 hours)
   - Create `SessionList.tsx`
   - Create `SessionItem.tsx`
   - Create "New Session" button and modal
   - Integrate with API client
   - State management (Zustand)

3. **Styling** (1-2 hours)
   - Use Shadcn UI components
   - Match Claude.ai style

4. **Tests** (1.5 hours)
   - Component tests
   - Integration tests

**Files**:
```
apps/desktop/src/
├── components/
│   ├── SessionList/
│   │   ├── SessionList.tsx
│   │   ├── SessionList.test.tsx
│   │   ├── SessionItem.tsx
│   │   └── NewSessionModal.tsx
│   └── ...
├── stores/
│   └── session-store.ts
```

**Success Criteria**:
- ✅ Can see list of sessions
- ✅ Can create new session
- ✅ Can select a session
- ✅ Can delete a session
- ✅ Visual feedback for actions

---

### 2.4 Chat Interface Component ⏱️ 8-10 hours

**Feature**: `010-chat-interface`

#### Tasks
1. **Use Case Document** (30 min)
   - Chat UI behavior
   - Message types

2. **Component Implementation** (4-5 hours)
   - Create `ChatInterface.tsx`
   - Create `MessageList.tsx`
   - Create `MessageItem.tsx` (user/assistant)
   - Create `MessageInput.tsx`
   - Create `ToolCallDisplay.tsx`

3. **WebSocket Integration** (2-3 hours)
   - Connect to WebSocket
   - Handle streaming responses
   - Display messages in real-time

4. **Tests** (1.5 hours)
   - Component tests
   - Integration tests with mock WebSocket

**Files**:
```
apps/desktop/src/
├── components/
│   ├── ChatInterface/
│   │   ├── ChatInterface.tsx
│   │   ├── ChatInterface.test.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageItem.tsx
│   │   ├── MessageInput.tsx
│   │   └── ToolCallDisplay.tsx
```

**Success Criteria**:
- ✅ Can send messages
- ✅ Messages display in real-time
- ✅ Streaming animation
- ✅ Tool calls show nicely
- ✅ Scroll to bottom on new message

---

### 2.5 Settings Panel ⏱️ 4-6 hours

**Feature**: `011-settings-panel`

#### Tasks
1. **Simple Settings UI** (2-3 hours)
   - Create `SettingsPanel.tsx`
   - Fields:
     - API Key
     - Model selection (claude-sonnet-4.5, etc.)
     - Theme (light/dark)
   - Save to backend

2. **Integration** (1-2 hours)
   - Load settings on app start
   - Update backend when changed

3. **Tests** (1 hour)

**Files**:
```
apps/desktop/src/
├── components/
│   ├── SettingsPanel/
│   │   ├── SettingsPanel.tsx
│   │   └── SettingsPanel.test.tsx
```

**Success Criteria**:
- ✅ Can update API key
- ✅ Can change model
- ✅ Settings persist
- ✅ Backend uses new settings

---

### 2.6 Integration & Polish ⏱️ 6-8 hours

**Feature**: `012-mvp-integration`

#### Tasks
1. **Connect All Components** (2-3 hours)
   - Wire session list to chat interface
   - Handle session switching
   - Loading states
   - Error states

2. **E2E Tests** (2-3 hours)
   - Test full user flow:
     - Create session
     - Send message
     - Switch session
     - Delete session

3. **Bug Fixes** (2 hours)
   - Fix issues found in testing

**Success Criteria**:
- ✅ Complete flow works end-to-end
- ✅ No crashes
- ✅ All E2E tests pass

---

**Total Phase 2**: ~35-45 hours (1 week full-time, 2 weeks part-time)

**Phase 2 Milestone**: Working desktop app, can create sessions, chat with Claude, see history

---

## Phase 3: MVP Polish & Stability (Week 3)

**Goal**: Bug-free, stable MVP ready for daily use

### 3.1 Loading & Error States ⏱️ 4-6 hours

**Feature**: `013-loading-error-states`

#### Tasks
1. **Add Loading Indicators** (2-3 hours)
   - Skeleton loaders for session list
   - Spinner while waiting for response
   - Progress indicators

2. **Error Handling** (2-3 hours)
   - Toast notifications for errors
   - Retry buttons
   - Helpful error messages

**Success Criteria**:
- ✅ User knows when something is loading
- ✅ Errors show clearly
- ✅ Can recover from errors

---

### 3.2 Performance Optimization ⏱️ 4-6 hours

**Feature**: `014-performance`

#### Tasks
1. **Message List Virtualization** (2-3 hours)
   - Use react-virtual or similar
   - Only render visible messages

2. **Optimize Re-renders** (1-2 hours)
   - Use React.memo where appropriate
   - Optimize state updates

3. **Database Queries** (1 hour)
   - Add indexes to SQLite
   - Optimize queries

**Success Criteria**:
- ✅ Scrolling is smooth
- ✅ App feels fast
- ✅ Low memory usage

---

### 3.3 Data Persistence Improvements ⏱️ 4-6 hours

**Feature**: `015-data-persistence`

#### Tasks
1. **Auto-save Session State** (2-3 hours)
   - Save scroll position
   - Save input text (draft)
   - Restore on session open

2. **Database Backup** (1-2 hours)
   - Automatic backup on close
   - Restore from backup

3. **Migration System** (1 hour)
   - Handle schema changes gracefully

**Success Criteria**:
- ✅ Never lose work
- ✅ Seamless session resumption
- ✅ Database can upgrade

---

### 3.4 User Experience Polish ⏱️ 6-8 hours

**Feature**: `016-ux-polish`

#### Tasks
1. **Keyboard Shortcuts** (2-3 hours)
   - Cmd+N: New session
   - Cmd+Enter: Send message
   - Cmd+K: Focus search

2. **Visual Polish** (2-3 hours)
   - Animations for state changes
   - Better typography
   - Consistent spacing

3. **Empty States** (1-2 hours)
   - "No sessions" state
   - "No messages" state
   - Helpful onboarding

**Success Criteria**:
- ✅ App feels polished
- ✅ Intuitive to use
- ✅ New users understand it

---

### 3.5 Testing & Bug Fixes ⏱️ 8-10 hours

**Feature**: `017-mvp-testing`

#### Tasks
1. **Comprehensive E2E Tests** (4-5 hours)
   - All user flows
   - Edge cases
   - Error scenarios

2. **Manual Testing** (2-3 hours)
   - Test on fresh Mac
   - Test with different projects
   - Test edge cases

3. **Bug Fixes** (2-3 hours)
   - Fix all critical bugs
   - Fix high-priority bugs

**Success Criteria**:
- ✅ All E2E tests pass
- ✅ No critical bugs
- ✅ Ready for daily use

---

### 3.6 Documentation ⏱️ 4-6 hours

**Feature**: `018-mvp-documentation`

#### Tasks
1. **User Documentation** (2-3 hours)
   - README with screenshots
   - Installation guide
   - Usage guide
   - Troubleshooting

2. **Developer Documentation** (2-3 hours)
   - Architecture overview
   - Setup instructions
   - Contributing guide

**Success Criteria**:
- ✅ New users can install and use
- ✅ Developers can contribute
- ✅ Common issues documented

---

**Total Phase 3**: ~30-40 hours (1 week full-time, 1.5-2 weeks part-time)

**Phase 3 Milestone**: Stable, polished MVP ready for release

---

## Summary Timeline

### Aggressive (Full-Time, 40 hours/week)

- **Week 0**: Setup (0.5 days)
- **Week 1**: Backend Core (5 days)
- **Week 2**: Desktop UI (5 days)
- **Week 3**: Polish & Stability (4 days)

**Total**: ~3 weeks

### Comfortable (Part-Time, 20 hours/week)

- **Week 0-1**: Setup + Backend Core (2 weeks)
- **Week 2-3**: Desktop UI (2 weeks)
- **Week 4-5**: Polish & Stability (2 weeks)

**Total**: ~6 weeks

### Very Comfortable (Part-Time, 10 hours/week)

- **Week 0-2**: Setup + Backend Core (3 weeks)
- **Week 3-5**: Desktop UI (3 weeks)
- **Week 6-8**: Polish & Stability (3 weeks)

**Total**: ~8 weeks

---

## Feature Priority

### P0 (Must Have for MVP)
1. ✅ Session creation with Git branch
2. ✅ Send/receive messages
3. ✅ Message persistence
4. ✅ Session list UI
5. ✅ Chat interface

### P1 (Should Have for MVP)
6. ✅ Session switching
7. ✅ Session deletion
8. ✅ Settings (API key, model)
9. ✅ Error handling
10. ✅ Loading states

### P2 (Nice to Have for MVP)
11. ⚠️ Keyboard shortcuts
12. ⚠️ Performance optimization
13. ⚠️ Auto-save drafts
14. ⚠️ Empty states

### P3 (Post-MVP)
- Multiple concurrent sessions
- File explorer
- Web client
- Git merge UI
- Advanced settings

---

## Risk Management

### High Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| Claude SDK API breaking | High | Pin version, test early |
| Git branch conflicts | Medium | Clear warnings, simple merge |
| WebSocket stability | Medium | Reconnection logic, fallback to polling |
| Tauri build issues | Medium | Test builds early and often |

### Technical Unknowns

1. **Claude Agent SDK**: Never used it before
   - **Mitigation**: Spike in Week 1, Day 1
   - **Fallback**: Use raw Anthropic API

2. **Tauri**: Limited experience
   - **Mitigation**: Simple UI first, add complexity later
   - **Fallback**: Electron if Tauri issues

3. **WebSocket**: Connection management
   - **Mitigation**: Start simple, add reconnection later
   - **Fallback**: Polling (slower but reliable)

---

## Success Metrics

### MVP Success Criteria

At the end of 3 weeks, we should have:

#### Functional
- ✅ Can create session (< 2 seconds)
- ✅ Can send message and get response
- ✅ Messages persist across app restarts
- ✅ Can switch between sessions
- ✅ Can delete sessions
- ✅ Git branches created automatically

#### Quality
- ✅ 80%+ test coverage
- ✅ All E2E tests pass
- ✅ No critical bugs
- ✅ No crashes in normal use

#### User Experience
- ✅ App starts quickly (< 2 seconds)
- ✅ Responses stream smoothly
- ✅ UI is intuitive
- ✅ Errors are helpful

#### Documentation
- ✅ README with setup instructions
- ✅ Screenshots of key features
- ✅ Known issues documented

---

## Daily Checklist

Use this checklist for each development session:

### Before Starting
- [ ] Read feature use-case document
- [ ] Read feature test-case document
- [ ] Review existing code

### During Development
- [ ] Write tests first (TDD)
- [ ] Run tests frequently
- [ ] Commit often with good messages
- [ ] Check test coverage

### Before Finishing
- [ ] All tests pass (`pnpm test`)
- [ ] No linting errors (`pnpm lint`)
- [ ] TypeScript compiles (`pnpm typecheck`)
- [ ] Code reviewed (`/review-ready`)
- [ ] Documentation updated
- [ ] Commit and push

---

## Getting Started

### Day 1 - Sprint Planning

1. **Morning** (2 hours)
   - Install dependencies
   - Set up environment
   - Read through roadmap
   - Prioritize features

2. **Afternoon** (4 hours)
   - Start Feature 001: Database Setup
   - Write use-case document
   - Write test-case document
   - Begin implementation

### Week 1 - Backend

Focus on backend services. By end of week:
- Backend server running
- All API endpoints working
- Can create sessions via API
- Can send messages via WebSocket

### Week 2 - Frontend

Focus on UI. By end of week:
- Desktop app opens
- Session list works
- Can send/receive messages
- Basic styling complete

### Week 3 - Polish

Focus on quality. By end of week:
- All tests pass
- Performance is good
- UX is polished
- Ready to use daily

---

## Next Steps

1. **Right Now**: Install dependencies
   ```bash
   pnpm install
   ```

2. **Next**: Start Feature 001 (Database Setup)
   ```bash
   claude
   # Then run: /start-feature
   ```

3. **Follow TDD Workflow**:
   - Write use-case doc
   - Write test-case doc
   - Write tests (failing)
   - Implement feature
   - Run `/review-ready`
   - Merge when green

---

**Ready to build?** Start with Feature 001: Database Setup 🚀
