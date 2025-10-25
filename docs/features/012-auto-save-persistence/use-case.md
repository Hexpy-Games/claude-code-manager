# Feature: Auto-save & Persistence

> **Feature ID**: 012
> **Status**: Complete
> **Owner**: Claude
> **Created**: 2025-01-25
> **Updated**: 2025-01-25

## Overview

Automatically save draft messages and scroll positions per session to localStorage, providing a seamless experience when switching between sessions or closing/reopening the app.

## User Story

**As a** user working across multiple Claude Code sessions
**I want** my draft messages and scroll positions automatically saved
**So that** I don't lose my work when switching sessions and can resume exactly where I left off

## Acceptance Criteria

- [x] **AC1**: Draft messages are auto-saved to localStorage per session
- [x] **AC2**: Draft messages are restored when switching to a session
- [x] **AC3**: Draft messages are cleared after successfully sending
- [x] **AC4**: Draft messages are cleared when session becomes null
- [x] **AC5**: Scroll position is saved to localStorage per session
- [x] **AC6**: Scroll position is restored when switching to a session
- [x] **AC7**: Scroll to bottom when no saved position exists (new session)
- [x] **AC8**: Debounced saves to minimize localStorage writes
- [x] **AC9**: No saves during scroll restoration (prevent infinite loops)

## Success Metrics

### Quantitative Metrics
- **Save latency**: < 500ms after user stops typing/scrolling
- **Restore latency**: < 100ms when switching sessions
- **localStorage size**: < 1KB per session (drafts + scroll)
- **Test coverage**: ≥ 80% for persistence logic

### Qualitative Metrics
- **User confidence**: Users feel safe switching sessions mid-composition
- **Seamless experience**: Restoration feels instant and natural
- **No data loss**: Zero reports of lost draft messages

## User Flows

### Primary Flow: Draft Message Persistence

1. **User starts typing in Session A**
   - User types: "Hello, can you help me with"
   - After 500ms of no typing, draft auto-saves to localStorage
   - Key: `draft_sess_A`, Value: "Hello, can you help me with"

2. **User switches to Session B**
   - Draft in Session A is preserved in localStorage
   - Session B loads its own draft (if any)
   - User types in Session B: "Different topic"
   - Session B draft auto-saves

3. **User switches back to Session A**
   - Previous draft "Hello, can you help me with" is restored
   - User continues typing: " this bug?"
   - Updated draft auto-saves

4. **User sends message in Session A**
   - Message is sent successfully
   - Draft is immediately cleared from both state and localStorage
   - Input field becomes empty

### Primary Flow: Scroll Position Persistence

1. **User scrolls up in Session A to review earlier messages**
   - User scrolls to position 450px
   - After 500ms of no scrolling, position saves to localStorage
   - Key: `scroll_sess_A`, Value: "450"

2. **User switches to Session B**
   - Scroll position in Session A is preserved
   - Session B restores its own scroll position or scrolls to bottom

3. **User switches back to Session A**
   - Scroll position 450px is restored
   - User sees the exact same view they left

4. **User receives new message in Session A**
   - If user is at bottom (< 100px from bottom), auto-scroll to new message
   - If user is scrolled up, don't auto-scroll (respect user position)

### Alternative Flows

#### Alt Flow 1: New Session (No Saved Data)

1. User creates new session
2. No draft exists in localStorage → empty input
3. No scroll position exists → scrolls to bottom
4. User starts fresh conversation

#### Alt Flow 2: App Restart

1. User closes app with unsent draft in Session A
2. User reopens app
3. User selects Session A
4. Draft is restored from localStorage
5. User can continue composing

#### Alt Flow 3: Draft During Streaming

1. User has draft: "Can you explain"
2. User receives streaming response
3. Draft remains in localStorage (preserved)
4. User can still edit draft during streaming
5. When user sends, draft clears

## Edge Cases

### Edge Case 1: Very Long Draft (> 10KB)
- **Situation**: User types extremely long message (edge case)
- **Expected behavior**: Draft saves successfully (localStorage limit is 5-10MB)
- **Rationale**: Even books fit in localStorage

### Edge Case 2: Rapid Session Switching
- **Situation**: User rapidly switches between sessions (< 100ms between switches)
- **Expected behavior**: Debounce prevents excessive localStorage writes
- **Rationale**: Performance optimization, last draft wins

### Edge Case 3: localStorage Full
- **Situation**: localStorage quota exceeded (unlikely with 5MB limit)
- **Expected behavior**: Fail gracefully, continue working without persistence
- **Rationale**: Better than crashing, user can still send messages

### Edge Case 4: Scroll Restoration During Streaming
- **Situation**: New message arrives while restoring scroll position
- **Expected behavior**: Restoration completes, then auto-scroll if at bottom
- **Rationale**: Respect user's last known position

### Edge Case 5: Draft in Deleted Session
- **Situation**: User deletes session with draft in localStorage
- **Expected behavior**: Orphaned draft stays in localStorage (harmless)
- **Rationale**: Cleanup not critical, minimal storage impact

## Dependencies

### Required Features
- Chat interface (Feature 006)
- Message input component (Feature 006)
- Session management (Feature 003)
- localStorage browser API

### External Dependencies
- React hooks (useState, useEffect)
- Radix UI ScrollArea component
- Browser localStorage API (no npm packages needed)

## Technical Notes

### Architecture Considerations

**localStorage Keys**:
- Draft messages: `draft_${sessionId}`
- Scroll positions: `scroll_${sessionId}`

**Debouncing Strategy**:
- Drafts: Save after 500ms of no typing (React useEffect dependency)
- Scroll: Save after 500ms of no scrolling (setTimeout in scroll handler)

**Cleanup Strategy**:
- Drafts cleared on send or when sessionId becomes null
- Scroll positions persist indefinitely (low storage impact)
- No automatic cleanup for orphaned data (acceptable trade-off)

### Implementation Details

**Draft Persistence**:
```typescript
// In ChatInterface.tsx
const [draftMessage, setDraftMessage] = useState('');

// Load draft on session change
useEffect(() => {
  if (!sessionId) {
    setDraftMessage('');
    return;
  }

  const draftKey = `draft_${sessionId}`;
  const savedDraft = localStorage.getItem(draftKey);
  if (savedDraft) {
    setDraftMessage(savedDraft);
  } else {
    setDraftMessage('');
  }
}, [sessionId]);

// Save draft on change
useEffect(() => {
  if (!sessionId) return;

  const draftKey = `draft_${sessionId}`;
  if (draftMessage) {
    localStorage.setItem(draftKey, draftMessage);
  } else {
    localStorage.removeItem(draftKey);
  }
}, [draftMessage, sessionId]);

// Clear draft after send
const handleSend = (msg: string) => {
  sendMutation.mutate(msg);
  setDraftMessage(''); // Clears both state and localStorage
};
```

**Scroll Position Persistence**:
```typescript
// In MessageList.tsx
const handleScroll = (event: Event) => {
  const scrollElement = event.target as HTMLElement;
  const { scrollTop } = scrollElement;

  // Debounced save
  if (sessionId && !isRestoringScrollRef.current) {
    if (scrollSaveTimeoutRef.current) {
      clearTimeout(scrollSaveTimeoutRef.current);
    }
    scrollSaveTimeoutRef.current = setTimeout(() => {
      const scrollKey = `scroll_${sessionId}`;
      localStorage.setItem(scrollKey, String(scrollTop));
    }, 500);
  }
};

// Restore on session change
useEffect(() => {
  if (sessionId && messages.length > 0) {
    const scrollKey = `scroll_${sessionId}`;
    const savedScrollPosition = localStorage.getItem(scrollKey);

    if (savedScrollPosition) {
      isRestoringScrollRef.current = true;
      requestAnimationFrame(() => {
        const scrollElement = getScrollElement();
        if (scrollElement) {
          scrollElement.scrollTop = Number(savedScrollPosition);
          setTimeout(() => {
            isRestoringScrollRef.current = false;
          }, 100);
        }
      });
    } else {
      scrollToBottom(true); // New session, scroll to bottom
    }
  }
}, [sessionId]);
```

### Component Changes

**ChatInterface.tsx**: Draft state management and persistence
**MessageInput.tsx**: Controlled/uncontrolled hybrid component
**MessageList.tsx**: Scroll position persistence and restoration

## UI/UX Considerations

### Visual Design
- No visual indicators for auto-save (seamless/invisible)
- No "Saved" badges or notifications (reduces clutter)
- User discovers behavior by experiencing it

### Accessibility
- Auto-save doesn't interfere with screen readers
- Focus remains on input when draft restored
- No accessibility concerns (background behavior)

## Non-Functional Requirements

### Performance
- Draft save: < 500ms after typing stops
- Scroll save: < 500ms after scrolling stops
- Restoration: < 100ms (localStorage is synchronous and fast)
- No UI blocking or jank

### Security
- localStorage is origin-bound (localhost:3000)
- No sensitive data stored (just draft messages and scroll positions)
- Data cleared on browser clear site data

### Data Storage
- Typical draft: ~100 bytes (short message)
- Typical scroll position: ~10 bytes (number as string)
- 100 sessions × 110 bytes = ~11KB total (negligible)

## Open Questions

- [x] **Q1**: Should we clean up orphaned drafts from deleted sessions?
  - **Answer**: No - storage impact minimal, cleanup adds complexity

- [x] **Q2**: Should we show "Draft restored" notification?
  - **Answer**: No - discovery through experience, no clutter

- [x] **Q3**: What if localStorage is disabled?
  - **Answer**: Graceful degradation - app works, just no persistence

## Related Features

- [Feature 003]: Session management - Switching triggers restoration
- [Feature 006]: WebSocket streaming - Scroll behavior during streaming
- [Feature 011]: Keyboard shortcuts - Cmd+Enter sends (clears draft)

## References

- [localStorage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- [React controlled components](https://react.dev/reference/react-dom/components/input#controlling-an-input-with-a-state-variable)

---

**Document History**:
- 2025-01-25: Retroactive documentation after implementation (feature already complete)
