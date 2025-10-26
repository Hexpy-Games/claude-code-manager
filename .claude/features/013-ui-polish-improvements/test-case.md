# Test Cases: UI Polish Improvements

> **Feature ID**: 013
> **Related Use Case**: [use-case.md](./use-case.md)
> **Status**: In Progress
> **Last Updated**: 2025-10-27

## Test Strategy

### Testing Pyramid

```
        E2E Tests (Manual)
      ─────────────────
     Integration Tests (Few)
   ───────────────────────────
  Unit Tests (Many)
```

### Coverage Goals
- **Unit Test Coverage**: ≥ 80%
- **Visual Regression**: Manual review of UI changes
- **E2E Tests**: Manual testing for visual polish

### Test Environment
- **Unit Tests**: Vitest, React Testing Library, JSDOM
- **Integration Tests**: Full component rendering with React Testing Library
- **E2E Tests**: Manual testing in desktop app

---

## Unit Tests

### Component: SessionItem

**File**: `apps/desktop/src/components/SessionItem.test.tsx`

#### Test Suite: Simplified SessionItem UI

##### ✅ Test Case 1: Renders without Card wrapper
```typescript
it('should render as simple div without Card component', () => {
  const mockSession = {
    id: 'sess_1',
    title: 'Test Session',
    rootDirectory: '/test/path',
    // ...other props
  };

  const { container } = render(
    <SessionItem
      session={mockSession}
      isActive={false}
      onSwitch={vi.fn()}
      onDelete={vi.fn()}
    />
  );

  // Should not have card-specific classes
  const element = container.firstChild as HTMLElement;
  expect(element.tagName).toBe('DIV');
  expect(element.className).not.toContain('border-2');
});
```

##### ✅ Test Case 2: Shows active state with correct styling
```typescript
it('should apply active styling when isActive is true', () => {
  const mockSession = {
    id: 'sess_1',
    title: 'Active Session',
    rootDirectory: '/test/path',
  };

  const { container } = render(
    <SessionItem
      session={mockSession}
      isActive={true}
      onSwitch={vi.fn()}
      onDelete={vi.fn()}
    />
  );

  const element = container.firstChild as HTMLElement;
  expect(element.className).toContain('bg-primary/10');
});
```

##### ✅ Test Case 3: Shows hover state for inactive items
```typescript
it('should apply hover styling for inactive items', () => {
  const mockSession = {
    id: 'sess_1',
    title: 'Inactive Session',
    rootDirectory: '/test/path',
  };

  const { container } = render(
    <SessionItem
      session={mockSession}
      isActive={false}
      onSwitch={vi.fn()}
      onDelete={vi.fn()}
    />
  );

  const element = container.firstChild as HTMLElement;
  expect(element.className).toContain('hover:bg-muted/50');
});
```

### Component: ChatInterface

**File**: `apps/desktop/src/components/ChatInterface.test.tsx`

#### Test Suite: Chat Header with Session Name

##### ✅ Test Case 1: Displays session name when session is active
```typescript
it('should display session name in header when session is selected', () => {
  const mockSession = {
    id: 'sess_1',
    title: 'My Awesome Project',
    rootDirectory: '/test/path',
  };

  // Mock Zustand store to return session
  render(<ChatInterface sessionId="sess_1" client={mockClient} />);

  expect(screen.getByText('My Awesome Project')).toBeInTheDocument();
  expect(screen.queryByText('Chat')).not.toBeInTheDocument();
});
```

##### ✅ Test Case 2: Shows placeholder when no session selected
```typescript
it('should show "No Session Selected" when sessionId is null', () => {
  render(<ChatInterface sessionId={null} client={mockClient} />);

  expect(screen.getByText('No Session Selected')).toBeInTheDocument();
});
```

##### ✅ Test Case 3: Truncates long session names
```typescript
it('should truncate very long session names', () => {
  const mockSession = {
    id: 'sess_1',
    title: 'This is a very long session name that should be truncated when displayed',
    rootDirectory: '/test/path',
  };

  const { container } = render(
    <ChatInterface sessionId="sess_1" client={mockClient} />
  );

  const headerElement = screen.getByText(/This is a very long/);
  expect(headerElement.className).toContain('truncate');
});
```

#### Test Suite: Agent Status Display

##### ✅ Test Case 4: Shows "Idle" status when no streaming
```typescript
it('should show "Idle" when not streaming', () => {
  render(
    <ChatInterface
      sessionId="sess_1"
      client={mockClient}
      streamingMessageId={undefined}
    />
  );

  expect(screen.getByText(/Idle/i)).toBeInTheDocument();
});
```

##### ✅ Test Case 5: Shows "Writing..." status when streaming
```typescript
it('should show "Writing..." when message is streaming', () => {
  render(
    <ChatInterface
      sessionId="sess_1"
      client={mockClient}
      streamingMessageId="msg_123"
    />
  );

  expect(screen.getByText(/Writing/i)).toBeInTheDocument();
});
```

##### ✅ Test Case 6: Updates status when streaming starts/stops
```typescript
it('should update status when streaming state changes', async () => {
  const { rerender } = render(
    <ChatInterface
      sessionId="sess_1"
      client={mockClient}
      streamingMessageId={undefined}
    />
  );

  expect(screen.getByText(/Idle/i)).toBeInTheDocument();

  // Start streaming
  rerender(
    <ChatInterface
      sessionId="sess_1"
      client={mockClient}
      streamingMessageId="msg_123"
    />
  );

  expect(screen.getByText(/Writing/i)).toBeInTheDocument();

  // Stop streaming
  rerender(
    <ChatInterface
      sessionId="sess_1"
      client={mockClient}
      streamingMessageId={undefined}
    />
  );

  expect(screen.getByText(/Idle/i)).toBeInTheDocument();
});
```

### Component: CodeBlock

**File**: `apps/desktop/src/components/ui/code-block.test.tsx`

#### Test Suite: Unified Code Block Styling

##### ✅ Test Case 1: Renders with single unified background
```typescript
it('should render code block with unified background', () => {
  const code = 'const foo = "bar";\nconsole.log(foo);';

  const { container } = render(<CodeBlock code={code} language="javascript" />);

  const preElement = container.querySelector('pre');
  expect(preElement).toBeInTheDocument();
  expect(preElement?.className).toContain('bg-muted');
});
```

##### ✅ Test Case 2: Does not have line-by-line backgrounds
```typescript
it('should not apply per-line backgrounds', () => {
  const code = 'line 1\nline 2\nline 3';

  const { container } = render(<CodeBlock code={code} language="text" />);

  // Should have single pre background, not per-line backgrounds
  const preElement = container.querySelector('pre');
  const codeElement = container.querySelector('code');

  expect(preElement?.className).toContain('bg-muted');
  expect(codeElement?.className).not.toContain('bg-');
});
```

##### ✅ Test Case 3: Maintains syntax highlighting
```typescript
it('should preserve syntax highlighting with unified background', () => {
  const code = 'const foo = "bar";';

  const { container } = render(<CodeBlock code={code} language="javascript" />);

  const codeElement = container.querySelector('code');
  expect(codeElement?.className).toContain('language-javascript');
});
```

##### ✅ Test Case 4: Copy button remains accessible
```typescript
it('should render copy button with unified background', () => {
  const code = 'const foo = "bar";';

  render(<CodeBlock code={code} language="javascript" />);

  const copyButton = screen.getByRole('button', { name: /copy/i });
  expect(copyButton).toBeInTheDocument();
  expect(copyButton).toBeVisible();
});
```

---

## Integration Tests

### Integration Test 1: Full Session Selection Flow

**Scope**: SessionList → SessionItem → ChatInterface

#### Test: Session name updates in chat header when clicked
```typescript
it('should update chat header when session is clicked', async () => {
  const user = userEvent.setup();

  render(<App />);

  // Wait for sessions to load
  await waitFor(() => {
    expect(screen.getByText('Test Session 1')).toBeInTheDocument();
  });

  // Click session
  const sessionItem = screen.getByText('Test Session 1');
  await user.click(sessionItem);

  // Chat header should show session name
  await waitFor(() => {
    expect(screen.getByText('Test Session 1')).toBeInTheDocument();
  });
});
```

### Integration Test 2: Agent Status Updates During Messaging

**Scope**: ChatInterface → MessageInput → MessageList

#### Test: Status changes from idle → writing → idle
```typescript
it('should update agent status during message lifecycle', async () => {
  const user = userEvent.setup();

  render(<App />);

  // Select session
  const session = screen.getByText('Test Session');
  await user.click(session);

  // Should show Idle
  expect(screen.getByText(/Idle/i)).toBeInTheDocument();

  // Send message
  const input = screen.getByRole('textbox');
  await user.type(input, 'Hello{Enter}');

  // Should show Writing during stream
  await waitFor(() => {
    expect(screen.getByText(/Writing/i)).toBeInTheDocument();
  });

  // After stream completes, should show Idle again
  await waitFor(() => {
    expect(screen.getByText(/Idle/i)).toBeInTheDocument();
  });
});
```

### Integration Test 3: Code Block Rendering in Message

**Scope**: MessageList → MessageItem → CodeBlock

#### Test: Code blocks render with unified styling
```typescript
it('should render code blocks with unified background in messages', async () => {
  const mockMessages = [
    {
      id: 'msg_1',
      role: 'assistant',
      content: '```javascript\nconst foo = "bar";\nconsole.log(foo);\n```',
      timestamp: Date.now(),
    },
  ];

  render(<MessageList messages={mockMessages} />);

  const preElement = screen.getByRole('code').closest('pre');
  expect(preElement?.className).toContain('bg-muted');
});
```

---

## E2E Tests (Manual)

### E2E Test 1: Session List Visual Polish

**User Story**: As a user, I want the session list to look clean without heavy card styling.

#### Test Steps

1. **Given** App is running with multiple sessions
2. **When** User views the session list
3. **Then** Sessions appear as simple list items
4. **And** No heavy borders or card shadows visible
5. **When** User hovers over a session
6. **Then** Subtle background highlight appears
7. **When** User clicks a session
8. **Then** Active session has distinct background color
9. **And** Visual focus is on content, not decoration

**Expected Visual State**:
- Clean, minimal list appearance
- Clear hover feedback
- Distinct active state
- No heavy borders

**Status**: ⏳ Pending

### E2E Test 2: Chat Header Shows Session Context

**User Story**: As a user, I want to know which session I'm viewing by seeing its name in the chat header.

#### Test Steps

1. **Given** User has 3 sessions: "Frontend", "Backend", "Docs"
2. **When** User clicks "Frontend" session
3. **Then** Chat header shows "Frontend" (not "Chat")
4. **When** User clicks "Backend" session
5. **Then** Chat header updates to show "Backend"
6. **When** User clicks "Docs" session
7. **Then** Chat header shows "Docs"
8. **When** User deselects session (Cmd+W)
9. **Then** Chat header shows "No Session Selected"

**Expected Behavior**:
- Header updates immediately on session switch
- Session name clearly visible
- No generic "Chat" label

**Status**: ⏳ Pending

### E2E Test 3: Agent Status Reflects Activity

**User Story**: As a user, I want to know when Claude is processing my request.

#### Test Steps

1. **Given** User has active session
2. **And** Chat header shows "Idle"
3. **When** User sends message "Explain React hooks"
4. **Then** Header status changes to "Writing..." or "Thinking..."
5. **And** Status remains while response streams
6. **When** Response completes
7. **Then** Status returns to "Idle"
8. **When** User presses ESC during streaming
9. **Then** Status immediately returns to "Idle"

**Expected Behavior**:
- Clear visual feedback of Claude's state
- Status updates within 100ms
- Accurate reflection of streaming state

**Status**: ⏳ Pending

### E2E Test 4: Code Blocks Look Unified

**User Story**: As a user reading code, I want code blocks to appear as cohesive visual units.

#### Test Steps

1. **Given** User asks "Write a JavaScript function"
2. **When** Claude responds with code:
   ```javascript
   function example() {
     const x = 1;
     const y = 2;
     return x + y;
   }
   ```
3. **Then** Code block appears with single unified background
4. **And** All lines share same background color
5. **And** Clear visual boundary around entire block
6. **And** Syntax highlighting still works correctly
7. **When** User hovers over code
8. **Then** Copy button appears and is accessible

**Expected Visual State**:
- Single cohesive block appearance
- No line-by-line background stripes
- Clear start/end boundaries
- Professional appearance

**Status**: ⏳ Pending

### E2E Test 5: Long Session Names Truncate

**User Story**: As a user with long session titles, I want them to truncate gracefully.

#### Test Steps

1. **Given** User creates session with very long name:
   "My Super Long Project Name That Definitely Won't Fit"
2. **When** User selects this session
3. **Then** Chat header shows truncated name with ellipsis
4. **And** Hover shows tooltip with full name (optional)
5. **And** Layout doesn't break or overflow

**Expected Behavior**:
- Graceful truncation with ellipsis
- No layout breaking
- Optional tooltip for full name

**Status**: ⏳ Pending

---

## Test Data

### Mock Data

#### Sample Sessions
```typescript
const mockSessions = [
  {
    id: 'sess_1',
    title: 'Frontend Project',
    rootDirectory: '/projects/frontend',
    isActive: true,
  },
  {
    id: 'sess_2',
    title: 'Backend API',
    rootDirectory: '/projects/backend',
    isActive: false,
  },
  {
    id: 'sess_3',
    title: 'Very Long Session Name That Should Truncate In The UI',
    rootDirectory: '/projects/long',
    isActive: false,
  },
];
```

#### Sample Messages with Code
```typescript
const mockMessageWithCode = {
  id: 'msg_1',
  role: 'assistant',
  content: `Here's an example:

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
  return true;
}
\`\`\`

This function demonstrates...`,
  timestamp: Date.now(),
};
```

---

## Mocks & Stubs

### Mocking Strategy

#### Zustand Store
```typescript
// Mock session store for testing
vi.mock('@/stores/sessionStore', () => ({
  useSessionStore: vi.fn((selector) =>
    selector({
      sessions: mockSessions,
      activeSessionId: 'sess_1',
      setActiveSessionId: vi.fn(),
    })
  ),
}));
```

#### REST Client
```typescript
const mockClient = {
  listSessions: vi.fn().mockResolvedValue(mockSessions),
  getSession: vi.fn().mockResolvedValue(mockSessions[0]),
  sendMessage: vi.fn(),
  // ...other methods
};
```

---

## Test Execution

### Running Tests

```bash
# Run all tests
pnpm test

# Run unit tests only
pnpm vitest run

# Run specific test file
pnpm vitest run src/components/SessionItem.test.tsx

# Run with coverage
pnpm vitest run --coverage

# Watch mode
pnpm vitest
```

### Manual Testing Checklist

#### SessionItem Polish
- [ ] Sessions appear as simple list items (no Card styling)
- [ ] Hover state shows subtle background
- [ ] Active state has distinct appearance
- [ ] No heavy borders or shadows
- [ ] Click behavior unchanged

#### Chat Header Context
- [ ] Session name appears in header when selected
- [ ] "No Session Selected" when no session active
- [ ] Long names truncate with ellipsis
- [ ] Header updates immediately on switch

#### Agent Status
- [ ] Shows "Idle" when not active
- [ ] Shows "Writing..." during streaming
- [ ] Updates within 100ms of state change
- [ ] Returns to "Idle" after completion
- [ ] ESC immediately returns to "Idle"

#### Code Block Unification
- [ ] Code blocks have single unified background
- [ ] No line-by-line background stripes
- [ ] Syntax highlighting preserved
- [ ] Copy button accessible
- [ ] Clear visual boundaries

---

## Coverage Requirements

### Target Coverage
- **SessionItem**: ≥ 80% line coverage
- **ChatInterface header**: ≥ 80% line coverage
- **CodeBlock styling**: ≥ 80% line coverage

### Current Coverage
```
Test Files:  TBD
Tests:       TBD
Coverage:    TBD
```

---

## Checklist

Before marking feature as "tested":

- [ ] All unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Manual E2E tests completed
- [ ] Test coverage ≥ 80%
- [ ] No flaky tests
- [ ] Visual regression manually reviewed
- [ ] Edge cases covered (long names, no session, rapid switches)
- [ ] Error states tested
- [ ] Accessibility maintained (ARIA labels, focus states)

---

**Document History**:
- 2025-10-27: Initial test-case document created
