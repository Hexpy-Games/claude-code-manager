# Test Cases: Git Service

> **Feature ID**: 002
> **Related Use Case**: [use-case.md](./use-case.md)
> **Status**: In Progress
> **Last Updated**: 2025-10-23

## Test Strategy

### Testing Pyramid

```
        E2E Tests (None)
      ─────────────────
     Integration Tests (Few)
   ───────────────────────────
  Unit Tests (Many)
```

### Coverage Goals
- **Unit Test Coverage**: ≥ 80%
- **Integration Tests**: Git operations with real temp repos
- **E2E Tests**: N/A (backend only)

### Test Environment
- **Unit Tests**: Vitest, mocked simple-git where appropriate
- **Integration Tests**: Vitest, temp directories with real Git repos
- **Test Cleanup**: All temp directories deleted after tests

---

## Unit Tests

### Component/Service: GitService

**File**: `packages/server/src/services/git-service.test.ts`

#### Test Suite: checkGitInstalled()

##### ✅ Test Case 1: Returns true when Git is installed
```typescript
it('should return true when Git is installed', async () => {
  // Arrange
  const gitService = new GitService();

  // Act
  const result = await gitService.checkGitInstalled();

  // Assert
  expect(result).toBe(true);
});
```

##### ✅ Test Case 2: Returns false when Git is not installed
```typescript
it('should return false when Git is not found', async () => {
  // Arrange
  const gitService = new GitService();
  // Mock simpleGit to throw "git not found" error

  // Act
  const result = await gitService.checkGitInstalled();

  // Assert
  expect(result).toBe(false);
});
```

#### Test Suite: isGitRepo()

##### ✅ Test Case 1: Returns true for valid Git repository
```typescript
it('should return true for a valid Git repository', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = await createTempGitRepo();

  // Act
  const result = await gitService.isGitRepo(tempDir);

  // Assert
  expect(result).toBe(true);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

##### ✅ Test Case 2: Returns false for non-Git directory
```typescript
it('should return false for a non-Git directory', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

  // Act
  const result = await gitService.isGitRepo(tempDir);

  // Assert
  expect(result).toBe(false);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

##### ✅ Test Case 3: Returns false for nonexistent directory
```typescript
it('should return false for nonexistent directory', async () => {
  // Arrange
  const gitService = new GitService();
  const nonexistentPath = '/path/that/does/not/exist';

  // Act
  const result = await gitService.isGitRepo(nonexistentPath);

  // Assert
  expect(result).toBe(false);
});
```

#### Test Suite: initRepo()

##### ✅ Test Case 1: Initializes Git repository successfully
```typescript
it('should initialize a Git repository', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

  // Act
  await gitService.initRepo(tempDir);

  // Assert
  const isRepo = await gitService.isGitRepo(tempDir);
  expect(isRepo).toBe(true);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

##### ✅ Test Case 2: Throws error for nonexistent directory
```typescript
it('should throw error when directory does not exist', async () => {
  // Arrange
  const gitService = new GitService();
  const nonexistentPath = '/path/that/does/not/exist';

  // Act & Assert
  await expect(gitService.initRepo(nonexistentPath))
    .rejects.toThrow(GitOperationError);
});
```

##### ✅ Test Case 3: Does not fail if already a Git repo
```typescript
it('should handle already initialized repository', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = await createTempGitRepo();

  // Act & Assert
  await expect(gitService.initRepo(tempDir)).resolves.not.toThrow();

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

#### Test Suite: createBranch()

##### ✅ Test Case 1: Creates branch from base branch
```typescript
it('should create a new branch from base branch', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = await createTempGitRepoWithCommit();

  // Act
  await gitService.createBranch('feature/test', 'main', tempDir);

  // Assert
  const branches = await gitService.getBranches(tempDir);
  expect(branches).toContain('feature/test');

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

##### ✅ Test Case 2: Throws error when branch already exists
```typescript
it('should throw BranchExistsError when branch already exists', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = await createTempGitRepoWithCommit();
  await gitService.createBranch('feature/test', 'main', tempDir);

  // Act & Assert
  await expect(
    gitService.createBranch('feature/test', 'main', tempDir)
  ).rejects.toThrow(BranchExistsError);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

##### ✅ Test Case 3: Throws error when base branch does not exist
```typescript
it('should throw error when base branch does not exist', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = await createTempGitRepoWithCommit();

  // Act & Assert
  await expect(
    gitService.createBranch('feature/test', 'nonexistent', tempDir)
  ).rejects.toThrow(GitOperationError);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

##### ✅ Test Case 4: Throws error when not a Git repo
```typescript
it('should throw NotGitRepoError when directory is not a Git repo', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

  // Act & Assert
  await expect(
    gitService.createBranch('feature/test', 'main', tempDir)
  ).rejects.toThrow(NotGitRepoError);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

##### ✅ Test Case 5: Handles empty repository (no commits)
```typescript
it('should throw error for empty repository with no commits', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  await gitService.initRepo(tempDir);

  // Act & Assert
  await expect(
    gitService.createBranch('feature/test', 'main', tempDir)
  ).rejects.toThrow(GitOperationError);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

#### Test Suite: checkoutBranch()

##### ✅ Test Case 1: Checks out existing branch
```typescript
it('should checkout an existing branch', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = await createTempGitRepoWithCommit();
  await gitService.createBranch('feature/test', 'main', tempDir);

  // Act
  await gitService.checkoutBranch('feature/test', tempDir);

  // Assert
  const currentBranch = await gitService.getCurrentBranch(tempDir);
  expect(currentBranch).toBe('feature/test');

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

##### ✅ Test Case 2: Throws error when branch does not exist
```typescript
it('should throw error when branch does not exist', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = await createTempGitRepoWithCommit();

  // Act & Assert
  await expect(
    gitService.checkoutBranch('nonexistent', tempDir)
  ).rejects.toThrow(GitOperationError);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

##### ✅ Test Case 3: Handles checkout with uncommitted changes
```typescript
it('should handle checkout with uncommitted changes', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = await createTempGitRepoWithCommit();
  await gitService.createBranch('feature/test', 'main', tempDir);

  // Create uncommitted change
  fs.writeFileSync(path.join(tempDir, 'test.txt'), 'modified content');

  // Act
  await gitService.checkoutBranch('feature/test', tempDir);

  // Assert
  const currentBranch = await gitService.getCurrentBranch(tempDir);
  expect(currentBranch).toBe('feature/test');

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

#### Test Suite: getCurrentBranch()

##### ✅ Test Case 1: Returns current branch name
```typescript
it('should return the current branch name', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = await createTempGitRepoWithCommit();

  // Act
  const branch = await gitService.getCurrentBranch(tempDir);

  // Assert
  expect(branch).toBe('main');

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

##### ✅ Test Case 2: Throws error for non-Git directory
```typescript
it('should throw NotGitRepoError for non-Git directory', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

  // Act & Assert
  await expect(gitService.getCurrentBranch(tempDir))
    .rejects.toThrow(NotGitRepoError);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

##### ✅ Test Case 3: Handles detached HEAD state
```typescript
it('should handle detached HEAD state', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = await createTempGitRepoWithCommit();
  // Checkout specific commit to create detached HEAD

  // Act
  const branch = await gitService.getCurrentBranch(tempDir);

  // Assert
  expect(branch).toContain('HEAD');

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

#### Test Suite: getBranches()

##### ✅ Test Case 1: Returns all branches
```typescript
it('should return all branches in the repository', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = await createTempGitRepoWithCommit();
  await gitService.createBranch('feature/test1', 'main', tempDir);
  await gitService.createBranch('feature/test2', 'main', tempDir);

  // Act
  const branches = await gitService.getBranches(tempDir);

  // Assert
  expect(branches).toContain('main');
  expect(branches).toContain('feature/test1');
  expect(branches).toContain('feature/test2');
  expect(branches.length).toBeGreaterThanOrEqual(3);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

##### ✅ Test Case 2: Returns empty array for new repo with no commits
```typescript
it('should handle repository with no commits', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  await gitService.initRepo(tempDir);

  // Act
  const branches = await gitService.getBranches(tempDir);

  // Assert
  expect(branches).toEqual([]);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

##### ✅ Test Case 3: Throws error for non-Git directory
```typescript
it('should throw NotGitRepoError for non-Git directory', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));

  // Act & Assert
  await expect(gitService.getBranches(tempDir))
    .rejects.toThrow(NotGitRepoError);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

#### Test Suite: branchExists()

##### ✅ Test Case 1: Returns true for existing branch
```typescript
it('should return true for existing branch', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = await createTempGitRepoWithCommit();

  // Act
  const exists = await gitService.branchExists('main', tempDir);

  // Assert
  expect(exists).toBe(true);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

##### ✅ Test Case 2: Returns false for non-existing branch
```typescript
it('should return false for non-existing branch', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = await createTempGitRepoWithCommit();

  // Act
  const exists = await gitService.branchExists('nonexistent', tempDir);

  // Assert
  expect(exists).toBe(false);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

#### Test Suite: getStatus()

##### ✅ Test Case 1: Returns clean status for clean repo
```typescript
it('should return clean status for clean repository', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = await createTempGitRepoWithCommit();

  // Act
  const status = await gitService.getStatus(tempDir);

  // Assert
  expect(status.isClean).toBe(true);
  expect(status.branch).toBe('main');
  expect(status.modified).toEqual([]);
  expect(status.created).toEqual([]);
  expect(status.deleted).toEqual([]);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

##### ✅ Test Case 2: Detects modified files
```typescript
it('should detect modified files', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = await createTempGitRepoWithCommit();
  const testFile = path.join(tempDir, 'test.txt');

  // Modify file
  fs.writeFileSync(testFile, 'modified content');

  // Act
  const status = await gitService.getStatus(tempDir);

  // Assert
  expect(status.isClean).toBe(false);
  expect(status.modified).toContain('test.txt');

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

##### ✅ Test Case 3: Detects created files
```typescript
it('should detect created (untracked) files', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = await createTempGitRepoWithCommit();

  // Create new file
  fs.writeFileSync(path.join(tempDir, 'new-file.txt'), 'new content');

  // Act
  const status = await gitService.getStatus(tempDir);

  // Assert
  expect(status.isClean).toBe(false);
  expect(status.created).toContain('new-file.txt');

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

##### ✅ Test Case 4: Detects deleted files
```typescript
it('should detect deleted files', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = await createTempGitRepoWithCommit();
  const testFile = path.join(tempDir, 'test.txt');

  // Delete file
  fs.unlinkSync(testFile);

  // Act
  const status = await gitService.getStatus(tempDir);

  // Assert
  expect(status.isClean).toBe(false);
  expect(status.deleted).toContain('test.txt');

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

##### ✅ Test Case 5: Detects renamed files
```typescript
it('should detect renamed files', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = await createTempGitRepoWithCommit();

  // Rename file using git mv
  const git = simpleGit(tempDir);
  await git.mv('test.txt', 'renamed.txt');

  // Act
  const status = await gitService.getStatus(tempDir);

  // Assert
  expect(status.isClean).toBe(false);
  expect(status.renamed.length).toBeGreaterThan(0);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

##### ✅ Test Case 6: Returns ahead/behind counts
```typescript
it('should return ahead/behind counts', async () => {
  // Arrange
  const gitService = new GitService();
  const tempDir = await createTempGitRepoWithCommit();

  // Act
  const status = await gitService.getStatus(tempDir);

  // Assert
  expect(status.ahead).toBeDefined();
  expect(status.behind).toBeDefined();
  expect(typeof status.ahead).toBe('number');
  expect(typeof status.behind).toBe('number');

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});
```

---

## Integration Tests

### Integration Test 1: Complete Git Workflow

**Scope**: Initialize repo → Create branch → Checkout → Check status

#### Setup
```typescript
describe('Git Service Integration', () => {
  let tempDir: string;
  let gitService: GitService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-test-'));
    gitService = new GitService();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });
});
```

#### ✅ Test Case: Complete workflow
```typescript
it('should handle complete Git workflow', async () => {
  // Check Git is installed
  const isInstalled = await gitService.checkGitInstalled();
  expect(isInstalled).toBe(true);

  // Verify not a repo yet
  let isRepo = await gitService.isGitRepo(tempDir);
  expect(isRepo).toBe(false);

  // Initialize repository
  await gitService.initRepo(tempDir);
  isRepo = await gitService.isGitRepo(tempDir);
  expect(isRepo).toBe(true);

  // Create initial commit
  fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test Repo');
  const git = simpleGit(tempDir);
  await git.add('.');
  await git.commit('Initial commit');

  // Get current branch
  let currentBranch = await gitService.getCurrentBranch(tempDir);
  expect(currentBranch).toBe('main');

  // Create new branch
  await gitService.createBranch('session/test', 'main', tempDir);

  // Verify branch exists
  const branchExists = await gitService.branchExists('session/test', tempDir);
  expect(branchExists).toBe(true);

  // Checkout new branch
  await gitService.checkoutBranch('session/test', tempDir);
  currentBranch = await gitService.getCurrentBranch(tempDir);
  expect(currentBranch).toBe('session/test');

  // Check status
  let status = await gitService.getStatus(tempDir);
  expect(status.isClean).toBe(true);

  // Make changes
  fs.writeFileSync(path.join(tempDir, 'test.txt'), 'test content');

  // Check status again
  status = await gitService.getStatus(tempDir);
  expect(status.isClean).toBe(false);
  expect(status.created).toContain('test.txt');

  // Get all branches
  const branches = await gitService.getBranches(tempDir);
  expect(branches).toContain('main');
  expect(branches).toContain('session/test');
});
```

### Integration Test 2: Error Handling

#### ✅ Test Case: Error propagation
```typescript
it('should properly handle and propagate errors', async () => {
  // NotGitRepoError
  await expect(
    gitService.getCurrentBranch(tempDir)
  ).rejects.toThrow(NotGitRepoError);

  // Initialize repo
  await gitService.initRepo(tempDir);

  // GitOperationError for empty repo
  await expect(
    gitService.createBranch('test', 'main', tempDir)
  ).rejects.toThrow(GitOperationError);

  // Create initial commit
  fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test');
  const git = simpleGit(tempDir);
  await git.add('.');
  await git.commit('Initial commit');

  // BranchExistsError
  await gitService.createBranch('test', 'main', tempDir);
  await expect(
    gitService.createBranch('test', 'main', tempDir)
  ).rejects.toThrow(BranchExistsError);
});
```

---

## Test Data

### Mock Data

#### Helper Functions
```typescript
async function createTempGitRepo(): Promise<string> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-test-'));
  const git = simpleGit(tempDir);
  await git.init();
  return tempDir;
}

async function createTempGitRepoWithCommit(): Promise<string> {
  const tempDir = await createTempGitRepo();
  const git = simpleGit(tempDir);

  // Configure git
  await git.addConfig('user.name', 'Test User');
  await git.addConfig('user.email', 'test@example.com');

  // Create initial commit
  fs.writeFileSync(path.join(tempDir, 'test.txt'), 'initial content');
  await git.add('.');
  await git.commit('Initial commit');

  return tempDir;
}
```

#### Sample GitStatus
```typescript
const cleanStatus: GitStatus = {
  branch: 'main',
  ahead: 0,
  behind: 0,
  modified: [],
  created: [],
  deleted: [],
  renamed: [],
  isClean: true,
};

const dirtyStatus: GitStatus = {
  branch: 'session/test',
  ahead: 2,
  behind: 0,
  modified: ['file1.ts', 'file2.ts'],
  created: ['new-file.ts'],
  deleted: [],
  renamed: [],
  isClean: false,
};
```

---

## Mocks & Stubs

### Mocking Strategy

For Git service tests:
- **Unit Tests**: Mock simple-git for error scenarios and edge cases
- **Integration Tests**: Use real Git operations with temp directories
- **No Git Installation**: Mock checkGitInstalled to return false

### Mock Examples

#### Mock simple-git for error testing
```typescript
vi.mock('simple-git', () => {
  return {
    default: vi.fn(() => ({
      checkIsRepo: vi.fn().mockRejectedValue(new Error('fatal: not a git repository')),
      version: vi.fn().mockRejectedValue(new Error('git: command not found')),
    })),
  };
});
```

---

## Test Execution

### Running Tests

```bash
# Run all Git service tests
pnpm --filter @claude-code-manager/server test:unit

# Run specific test file
pnpm --filter @claude-code-manager/server test:unit src/services/git-service.test.ts

# Run with coverage
pnpm --filter @claude-code-manager/server test:coverage

# Watch mode for development
pnpm --filter @claude-code-manager/server test:watch
```

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

### Critical Paths to Cover
- Git not installed scenario
- Not a Git repository scenario
- Branch already exists scenario
- Empty repository (no commits) scenario
- All error types thrown correctly
- Status detection for all file states

---

## Checklist

Before marking feature as "tested":

- [ ] All unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Test coverage ≥ 80%
- [ ] No flaky tests
- [ ] All edge cases covered
- [ ] Error handling tested for all operations
- [ ] Temp directories properly cleaned up
- [ ] Tests run in CI/CD pipeline
- [ ] Git not installed scenario tested
- [ ] Empty repository scenario tested
- [ ] Detached HEAD scenario tested
- [ ] Uncommitted changes scenario tested

---

**Document History**:
- 2025-10-23: Initial test cases
