# Feature 013: ACP Migration - Use Case

> **Feature**: Migrate from Headless Claude CLI to Agent Client Protocol (ACP)
> **Status**: Planning
> **Priority**: High
> **Estimated Effort**: 2-3 weeks

---

## User Story

**As a** Claude Code Manager developer/user
**I want** to use the Agent Client Protocol (ACP) instead of headless Claude CLI
**So that** I can access full Claude Code features including tool calls, permissions, and MCP integration

---

## Problem Statement

### Current Limitations

The current headless Claude CLI integration has several critical limitations:

1. **No Tool Call Visibility**
   - Users cannot see what tools Claude is using
   - No visibility into file operations, command executions, etc.
   - Debugging is difficult when Claude performs actions

2. **No Permission Management**
   - Cannot control what Claude is allowed to do
   - No way to approve/deny specific tool uses
   - Security concerns with unrestricted access

3. **No MCP Support**
   - Cannot extend Claude with custom tools
   - Cannot integrate external services
   - Limited to built-in Claude Code capabilities

4. **Performance Issues**
   - Process spawn overhead (~500ms) on every request
   - No connection reuse
   - Higher latency for consecutive messages

5. **Incomplete Headless Mode**
   - Claude CLI headless mode not fully featured
   - Limited stop reason information
   - Fragile error detection via stderr parsing

### Impact

- **User Experience**: Users don't know what Claude is doing
- **Debugging**: Difficult to troubleshoot issues
- **Security**: No control over tool execution
- **Extensibility**: Cannot add custom tools
- **Performance**: Slower response times

---

## Proposed Solution

### Agent Client Protocol (ACP)

Adopt the Agent Client Protocol (ACP), a standardized JSON-RPC protocol for communication between code editors and AI coding agents.

**Key Components**:
1. **@zed-industries/claude-code-acp**: Production-ready ACP adapter for Claude Code
2. **@zed-industries/agent-client-protocol**: TypeScript SDK for ACP protocol
3. **Feature Flag**: Switch between CLI and ACP modes

### Solution Architecture

```
┌────────────────────────────────────┐
│   Frontend (React)                 │
│   - Tool call display              │
│   - Permission dialogs             │
│   - Diff viewer                    │
└──────────────┬─────────────────────┘
               │ HTTP/WebSocket
┌──────────────┴─────────────────────┐
│   Backend (Node.js)                │
│   ┌────────────────────────────┐   │
│   │  ClaudeAgentService        │   │
│   │  (Feature flag router)     │   │
│   └───────┬────────────────────┘   │
│           │                        │
│     ┌─────┴──────┐                │
│     ↓            ↓                 │
│  CLI Client   ACP Client           │
│  (Legacy)     (New)                │
└───────────────┬───────────────────┘
                ↓
     ┌──────────────────────┐
     │  claude-code-acp      │
     │  (ACP Agent)          │
     └──────────┬────────────┘
                ↓
     ┌──────────────────────┐
     │  Claude Agent SDK     │
     │  → Anthropic API      │
     └───────────────────────┘
```

---

## Acceptance Criteria

### Must Have (MVP)

- [ ] **AC1**: ACP client can initialize and establish connection
  - Can spawn claude-code-acp process
  - Can perform protocol handshake
  - Can verify connection status

- [ ] **AC2**: Can create and manage sessions via ACP
  - Create new ACP session with workspace directory
  - Reuse existing sessions
  - Session IDs map to database records

- [ ] **AC3**: Can send messages and receive responses
  - Non-streaming: Complete response
  - Streaming: Chunk-by-chunk delivery
  - Same interface as CLI client

- [ ] **AC4**: Tool calls are captured and displayed
  - Tool call data extracted from ACP responses
  - Stored in database `tool_calls` column
  - Displayed in frontend UI

- [ ] **AC5**: Feature flag enables mode switching
  - Environment variable: `CLAUDE_INTEGRATION_MODE=acp|cli`
  - Can switch between modes without code changes
  - Both modes work correctly

- [ ] **AC6**: Error handling is comprehensive
  - ACP process failures detected
  - Connection errors handled gracefully
  - Fallback to CLI if ACP unavailable

- [ ] **AC7**: Performance meets targets
  - First message < 1s (vs ~2s CLI)
  - Subsequent messages < 500ms (vs ~1s CLI)
  - No memory leaks from long-running process

- [ ] **AC8**: All existing functionality preserved
  - Session creation/switching works
  - Message sending/streaming works
  - Settings management works
  - Git operations work

### Should Have (Phase 2)

- [ ] **AC9**: Permission management implemented
  - Support 4 permission modes (default, acceptEdits, plan, bypassPermissions)
  - Can set permission mode per session
  - Permission requests handled (initially auto-approve)

- [ ] **AC10**: UI displays tool call details
  - Tool name shown
  - Tool input/parameters visible
  - Formatted nicely (not raw JSON)

- [ ] **AC11**: Settings UI for integration mode
  - Can switch between CLI/ACP in settings
  - Current mode displayed
  - Restart prompt if needed

### Could Have (Future)

- [ ] **AC12**: Interactive permission dialogs
  - User can approve/deny tool execution
  - Remember decision for session
  - Permission history visible

- [ ] **AC13**: Diff display for file changes
  - Show before/after diffs
  - Syntax highlighting
  - Accept/reject changes

- [ ] **AC14**: MCP server configuration
  - Add custom MCP servers
  - Configure server parameters
  - Enable/disable servers per session

- [ ] **AC15**: Performance monitoring
  - Track response times
  - Monitor memory usage
  - Alert on degradation

---

## User Workflows

### Workflow 1: New User (ACP Mode)

```
1. User installs Claude Code Manager
2. App detects claude-code-acp installed
3. Defaults to ACP mode
4. User creates session
5. User sends message: "Create a file named test.txt"
6. User sees:
   - 🛠️ Tool Call: write_file
     - path: test.txt
     - content: (empty)
7. User sees Claude's response
8. File is created in workspace
```

**Expected Behavior**: Smooth experience with full visibility

### Workflow 2: Existing User (Migrating from CLI)

```
1. User updates to new version
2. User sees migration prompt
3. User clicks "Enable ACP mode"
4. App checks for claude-code-acp
5. If not found:
   - Show installation instructions
   - Offer to install automatically
6. If found:
   - Set CLAUDE_INTEGRATION_MODE=acp
   - Restart backend
7. User's existing sessions still work
8. New sessions use ACP features
```

**Expected Behavior**: Seamless migration with guidance

### Workflow 3: Power User (Manual Mode Switch)

```
1. User opens Settings
2. User navigates to "Integration" tab
3. Current mode shown: CLI
4. User selects: ACP
5. App shows benefits:
   ✅ Tool calls visible
   ✅ Permission management
   ✅ Better performance
6. User clicks "Switch & Restart"
7. Backend restarts in ACP mode
8. User's session continues where left off
```

**Expected Behavior**: User-controlled migration

### Workflow 4: Developer Testing Both Modes

```
1. Developer sets CLAUDE_INTEGRATION_MODE=cli
2. Runs test suite: pnpm test
3. All tests pass ✅
4. Developer sets CLAUDE_INTEGRATION_MODE=acp
5. Runs test suite: pnpm test
6. All tests pass ✅
7. Developer compares performance:
   - CLI: First message ~1.8s
   - ACP: First message ~0.6s
8. Developer confirms ACP is faster
```

**Expected Behavior**: Both modes fully functional

---

## Edge Cases

### Edge Case 1: claude-code-acp Not Installed

**Scenario**: User enables ACP mode but hasn't installed claude-code-acp

**Expected Behavior**:
- Show clear error message on startup
- Provide installation command: `npm install -g @zed-industries/claude-code-acp`
- Offer to fallback to CLI mode
- Don't crash, handle gracefully

### Edge Case 2: ACP Process Crashes Mid-Session

**Scenario**: claude-code-acp process crashes while handling request

**Expected Behavior**:
- Detect process exit
- Show error to user: "Connection lost. Reconnecting..."
- Attempt to reconnect automatically
- If reconnect fails, show manual recovery options
- Don't lose user's message

### Edge Case 3: Switching Modes with Active Session

**Scenario**: User switches from CLI to ACP while session is active

**Expected Behavior**:
- Prompt user: "Switching modes requires restart. Continue?"
- If yes:
  - Save current state
  - Restart backend
  - Restore session
  - Continue conversation seamlessly
- If no:
  - Cancel switch
  - Keep current mode

### Edge Case 4: Tool Call Parsing Errors

**Scenario**: ACP returns malformed tool call data

**Expected Behavior**:
- Catch parsing errors
- Log error for debugging
- Display raw tool call data to user
- Show warning: "⚠️ Could not parse tool call details"
- Continue processing message

### Edge Case 5: Permission Request Timeout

**Scenario**: ACP sends permission request but no response

**Expected Behavior**:
- Set timeout (e.g., 30 seconds)
- If timeout:
  - Deny permission (safe default)
  - Log timeout
  - Continue execution
  - Don't block forever

### Edge Case 6: Database Has tool_calls Data but in CLI Mode

**Scenario**: Session was created in ACP mode, now running in CLI mode

**Expected Behavior**:
- CLI mode ignores tool_calls column
- Messages display normally
- Tool calls not shown (expected in CLI mode)
- No errors or warnings
- Data preserved for when ACP re-enabled

---

## Dependencies

### External Dependencies

1. **@zed-industries/claude-code-acp** (npm package)
   - Must be installed globally or locally
   - Version: 0.1.5 or higher
   - Maintained by Zed Industries

2. **@zed-industries/agent-client-protocol** (npm package)
   - TypeScript SDK for ACP protocol
   - Version: 0.5.1 or higher
   - Required for client implementation

3. **ANTHROPIC_API_KEY** (environment variable)
   - Required for ACP mode
   - Used by claude-code-acp process
   - Must be valid Anthropic API key

### Internal Dependencies

1. **Database Schema**: Already ready
   - `messages.tool_calls` column exists
   - No migration needed

2. **Backend Services**: Need modification
   - `ClaudeAgentService`: Add mode switching
   - Routes: Handle tool call responses

3. **Frontend Components**: Need updates
   - `MessageItem`: Display tool calls
   - `Settings`: Add integration mode selector

---

## Success Metrics

### Functional Metrics

- [ ] 100% of existing functionality works in ACP mode
- [ ] Tool calls captured in 100% of tool-using messages
- [ ] 0 critical bugs in ACP implementation
- [ ] Feature flag works without errors

### Performance Metrics

- [ ] First message latency: < 1s (target: 600-800ms)
- [ ] Subsequent message latency: < 500ms (target: 200-400ms)
- [ ] Memory usage: < 200MB for long-running ACP process
- [ ] No memory leaks over 1000 messages

### Quality Metrics

- [ ] Test coverage: ≥ 90% for ACP code
- [ ] All existing tests pass (257+)
- [ ] 100+ new tests for ACP features
- [ ] Code review passed
- [ ] Documentation complete

### User Experience Metrics

- [ ] Migration success rate: > 95%
- [ ] User error reports: < 5% after migration
- [ ] User satisfaction: Positive feedback on tool visibility
- [ ] Support tickets: No increase in support load

---

## Non-Goals (Out of Scope)

### Explicitly Not Included

1. **Interactive Permission Dialogs**
   - Will auto-approve all permissions initially
   - Interactive UI can be added in Phase 2

2. **MCP Server Configuration**
   - Basic support only
   - Advanced MCP features in future release

3. **Diff Display UI**
   - Backend will receive diffs
   - Frontend display deferred to Phase 2

4. **CLI Mode Removal**
   - Will keep both modes for compatibility
   - Deprecation considered after 6 months

5. **Performance Optimization**
   - Focus on functional parity first
   - Performance tuning in follow-up work

6. **Custom Tool Development**
   - ACP enables this, but not building custom tools yet
   - Future enhancement

---

## Timeline

- **Planning & Documentation**: 2 days (complete)
- **Phase 1 - Foundation**: 5 days (Week 1)
- **Phase 2 - Implementation**: 5 days (Week 2)
- **Phase 3 - Migration & Polish**: 5 days (Week 3)
- **Buffer**: 3 days
- **Total**: 15-20 days (3-4 weeks)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| ACP SDK breaking changes | Pin to specific version, test upgrades |
| claude-code-acp not installed | Clear error messages, installation guide |
| Performance regression | Benchmark before/after, keep CLI fallback |
| Tool call parsing errors | Extensive error handling, display raw data |
| User confusion | Clear migration guide, in-app help |

---

## Related Documents

- **Migration Plan**: `migration-plan.md` (comprehensive implementation guide)
- **Test Cases**: `test-case.md` (testing scenarios)
- **Architecture Analysis**: `../../architecture/ACP-INTEGRATION-ANALYSIS.md`
- **Guidelines**: `../../development/GUIDELINES.md`

---

**Status**: Ready for Phase 1 implementation 🚀
