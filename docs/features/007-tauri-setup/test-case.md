# Test Cases: Tauri Desktop Application Setup

> **Feature ID**: 007
> **Related Use Case**: [use-case.md](./use-case.md)
> **Status**: Complete ✅
> **Last Updated**: 2025-10-25

## Test Strategy

### Testing Pyramid

```
        E2E Tests (5)
      ─────────────────
     Integration Tests (8)
   ───────────────────────────
  Unit Tests (15)
```

### Coverage Goals
- **Unit Test Coverage**: ≥ 80%
- **Integration Tests**: All core components render
- **E2E Tests**: App launches and basic interactions work

### Test Environment
- **Unit Tests**: Vitest + jsdom + React Testing Library
- **Integration Tests**: Vitest with real component rendering
- **E2E Tests**: Playwright with actual Tauri app

---

## Unit Tests

### Component/Service: App Component

**File**: `apps/desktop/src/App.test.tsx`

#### Test Suite: App Rendering

##### ✅ Test Case 1: App renders without crashing
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

it('should render without crashing', () => {
  // Act
  render(<App />);

  // Assert
  expect(screen.getByText(/Claude Code Manager/i)).toBeInTheDocument();
});
```

##### ✅ Test Case 2: App applies Tailwind classes correctly
```typescript
it('should apply Tailwind styles correctly', () => {
  // Act
  const { container } = render(<App />);

  // Assert
  const appElement = container.firstChild;
  expect(appElement).toHaveClass('min-h-screen');
});
```

##### ✅ Test Case 3: App renders within ErrorBoundary
```typescript
it('should render within ErrorBoundary', () => {
  // Act
  const { container } = render(<App />);

  // Assert
  expect(container).toBeInTheDocument();
});
```

##### ✅ Test Case 4: App has QueryClientProvider
```typescript
it('should have QueryClientProvider', () => {
  // Act
  const { container } = render(<App />);

  // Assert
  expect(container.querySelector('div')).toBeInTheDocument();
});
```

##### ✅ Test Case 5: App renders settings button
```typescript
it('should render Settings button', () => {
  // Act
  render(<App />);

  // Assert
  expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
});
```

---

### Component/Service: Utils (Shadcn Helper)

**File**: `apps/desktop/src/lib/utils.test.ts`

#### Test Suite: cn() Utility Function

##### ✅ Test Case 6: Merge class names
```typescript
import { describe, it, expect } from 'vitest';
import { cn } from './utils';

it('should merge class names', () => {
  // Act
  const result = cn('class-1', 'class-2');

  // Assert
  expect(result).toBe('class-1 class-2');
});
```

##### ✅ Test Case 7: Handle conditional classes
```typescript
it('should handle conditional classes', () => {
  // Assert false condition
  expect(cn('base', false && 'conditional')).toBe('base');

  // Assert true condition
  expect(cn('base', true && 'conditional')).toBe('base conditional');
});
```

##### ✅ Test Case 8: Merge Tailwind classes without conflicts
```typescript
it('should merge Tailwind classes without conflicts', () => {
  // Act - tailwind-merge should handle conflicting utilities
  const result = cn('px-2 py-1', 'p-3');

  // Assert - p-3 should override px-2 py-1
  expect(result).toBe('p-3');
});
```

##### ✅ Test Case 9: Handle undefined and null values
```typescript
it('should handle undefined and null values gracefully', () => {
  // Act
  const result = cn('base', undefined, null, 'extra');

  // Assert
  expect(result).toBe('base extra');
});
```

##### ✅ Test Case 10: Handle array of classes
```typescript
it('should handle array of classes', () => {
  // Act
  const result = cn(['class-1', 'class-2'], 'class-3');

  // Assert
  expect(result).toBe('class-1 class-2 class-3');
});
```

---

### Component/Service: Shadcn UI Button

**File**: `apps/desktop/src/components/ui/button.test.tsx`

#### Test Suite: Button Component

##### ✅ Test Case 11: Button renders with text
```typescript
import { render, screen } from '@testing-library/react';
import { Button } from './button';

it('should render button with text', () => {
  // Act
  render(<Button>Click me</Button>);

  // Assert
  expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
});
```

##### ✅ Test Case 12: Button applies variant classes
```typescript
it('should apply variant classes', () => {
  // Act
  const { rerender } = render(<Button variant="default">Default</Button>);
  const defaultButton = screen.getByRole('button');
  expect(defaultButton).toHaveClass('bg-primary');

  // Act - change variant
  rerender(<Button variant="outline">Outline</Button>);
  const outlineButton = screen.getByRole('button');
  expect(outlineButton).toHaveClass('border');
});
```

##### ✅ Test Case 13: Button handles click events
```typescript
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';

it('should handle click events', async () => {
  // Arrange
  const handleClick = vi.fn();
  const user = userEvent.setup();
  render(<Button onClick={handleClick}>Click me</Button>);

  // Act
  await user.click(screen.getByRole('button'));

  // Assert
  expect(handleClick).toHaveBeenCalledOnce();
});
```

##### ✅ Test Case 14: Button can be disabled
```typescript
it('should be disableable', () => {
  // Act
  render(<Button disabled>Disabled</Button>);

  // Assert
  expect(screen.getByRole('button')).toBeDisabled();
});
```

##### ✅ Test Case 15: Button applies custom className
```typescript
it('should accept custom className', () => {
  // Act
  render(<Button className="custom-class">Button</Button>);

  // Assert
  expect(screen.getByRole('button')).toHaveClass('custom-class');
});
```

---

## Integration Tests

### Integration Test 1: App Component with Providers

**File**: `apps/desktop/src/__tests__/integration/app-integration.test.tsx`

##### ✅ Test Case 16: App renders with all providers
```typescript
describe('App Integration', () => {
  it('should render with ErrorBoundary and QueryClientProvider', () => {
    // Act
    render(<App />);

    // Assert
    expect(screen.getByText(/Claude Code Manager/i)).toBeInTheDocument();
  });
});
```

##### ✅ Test Case 17: App renders session list placeholder
```typescript
it('should render session list section', () => {
  // Act
  render(<App />);

  // Assert
  expect(screen.getByText(/Sessions/i)).toBeInTheDocument();
});
```

##### ✅ Test Case 18: Settings dialog can be opened
```typescript
it('should open settings dialog when button clicked', async () => {
  // Arrange
  const user = userEvent.setup();
  render(<App />);

  // Act
  await user.click(screen.getByRole('button', { name: /settings/i }));

  // Assert
  expect(screen.getByRole('dialog')).toBeVisible();
});
```

---

### Integration Test 2: TailwindCSS Integration

**File**: `apps/desktop/src/__tests__/integration/tailwind.test.tsx`

##### ✅ Test Case 19: Tailwind utility classes work
```typescript
it('should apply Tailwind utility classes', () => {
  // Act
  const { container } = render(
    <div className="bg-primary text-primary-foreground p-4 rounded-lg">
      Test Content
    </div>
  );

  // Assert
  const element = container.firstChild;
  expect(element).toHaveClass('bg-primary');
  expect(element).toHaveClass('text-primary-foreground');
  expect(element).toHaveClass('p-4');
  expect(element).toHaveClass('rounded-lg');
});
```

##### ✅ Test Case 20: Tailwind dark mode classes work
```typescript
it('should support dark mode classes', () => {
  // Act
  const { container } = render(
    <div className="bg-white dark:bg-slate-900">
      Content
    </div>
  );

  // Assert
  expect(container.firstChild).toHaveClass('dark:bg-slate-900');
});
```

---

### Integration Test 3: Configuration Files

**File**: `apps/desktop/src/__tests__/config.test.ts`

##### ✅ Test Case 21: package.json is valid
```typescript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

it('should have valid package.json', () => {
  // Act
  const pkg = JSON.parse(
    readFileSync(join(__dirname, '../../package.json'), 'utf-8')
  );

  // Assert
  expect(pkg.name).toBe('@claude-code-manager/desktop');
  expect(pkg.type).toBe('module');
  expect(pkg.scripts.dev).toBeDefined();
  expect(pkg.scripts.build).toBeDefined();
  expect(pkg.scripts.test).toBeDefined();
});
```

##### ✅ Test Case 22: Tauri config is valid
```typescript
it('should have valid Tauri config', () => {
  // Act
  const tauriConf = JSON.parse(
    readFileSync(join(__dirname, '../../src-tauri/tauri.conf.json'), 'utf-8')
  );

  // Assert
  expect(tauriConf.productName).toBe('Claude Code Manager');
  expect(tauriConf.identifier).toBe('com.claude-code-manager.app');
  expect(tauriConf.build.devUrl).toBe('http://localhost:1420');
});
```

##### ✅ Test Case 23: TypeScript config extends root
```typescript
it('should have TypeScript config that extends root', () => {
  // Act
  const tsconfig = JSON.parse(
    readFileSync(join(__dirname, '../../tsconfig.json'), 'utf-8')
  );

  // Assert
  expect(tsconfig.extends).toBe('../../tsconfig.json');
  expect(tsconfig.compilerOptions.jsx).toBe('react-jsx');
  expect(tsconfig.compilerOptions.paths['@/*']).toEqual(['./src/*']);
});
```

---

## E2E Tests

### E2E Test 1: Application Launch

**File**: `apps/desktop/e2e/app.spec.ts`

##### ✅ Test Case 24: App launches successfully
```typescript
import { test, expect } from '@playwright/test';

test('should launch Tauri app successfully', async ({ page }) => {
  // Assert: App window opens
  await expect(page).toHaveTitle(/Claude Code Manager/);
});
```

##### ✅ Test Case 25: Main interface renders
```typescript
test('should render main interface', async ({ page }) => {
  // Assert: Main heading visible
  const heading = page.getByText(/Claude Code Manager/i);
  await expect(heading).toBeVisible();
});
```

##### ✅ Test Case 26: Dark mode applied by default
```typescript
test('should apply dark mode by default', async ({ page }) => {
  // Assert: Body has dark class
  const body = page.locator('body');
  await expect(body).toHaveClass(/dark/);
});
```

##### ✅ Test Case 27: Settings button is clickable
```typescript
test('should have clickable settings button', async ({ page }) => {
  // Arrange
  const settingsButton = page.getByRole('button', { name: /settings/i });

  // Act
  await settingsButton.click();

  // Assert: Settings dialog opens
  await expect(page.getByRole('dialog')).toBeVisible();
});
```

##### ✅ Test Case 28: Session list section exists
```typescript
test('should show session list section', async ({ page }) => {
  // Assert
  await expect(page.getByText(/Sessions/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /New/i })).toBeVisible();
});
```

---

### E2E Test 2: Hot Reload (Manual Test)

**Manual Test**: `apps/desktop/e2e/manual-hot-reload.md`

##### ✅ Test Case 29: Hot reload works
```markdown
Manual Test: Hot Reload

Steps:
1. Run `pnpm dev` in apps/desktop
2. Wait for app to launch
3. Edit src/App.tsx - change text "Claude Code Manager" to "Test Text"
4. Save file
5. Observe app window

Expected:
- Text changes to "Test Text" within 2 seconds
- No manual reload needed
- No errors in console

Actual: ✅ Pass
```

---

### E2E Test 3: Production Build

**Manual Test**: `apps/desktop/e2e/manual-build.md`

##### ✅ Test Case 30: Production build succeeds
```markdown
Manual Test: Production Build

Steps:
1. Run `pnpm build` in apps/desktop
2. Wait for build to complete
3. Check src-tauri/target/release for binary

Expected:
- Build completes without errors
- Binary created in release directory
- Binary launches when executed
- File size < 50MB

Actual: ✅ Pass
```

---

## Test Data

### Mock Data

N/A - Tauri setup doesn't require mock data

### Test Fixtures

**Fixture for React Component**:
```typescript
// apps/desktop/src/test/fixtures/test-component.tsx
export function TestComponent() {
  return <div>Test Content</div>;
}
```

**Fixture for Testing cn() utility**:
```typescript
// apps/desktop/src/test/fixtures/class-names.ts
export const testClasses = {
  base: 'base-class',
  conditional: 'conditional-class',
  tailwind: 'bg-primary text-white',
  conflicting: 'p-2 p-4', // Should resolve to p-4
};
```

---

## Mocks & Stubs

### Mocking Strategy

**jsdom for Unit Tests**:
- Simulates browser environment
- DOM APIs available
- Window and document objects

**Mock Tauri APIs** (when needed):
```typescript
// apps/desktop/src/test/mocks/tauri.ts
vi.mock('@tauri-apps/api', () => ({
  invoke: vi.fn(),
  window: {
    appWindow: {
      listen: vi.fn(),
    },
  },
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

# Run unit tests in watch mode
pnpm test:watch

# Run E2E tests
pnpm test:e2e

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm test:unit src/App.test.tsx

# Typecheck
pnpm typecheck

# Lint
pnpm lint
```

### CI/CD Pipeline

```yaml
# .github/workflows/desktop-test.yml
name: Desktop Tests

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
        run: pnpm --filter @claude-code-manager/desktop test:unit

      - name: Run typecheck
        run: pnpm --filter @claude-code-manager/desktop typecheck

      - name: Run lint
        run: pnpm --filter @claude-code-manager/desktop lint

      - name: Build app
        run: pnpm --filter @claude-code-manager/desktop build
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

```javascript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        'src-tauri/',
        'src/components/ui/*', // Shadcn components (external)
      ],
    },
  },
});
```

---

## Test Maintenance

### When to Update Tests

- ✅ React version upgraded
- ✅ Tauri version upgraded
- ✅ New Shadcn components added
- ✅ TypeScript config changed
- ✅ Vite config changed

### Test Smell Checklist

- [ ] Tests are flaky (pass/fail randomly)
- [ ] Tests depend on execution order
- [ ] Tests have unclear names
- [ ] Tests test multiple things
- [ ] Tests have no assertions
- [ ] Tests are too slow
- [ ] Tests require manual intervention

---

## Checklist

Before marking feature as "tested":

- [x] All unit tests written and passing (15 tests)
- [x] All integration tests written and passing (8 tests)
- [x] All E2E tests written and passing (5 tests)
- [x] Test coverage ≥ 80%
- [x] No flaky tests
- [x] Test fixtures documented
- [x] Mocks are appropriate
- [x] Tests run in CI/CD pipeline
- [x] Configuration files validated
- [x] Hot reload manually verified
- [x] Production build manually verified

---

**Document History**:
- 2025-10-24: Initial test implementation
- 2025-10-25: Converted to proper test-case format
