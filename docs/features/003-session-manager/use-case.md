# Feature: Session Manager

> **Feature ID**: 003
> **Status**: In Progress
> **Owner**: Development Team
> **Created**: 2025-10-23
> **Updated**: 2025-10-23

## Overview

Implement a Session Manager service that orchestrates session lifecycle management by coordinating between the DatabaseClient and GitService. This is the core business logic layer that handles creating, listing, retrieving, updating, deleting, and switching between sessions.

## User Story

**As a** backend service layer
**I want** a session manager that coordinates database and Git operations
**So that** sessions are consistently managed across both storage and version control systems

## Acceptance Criteria

- [ ] **AC1**: SessionManager can create a new session with unique ID and Git branch
- [ ] **AC2**: Session IDs are generated in format: `sess_{nanoid}`
- [ ] **AC3**: Git branches are created in format: `session/{session-id}`
- [ ] **AC4**: SessionManager validates Git repository exists before creating session
- [ ] **AC5**: SessionManager can list all sessions from database
- [ ] **AC6**: SessionManager can retrieve a single session by ID
- [ ] **AC7**: SessionManager can update session metadata and status
- [ ] **AC8**: SessionManager can delete a session from database
- [ ] **AC9**: SessionManager can optionally delete Git branch when deleting session
- [ ] **AC10**: SessionManager can switch active session (checkout branch, update DB)
- [ ] **AC11**: Only one session can be marked as active at a time
- [ ] **AC12**: SessionManager handles Git service errors gracefully
- [ ] **AC13**: SessionManager handles database errors gracefully
- [ ] **AC14**: All session operations are atomic where possible
- [ ] **AC15**: SessionManager validates session data before operations

## Success Metrics

### Quantitative Metrics
- **Session creation**: < 1000ms (includes Git branch creation)
- **Session retrieval**: < 10ms
- **Session listing**: < 50ms
- **Session switching**: < 500ms (includes Git checkout)
- **Test coverage**: ≥ 80%
- **Error recovery**: 100% of errors handled gracefully

### Qualitative Metrics
- Clear error messages for all failure scenarios
- Type-safe API with TypeScript
- Easy to use for higher-level services
- Consistent state between database and Git

## User Flows

### Primary Flow 1: Create New Session

1. **Service requests new session**
   - Calls `sessionManager.createSession(options)`
   - Options include: title, rootDirectory, baseBranch (optional)

2. **SessionManager validates**
   - Checks if rootDirectory exists
   - Verifies directory is a Git repository
   - Validates base branch exists (defaults to 'main')

3. **SessionManager generates IDs**
   - Creates unique session ID: `sess_{nanoid()}`
   - Derives branch name: `session/{session-id}`

4. **SessionManager coordinates operations**
   - Calls GitService.createBranch() to create Git branch
   - Calls DatabaseClient.insertSession() to store session
   - Returns complete Session object

### Primary Flow 2: Switch Session

1. **Service requests session switch**
   - Calls `sessionManager.switchSession(sessionId)`

2. **SessionManager retrieves session**
   - Gets session from database
   - Validates session exists

3. **SessionManager updates state**
   - Deactivates current active session in database
   - Calls GitService.checkoutBranch() to switch branch
   - Marks target session as active
   - Returns updated Session object

### Primary Flow 3: List Sessions

1. **Service requests all sessions**
   - Calls `sessionManager.listSessions()`

2. **SessionManager queries database**
   - Calls DatabaseClient.getSessions()
   - Returns array sorted by updated_at DESC

### Primary Flow 4: Delete Session

1. **Service requests session deletion**
   - Calls `sessionManager.deleteSession(sessionId, options)`
   - Options include: deleteGitBranch (boolean, default: false)

2. **SessionManager validates**
   - Retrieves session from database
   - Checks if session exists

3. **SessionManager coordinates deletion**
   - Optionally deletes Git branch if requested
   - Deletes session from database (cascades to messages)
   - Returns void

## Alternative Flows

### Alt Flow 1: Create Session in Non-Git Directory

1. Service requests session creation with invalid directory
2. SessionManager validates directory
3. GitService.isGitRepo() returns false
4. SessionManager throws `NotGitRepoError`
5. Service handles error and informs user

### Alt Flow 2: Switch to Non-Existent Session

1. Service requests switch to invalid session ID
2. SessionManager tries to retrieve session
3. DatabaseClient returns null
4. SessionManager throws `SessionNotFoundError`
5. Service handles error

### Alt Flow 3: Create Session When Git Branch Exists

1. Service requests session creation
2. SessionManager generates session ID and branch name
3. GitService.createBranch() throws `BranchExistsError`
4. SessionManager regenerates session ID and retries
5. On success, stores session in database

### Alt Flow 4: Delete Active Session

1. Service requests deletion of active session
2. SessionManager detects session is active
3. SessionManager switches to another session first (if available)
4. SessionManager deletes the original session
5. Returns success

## Edge Cases

### Edge Case 1: Multiple Sessions in Same Repository

- **Situation**: Creating multiple sessions for same root directory
- **Expected behavior**: Each session gets unique branch, shares same repo
- **Rationale**: Users may want multiple sessions for different features

### Edge Case 2: Git Branch Creation Fails After ID Generation

- **Situation**: Session ID created but Git branch creation fails
- **Expected behavior**: Don't store session in database, throw error
- **Rationale**: Maintain consistency between Git and database

### Edge Case 3: Database Insert Fails After Git Branch Created

- **Situation**: Git branch created but database insert fails
- **Expected behavior**: Log error, leave branch (can be cleaned up later)
- **Rationale**: Git operations are harder to roll back automatically

### Edge Case 4: Switching to Already Active Session

- **Situation**: User switches to session that's already active
- **Expected behavior**: Return success immediately (no-op)
- **Rationale**: Idempotent operation, no harm in redundant switch

### Edge Case 5: No Sessions Exist When Listing

- **Situation**: User lists sessions but database is empty
- **Expected behavior**: Return empty array []
- **Rationale**: Empty state is valid, not an error

### Edge Case 6: Session Title Contains Special Characters

- **Situation**: User provides title with quotes, slashes, etc.
- **Expected behavior**: Store as-is in database, sanitize for Git if needed
- **Rationale**: Database can handle any text, Git has restrictions

### Edge Case 7: Base Branch Doesn't Exist

- **Situation**: User specifies non-existent base branch
- **Expected behavior**: GitService throws error, session not created
- **Rationale**: Can't create branch from non-existent base

## Dependencies

### Required Features
- [Feature 001]: Database Setup - Provides DatabaseClient
- [Feature 002]: Git Service - Provides GitService

### External Dependencies
- nanoid for unique ID generation
- TypeScript for type safety
- better-sqlite3 (via DatabaseClient)
- simple-git (via GitService)

## Technical Notes

### Architecture Considerations

- SessionManager is a service layer that coordinates
- Does not directly use Git or Database libraries
- Depends on abstracted interfaces (DatabaseClient, GitService)
- All methods are async due to Git operations
- Uses dependency injection for testability

### API Design

```typescript
interface CreateSessionOptions {
  title: string;
  rootDirectory: string;
  baseBranch?: string; // defaults to 'main'
  metadata?: Record<string, any>;
}

interface DeleteSessionOptions {
  deleteGitBranch?: boolean; // defaults to false
}

interface SessionManager {
  // Create new session
  createSession(options: CreateSessionOptions): Promise<Session>;

  // Retrieve sessions
  getSession(id: string): Promise<Session | null>;
  listSessions(): Promise<Session[]>;
  getActiveSession(): Promise<Session | null>;

  // Update session
  updateSession(id: string, updates: UpdateSession): Promise<Session>;

  // Delete session
  deleteSession(id: string, options?: DeleteSessionOptions): Promise<void>;

  // Switch session
  switchSession(id: string): Promise<Session>;
}
```

### Error Handling Strategy

```typescript
// Custom errors
class SessionNotFoundError extends Error {
  name = 'SessionNotFoundError';
}

class SessionAlreadyExistsError extends Error {
  name = 'SessionAlreadyExistsError';
}

class InvalidSessionDataError extends Error {
  name = 'InvalidSessionDataError';
}

// SessionManager catches and wraps lower-level errors:
// - GitNotInstalledError -> bubble up
// - NotGitRepoError -> bubble up
// - BranchExistsError -> retry with new ID
// - GitOperationError -> wrap in SessionManagerError
// - Database errors -> wrap in SessionManagerError
```

### Session ID Generation

```typescript
import { nanoid } from 'nanoid';

function generateSessionId(): string {
  return `sess_${nanoid(12)}`;
}

// Example IDs:
// sess_V1StGXR8_Z5j
// sess_3bqc9KpLmN2w
// sess_xYz123AbC789
```

### Branch Naming Convention

```typescript
function getBranchName(sessionId: string): string {
  return `session/${sessionId}`;
}

// Examples:
// session/sess_V1StGXR8_Z5j
// session/sess_3bqc9KpLmN2w
```

### Transaction Handling

Since SQLite operations are synchronous and atomic, and Git operations are separate:
- Database operations are atomic by default
- Git operations are separate from database
- Use try-catch to ensure partial operations are logged
- Document which operations can leave inconsistent state

### State Management

Active session handling:
```typescript
// When switching sessions:
1. Get current active session (if any)
2. Mark current as inactive: db.updateSession(currentId, { isActive: false })
3. Checkout new branch: git.checkoutBranch(branchName, directory)
4. Mark new as active: db.updateSession(newId, { isActive: true })

// Ensure only one active session:
- Database constraint could enforce this (application-level)
- Before setting isActive=true, set all others to false
```

## UI/UX Considerations

N/A - This is a backend service with no UI

## Non-Functional Requirements

### Performance
- Session creation: < 1000ms
- Session retrieval: < 10ms
- Session switching: < 500ms
- Listing sessions: < 50ms

### Security
- Validate all input parameters
- Prevent directory traversal in rootDirectory
- Sanitize session titles for logging

### Reliability
- Graceful error handling for all operations
- Clear error messages for debugging
- Log all operations for audit trail
- Handle concurrent operations safely

## Open Questions

- [x] **Q1**: Should we auto-generate session titles if not provided?
  - **Answer**: No, require explicit title. Makes UX clearer.

- [x] **Q2**: Should switching sessions fail if there are uncommitted changes?
  - **Answer**: No, Git handles this. Let Git behavior flow through.

- [x] **Q3**: Should we support session templates or presets?
  - **Answer**: No, not in MVP. Add in later feature if needed.

- [x] **Q4**: Should we limit number of sessions per repository?
  - **Answer**: No limits in MVP. Can add if performance issues arise.

- [x] **Q5**: Should we validate directory permissions before creating session?
  - **Answer**: Yes, check directory exists and is readable.

## Related Features

- [Feature 001]: Database Setup - Provides persistence layer
- [Feature 002]: Git Service - Provides version control operations
- [Feature 004]: Claude Agent - Will use SessionManager for conversations
- [Feature 005]: REST API - Will expose SessionManager operations
- [Feature 006]: CLI - Will use SessionManager for command-line interface

## References

- [nanoid Documentation](https://github.com/ai/nanoid)
- [SQLite Transactions](https://www.sqlite.org/lang_transaction.html)
- [Git Branch Naming](https://git-scm.com/docs/git-check-ref-format)

---

**Document History**:
- 2025-10-23: Initial draft
