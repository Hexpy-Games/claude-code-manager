# Feature: Clone-Based Session Architecture

> **Feature ID**: 009
> **Status**: Complete ✅
> **Owner**: Development Team
> **Created**: 2025-10-25
> **Updated**: 2025-10-25

## Overview

Implement a clone-based session architecture where each session has its own isolated Git workspace (cloned repository), replacing the branch-switching approach. This provides true filesystem isolation, supports concurrent sessions, and eliminates merge conflicts between sessions.

## User Story

**As a** backend system
**I want** each session to have its own cloned Git workspace
**So that** sessions are truly isolated with no filesystem conflicts, and users can run multiple sessions concurrently

### Example
**As a** Claude Code Manager backend
**I want** to create a new session by cloning the repository to `/tmp/claude-sessions/{sessionId}/{repoName}`
**So that** this session's file operations never conflict with other sessions

## Acceptance Criteria

- [ ] **AC1**: Sessions table has `workspace_path` column storing cloned workspace location
- [ ] **AC2**: SessionManager creates Git clone to `/tmp/claude-sessions/{sessionId}/{repoName}` when creating session
- [ ] **AC3**: Git clone includes only Git-tracked files (like `git clone`), no node_modules or build artifacts
- [ ] **AC4**: SessionManager checkouts session branch in the cloned workspace
- [ ] **AC5**: Switching sessions does NOT checkout branches in original repo, only updates active status
- [ ] **AC6**: Deleting session removes cloned workspace directory
- [ ] **AC7**: Multiple sessions can exist for same repository without conflicts
- [ ] **AC8**: Database migration adds workspace_path to existing sessions
- [ ] **AC9**: All existing tests pass with new architecture (257 tests)
- [ ] **AC10**: Session creation still validates original repo is Git repository
- [ ] **AC11**: workspacePath returned in Session API responses
- [ ] **AC12**: Sessions can run concurrently on different workspaces

## Success Metrics

### Quantitative Metrics
- **Session creation time**: < 5 seconds (includes Git clone)
- **Disk space per session**: ~same as original repo size (only Git-tracked files)
- **Test pass rate**: 100% (257/257 tests)
- **Concurrent sessions**: Support 10+ sessions simultaneously

### Qualitative Metrics
- **True isolation**: Each session has independent filesystem
- **No conflicts**: Sessions never interfere with each other
- **Clean workspaces**: No build artifacts or node_modules in clones
- **Original repo unchanged**: Main repo never modified by session operations

## User Flows

### Primary Flow (Happy Path)

1. **User requests session creation**
   - API receives: `POST /api/sessions` with `{ title, rootDirectory, baseBranch }`

2. **SessionManager validates repository**
   - Checks rootDirectory is valid Git repository
   - Validates base branch exists

3. **SessionManager generates session ID and paths**
   - Generates: `sess_{nanoid}`
   - Calculates workspacePath: `/tmp/claude-sessions/{sessionId}/{repoName}`
   - Branch name: `session/{sessionId}`

4. **SessionManager creates Git branch in original repo**
   - Creates branch in original repository (not yet checked out)

5. **SessionManager clones repository to workspace**
   - Runs `git clone {originalRepo} {workspacePath}`
   - Checkouts session branch in cloned workspace
   - Only Git-tracked files included

6. **SessionManager stores session in database**
   - Includes both rootDirectory (original) and workspacePath (clone)
   - Returns Session object with both paths

### Alternative Flows

#### Alt Flow 1: Create Second Session in Same Repository

1. User creates first session → Clone created at `/tmp/claude-sessions/sess_abc123/my-project`
2. User creates second session for same repo
3. SessionManager creates new branch in original repo
4. SessionManager clones again to `/tmp/claude-sessions/sess_def456/my-project`
5. Both workspaces exist independently
6. **Result**: Two isolated workspaces, no conflicts

#### Alt Flow 2: Switch Between Sessions

1. Session A is active (workspace at `/tmp/claude-sessions/sess_abc123/my-project`)
2. User switches to Session B
3. SessionManager marks A as inactive, B as active
4. **No Git operations performed** (just database update)
5. Claude Code CLI uses Session B's workspace path
6. **Result**: Instant switching, no Git checkout needed

#### Alt Flow 3: Delete Session

1. User deletes session
2. SessionManager retrieves session to get workspacePath
3. SessionManager removes workspace directory (`rm -rf /tmp/claude-sessions/{sessionId}`)
4. SessionManager optionally deletes Git branch from original repo
5. SessionManager removes session from database
6. **Result**: Clean deletion, no orphaned files

## Edge Cases

### Edge Case 1: Workspace Already Exists

- **Situation**: `/tmp/claude-sessions/sess_abc123` already exists (leftover from crash)
- **Expected behavior**: Remove existing workspace, create fresh clone
- **Rationale**: Ensure clean state, prevent corruption

### Edge Case 2: Clone Fails Mid-Operation

- **Situation**: Git clone starts but fails (network error, disk full)
- **Expected behavior**: Clean up partial clone, don't store session in DB, throw error
- **Rationale**: Prevent invalid sessions

### Edge Case 3: Original Repo Deleted After Session Created

- **Situation**: Session's original repo is deleted from filesystem
- **Expected behavior**: Session workspace still exists, can continue using it
- **Rationale**: Cloned workspace is independent

### Edge Case 4: /tmp Directory Cleaned by OS

- **Situation**: OS clears `/tmp/claude-sessions/` (reboot, cleanup script)
- **Expected behavior**: Sessions in DB marked as invalid, error when accessed
- **Rationale**: Detect orphaned sessions, inform user

### Edge Case 5: Very Large Repository

- **Situation**: Cloning 10GB+ repository
- **Expected behavior**: Show progress, allow cancellation, handle timeout
- **Rationale**: Large clones take time, user needs feedback

### Edge Case 6: Insufficient Disk Space

- **Situation**: Not enough space in `/tmp` for clone
- **Expected behavior**: Git clone fails with clear error, session not created
- **Rationale**: Fail gracefully with actionable error

### Edge Case 7: Clone Location Not Writable

- **Situation**: `/tmp/claude-sessions` not writable (permissions issue)
- **Expected behavior**: Clear error message, suggest fix
- **Rationale**: Guide user to resolution

## Dependencies

### Required Features
- [Feature 001]: Database Setup - Requires migrations for workspace_path column
- [Feature 002]: Git Service - Requires cloneRepository() method
- [Feature 003]: Session Manager - Requires refactoring for clone-based approach

### External Dependencies
- Git installed on system
- simple-git npm package with clone support
- Sufficient disk space in `/tmp` directory
- Write permissions in `/tmp` directory

## Technical Notes

### Architecture Considerations

**Before (Branch-Switching)**:
```
Original Repo: /Users/user/my-project
├── Checkout session/sess_1 → Switch branch
├── Checkout session/sess_2 → Switch branch
└── FILE CONFLICTS! Can't run multiple sessions
```

**After (Clone-Based)**:
```
Original Repo: /Users/user/my-project
├── main branch
└── session branches created here

Session 1 Workspace: /tmp/claude-sessions/sess_abc123/my-project
├── Git clone from original
├── Branch: session/sess_abc123
└── Independent filesystem

Session 2 Workspace: /tmp/claude-sessions/sess_def456/my-project
├── Git clone from original
├── Branch: session/sess_def456
└── NO conflicts!
```

### Data Model Changes

```sql
-- Add workspace_path column to sessions table
ALTER TABLE sessions ADD COLUMN workspace_path TEXT NOT NULL DEFAULT '';

-- Update existing sessions with workspace paths
-- (Migration script required)
```

### API Changes

**Updated Session Type**:
```typescript
interface Session {
  id: string;
  title: string;
  rootDirectory: string;      // Original repo path
  workspacePath: string;        // NEW! Cloned workspace path
  branchName: string;
  baseBranch: string;
  gitStatus: string | null;
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number | null;
  metadata: Record<string, unknown> | null;
  isActive: boolean;
}
```

**API Response Example**:
```json
{
  "id": "sess_abc123",
  "title": "Add authentication",
  "rootDirectory": "/Users/yeonwoo/my-project",
  "workspacePath": "/tmp/claude-sessions/sess_abc123/my-project",
  "branchName": "session/sess_abc123",
  "isActive": true
}
```

### Implementation Details

**GitService.cloneRepository()**:
```typescript
async cloneRepository(
  sourceRepo: string,
  targetPath: string,
  branchName: string
): Promise<void> {
  // 1. Create parent directory
  await fs.mkdir(path.dirname(targetPath), { recursive: true });

  // 2. Clone repository
  await git.clone(sourceRepo, targetPath);

  // 3. Checkout target branch
  const clonedGit = simpleGit(targetPath);
  await clonedGit.checkout(branchName);
}
```

**SessionManager.createSession()** (updated):
```typescript
async createSession(options: CreateSessionOptions): Promise<Session> {
  // 1. Validate original repo
  const isGitRepo = await this.gitService.isGitRepo(options.rootDirectory);
  if (!isGitRepo) throw new NotGitRepoError();

  // 2. Generate IDs and paths
  const sessionId = generateSessionId();
  const branchName = `session/${sessionId}`;
  const repoName = path.basename(options.rootDirectory);
  const workspacePath = `/tmp/claude-sessions/${sessionId}/${repoName}`;

  // 3. Create branch in original repo
  await this.gitService.createBranch(
    branchName,
    options.baseBranch || 'main',
    options.rootDirectory
  );

  // 4. Clone to workspace
  await this.gitService.cloneRepository(
    options.rootDirectory,
    workspacePath,
    branchName
  );

  // 5. Store in database
  const session = await this.db.insertSession({
    id: sessionId,
    title: options.title,
    rootDirectory: options.rootDirectory,
    workspacePath,           // NEW!
    branchName,
    baseBranch: options.baseBranch || 'main',
    // ... other fields
  });

  return session;
}
```

**SessionManager.switchSession()** (updated):
```typescript
async switchSession(sessionId: string): Promise<Session> {
  // 1. Get target session
  const session = await this.db.getSession(sessionId);
  if (!session) throw new SessionNotFoundError();

  // 2. Deactivate current session
  await this.db.updateSession(currentId, { isActive: false });

  // 3. Activate target session (NO Git operations!)
  await this.db.updateSession(sessionId, { isActive: true });

  // 4. Return activated session
  return session;
}
```

### Migration Strategy

**Database Migration**:
```typescript
// packages/server/src/db/migrations/add-workspace-path.ts
export async function migrateToCloneBased(db: Database) {
  // 1. Add workspace_path column
  db.exec('ALTER TABLE sessions ADD COLUMN workspace_path TEXT NOT NULL DEFAULT ""');

  // 2. For each existing session
  const sessions = db.prepare('SELECT * FROM sessions').all();
  for (const session of sessions) {
    const repoName = path.basename(session.root_directory);
    const workspacePath = `/tmp/claude-sessions/${session.id}/${repoName}`;

    // 3. Clone to workspace if not exists
    if (!fs.existsSync(workspacePath)) {
      await gitService.cloneRepository(
        session.root_directory,
        workspacePath,
        session.branch_name
      );
    }

    // 4. Update database
    db.prepare('UPDATE sessions SET workspace_path = ? WHERE id = ?')
      .run(workspacePath, session.id);
  }
}
```

### Cleanup Strategy

**Automatic Cleanup**:
- On session delete: Remove workspace immediately
- On app shutdown: Optional cleanup of /tmp/claude-sessions
- On app startup: Verify workspaces exist, mark orphaned sessions

**Manual Cleanup**:
```bash
# Remove all session workspaces
rm -rf /tmp/claude-sessions/*
```

## UI/UX Considerations

N/A - This is a backend architecture change with no direct UI impact

## Non-Functional Requirements

### Performance
- **Session creation**: < 5 seconds (including Git clone)
- **Session switching**: < 100ms (no Git operations)
- **Session deletion**: < 2 seconds (including workspace removal)

### Security
- **Workspace isolation**: Each session can only access its own workspace
- **Path validation**: Prevent directory traversal in workspace paths
- **Permission checks**: Ensure write access to `/tmp/claude-sessions`

### Reliability
- **Atomic operations**: Clone succeeds or session not created
- **Cleanup on failure**: Remove partial clones on error
- **Recovery**: Handle orphaned sessions gracefully

### Scalability
- **Disk space**: Each session uses ~repo size
- **Concurrent sessions**: Support 10+ sessions
- **Large repos**: Handle multi-GB repositories

## Open Questions

- [x] **Q1**: Where should cloned workspaces be stored?
  - **Answer**: `/tmp/claude-sessions/{sessionId}/{repoName}` for automatic OS cleanup

- [x] **Q2**: Should we clone with full history or shallow clone?
  - **Answer**: Full clone to preserve all Git capabilities

- [x] **Q3**: What happens to workspaces on app restart?
  - **Answer**: Persist in /tmp, verify on startup, re-clone if missing

- [x] **Q4**: Should we support custom workspace locations?
  - **Answer**: No in MVP, can add later via configuration

- [x] **Q5**: How to handle very large repositories?
  - **Answer**: Show progress, allow cancellation, document disk space requirements

## Related Features

- [Feature 001]: Database Setup - Requires schema migration
- [Feature 002]: Git Service - Adds cloneRepository() method
- [Feature 003]: Session Manager - Refactored for clone-based approach
- [Feature 005]: REST API - Returns workspacePath in responses

## References

- [Git Clone Documentation](https://git-scm.com/docs/git-clone)
- [simple-git clone method](https://github.com/steveukx/git-js#clone)
- [Clone-Based Sessions Architecture Doc](../../architecture/CLONE-BASED-SESSIONS.md)

---

**Document History**:
- 2025-10-25: Initial documentation after implementation
- 2025-10-25: Added migration strategy and edge cases
