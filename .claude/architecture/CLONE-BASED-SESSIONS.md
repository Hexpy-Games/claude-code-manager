# Clone-Based Session Architecture

## Overview

The Claude Code Manager now uses a **clone-based session architecture**, where each session has its own isolated Git clone (workspace). This is similar to cloning a repository from GitHub for each session.

## Architecture

### Before (Branch-Switching - WRONG ❌)
```
Original Repo: /Users/yeonwoo/my-project
├── Switch to session/sess_1  → Checkout branch
├── Switch to session/sess_2  → Checkout branch
└── FILE CONFLICTS! Can't run multiple sessions concurrently
```

### After (Clone-Based - CORRECT ✅)
```
Original Repo: /Users/yeonwoo/my-project
├── main branch
└── session branches created here

Session 1 Workspace: /tmp/claude-sessions/sess_abc123/my-project
├── Git clone from original repo
├── Branch: session/sess_abc123
└── Only Git-tracked files (no node_modules, build artifacts)

Session 2 Workspace: /tmp/claude-sessions/sess_def456/my-project
├── Git clone from original repo
├── Branch: session/sess_def456
└── Independent filesystem - NO conflicts!
```

## Benefits

✅ **True Isolation**: Each session has its own file system  
✅ **Concurrent Sessions**: Can run multiple sessions at the same time  
✅ **Clean Workspaces**: Only Git-tracked files (like `git clone`)  
✅ **No Merge Conflicts**: Sessions don't interfere with each other

## Implementation

### Database Schema

Added `workspace_path` column to `sessions` table:

\`\`\`sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  root_directory TEXT NOT NULL,
  workspace_path TEXT NOT NULL,  -- NEW!
  branch_name TEXT NOT NULL,
  -- ... other fields
);
\`\`\`

### Session Creation Flow

1. **Create branch** in original repository
2. **Clone repository** to workspace: `/tmp/claude-sessions/{sessionId}/{repoName}`
3. **Checkout** session branch in workspace
4. **Store** workspace path in database

### Session Switching

- Just mark session as active in database
- Claude Code CLI uses `workspacePath` from active session
- No Git operations needed!

### Session Deletion

1. Delete workspace directory (cleanup cloned files)
2. Optionally delete branch from original repository
3. Remove from database

## API Changes

### Session Type

\`\`\`typescript
interface Session {
  id: string;
  title: string;
  rootDirectory: string;    // Original repo path
  workspacePath: string;     // Cloned workspace path (NEW!)
  branchName: string;
  // ... other fields
}
\`\`\`

### Response Example

\`\`\`json
{
  "id": "sess_abc123",
  "title": "Add authentication",
  "rootDirectory": "/Users/yeonwoo/my-project",
  "workspacePath": "/tmp/claude-sessions/sess_abc123/my-project",
  "branchName": "session/sess_abc123",
  "isActive": true
}
\`\`\`

## Usage for Claude Code CLI

When a session is active, Claude Code should use the `workspacePath` for all operations:

\`\`\`typescript
const activeSession = await client.getActiveSession();
if (activeSession) {
  // Use workspace path, NOT rootDirectory!
  process.chdir(activeSession.workspacePath);
}
\`\`\`

## Migration

Existing sessions will need migration:
1. Clone repository to workspace
2. Update database with workspace path
3. Verify workspace has correct branch checked out

