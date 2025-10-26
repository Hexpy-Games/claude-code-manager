# Feature: Keyboard Shortcuts

> **Feature ID**: 011
> **Status**: Complete
> **Owner**: Claude
> **Created**: 2025-01-25
> **Updated**: 2025-01-25

## Overview

Add comprehensive keyboard shortcuts to the desktop application for power users, enabling fast navigation and common actions without mouse interaction.

## User Story

**As a** power user of Claude Code Manager
**I want** keyboard shortcuts for common actions
**So that** I can navigate and interact with the application efficiently without using the mouse

## Acceptance Criteria

- [x] **AC1**: User can press `Cmd/Ctrl+N` to open new session dialog
- [x] **AC2**: User can press `Cmd/Ctrl+,` to open settings dialog
- [x] **AC3**: User can press `Cmd/Ctrl+W` to close/deselect active session
- [x] **AC4**: User can press `Cmd/Ctrl+1-9` to switch to sessions 1-9 (sorted by updated time)
- [x] **AC5**: User can press `Cmd/Ctrl+Enter` or `Enter` to send message
- [x] **AC6**: User can press `ESC` to stop streaming response
- [x] **AC7**: Shortcuts work even when typing in text inputs
- [x] **AC8**: Shortcuts use platform-appropriate modifier (`Cmd` on Mac, `Ctrl` on Windows/Linux)

## Success Metrics

### Quantitative Metrics
- **Shortcut registration**: < 100ms on app load
- **Shortcut response time**: < 50ms from key press to action
- **Test coverage**: ≥ 80% for keyboard shortcut logic

### Qualitative Metrics
- **Discoverability**: Users can discover shortcuts through placeholder text and UI hints
- **Consistency**: Shortcuts match common conventions (Cmd+N for new, Cmd+, for settings)
- **Accessibility**: Keyboard-only users can access all primary functions

## User Flows

### Primary Flow (Happy Path)

1. **User presses Cmd+N**
   - New session dialog opens
   - Focus moves to session title input

2. **User fills in session details and presses Enter**
   - Session is created
   - User can immediately start typing

3. **User types message and presses Cmd+Enter**
   - Message is sent to Claude
   - Response begins streaming

4. **User presses ESC while streaming**
   - Streaming stops immediately
   - Partial response is saved

5. **User presses Cmd+1**
   - Switches to first session in sidebar
   - Chat interface loads with that session's messages

### Alternative Flows

#### Alt Flow 1: Settings Access

1. User presses `Cmd+,` anywhere in app
2. Settings dialog opens
3. User can configure app settings
4. User presses `ESC` or clicks close
5. Settings dialog closes

#### Alt Flow 2: Session Navigation

1. User has 5 sessions open
2. User presses `Cmd+3`
3. Switches to third session (sorted by updated time)
4. Chat interface shows correct session messages

#### Alt Flow 3: Close Active Session

1. User has session selected
2. User presses `Cmd+W`
3. Active session is deselected
4. Chat interface shows "No Session Selected" state

## Edge Cases

### Edge Case 1: Pressing Session Number Beyond Available Sessions
- **Situation**: User presses `Cmd+7` but only has 3 sessions
- **Expected behavior**: Nothing happens (shortcut ignored gracefully)
- **Rationale**: Better than error message for quick navigation attempts

### Edge Case 2: Multiple Rapid Shortcut Presses
- **Situation**: User rapidly presses `Cmd+N` multiple times
- **Expected behavior**: Only one dialog opens, additional presses ignored
- **Rationale**: Prevents multiple dialogs stacking

### Edge Case 3: Shortcut While Dialog Open
- **Situation**: User has settings open and presses `Cmd+N`
- **Expected behavior**: New session dialog opens (layered), settings stays open
- **Rationale**: Allows recovering from misclicked shortcuts

## Dependencies

### Required Features
- Session list UI (Feature 003)
- Settings dialog component (Feature 010)
- Message input component (Feature 006)
- Chat interface streaming (Feature 006)

### External Dependencies
- react-hotkeys-hook (npm package for global shortcuts)
- React hooks (useState, useEffect)
- Zustand store for session state

## Technical Notes

### Architecture Considerations
- Use `react-hotkeys-hook` for cross-platform shortcut handling
- Register shortcuts at App.tsx level for global scope
- Use `enableOnFormTags: true` to allow shortcuts while typing
- Modifier key detection via `mod` (automatically Cmd/Ctrl based on platform)

### Implementation Details
```typescript
// Global keyboard shortcuts using react-hotkeys-hook
useHotkeys('mod+n', (e) => {
  e.preventDefault();
  setShowNewSessionDialog(true);
}, { enableOnFormTags: true });

// Session switching with dynamic number
for (let i = 1; i <= 9; i++) {
  useHotkeys(`mod+${i}`, (e) => {
    e.preventDefault();
    const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
    const targetSession = sortedSessions[i - 1];
    if (targetSession) {
      setActiveSessionId(targetSession.id);
    }
  }, { enableOnFormTags: true }, [sessions]);
}
```

### Component Changes

**App.tsx**: Added global shortcut handlers
**MessageInput.tsx**: Added Cmd+Enter and ESC handlers
**SessionList.tsx**: Made dialog state controllable from parent

## UI/UX Considerations

### Visual Design
- Input placeholder shows "Enter or Cmd+Enter to send"
- Streaming placeholder shows "ESC to stop"
- No visual keyboard shortcut hints (kept clean)

### Accessibility
- All shortcuts use standard conventions
- Shortcuts don't conflict with browser defaults
- Screen readers can still use mouse/touch alternatives
- Focus management handled correctly when dialogs open

## Non-Functional Requirements

### Performance
- Shortcut registration: < 100ms
- Shortcut response: < 50ms
- No memory leaks from event listeners

### Security
- No security concerns (client-side only)
- Shortcuts don't bypass authentication

## Related Features

- [Feature 006]: WebSocket streaming - ESC shortcut stops streaming
- [Feature 010]: Settings panel - Cmd+, opens settings
- [Feature 003]: Session management - Cmd+1-9 switches sessions

## References

- [react-hotkeys-hook documentation](https://github.com/JohannesKlauss/react-hotkeys-hook)
- [macOS keyboard shortcuts guidelines](https://developer.apple.com/design/human-interface-guidelines/keyboards)

---

**Document History**:
- 2025-01-25: Retroactive documentation after implementation (feature already complete)
