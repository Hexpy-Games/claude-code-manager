# Test Cases: [Feature Name]

> **Feature ID**: [XXX]
> **Related Use Case**: [Link to use-case.md]
> **Status**: Draft | In Progress | Complete
> **Last Updated**: YYYY-MM-DD

## Test Strategy

### Testing Pyramid

```
        E2E Tests (Few)
      ─────────────────
     Integration Tests (Some)
   ───────────────────────────
  Unit Tests (Many)
```

### Coverage Goals
- **Unit Test Coverage**: ≥ 80%
- **Integration Tests**: All API endpoints
- **E2E Tests**: Critical user flows

### Test Environment
- **Unit Tests**: Vitest, in-memory mocks
- **Integration Tests**: Real SQLite DB, mocked Claude SDK
- **E2E Tests**: Playwright, full stack running

---

## Unit Tests

### Component/Service: [Name]

**File**: `path/to/file.test.ts`

#### Test Suite: [Function or Method Name]

##### ✅ Test Case 1: [Happy path description]
```typescript
it('should [expected behavior] when [condition]', () => {
  // Arrange
  const input = { /* test data */ };

  // Act
  const result = functionUnderTest(input);

  // Assert
  expect(result).toBe(expected);
});
```

##### ✅ Test Case 2: [Edge case description]
```typescript
it('should [expected behavior] when [edge case condition]', () => {
  // Test implementation
});
```

##### ✅ Test Case 3: [Error case description]
```typescript
it('should throw [ErrorType] when [error condition]', () => {
  // Test implementation
});
```

### Example

### Component/Service: GitService

**File**: `apps/server/src/services/git-service.test.ts`

#### Test Suite: checkGitInstalled()

##### ✅ Test Case 1: Git is installed
```typescript
it('should return true when Git is installed', async () => {
  // Arrange
  const gitService = new GitService();
  mockExec.mockResolvedValue({ stdout: '/usr/bin/git' });

  // Act
  const result = await gitService.checkGitInstalled();

  // Assert
  expect(result).toBe(true);
  expect(mockExec).toHaveBeenCalledWith('which git');
});
```

##### ✅ Test Case 2: Git is not installed
```typescript
it('should return false when Git is not found', async () => {
  // Arrange
  const gitService = new GitService();
  mockExec.mockRejectedValue(new Error('command not found'));

  // Act
  const result = await gitService.checkGitInstalled();

  // Assert
  expect(result).toBe(false);
});
```

#### Test Suite: isGitRepo()

##### ✅ Test Case 1: Valid Git repository
```typescript
it('should return true for valid Git repository', async () => {
  // Arrange
  const gitService = new GitService();
  const testDir = '/path/to/repo';
  mockExec.mockResolvedValue({ stdout: '' });

  // Act
  const result = await gitService.isGitRepo(testDir);

  // Assert
  expect(result).toBe(true);
  expect(mockExec).toHaveBeenCalledWith('git rev-parse --is-inside-work-tree', { cwd: testDir });
});
```

##### ✅ Test Case 2: Not a Git repository
```typescript
it('should return false for non-Git directory', async () => {
  // Arrange
  const gitService = new GitService();
  const testDir = '/path/to/non-repo';
  mockExec.mockRejectedValue(new Error('not a git repository'));

  // Act
  const result = await gitService.isGitRepo(testDir);

  // Assert
  expect(result).toBe(false);
});
```

##### ✅ Test Case 3: Directory does not exist
```typescript
it('should return false for non-existent directory', async () => {
  // Arrange
  const gitService = new GitService();
  const testDir = '/non/existent/path';
  mockExec.mockRejectedValue(new Error('ENOENT'));

  // Act
  const result = await gitService.isGitRepo(testDir);

  // Assert
  expect(result).toBe(false);
});
```

---

## Integration Tests

Integration tests verify that multiple components work together correctly.

### Integration Test 1: [Scenario Name]

**Scope**: [Which components are integrated]

#### Setup
```typescript
beforeEach(async () => {
  // Setup code
  db = await createTestDatabase();
  server = await createTestServer();
});

afterEach(async () => {
  // Cleanup code
  await db.close();
  await server.close();
});
```

#### ✅ Test Case: [Description]
```typescript
it('should [expected behavior] when [components interact]', async () => {
  // Arrange
  const requestData = { /* test data */ };

  // Act
  const response = await server.inject({
    method: 'POST',
    url: '/api/endpoint',
    payload: requestData
  });

  // Assert
  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject(expected);

  // Verify side effects
  const dbRecord = await db.query('SELECT * FROM table WHERE id = ?', [id]);
  expect(dbRecord).toBeDefined();
});
```

### Example

### Integration Test 1: Session Creation API Flow

**Scope**: API endpoint → SessionService → GitService → Database

#### Setup
```typescript
describe('POST /api/sessions', () => {
  let app: FastifyInstance;
  let db: Database;
  let testRepoPath: string;

  beforeEach(async () => {
    // Create test database
    db = await createTestDatabase();

    // Create test Git repo
    testRepoPath = await createTestGitRepo();

    // Start server
    app = await createApp({ db });
  });

  afterEach(async () => {
    await cleanupTestRepo(testRepoPath);
    await db.close();
    await app.close();
  });
});
```

#### ✅ Test Case: Successfully create session with Git branch
```typescript
it('should create session and Git branch when valid data provided', async () => {
  // Arrange
  const sessionData = {
    title: 'Test Session',
    rootDirectory: testRepoPath
  };

  // Act
  const response = await app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: sessionData
  });

  // Assert API response
  expect(response.statusCode).toBe(201);
  const session = response.json();
  expect(session.id).toBeDefined();
  expect(session.branchName).toMatch(/^session\//);

  // Verify database
  const dbSession = await db.get('SELECT * FROM sessions WHERE id = ?', [session.id]);
  expect(dbSession).toBeDefined();
  expect(dbSession.title).toBe('Test Session');

  // Verify Git branch created
  const branches = await execGit('branch --list', { cwd: testRepoPath });
  expect(branches.stdout).toContain(session.branchName);
});
```

#### ✅ Test Case: Reject session creation for non-Git directory
```typescript
it('should return 400 when directory is not a Git repo', async () => {
  // Arrange
  const nonGitDir = await createTempDirectory();
  const sessionData = {
    title: 'Test Session',
    rootDirectory: nonGitDir
  };

  // Act
  const response = await app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: sessionData
  });

  // Assert
  expect(response.statusCode).toBe(400);
  expect(response.json().error).toContain('not a Git repository');

  // Verify no session in database
  const sessions = await db.all('SELECT * FROM sessions');
  expect(sessions).toHaveLength(0);
});
```

---

## E2E Tests

End-to-end tests verify complete user workflows from UI to backend.

### E2E Test 1: [User Flow Name]

**User Story**: As a [user], I want to [action], so that [benefit]

#### Test Steps

1. **Given** [initial state]
2. **When** [user action]
3. **Then** [expected outcome]
4. **And** [additional verification]

#### Test Implementation

```typescript
test('[user flow description]', async ({ page }) => {
  // Step 1: Setup
  await page.goto('http://localhost:3000');

  // Step 2: User action
  await page.click('button:has-text("Action")');

  // Step 3: Assert outcome
  await expect(page.locator('.result')).toBeVisible();

  // Step 4: Additional verification
  await expect(page.locator('.status')).toHaveText('Success');
});
```

### Example

### E2E Test 1: Create New Session (Happy Path)

**User Story**: As a developer, I want to create a new Claude Code session with Git isolation, so that I can work on a feature without affecting other work.

#### Test Steps

1. **Given** I am on the main application page
2. **When** I click "New Session" button
3. **And** I enter session title "My Feature"
4. **And** I select a Git repository directory
5. **And** I click "Create"
6. **Then** I should see the new session in the sidebar
7. **And** The chat interface should be ready
8. **And** A Git branch should be created

#### Test Implementation

```typescript
// apps/desktop/e2e/session-creation.spec.ts

test('user can create new session with Git branch', async ({ page }) => {
  // Step 1: Navigate to app
  await page.goto('http://localhost:3000');
  await expect(page.locator('h1')).toContainText('Claude Code Manager');

  // Step 2: Click "New Session"
  await page.click('button[data-testid="new-session-btn"]');

  // Step 3: Fill in session form
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await page.fill('input[name="title"]', 'My Feature');
  await page.fill('input[name="rootDirectory"]', '/path/to/test/repo');

  // Step 4: Submit form
  await page.click('button:has-text("Create")');

  // Step 5: Verify session appears in sidebar
  await expect(page.locator('.session-item:has-text("My Feature")')).toBeVisible();

  // Step 6: Verify chat interface is ready
  await expect(page.locator('textarea[placeholder*="Message"]')).toBeVisible();

  // Step 7: Verify Git branch (via API check)
  const sessionId = await page.locator('.session-item:has-text("My Feature")').getAttribute('data-session-id');
  const response = await page.request.get(`http://localhost:3000/api/sessions/${sessionId}/git`);
  const gitStatus = await response.json();
  expect(gitStatus.currentBranch).toMatch(/^session\//);
});
```

### E2E Test 2: Error - No Git Repository

**User Story**: As a developer, when I try to create a session in a non-Git directory, I should see a clear error and option to initialize Git.

#### Test Steps

1. **Given** I am on the main application page
2. **When** I click "New Session" button
3. **And** I select a directory WITHOUT Git
4. **Then** I should see "Initialize Git?" dialog
5. **When** I click "Yes"
6. **Then** Git should be initialized
7. **And** Session creation should continue

#### Test Implementation

```typescript
test('prompts to initialize Git when directory is not a repo', async ({ page }) => {
  // Step 1: Navigate and click New Session
  await page.goto('http://localhost:3000');
  await page.click('button[data-testid="new-session-btn"]');

  // Step 2: Select non-Git directory
  await page.fill('input[name="title"]', 'Test Session');
  await page.fill('input[name="rootDirectory"]', '/path/to/non-git-dir');
  await page.click('button:has-text("Create")');

  // Step 3: Verify Git initialization prompt
  await expect(page.locator('[role="alertdialog"]')).toBeVisible();
  await expect(page.locator('[role="alertdialog"]')).toContainText('not a Git repository');
  await expect(page.locator('button:has-text("Initialize Git")')).toBeVisible();

  // Step 4: Click "Initialize Git"
  await page.click('button:has-text("Initialize Git")');

  // Step 5: Verify session created after Git init
  await expect(page.locator('.session-item:has-text("Test Session")')).toBeVisible();

  // Step 6: Verify Git was initialized (check via API)
  const response = await page.request.get('http://localhost:3000/api/git/check?path=/path/to/non-git-dir');
  const status = await response.json();
  expect(status.isGitRepo).toBe(true);
});
```

---

## Test Data

### Mock Data

#### Sample Session
```typescript
const mockSession = {
  id: 'sess_test123',
  title: 'Test Session',
  rootDirectory: '/test/repo',
  branchName: 'session/sess_test123',
  baseBranch: 'main',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  isActive: true
};
```

#### Sample API Response
```typescript
const mockSessionResponse = {
  id: 'sess_abc123',
  title: 'My Session',
  branchName: 'session/sess_abc123',
  status: 'ready'
};
```

### Test Fixtures

```typescript
// fixtures/test-repo.ts
export async function createTestGitRepo(): Promise<string> {
  const tmpDir = await createTempDirectory();
  await execGit('init', { cwd: tmpDir });
  await execGit('commit --allow-empty -m "Initial commit"', { cwd: tmpDir });
  return tmpDir;
}

export async function cleanupTestRepo(path: string): Promise<void> {
  await fs.rm(path, { recursive: true, force: true });
}
```

---

## Mocks & Stubs

### Mocking Strategy

#### External Services
- **Claude Agent SDK**: Mock all API calls
- **Git Commands**: Use real Git in integration tests, mock in unit tests
- **File System**: Use temp directories in tests

#### Example Mocks

```typescript
// Mock Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  ClaudeAgent: vi.fn(() => ({
    query: vi.fn().mockResolvedValue({
      content: 'Mocked response',
      toolCalls: []
    }),
    stream: vi.fn().mockReturnValue(mockStream)
  }))
}));

// Mock Git operations
vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({
    checkIsRepo: vi.fn().mockResolvedValue(true),
    branch: vi.fn().mockResolvedValue({ current: 'main' }),
    checkout: vi.fn().mockResolvedValue(undefined)
  }))
}));
```

---

## Test Execution

### Running Tests

```bash
# Run all tests
pnpm test

# Run unit tests only
pnpm test:unit

# Run integration tests only
pnpm test:integration

# Run E2E tests only
pnpm test:e2e

# Run tests in watch mode
pnpm test:unit --watch

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm test:unit path/to/test.test.ts

# Run tests matching pattern
pnpm test:unit --grep "session creation"
```

### CI/CD Pipeline

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3

      - name: Install dependencies
        run: pnpm install

      - name: Run unit tests
        run: pnpm test:unit

      - name: Run integration tests
        run: pnpm test:integration

      - name: Run E2E tests
        run: pnpm test:e2e

      - name: Check coverage
        run: pnpm test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
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

### Coverage Exclusions

Files/patterns excluded from coverage:
- `**/*.test.ts` - Test files
- `**/*.spec.ts` - Spec files
- `**/e2e/**` - E2E test files
- `**/*.d.ts` - Type definitions
- `**/mocks/**` - Mock files

---

## Test Maintenance

### When to Update Tests

- ✅ Requirements change
- ✅ Bug is found (add test to prevent regression)
- ✅ Refactoring code
- ✅ API contracts change

### Test Smell Checklist

- [ ] Tests are flaky (pass/fail randomly)
- [ ] Tests depend on execution order
- [ ] Tests have unclear names
- [ ] Tests test multiple things
- [ ] Tests have no assertions
- [ ] Tests are too slow

---

## Checklist

Before marking feature as "tested":

- [ ] All unit tests written and passing
- [ ] All integration tests written and passing
- [ ] All E2E tests written and passing
- [ ] Test coverage ≥ 80%
- [ ] No flaky tests
- [ ] Test data and fixtures documented
- [ ] Mocks are appropriate and maintainable
- [ ] Tests run in CI/CD pipeline
- [ ] Edge cases covered
- [ ] Error cases covered

---

**Document History**:
- YYYY-MM-DD: Initial test cases
- YYYY-MM-DD: Added integration tests
- YYYY-MM-DD: All tests passing
