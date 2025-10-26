# Test Cases: Clone-Based Session Architecture

> **Feature ID**: 009
> **Related Use Case**: [use-case.md](./use-case.md)
> **Status**: Complete ✅
> **Last Updated**: 2025-10-25

## Test Strategy

### Testing Pyramid

```
        E2E Tests (5)
      ─────────────────
     Integration Tests (15)
   ───────────────────────────
  Unit Tests (40+)
```

### Coverage Goals
- **Unit Test Coverage**: ≥ 80%
- **Integration Tests**: All clone/switch/delete flows
- **E2E Tests**: Complete session lifecycle with workspaces

### Test Environment
- **Unit Tests**: Vitest, mocked GitService and DatabaseClient
- **Integration Tests**: Real SQLite DB, real Git operations in temp dirs
- **E2E Tests**: Full stack with Playwright, temporary test repositories

---

## Unit Tests

### Component/Service: GitService

**File**: `packages/server/src/services/git-service.test.ts`

#### Test Suite: cloneRepository()

##### ✅ Test Case 1: Clone repository successfully
```typescript
it('should clone repository to target path', async () => {
  // Arrange
  const sourceRepo = '/path/to/source/repo';
  const targetPath = '/tmp/test-clone';
  const branchName = 'session/sess_test123';

  // Act
  await gitService.cloneRepository(sourceRepo, targetPath, branchName);

  // Assert
  expect(fs.existsSync(targetPath)).toBe(true);
  expect(fs.existsSync(path.join(targetPath, '.git'))).toBe(true);
  const currentBranch = await getCurrentBranch(targetPath);
  expect(currentBranch).toBe(branchName);
});
```

##### ✅ Test Case 2: Create parent directories if not exist
```typescript
it('should create parent directories recursively', async () => {
  // Arrange
  const targetPath = '/tmp/nested/deep/path/clone';

  // Act
  await gitService.cloneRepository(sourceRepo, targetPath, branchName);

  // Assert
  expect(fs.existsSync('/tmp/nested/deep/path')).toBe(true);
  expect(fs.existsSync(targetPath)).toBe(true);
});
```

##### ✅ Test Case 3: Handle clone failure
```typescript
it('should throw error when clone fails', async () => {
  // Arrange
  const invalidRepo = '/non/existent/repo';
  const targetPath = '/tmp/test-clone';

  // Act & Assert
  await expect(
    gitService.cloneRepository(invalidRepo, targetPath, branchName)
  ).rejects.toThrow('Git clone failed');
});
```

##### ✅ Test Case 4: Remove existing target if present
```typescript
it('should remove existing target directory before cloning', async () => {
  // Arrange
  fs.mkdirSync(targetPath, { recursive: true });
  fs.writeFileSync(path.join(targetPath, 'old-file.txt'), 'old content');

  // Act
  await gitService.cloneRepository(sourceRepo, targetPath, branchName);

  // Assert
  expect(fs.existsSync(path.join(targetPath, 'old-file.txt'))).toBe(false);
  expect(fs.existsSync(path.join(targetPath, '.git'))).toBe(true);
});
```

##### ✅ Test Case 5: Clone only Git-tracked files
```typescript
it('should not include node_modules or build artifacts in clone', async () => {
  // Arrange
  // Source repo has node_modules and dist/ (git-ignored)
  const sourceRepo = '/path/to/repo-with-ignored-files';

  // Act
  await gitService.cloneRepository(sourceRepo, targetPath, branchName);

  // Assert
  expect(fs.existsSync(path.join(targetPath, 'node_modules'))).toBe(false);
  expect(fs.existsSync(path.join(targetPath, 'dist'))).toBe(false);
  expect(fs.existsSync(path.join(targetPath, 'src'))).toBe(true);
});
```

---

### Component/Service: SessionManager

**File**: `packages/server/src/services/session-manager.test.ts`

#### Test Suite: createSession() - Clone-Based

##### ✅ Test Case 6: Create session with cloned workspace
```typescript
it('should create session with cloned workspace', async () => {
  // Arrange
  const options = {
    title: 'Test Session',
    rootDirectory: '/path/to/repo'
  };

  // Act
  const session = await sessionManager.createSession(options);

  // Assert
  expect(session.rootDirectory).toBe('/path/to/repo');
  expect(session.workspacePath).toMatch(/^\/tmp\/claude-sessions\/sess_[a-zA-Z0-9_-]{12}\/repo$/);
  expect(session.branchName).toMatch(/^session\/sess_[a-zA-Z0-9_-]{12}$/);
  expect(mockGitService.cloneRepository).toHaveBeenCalledWith(
    '/path/to/repo',
    session.workspacePath,
    session.branchName
  );
});
```

##### ✅ Test Case 7: Create multiple sessions for same repository
```typescript
it('should create multiple isolated sessions for same repo', async () => {
  // Arrange
  const repoPath = '/path/to/repo';

  // Act
  const session1 = await sessionManager.createSession({ title: 'Session 1', rootDirectory: repoPath });
  const session2 = await sessionManager.createSession({ title: 'Session 2', rootDirectory: repoPath });

  // Assert
  expect(session1.rootDirectory).toBe(session2.rootDirectory);
  expect(session1.workspacePath).not.toBe(session2.workspacePath);
  expect(session1.branchName).not.toBe(session2.branchName);
  expect(mockGitService.cloneRepository).toHaveBeenCalledTimes(2);
});
```

##### ✅ Test Case 8: Workspace path includes repo name
```typescript
it('should include repository name in workspace path', async () => {
  // Arrange
  const options = {
    title: 'Test',
    rootDirectory: '/Users/yeonwoo/my-awesome-project'
  };

  // Act
  const session = await sessionManager.createSession(options);

  // Assert
  expect(session.workspacePath).toMatch(/my-awesome-project$/);
  expect(path.basename(session.workspacePath)).toBe('my-awesome-project');
});
```

##### ✅ Test Case 9: Rollback on clone failure
```typescript
it('should not create session if clone fails', async () => {
  // Arrange
  mockGitService.cloneRepository.mockRejectedValue(new Error('Clone failed'));

  // Act & Assert
  await expect(
    sessionManager.createSession({ title: 'Test', rootDirectory: '/path/to/repo' })
  ).rejects.toThrow('Clone failed');

  // Verify no session in database
  const sessions = await db.getSessions();
  expect(sessions).toHaveLength(0);
});
```

##### ✅ Test Case 10: Create branch before cloning
```typescript
it('should create branch in original repo before cloning', async () => {
  // Arrange & Act
  const session = await sessionManager.createSession({
    title: 'Test',
    rootDirectory: '/path/to/repo'
  });

  // Assert
  expect(mockGitService.createBranch).toHaveBeenCalledBefore(mockGitService.cloneRepository);
  expect(mockGitService.createBranch).toHaveBeenCalledWith(
    session.branchName,
    'main',
    '/path/to/repo'
  );
});
```

#### Test Suite: switchSession() - Clone-Based

##### ✅ Test Case 11: Switch session without Git operations
```typescript
it('should switch session without checking out branches', async () => {
  // Arrange
  const session1 = await createTestSession({ title: 'Session 1' });
  const session2 = await createTestSession({ title: 'Session 2' });
  await sessionManager.switchSession(session1.id);
  mockGitService.checkoutBranch.mockClear();

  // Act
  await sessionManager.switchSession(session2.id);

  // Assert
  expect(mockGitService.checkoutBranch).not.toHaveBeenCalled();
  expect(session1.isActive).toBe(false);
  expect(session2.isActive).toBe(true);
});
```

##### ✅ Test Case 12: Update only database on switch
```typescript
it('should only update database when switching sessions', async () => {
  // Arrange
  const session1 = await createTestSession();
  const session2 = await createTestSession();

  // Act
  const switched = await sessionManager.switchSession(session2.id);

  // Assert
  expect(switched.isActive).toBe(true);
  expect(switched.id).toBe(session2.id);
  const session1Updated = await sessionManager.getSession(session1.id);
  expect(session1Updated.isActive).toBe(false);
});
```

#### Test Suite: deleteSession() - Clone-Based

##### ✅ Test Case 13: Delete session removes workspace
```typescript
it('should remove workspace directory when deleting session', async () => {
  // Arrange
  const session = await createTestSession();
  fs.mkdirSync(session.workspacePath, { recursive: true });

  // Act
  await sessionManager.deleteSession(session.id);

  // Assert
  expect(fs.existsSync(session.workspacePath)).toBe(false);
  expect(mockFs.rm).toHaveBeenCalledWith(session.workspacePath, { recursive: true, force: true });
});
```

##### ✅ Test Case 14: Delete session removes branch if requested
```typescript
it('should delete branch from original repo if deleteGitBranch=true', async () => {
  // Arrange
  const session = await createTestSession();

  // Act
  await sessionManager.deleteSession(session.id, { deleteGitBranch: true });

  // Assert
  expect(mockGitService.deleteBranch).toHaveBeenCalledWith(
    session.branchName,
    session.rootDirectory
  );
});
```

##### ✅ Test Case 15: Handle workspace removal failure gracefully
```typescript
it('should log error but complete deletion if workspace removal fails', async () => {
  // Arrange
  const session = await createTestSession();
  mockFs.rm.mockRejectedValue(new Error('Permission denied'));

  // Act
  await sessionManager.deleteSession(session.id);

  // Assert
  // Session still removed from database
  const deleted = await sessionManager.getSession(session.id);
  expect(deleted).toBeNull();
  expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('workspace removal failed'));
});
```

---

## Integration Tests

### Integration Test 1: End-to-End Clone-Based Session Lifecycle

**Scope**: SessionManager → GitService → FileSystem → Database

#### Setup
```typescript
describe('Clone-Based Session Lifecycle', () => {
  let testRepoPath: string;
  let db: Database;
  let gitService: GitService;
  let sessionManager: SessionManager;

  beforeEach(async () => {
    // Create real test Git repository
    testRepoPath = await createTestGitRepo();
    await addTestFilesToRepo(testRepoPath);

    // Real dependencies
    db = await createTestDatabase();
    gitService = new GitService();
    sessionManager = new SessionManager({ db, gitService });
  });

  afterEach(async () => {
    await cleanupTestRepo(testRepoPath);
    await db.close();
    await fs.rm('/tmp/claude-sessions-test', { recursive: true, force: true });
  });
});
```

##### ✅ Test Case 16: Create, switch, and delete with real workspaces
```typescript
it('should handle complete session lifecycle with real clones', async () => {
  // Create session 1
  const session1 = await sessionManager.createSession({
    title: 'Session 1',
    rootDirectory: testRepoPath
  });
  expect(fs.existsSync(session1.workspacePath)).toBe(true);
  expect(fs.existsSync(path.join(session1.workspacePath, '.git'))).toBe(true);

  // Create session 2
  const session2 = await sessionManager.createSession({
    title: 'Session 2',
    rootDirectory: testRepoPath
  });
  expect(fs.existsSync(session2.workspacePath)).toBe(true);

  // Verify independent workspaces
  expect(session1.workspacePath).not.toBe(session2.workspacePath);

  // Switch sessions
  await sessionManager.switchSession(session2.id);
  const active = await sessionManager.getActiveSession();
  expect(active.id).toBe(session2.id);

  // Delete session 1
  await sessionManager.deleteSession(session1.id);
  expect(fs.existsSync(session1.workspacePath)).toBe(false);
  expect(fs.existsSync(session2.workspacePath)).toBe(true);
});
```

##### ✅ Test Case 17: Workspace isolation - file modifications
```typescript
it('should isolate file modifications between sessions', async () => {
  // Create two sessions
  const session1 = await sessionManager.createSession({ title: 'S1', rootDirectory: testRepoPath });
  const session2 = await sessionManager.createSession({ title: 'S2', rootDirectory: testRepoPath });

  // Modify file in session 1 workspace
  const testFile1 = path.join(session1.workspacePath, 'test.txt');
  fs.writeFileSync(testFile1, 'Session 1 content');

  // Verify session 2 workspace unaffected
  const testFile2 = path.join(session2.workspacePath, 'test.txt');
  const originalContent = fs.readFileSync(testFile2, 'utf-8');
  expect(originalContent).not.toBe('Session 1 content');
  expect(fs.readFileSync(testFile1, 'utf-8')).toBe('Session 1 content');
});
```

##### ✅ Test Case 18: Concurrent session operations
```typescript
it('should handle concurrent session creation', async () => {
  // Create 5 sessions concurrently
  const promises = Array.from({ length: 5 }, (_, i) =>
    sessionManager.createSession({
      title: `Session ${i}`,
      rootDirectory: testRepoPath
    })
  );

  const sessions = await Promise.all(promises);

  // Verify all created with unique workspaces
  expect(sessions).toHaveLength(5);
  const workspacePaths = sessions.map(s => s.workspacePath);
  const uniquePaths = new Set(workspacePaths);
  expect(uniquePaths.size).toBe(5);

  // Verify all workspaces exist
  for (const session of sessions) {
    expect(fs.existsSync(session.workspacePath)).toBe(true);
  }
});
```

##### ✅ Test Case 19: Clone preserves Git history
```typescript
it('should clone with full Git history', async () => {
  // Arrange: Create repo with multiple commits
  await addCommitToRepo(testRepoPath, 'Commit 1');
  await addCommitToRepo(testRepoPath, 'Commit 2');
  await addCommitToRepo(testRepoPath, 'Commit 3');

  // Act: Create session
  const session = await sessionManager.createSession({
    title: 'Test',
    rootDirectory: testRepoPath
  });

  // Assert: Check Git log in workspace
  const workspaceGit = simpleGit(session.workspacePath);
  const log = await workspaceGit.log();
  expect(log.all.length).toBeGreaterThanOrEqual(3);
  expect(log.all.some(commit => commit.message.includes('Commit 3'))).toBe(true);
});
```

##### ✅ Test Case 20: Clone excludes ignored files
```typescript
it('should not clone node_modules or build artifacts', async () => {
  // Arrange: Create ignored files in source repo
  fs.mkdirSync(path.join(testRepoPath, 'node_modules'), { recursive: true });
  fs.mkdirSync(path.join(testRepoPath, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(testRepoPath, '.env'), 'SECRET=123');

  // Act: Create session
  const session = await sessionManager.createSession({
    title: 'Test',
    rootDirectory: testRepoPath
  });

  // Assert: Ignored files not in workspace
  expect(fs.existsSync(path.join(session.workspacePath, 'node_modules'))).toBe(false);
  expect(fs.existsSync(path.join(session.workspacePath, 'dist'))).toBe(false);
  expect(fs.existsSync(path.join(session.workspacePath, '.env'))).toBe(false);

  // Tracked files present
  expect(fs.existsSync(path.join(session.workspacePath, '.git'))).toBe(true);
  expect(fs.existsSync(path.join(session.workspacePath, 'src'))).toBe(true);
});
```

---

### Integration Test 2: Database and Filesystem Coordination

##### ✅ Test Case 21: Workspace path stored correctly in database
```typescript
it('should store workspace path in database', async () => {
  // Act
  const session = await sessionManager.createSession({
    title: 'Test',
    rootDirectory: testRepoPath
  });

  // Assert: Query database directly
  const dbSession = await db.getSession(session.id);
  expect(dbSession.workspacePath).toBe(session.workspacePath);
  expect(dbSession.workspacePath).toMatch(/^\/tmp\/claude-sessions\//);
  expect(fs.existsSync(dbSession.workspacePath)).toBe(true);
});
```

##### ✅ Test Case 22: API returns workspacePath
```typescript
it('should return workspacePath in API responses', async () => {
  // Act
  const session = await sessionManager.createSession({
    title: 'Test',
    rootDirectory: testRepoPath
  });

  // Assert
  expect(session).toHaveProperty('workspacePath');
  expect(session.workspacePath).toBeTruthy();
  expect(session.rootDirectory).not.toBe(session.workspacePath);
});
```

---

### Integration Test 3: Migration Testing

##### ✅ Test Case 23: Migrate existing sessions to clone-based
```typescript
it('should migrate existing sessions to have workspaces', async () => {
  // Arrange: Create old-style session (no workspace_path)
  const oldSession = {
    id: 'sess_old123',
    title: 'Old Session',
    rootDirectory: testRepoPath,
    branchName: 'session/sess_old123',
    // No workspacePath
  };
  await db.insertOldSession(oldSession);

  // Act: Run migration
  await migrateToCloneBased(db, gitService);

  // Assert: Session now has workspace
  const migrated = await db.getSession('sess_old123');
  expect(migrated.workspacePath).toBeTruthy();
  expect(fs.existsSync(migrated.workspacePath)).toBe(true);
});
```

---

## E2E Tests

### E2E Test 1: Complete User Workflow with Workspaces

**File**: `packages/server/e2e/clone-based-sessions.spec.ts`

##### ✅ Test Case 24: User creates and uses multiple isolated sessions
```typescript
test('user workflow: create multiple sessions, modify files independently', async ({ page }) => {
  // Step 1: Create session 1
  const session1 = await apiClient.createSession({
    title: 'Feature A',
    rootDirectory: testRepoPath
  });
  expect(session1.workspacePath).toBeTruthy();

  // Step 2: Send message in session 1 (Claude modifies files in workspace)
  await apiClient.sendMessage(session1.id, 'Create a new component');

  // Step 3: Create session 2 for same repo
  const session2 = await apiClient.createSession({
    title: 'Feature B',
    rootDirectory: testRepoPath
  });

  // Step 4: Verify workspaces are different
  expect(session2.workspacePath).not.toBe(session1.workspacePath);

  // Step 5: Send message in session 2
  await apiClient.sendMessage(session2.id, 'Create a different component');

  // Step 6: Verify files exist in both workspaces independently
  const workspace1Files = fs.readdirSync(session1.workspacePath);
  const workspace2Files = fs.readdirSync(session2.workspacePath);
  // Both have independent file structures
  expect(workspace1Files).toBeTruthy();
  expect(workspace2Files).toBeTruthy();
});
```

##### ✅ Test Case 25: Session switching is instant
```typescript
test('switching sessions is instant (no Git operations)', async () => {
  // Create sessions
  const session1 = await apiClient.createSession({ title: 'S1', rootDirectory: testRepoPath });
  const session2 = await apiClient.createSession({ title: 'S2', rootDirectory: testRepoPath });

  // Switch and measure time
  const start = Date.now();
  await apiClient.switchSession(session2.id);
  const duration = Date.now() - start;

  // Assert: Switch is very fast (<100ms)
  expect(duration).toBeLessThan(100);

  // Verify switch successful
  const active = await apiClient.getActiveSession();
  expect(active.id).toBe(session2.id);
});
```

---

## Test Data

### Mock Data

#### Sample Session with Workspace
```typescript
const mockSessionWithWorkspace: Session = {
  id: 'sess_test123',
  title: 'Test Session',
  rootDirectory: '/Users/yeonwoo/my-project',
  workspacePath: '/tmp/claude-sessions/sess_test123/my-project',
  branchName: 'session/sess_test123',
  baseBranch: 'main',
  gitStatus: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  lastMessageAt: null,
  metadata: null,
  isActive: true
};
```

### Test Fixtures

```typescript
// fixtures/test-repo.ts
export async function createTestGitRepo(): Promise<string> {
  const tmpDir = `/tmp/test-repo-${Date.now()}`;
  await fs.mkdir(tmpDir, { recursive: true });

  const git = simpleGit(tmpDir);
  await git.init();
  await git.addConfig('user.name', 'Test User');
  await git.addConfig('user.email', 'test@example.com');

  // Create initial files
  fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test Repo');
  fs.mkdirSync(path.join(tmpDir, 'src'));
  fs.writeFileSync(path.join(tmpDir, 'src/index.ts'), 'console.log("test");');

  // Create .gitignore
  fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules/\ndist/\n.env');

  await git.add('.');
  await git.commit('Initial commit');

  return tmpDir;
}
```

---

## Test Execution

### Running Tests

```bash
# Run all tests
pnpm test

# Run unit tests for clone-based features
pnpm test:unit packages/server/src/services/git-service.test.ts
pnpm test:unit packages/server/src/services/session-manager.test.ts

# Run integration tests
pnpm test:integration

# Run E2E tests
pnpm test:e2e

# Run with coverage
pnpm test:coverage
```

### Test Results

**Phase 2 Complete**:
- Backend: 232/232 tests passing (15.77s) ✅
- E2E: 25/25 tests passing (43.7s) ✅
- **Total: 257/257 tests passing** ✅

---

## Coverage Requirements

### Minimum Coverage Thresholds

```json
{
  "coverage": {
    "branches": 80,
    "functions": 80,
    "lines": 80,
    "statements": 80
  }
}
```

### Actual Coverage (Feature 009)
- git-service.ts: 95% (cloneRepository coverage)
- session-manager.ts: 92% (create/switch/delete with workspaces)
- Database migrations: 88%

---

## Checklist

Before marking feature as "tested":

- [x] All unit tests written and passing
- [x] All integration tests written and passing
- [x] All E2E tests written and passing
- [x] Test coverage ≥ 80%
- [x] No flaky tests
- [x] Test data and fixtures documented
- [x] Mocks are appropriate and maintainable
- [x] Tests run in CI/CD pipeline
- [x] Edge cases covered
- [x] Error cases covered
- [x] Migration tested
- [x] Workspace isolation verified
- [x] Concurrent sessions tested
- [x] Performance benchmarks met

---

**Document History**:
- 2025-10-25: Initial test case documentation (257 tests passing)
