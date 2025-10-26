# Test Cases: Session Manager

> **Feature ID**: 003
> **Test Suite**: Session Manager
> **Created**: 2025-10-23
> **Updated**: 2025-10-23

## Test Strategy

### Testing Approach
- **Unit Tests**: Test SessionManager methods with mocked dependencies
- **Integration Tests**: Test with real DatabaseClient and GitService
- **Error Handling Tests**: Verify all error scenarios are handled
- **Edge Case Tests**: Test boundary conditions and unusual inputs

### Coverage Goals
- Line coverage: ≥ 80%
- Branch coverage: ≥ 75%
- Function coverage: 100%

### Test Organization
```
session-manager.test.ts
├── Unit Tests (Mocked Dependencies)
│   ├── createSession()
│   ├── getSession()
│   ├── listSessions()
│   ├── getActiveSession()
│   ├── updateSession()
│   ├── deleteSession()
│   └── switchSession()
├── Integration Tests (Real Dependencies)
│   ├── End-to-end session lifecycle
│   ├── Multiple sessions management
│   └── Git + Database coordination
└── Error Handling Tests
    ├── Git service errors
    ├── Database errors
    └── Validation errors
```

---

## Unit Tests: createSession()

### TC-001: Create session with valid data
**Category**: Unit Test - Happy Path
**Priority**: High

**Given**:
- Valid title "My Test Session"
- Valid rootDirectory (Git repo)
- Default base branch "main"

**When**: `createSession()` is called

**Then**:
- Session ID generated with format `sess_{nanoid}`
- Branch name is `session/{sessionId}`
- GitService.createBranch() called with correct params
- DatabaseClient.insertSession() called with session data
- Returns complete Session object
- createdAt and updatedAt are set
- isActive is false by default

---

### TC-002: Create session with custom base branch
**Category**: Unit Test
**Priority**: Medium

**Given**:
- Valid title
- Valid rootDirectory
- Custom baseBranch "develop"

**When**: `createSession()` is called

**Then**:
- GitService.createBranch() called with baseBranch="develop"
- Session stored with baseBranch="develop"
- Branch created from develop, not main

---

### TC-003: Create session with metadata
**Category**: Unit Test
**Priority**: Medium

**Given**:
- Valid title
- Valid rootDirectory
- metadata: { projectType: "react", version: "18.0" }

**When**: `createSession()` is called

**Then**:
- Session stored with metadata
- Metadata correctly serialized in database
- Returns session with parsed metadata

---

### TC-004: Create session generates unique IDs
**Category**: Unit Test
**Priority**: High

**Given**: Multiple session creation requests

**When**: `createSession()` called multiple times

**Then**:
- Each session has unique ID
- No ID collisions
- All IDs match format `sess_{nanoid}`

---

### TC-005: Create session validates directory exists
**Category**: Unit Test - Validation
**Priority**: High

**Given**: Non-existent directory path

**When**: `createSession()` is called

**Then**:
- Throws error before calling Git service
- Error message indicates directory not found
- No Git operations performed
- No database records created

---

### TC-006: Create session validates Git repository
**Category**: Unit Test - Validation
**Priority**: High

**Given**: Directory that is not a Git repository

**When**: `createSession()` is called

**Then**:
- GitService.isGitRepo() returns false
- Throws NotGitRepoError
- No database records created

---

### TC-007: Create session with empty title
**Category**: Unit Test - Validation
**Priority**: Medium

**Given**: Empty string title ""

**When**: `createSession()` is called

**Then**:
- Throws InvalidSessionDataError
- Error message indicates title required
- No Git or database operations

---

### TC-008: Create session retries on branch collision
**Category**: Unit Test - Edge Case
**Priority**: Medium

**Given**:
- First branch name conflicts with existing branch
- Second attempt generates different ID

**When**: `createSession()` is called

**Then**:
- First GitService.createBranch() throws BranchExistsError
- SessionManager generates new session ID
- Second GitService.createBranch() succeeds
- Session stored with second ID

---

## Unit Tests: getSession()

### TC-009: Get existing session by ID
**Category**: Unit Test - Happy Path
**Priority**: High

**Given**: Session exists in database with ID "sess_abc123"

**When**: `getSession("sess_abc123")` is called

**Then**:
- DatabaseClient.getSession() called with ID
- Returns complete Session object
- All fields correctly populated
- Metadata parsed from JSON

---

### TC-010: Get non-existent session
**Category**: Unit Test
**Priority**: High

**Given**: Session ID "sess_nonexistent" does not exist

**When**: `getSession("sess_nonexistent")` is called

**Then**:
- DatabaseClient.getSession() returns null
- Returns null (does not throw)

---

### TC-011: Get session with null ID
**Category**: Unit Test - Validation
**Priority**: Low

**Given**: null or undefined ID

**When**: `getSession(null)` is called

**Then**:
- Throws InvalidSessionDataError
- Error message indicates ID required

---

## Unit Tests: listSessions()

### TC-012: List all sessions when multiple exist
**Category**: Unit Test - Happy Path
**Priority**: High

**Given**:
- 3 sessions exist in database
- Different updated_at timestamps

**When**: `listSessions()` is called

**Then**:
- DatabaseClient.getSessions() called
- Returns array of 3 Session objects
- Sorted by updated_at DESC (newest first)
- All fields correctly populated

---

### TC-013: List sessions when none exist
**Category**: Unit Test
**Priority**: Medium

**Given**: Empty database (no sessions)

**When**: `listSessions()` is called

**Then**:
- Returns empty array []
- Does not throw error

---

### TC-014: List sessions includes active status
**Category**: Unit Test
**Priority**: Medium

**Given**:
- Multiple sessions exist
- One is marked isActive=true

**When**: `listSessions()` is called

**Then**:
- All sessions returned
- isActive boolean correctly set for each
- Active session identifiable

---

## Unit Tests: getActiveSession()

### TC-015: Get active session when one exists
**Category**: Unit Test - Happy Path
**Priority**: High

**Given**: One session marked isActive=true

**When**: `getActiveSession()` is called

**Then**:
- Returns the active Session object
- isActive is true

---

### TC-016: Get active session when none active
**Category**: Unit Test
**Priority**: High

**Given**: Multiple sessions but none isActive=true

**When**: `getActiveSession()` is called

**Then**:
- Returns null
- Does not throw error

---

### TC-017: Get active session when multiple active (data integrity issue)
**Category**: Unit Test - Edge Case
**Priority**: Low

**Given**: Database has multiple sessions with isActive=true

**When**: `getActiveSession()` is called

**Then**:
- Returns first active session found
- Logs warning about data integrity issue

---

## Unit Tests: updateSession()

### TC-018: Update session title
**Category**: Unit Test - Happy Path
**Priority**: High

**Given**: Existing session with ID "sess_abc123"

**When**: `updateSession("sess_abc123", { title: "New Title" })`

**Then**:
- DatabaseClient.updateSession() called
- Session title updated
- updated_at timestamp refreshed
- Returns updated Session object

---

### TC-019: Update session metadata
**Category**: Unit Test
**Priority**: Medium

**Given**: Existing session

**When**: `updateSession(id, { metadata: { tags: ["urgent"] } })`

**Then**:
- Metadata updated in database
- Metadata serialized as JSON
- Returns session with new metadata

---

### TC-020: Update session git status
**Category**: Unit Test
**Priority**: Medium

**Given**: Existing session

**When**: `updateSession(id, { gitStatus: "modified" })`

**Then**:
- gitStatus field updated
- Returns updated session

---

### TC-021: Update non-existent session
**Category**: Unit Test - Error
**Priority**: High

**Given**: Session ID does not exist

**When**: `updateSession("sess_nonexistent", { title: "..." })`

**Then**:
- DatabaseClient.updateSession() throws error
- Throws SessionNotFoundError
- Includes session ID in error message

---

### TC-022: Update with empty updates object
**Category**: Unit Test - Edge Case
**Priority**: Low

**Given**: Existing session

**When**: `updateSession(id, {})`

**Then**:
- Only updated_at timestamp changed
- No other fields modified
- Returns updated session

---

## Unit Tests: deleteSession()

### TC-023: Delete session without deleting Git branch
**Category**: Unit Test - Happy Path
**Priority**: High

**Given**:
- Existing session
- deleteGitBranch option is false (default)

**When**: `deleteSession(id)` is called

**Then**:
- DatabaseClient.deleteSession() called
- GitService.deleteBranch() NOT called
- Session removed from database
- Messages cascade deleted (foreign key)
- Returns void (no error)

---

### TC-024: Delete session with Git branch deletion
**Category**: Unit Test
**Priority**: High

**Given**:
- Existing session
- deleteGitBranch option is true

**When**: `deleteSession(id, { deleteGitBranch: true })`

**Then**:
- Session retrieved to get branch name
- Git branch deleted first (if exists)
- DatabaseClient.deleteSession() called
- Session removed from database
- Returns void

---

### TC-025: Delete non-existent session
**Category**: Unit Test - Error
**Priority**: High

**Given**: Session ID does not exist

**When**: `deleteSession("sess_nonexistent")`

**Then**:
- Throws SessionNotFoundError
- No database or Git operations performed

---

### TC-026: Delete active session
**Category**: Unit Test - Edge Case
**Priority**: Medium

**Given**:
- Session is currently active (isActive=true)
- Other sessions exist

**When**: `deleteSession(activeId)`

**Then**:
- Session marked as inactive first
- Then deleted from database
- Another session optionally activated
- Returns void

---

### TC-027: Delete last remaining session
**Category**: Unit Test - Edge Case
**Priority**: Low

**Given**: Only one session exists

**When**: `deleteSession(id)`

**Then**:
- Session deleted successfully
- Database becomes empty
- No errors thrown

---

## Unit Tests: switchSession()

### TC-028: Switch to different session successfully
**Category**: Unit Test - Happy Path
**Priority**: High

**Given**:
- Current active session exists
- Target session exists
- Different branch names

**When**: `switchSession(targetId)` is called

**Then**:
- Current session marked isActive=false
- GitService.checkoutBranch() called with target branch
- Target session marked isActive=true
- Returns target Session object with isActive=true

---

### TC-029: Switch to non-existent session
**Category**: Unit Test - Error
**Priority**: High

**Given**: Target session ID does not exist

**When**: `switchSession("sess_nonexistent")`

**Then**:
- Throws SessionNotFoundError
- No Git operations performed
- Current active session remains active

---

### TC-030: Switch to already active session (idempotent)
**Category**: Unit Test - Edge Case
**Priority**: Medium

**Given**: Session is already active

**When**: `switchSession(currentActiveId)` is called

**Then**:
- Returns session immediately (no-op)
- No Git checkout performed
- isActive remains true

---

### TC-031: Switch when no session is currently active
**Category**: Unit Test - Edge Case
**Priority**: Medium

**Given**: No session has isActive=true

**When**: `switchSession(targetId)` is called

**Then**:
- GitService.checkoutBranch() called
- Target session marked isActive=true
- Returns target Session object

---

### TC-032: Switch fails during Git checkout
**Category**: Unit Test - Error
**Priority**: High

**Given**:
- Target session exists
- GitService.checkoutBranch() throws error

**When**: `switchSession(targetId)` is called

**Then**:
- Git error caught
- Database rollback: target remains inactive
- Current session remains active
- Throws wrapped error with context

---

## Integration Tests

### TC-033: End-to-end session lifecycle
**Category**: Integration Test
**Priority**: High

**Setup**:
- Real DatabaseClient (in-memory)
- Real GitService with temp Git repo

**Test**:
1. Create session - verify DB and Git branch
2. Get session - verify data
3. Update session - verify changes
4. Switch session - verify branch checkout
5. Delete session - verify cleanup

**Verify**:
- All operations succeed
- Database and Git stay in sync
- No orphaned records or branches

---

### TC-034: Create multiple sessions in same repository
**Category**: Integration Test
**Priority**: High

**Setup**:
- Real dependencies
- One Git repository

**Test**:
1. Create session A
2. Create session B
3. Create session C
4. List sessions - verify all 3
5. Each has unique ID and branch

**Verify**:
- All 3 sessions in database
- All 3 Git branches created
- Can switch between them

---

### TC-035: Switch between multiple sessions
**Category**: Integration Test
**Priority**: High

**Setup**:
- 3 sessions created

**Test**:
1. Switch to session A - verify active
2. Switch to session B - verify active, A inactive
3. Switch to session C - verify active, B inactive
4. Get active session - returns C

**Verify**:
- Only one session active at a time
- Git branch correctly checked out
- Database reflects active state

---

### TC-036: Delete session with messages
**Category**: Integration Test
**Priority**: Medium

**Setup**:
- Session with associated messages in DB

**Test**:
1. Insert messages for session
2. Delete session
3. Query messages

**Verify**:
- Session deleted
- Messages cascade deleted (foreign key)
- No orphaned messages

---

### TC-037: Database and Git coordination on create
**Category**: Integration Test
**Priority**: High

**Setup**: Real dependencies

**Test**:
1. Create session
2. Check Git branch exists
3. Check database record exists
4. Verify branch name matches session.branchName

**Verify**:
- Git branch actually created
- Database has correct branch name
- Consistent state

---

### TC-038: Database and Git coordination on delete
**Category**: Integration Test
**Priority**: High

**Setup**: Session created with both DB and Git

**Test**:
1. Delete session with deleteGitBranch=true
2. Check Git branch deleted
3. Check database record deleted

**Verify**:
- Both removed successfully
- No leftover artifacts

---

## Error Handling Tests

### TC-039: Git service unavailable during create
**Category**: Error Handling
**Priority**: High

**Given**: GitService.checkGitInstalled() returns false

**When**: `createSession()` is called

**Then**:
- Throws GitNotInstalledError
- Clear error message
- No database records created

---

### TC-040: Git branch creation fails
**Category**: Error Handling
**Priority**: High

**Given**: GitService.createBranch() throws GitOperationError

**When**: `createSession()` is called

**Then**:
- Error caught and wrapped
- Includes original error details
- No database records created

---

### TC-041: Database insert fails after Git branch created
**Category**: Error Handling
**Priority**: High

**Given**:
- Git branch created successfully
- DatabaseClient.insertSession() throws error

**When**: `createSession()` is called

**Then**:
- Error thrown to caller
- Git branch remains (logged as orphaned)
- Error message indicates partial state

---

### TC-042: Database connection lost during operation
**Category**: Error Handling
**Priority**: Medium

**Given**: Database becomes unavailable

**When**: Any database operation called

**Then**:
- Error caught
- Clear error message
- Doesn't crash application

---

### TC-043: Git checkout fails during switch
**Category**: Error Handling
**Priority**: High

**Given**: GitService.checkoutBranch() fails

**When**: `switchSession()` is called

**Then**:
- Error caught
- Database state rolled back
- Previous active session restored
- Clear error message

---

### TC-044: Invalid rootDirectory path
**Category**: Error Handling - Validation
**Priority**: Medium

**Given**: rootDirectory with invalid characters or path traversal

**When**: `createSession()` is called

**Then**:
- Validation error thrown
- Path sanitization applied
- Security issue prevented

---

### TC-045: Session ID format validation
**Category**: Error Handling - Validation
**Priority**: Low

**Given**: Manually constructed invalid session ID

**When**: Operations called with bad ID

**Then**:
- Validation catches issue
- Clear error message
- No operations performed

---

### TC-046: Concurrent session creation
**Category**: Error Handling - Concurrency
**Priority**: Medium

**Given**: Two createSession() calls at same time

**When**: Both try to create sessions

**Then**:
- Both succeed with unique IDs
- No race conditions
- Database handles correctly

---

### TC-047: Concurrent session switch
**Category**: Error Handling - Concurrency
**Priority**: Medium

**Given**: Two switchSession() calls simultaneously

**When**: Both try to switch to different sessions

**Then**:
- Last one wins
- Only one session ends up active
- No corrupted state

---

### TC-048: Retry logic on transient Git failures
**Category**: Error Handling
**Priority**: Low

**Given**: Git operation fails with transient error

**When**: SessionManager calls Git operation

**Then**:
- Retry attempted (if configured)
- Eventual success or clear failure
- Logged appropriately

---

## Summary

**Total Test Cases**: 48

**Breakdown by Category**:
- Unit Tests (Happy Path): 10
- Unit Tests (Validation): 8
- Unit Tests (Edge Cases): 10
- Integration Tests: 6
- Error Handling Tests: 14

**Breakdown by Priority**:
- High: 30 test cases
- Medium: 16 test cases
- Low: 2 test cases

**Coverage Targets**:
- All public methods tested
- All error paths tested
- All edge cases covered
- Integration scenarios validated

---

**Document History**:
- 2025-10-23: Initial test cases (48 total)
