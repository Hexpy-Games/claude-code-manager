# Feature: Git Service

> **Feature ID**: 002
> **Status**: In Progress
> **Owner**: Development Team
> **Created**: 2025-10-23
> **Updated**: 2025-10-23

## Overview

Implement a Git service that provides operations for checking Git installation, validating repositories, creating branches, and managing session branches.

## User Story

**As a** session manager service
**I want** a reliable Git service wrapper
**So that** I can create and manage Git branches for each session

## Acceptance Criteria

- [ ] **AC1**: Can check if Git is installed on the system
- [ ] **AC2**: Can detect if a directory is a Git repository
- [ ] **AC3**: Can initialize a new Git repository
- [ ] **AC4**: Can create a new branch from a base branch
- [ ] **AC5**: Can checkout an existing branch
- [ ] **AC6**: Can get the current branch name
- [ ] **AC7**: Can list all branches
- [ ] **AC8**: Can get repository status (clean/modified)
- [ ] **AC9**: Handles errors gracefully with clear messages
- [ ] **AC10**: All Git operations are tested

## Success Metrics

### Quantitative Metrics
- **Git check**: < 50ms
- **Repo validation**: < 100ms
- **Branch operations**: < 500ms
- **Test coverage**: ≥ 80%

### Qualitative Metrics
- Clear error messages for debugging
- Type-safe API
- Easy to mock for testing

## User Flows

### Primary Flow (Happy Path)

1. **Check if directory is Git repo**
   - Service calls `isGitRepo('/path/to/project')`
   - Returns `true` if Git repo, `false` otherwise

2. **Create session branch**
   - Service calls `createBranch('session/sess_123', 'main')`
   - Git creates new branch from main
   - Returns success

3. **Checkout session branch**
   - Service calls `checkoutBranch('session/sess_123')`
   - Git switches to branch
   - Returns success

### Alternative Flows

#### Alt Flow 1: Git Not Installed

1. Service calls any Git operation
2. System detects Git not installed
3. Throws `GitNotInstalledError` with installation instructions
4. Application shows error to user

#### Alt Flow 2: Not a Git Repository

1. Service calls `isGitRepo('/not/a/repo')`
2. System checks for .git directory
3. Returns `false`
4. Application prompts user to initialize Git

#### Alt Flow 3: Branch Already Exists

1. Service calls `createBranch('existing-branch', 'main')`
2. Git detects branch exists
3. Throws `BranchExistsError`
4. Application handles gracefully

## Edge Cases

### Edge Case 1: Git Installed but Not in PATH
- **Situation**: Git installed but not in system PATH
- **Expected behavior**: Check common installation paths
- **Rationale**: Help user even with misconfigured Git

### Edge Case 2: Empty Repository (No Commits)
- **Situation**: Repository initialized but no commits yet
- **Expected behavior**: Handle gracefully, inform user
- **Rationale**: New projects may not have commits

### Edge Case 3: Detached HEAD State
- **Situation**: Repository in detached HEAD state
- **Expected behavior**: Detect and handle appropriately
- **Rationale**: Don't break if user manually uses Git

### Edge Case 4: Uncommitted Changes
- **Situation**: User has uncommitted changes
- **Expected behavior**: Track status but allow branch operations
- **Rationale**: WAL mode and Git handle this

## Dependencies

### Required Features
- [Feature 001]: Database Setup - For storing Git state

### External Dependencies
- simple-git npm package (already installed)
- Git installed on system
- Node.js child_process APIs

## Technical Notes

### Architecture Considerations
- Use simple-git library for operations
- Wrapper around simple-git for error handling
- Type-safe interfaces
- Async operations (Git commands can be slow)

### API Design

```typescript
interface GitService {
  // Check operations
  checkGitInstalled(): Promise<boolean>;
  isGitRepo(directory: string): Promise<boolean>;

  // Repository operations
  initRepo(directory: string): Promise<void>;

  // Branch operations
  createBranch(branchName: string, baseBranch: string, directory: string): Promise<void>;
  checkoutBranch(branchName: string, directory: string): Promise<void>;
  getCurrentBranch(directory: string): Promise<string>;
  getBranches(directory: string): Promise<string[]>;
  branchExists(branchName: string, directory: string): Promise<boolean>;

  // Status operations
  getStatus(directory: string): Promise<GitStatus>;
}

interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  created: string[];
  deleted: string[];
  renamed: string[];
  isClean: boolean;
}
```

### Error Types

```typescript
class GitNotInstalledError extends Error {
  name = 'GitNotInstalledError';
}

class NotGitRepoError extends Error {
  name = 'NotGitRepoError';
}

class BranchExistsError extends Error {
  name = 'BranchExistsError';
}

class GitOperationError extends Error {
  name = 'GitOperationError';
}
```

## UI/UX Considerations

N/A - This is a backend service with no UI

## Non-Functional Requirements

### Performance
- Git installed check: < 50ms
- Repo validation: < 100ms
- Branch operations: < 500ms

### Security
- No shell injection (use simple-git safely)
- Validate directory paths

### Reliability
- Retry logic for transient failures
- Clear error messages
- Timeout handling

## Open Questions

- [x] **Q1**: Should we support Git submodules?
  - **Answer**: No, not in MVP. Add later if needed.

- [x] **Q2**: Should we auto-commit before switching branches?
  - **Answer**: No, let Git handle uncommitted changes naturally.

- [x] **Q3**: Should we support sparse checkouts?
  - **Answer**: No, not needed for MVP.

## Related Features

- [Feature 001]: Database - Stores Git state
- [Feature 003]: Session Manager - Uses this service
- [Feature 005]: REST API - Exposes Git status

## References

- [simple-git Documentation](https://github.com/steveukx/git-js)
- [Git Documentation](https://git-scm.com/doc)

---

**Document History**:
- 2025-10-23: Initial draft
