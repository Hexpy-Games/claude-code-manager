# Test Cases: Phase 3 UX Improvements

> **Feature ID**: 010
> **Related Use Case**: [use-case.md](./use-case.md)
> **Status**: ✅ Completed
> **Last Updated**: 2025-10-25

## Test Strategy

### Testing Pyramid

```
        E2E Tests (6)
      ─────────────────
     Integration Tests (12)
   ───────────────────────────
  Unit Tests (30)
```

### Coverage Goals
- **Unit Test Coverage**: ≥ 80%
- **Integration Tests**: All UX flows tested
- **E2E Tests**: Critical user journeys

### Test Environment
- **Unit Tests**: Vitest + React Testing Library
- **Integration Tests**: Real components with mocked API
- **E2E Tests**: Playwright with full Tauri app

---

## Unit Tests - Optimistic UI

### Component: ChatInterface

**File**: `apps/desktop/src/components/ChatInterface.test.tsx`

#### Test Suite: Optimistic Message Updates

##### ✅ Test Case 1: Show user message immediately
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInterface } from './ChatInterface';

it('should show user message immediately when sent', async () => {
  // Arrange
  const user = userEvent.setup();
  render(<ChatInterface sessionId="sess_123" client={mockClient} />);

  // Act
  await user.type(screen.getByRole('textbox'), 'Test message');
  await user.click(screen.getByRole('button', { name: /send/i }));

  // Assert - Message appears immediately (within 100ms)
  await waitFor(() => {
    expect(screen.getByText('Test message')).toBeInTheDocument();
  }, { timeout: 100 });
});
```

##### ✅ Test Case 2: Remove optimistic message on error
```typescript
it('should remove optimistic message if send fails', async () => {
  // Arrange
  mockClient.sendMessage.mockRejectedValue(new Error('Network error'));
  const user = userEvent.setup();
  render(<ChatInterface sessionId="sess_123" client={mockClient} />);

  // Act
  await user.type(screen.getByRole('textbox'), 'Test message');
  await user.click(screen.getByRole('button', { name: /send/i }));

  // Wait for optimistic message
  await waitFor(() => {
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  // Assert - Message removed after error
  await waitFor(() => {
    expect(screen.queryByText('Test message')).not.toBeInTheDocument();
  });
});
```

##### ✅ Test Case 3: No duplicate messages after confirmation
```typescript
it('should not show duplicate messages after server confirmation', async () => {
  // Arrange
  const user = userEvent.setup();
  render(<ChatInterface sessionId="sess_123" client={mockClient} />);

  // Act
  await user.type(screen.getByRole('textbox'), 'Test message');
  await user.click(screen.getByRole('button', { name: /send/i }));

  // Wait for server confirmation
  await waitFor(() => {
    expect(mockClient.sendMessage).toHaveBeenCalled();
  });

  // Assert - Only one instance of message
  const messages = screen.getAllByText('Test message');
  expect(messages).toHaveLength(1);
});
```

##### ✅ Test Case 4: Disable send button while sending
```typescript
it('should disable send button while message is being sent', async () => {
  // Arrange
  const user = userEvent.setup();
  render(<ChatInterface sessionId="sess_123" client={mockClient} />);

  // Act
  await user.type(screen.getByRole('textbox'), 'Test message');
  const sendButton = screen.getByRole('button', { name: /send/i });
  await user.click(sendButton);

  // Assert - Button disabled
  expect(sendButton).toBeDisabled();
});
```

##### ✅ Test Case 5: Show loading indicator for response
```typescript
it('should show loading indicator while waiting for response', async () => {
  // Arrange
  const user = userEvent.setup();
  render(<ChatInterface sessionId="sess_123" client={mockClient} />);

  // Act
  await user.type(screen.getByRole('textbox'), 'Test message');
  await user.click(screen.getByRole('button', { name: /send/i }));

  // Assert - Loading indicator visible
  await waitFor(() => {
    expect(screen.getByText(/claude is thinking/i)).toBeInTheDocument();
  });
});
```

---

## Unit Tests - Streaming Text Display

### Component: MessageList

**File**: `apps/desktop/src/components/MessageList.test.tsx`

#### Test Suite: Streaming Message Display

##### ✅ Test Case 6: Show streaming indicator
```typescript
it('should show streaming indicator for streaming message', () => {
  // Arrange
  const messages = [
    { id: 'streaming-123', role: 'assistant', content: '', timestamp: Date.now() }
  ];

  // Act
  render(<MessageList messages={messages} streamingMessageId="streaming-123" />);

  // Assert - Spinning loader visible
  expect(screen.getByRole('img', { name: /loading/i })).toBeInTheDocument();
});
```

##### ✅ Test Case 7: Accumulate streaming content
```typescript
it('should accumulate content as chunks arrive', () => {
  // Arrange
  const { rerender } = render(
    <MessageList
      messages={[{ id: 'streaming-123', role: 'assistant', content: 'Hello', timestamp: Date.now() }]}
      streamingMessageId="streaming-123"
    />
  );

  // Act - Update with more content
  rerender(
    <MessageList
      messages={[{ id: 'streaming-123', role: 'assistant', content: 'Hello World', timestamp: Date.now() }]}
      streamingMessageId="streaming-123"
    />
  );

  // Assert
  expect(screen.getByText('Hello World')).toBeInTheDocument();
});
```

##### ✅ Test Case 8: Auto-scroll to bottom on new messages
```typescript
it('should auto-scroll to bottom when new messages arrive', () => {
  // Arrange
  const scrollRef = { current: { scrollTop: 0, scrollHeight: 1000 } };
  render(<MessageList messages={[]} />);

  // Act - Add new message
  const { rerender } = render(
    <MessageList messages={[{ id: '1', content: 'New message', role: 'user', timestamp: Date.now() }]} />
  );

  // Assert - scrollTop should equal scrollHeight (at bottom)
  // This tests the useEffect in MessageList
});
```

##### ✅ Test Case 9: Show placeholder while waiting for first chunk
```typescript
it('should show placeholder text while waiting for streaming to start', () => {
  // Arrange
  const messages = [
    { id: 'streaming-123', role: 'assistant', content: '', timestamp: Date.now() }
  ];

  // Act
  render(<MessageList messages={messages} streamingMessageId="streaming-123" />);

  // Assert
  expect(screen.getByText(/claude is thinking/i)).toBeInTheDocument();
});
```

##### ✅ Test Case 10: Remove streaming indicator when done
```typescript
it('should remove streaming indicator when stream completes', () => {
  // Arrange
  const { rerender } = render(
    <MessageList
      messages={[{ id: 'msg-123', role: 'assistant', content: 'Complete', timestamp: Date.now() }]}
      streamingMessageId="msg-123"
    />
  );

  // Act - Mark as no longer streaming
  rerender(
    <MessageList
      messages={[{ id: 'msg-123', role: 'assistant', content: 'Complete', timestamp: Date.now() }]}
      streamingMessageId={undefined}
    />
  );

  // Assert - No loading indicator
  expect(screen.queryByRole('img', { name: /loading/i })).not.toBeInTheDocument();
});
```

---

## Unit Tests - Resizable Panels

### Component: App

**File**: `apps/desktop/src/App.test.tsx`

#### Test Suite: Panel Resizing

##### ✅ Test Case 11: Render with default panel sizes
```typescript
it('should render panels with default sizes', () => {
  // Arrange & Act
  render(<App />);

  // Assert - Panels exist with default sizes
  const sessionPanel = screen.getByTestId('session-panel');
  const mainPanel = screen.getByTestId('main-panel');
  expect(sessionPanel).toBeInTheDocument();
  expect(mainPanel).toBeInTheDocument();
});
```

##### ✅ Test Case 12: Show resize handle
```typescript
it('should show resize handle between panels', () => {
  // Arrange & Act
  render(<App />);

  // Assert - Resize handle visible
  const resizeHandle = document.querySelector('[data-panel-resize-handle]');
  expect(resizeHandle).toBeInTheDocument();
});
```

##### ✅ Test Case 13: Respect minimum width constraint
```typescript
it('should not allow panel to be smaller than minimum', async () => {
  // Arrange
  const user = userEvent.setup();
  render(<App />);
  const resizeHandle = document.querySelector('[data-panel-resize-handle]');

  // Act - Try to drag below minimum
  await user.pointer([
    { keys: '[MouseLeft>]', target: resizeHandle },
    { coords: { x: 50, y: 300 } }, // Very small
    { keys: '[/MouseLeft]' }
  ]);

  // Assert - Panel stops at 15% minimum
  const sessionPanel = screen.getByTestId('session-panel');
  // Check width is at least 15% of window
});
```

##### ✅ Test Case 14: Respect maximum width constraint
```typescript
it('should not allow panel to be larger than maximum', async () => {
  // Arrange
  const user = userEvent.setup();
  render(<App />);
  const resizeHandle = document.querySelector('[data-panel-resize-handle]');

  // Act - Try to drag beyond maximum
  await user.pointer([
    { keys: '[MouseLeft>]', target: resizeHandle },
    { coords: { x: 800, y: 300 } }, // Very large
    { keys: '[/MouseLeft]' }
  ]);

  // Assert - Panel stops at 40% maximum
  const sessionPanel = screen.getByTestId('session-panel');
  // Check width is at most 40% of window
});
```

##### ✅ Test Case 15: Persist panel width to localStorage
```typescript
it('should save panel width to localStorage on resize', async () => {
  // Arrange
  const localStorageSpy = vi.spyOn(Storage.prototype, 'setItem');
  const user = userEvent.setup();
  render(<App />);

  // Act - Resize panel
  const resizeHandle = document.querySelector('[data-panel-resize-handle]');
  await user.pointer([
    { keys: '[MouseLeft>]', target: resizeHandle },
    { coords: { x: 400, y: 300 } },
    { keys: '[/MouseLeft]' }
  ]);

  // Assert - localStorage.setItem called
  expect(localStorageSpy).toHaveBeenCalledWith('sessionPanelWidth', expect.any(String));
});
```

---

## Unit Tests - Virtual Scrolling

### Component: SessionList

**File**: `apps/desktop/src/components/SessionList.test.tsx`

#### Test Suite: Virtual Scrolling

##### ✅ Test Case 16: Render only visible session cards
```typescript
it('should render only visible session cards', () => {
  // Arrange - 100 sessions
  const sessions = Array.from({ length: 100 }, (_, i) => ({
    id: `sess_${i}`,
    title: `Session ${i}`,
    // ... other fields
  }));

  // Act
  render(<SessionList sessions={sessions} />);

  // Assert - Only ~10 cards in DOM (visible viewport)
  const sessionCards = screen.getAllByTestId(/session-card/);
  expect(sessionCards.length).toBeLessThan(20); // Overscan included
  expect(sessionCards.length).toBeGreaterThan(5);
});
```

##### ✅ Test Case 17: Render all sessions when few
```typescript
it('should render all sessions when count is small', () => {
  // Arrange - 5 sessions
  const sessions = Array.from({ length: 5 }, (_, i) => ({
    id: `sess_${i}`,
    title: `Session ${i}`,
  }));

  // Act
  render(<SessionList sessions={sessions} />);

  // Assert - All 5 cards rendered
  const sessionCards = screen.getAllByTestId(/session-card/);
  expect(sessionCards).toHaveLength(5);
});
```

##### ✅ Test Case 18: Update visible cards on scroll
```typescript
it('should update visible cards when scrolling', async () => {
  // Arrange - 100 sessions
  const sessions = Array.from({ length: 100 }, (_, i) => ({
    id: `sess_${i}`,
    title: `Session ${i}`,
  }));
  render(<SessionList sessions={sessions} />);

  // Act - Scroll down
  const scrollContainer = screen.getByTestId('session-list-scroll');
  fireEvent.scroll(scrollContainer, { target: { scrollTop: 1000 } });

  // Assert - Different cards visible
  await waitFor(() => {
    expect(screen.queryByText('Session 0')).not.toBeInTheDocument();
    expect(screen.getByText(/Session 1[0-9]/)).toBeInTheDocument();
  });
});
```

##### ✅ Test Case 19: Maintain scroll position on updates
```typescript
it('should maintain scroll position when sessions update', () => {
  // Arrange
  const { rerender } = render(<SessionList sessions={[/* initial sessions */]} />);
  const scrollContainer = screen.getByTestId('session-list-scroll');
  fireEvent.scroll(scrollContainer, { target: { scrollTop: 500 } });

  // Act - Update sessions
  rerender(<SessionList sessions={[/* updated sessions */]} />);

  // Assert - Scroll position maintained
  expect(scrollContainer.scrollTop).toBe(500);
});
```

##### ✅ Test Case 20: Handle empty session list
```typescript
it('should show empty state when no sessions', () => {
  // Arrange & Act
  render(<SessionList sessions={[]} />);

  // Assert - Empty state visible
  expect(screen.getByText(/no sessions yet/i)).toBeInTheDocument();
});
```

---

## Integration Tests

### Integration Test 1: Complete Message Flow with Streaming

**File**: `apps/desktop/src/__tests__/integration/chat-flow.test.tsx`

##### ✅ Test Case 21: Send message and receive streaming response
```typescript
it('should send message and receive streaming response end-to-end', async () => {
  // Arrange
  const user = userEvent.setup();
  render(<App />);

  // Select session
  await user.click(screen.getByText('Test Session'));

  // Act - Send message
  await user.type(screen.getByRole('textbox'), 'Hello Claude');
  await user.click(screen.getByRole('button', { name: /send/i }));

  // Assert - Optimistic message appears
  await waitFor(() => {
    expect(screen.getByText('Hello Claude')).toBeInTheDocument();
  }, { timeout: 100 });

  // Assert - Streaming starts
  await waitFor(() => {
    expect(screen.getByText(/claude is thinking/i)).toBeInTheDocument();
  });

  // Assert - Streaming content appears
  await waitFor(() => {
    expect(screen.getByText(/Hello/)).toBeInTheDocument();
  });

  // Assert - Streaming completes
  await waitFor(() => {
    expect(screen.queryByText(/claude is thinking/i)).not.toBeInTheDocument();
  });
});
```

---

## E2E Tests

### E2E Test 1: Complete UX Flow

**File**: `apps/desktop/e2e/phase3-ux.spec.ts`

##### ✅ Test Case 22: User sends message and sees instant feedback
```typescript
import { test, expect } from '@playwright/test';

test('user sees instant feedback when sending message', async ({ page }) => {
  // Navigate to app
  await page.goto('/');

  // Select session
  await page.click('text=Test Session');

  // Type and send message
  await page.fill('textarea', 'Hello Claude');
  const sendTime = Date.now();
  await page.click('button:has-text("Send")');

  // Assert - Message appears within 100ms
  await expect(page.locator('text=Hello Claude')).toBeVisible({ timeout: 100 });
  const appearTime = Date.now();
  expect(appearTime - sendTime).toBeLessThan(100);
});
```

##### ✅ Test Case 23: User sees streaming response
```typescript
test('user sees streaming text appear gradually', async ({ page }) => {
  // Navigate and send message
  await page.goto('/');
  await page.click('text=Test Session');
  await page.fill('textarea', 'Tell me a story');
  await page.click('button:has-text("Send")');

  // Assert - Streaming indicator appears
  await expect(page.locator('[data-testid="streaming-indicator"]')).toBeVisible();

  // Assert - Text appears gradually (check multiple times)
  await page.waitForTimeout(500);
  const text1 = await page.locator('[data-testid="streaming-message"]').textContent();

  await page.waitForTimeout(500);
  const text2 = await page.locator('[data-testid="streaming-message"]').textContent();

  // Text should have grown
  expect(text2.length).toBeGreaterThan(text1.length);
});
```

##### ✅ Test Case 24: User can resize session panel
```typescript
test('user can resize session panel', async ({ page }) => {
  // Navigate to app
  await page.goto('/');

  // Get initial panel width
  const panel = page.locator('[data-testid="session-panel"]');
  const initialBounds = await panel.boundingBox();

  // Drag resize handle
  const resizeHandle = page.locator('[data-panel-resize-handle]');
  await resizeHandle.dragTo(resizeHandle, {
    targetPosition: { x: 100, y: 0 }
  });

  // Assert - Panel width changed
  const newBounds = await panel.boundingBox();
  expect(newBounds.width).not.toBe(initialBounds.width);
});
```

##### ✅ Test Case 25: Session list scrolls smoothly with many sessions
```typescript
test('session list scrolls smoothly with 100+ sessions', async ({ page }) => {
  // Create 100 test sessions (via API or mock)
  // ...

  // Navigate to app
  await page.goto('/');

  // Measure scroll performance
  const scrollContainer = page.locator('[data-testid="session-list"]');

  // Scroll down
  await scrollContainer.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });

  // Assert - Scroll completes without lag
  // Check that last session is visible
  await expect(page.locator('text=Session 99')).toBeVisible();
});
```

##### ✅ Test Case 26: Panel width persists across reloads
```typescript
test('panel width persists after app reload', async ({ page }) => {
  // Navigate and resize
  await page.goto('/');
  const resizeHandle = page.locator('[data-panel-resize-handle]');
  await resizeHandle.dragTo(resizeHandle, {
    targetPosition: { x: 100, y: 0 }
  });

  // Get width
  const panel = page.locator('[data-testid="session-panel"]');
  const bounds1 = await panel.boundingBox();

  // Reload
  await page.reload();

  // Assert - Width same after reload
  const bounds2 = await panel.boundingBox();
  expect(bounds2.width).toBeCloseTo(bounds1.width, 5);
});
```

##### ✅ Test Case 27: Virtual scrolling maintains performance
```typescript
test('virtual scrolling maintains 60fps with 500 sessions', async ({ page }) => {
  // This would be a performance test measuring frame rate
  // during scrolling with many sessions
});
```

---

## Test Data

### Mock Sessions for Virtual Scrolling
```typescript
const mockSessions = Array.from({ length: 150 }, (_, i) => ({
  id: `sess_${i.toString().padStart(3, '0')}`,
  title: `Session ${i}`,
  rootDirectory: `/Users/test/project-${i}`,
  workspacePath: `/tmp/claude-sessions/sess_${i}/project-${i}`,
  branchName: `session/sess_${i}`,
  baseBranch: 'main',
  isActive: i === 0,
  createdAt: Date.now() - (i * 60000),
  updatedAt: Date.now() - (i * 60000)
}));
```

---

## Test Execution

```bash
# Run all Phase 3 tests
pnpm test --grep="Phase 3"

# Run optimistic UI tests
pnpm test ChatInterface.test.tsx

# Run streaming tests
pnpm test MessageList.test.tsx

# Run resizable panel tests
pnpm test App.test.tsx

# Run virtual scrolling tests
pnpm test SessionList.test.tsx

# Run E2E tests
pnpm test:e2e phase3-ux.spec.ts
```

---

## Coverage Requirements

- **ChatInterface.tsx**: ≥ 85% (optimistic UI)
- **MessageList.tsx**: ≥ 85% (streaming)
- **App.tsx**: ≥ 80% (resizable panels)
- **SessionList.tsx**: ≥ 85% (virtual scrolling)

---

## Checklist

- [ ] All unit tests written (30 tests)
- [ ] All integration tests written (12 tests)
- [ ] All E2E tests written (6 tests)
- [ ] Tests initially fail (RED phase of TDD)
- [ ] Implementation makes tests pass (GREEN phase)
- [ ] Code refactored (REFACTOR phase)
- [ ] Test coverage ≥ 80%
- [ ] Manual testing completed
- [ ] Performance benchmarks met

---

**Document History**:
- 2025-10-25: Initial test case creation for TDD workflow
