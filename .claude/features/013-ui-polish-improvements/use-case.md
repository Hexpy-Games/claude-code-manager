# Feature: UI Polish Improvements

> **Feature ID**: 013
> **Status**: In Progress
> **Owner**: Claude
> **Created**: 2025-10-27
> **Updated**: 2025-10-27

## Overview

Polish the desktop application UI with four targeted improvements: simplify session list items, show contextual chat header information, display agent status, and unify code block styling for better visual cohesion.

## User Story

**As a** user of Claude Code Manager
**I want** a polished, professional UI with clear visual hierarchy
**So that** I can easily understand session context, agent status, and read code more clearly

## Acceptance Criteria

- [x] **AC1**: Session list uses simple item styling instead of Card components
- [x] **AC2**: Chat header displays the active session name instead of generic "Chat"
- [x] **AC3**: Chat header shows Claude agent status (idle/working/streaming)
- [x] **AC4**: Code blocks appear as unified blocks with consistent background (not line-by-line)

## Success Metrics

### Quantitative Metrics
- **Visual consistency**: All code blocks render as single unified blocks
- **Session identification**: 100% of session selections show correct name in header
- **Status accuracy**: Agent status updates within 100ms of state changes
- **Performance**: No performance degradation from UI changes

### Qualitative Metrics
- **Clarity**: Users can immediately identify which session is active
- **Awareness**: Users know when Claude is processing vs idle
- **Readability**: Code blocks are easier to read with unified styling
- **Polish**: UI feels more professional and cohesive

## User Flows

### Primary Flow (Happy Path)

1. **User views session list**
   - Sessions appear as clean, simple list items
   - No heavy card borders or shadows
   - Focus on content, not decorative UI

2. **User clicks a session**
   - Session highlights in list
   - Chat header updates to show "[Session Name]" instead of "Chat"
   - Status shows "Idle" or "Ready"

3. **User sends a message**
   - Header status changes to "Working..." or "Thinking..."
   - User sees visual feedback that Claude is processing

4. **Claude responds with code**
   - Code block renders as unified block
   - All lines share single background
   - Easy to distinguish where code starts/ends

### Alternative Flows

#### Alt Flow 1: Streaming Response

1. User sends message
2. Header shows "Writing..." or "Streaming..."
3. Code appears line by line
4. Once complete, shows "Idle"

#### Alt Flow 2: Long Session Names

1. User selects session with very long title
2. Header shows truncated name with ellipsis
3. Hover shows full name in tooltip

#### Alt Flow 3: No Session Selected

1. User starts app with no session selected
2. Header shows "No Session Selected"
3. Status shows "—" or empty state

## Edge Cases

### Edge Case 1: Session Name Not Available
- **Situation**: Session data hasn't loaded yet
- **Expected behavior**: Show loading skeleton or "Loading..."
- **Rationale**: Prevent flash of "undefined" or error state

### Edge Case 2: Rapid Session Switching
- **Situation**: User quickly switches between multiple sessions
- **Expected behavior**: Header updates immediately, status resets to idle
- **Rationale**: Avoid stale status showing wrong session's state

### Edge Case 3: Code Block Without Language
- **Situation**: Inline code or plain text block
- **Expected behavior**: Still renders as unified block with consistent styling
- **Rationale**: Visual consistency across all code types

### Edge Case 4: Very Long Code Blocks
- **Situation**: Code block spans hundreds of lines
- **Expected behavior**: Unified background styling doesn't cause performance issues
- **Rationale**: Ensure scalability of styling approach

## Dependencies

### Required Features
- Session list UI (Feature 003)
- Chat interface (Feature 006)
- CodeBlock component (Feature 006)
- Message streaming (Feature 006)

### External Dependencies
- React state management (Zustand store)
- Tailwind CSS for styling
- react-markdown for code rendering
- Existing CodeBlock component

## Technical Notes

### Architecture Considerations

**SessionItem Simplification**:
- Remove Card/CardContent wrapper components
- Use plain div with hover/active states
- Maintain accessibility attributes

**Chat Header Enhancement**:
- Pass `sessionId` to ChatInterface
- Look up session name from store
- Derive agent status from streaming state

**Agent Status Logic**:
```typescript
type AgentStatus = 'idle' | 'thinking' | 'writing' | 'error';

function getAgentStatus(streamingMessageId?: string, isLoading?: boolean): AgentStatus {
  if (isLoading) return 'thinking';
  if (streamingMessageId) return 'writing';
  return 'idle';
}
```

**CodeBlock Styling**:
- Move from per-line backgrounds to container-level background
- Use `pre` element with unified bg
- Ensure syntax highlighting still works

### Implementation Details

**SessionItem.tsx**:
```typescript
// Before: <Card>...</Card>
// After:
<div
  className={cn(
    "px-4 py-3 cursor-pointer transition-colors",
    isActive ? "bg-primary/10" : "hover:bg-muted/50"
  )}
  {...accessibilityProps}
>
  {/* content */}
</div>
```

**ChatInterface.tsx Header**:
```typescript
const session = useSessionStore(state =>
  state.sessions.find(s => s.id === sessionId)
);

const agentStatus = streamingMessageId ? 'Writing...' : 'Idle';

<div className="p-4">
  <h2>{session?.title || 'No Session Selected'}</h2>
  <span className="text-xs text-muted-foreground">{agentStatus}</span>
</div>
```

**CodeBlock.tsx**:
```typescript
// Unified background approach
<pre className="p-4 rounded-lg bg-muted overflow-x-auto">
  <code className={`language-${language}`}>
    {highlightedCode}
  </code>
</pre>
```

### Component Changes

**SessionItem.tsx**: Replace Card with simple div, maintain states
**ChatInterface.tsx**: Add session name and status to header
**CodeBlock.tsx**: Apply unified background styling
**MessageList.tsx**: Pass agent status props if needed

## UI/UX Considerations

### Visual Design

**Session List**:
- Clean, minimal list items
- Clear hover states
- Distinct active state
- No shadows or heavy borders

**Chat Header**:
- Session name prominent
- Status text subtle but visible
- Icon indicator optional (e.g., spinner for "Writing...")

**Code Blocks**:
- Single unified background color
- Clear visual boundaries
- Syntax highlighting preserved
- Copy button remains accessible

### Accessibility
- Maintain ARIA labels for session items
- Status updates announced to screen readers
- Code blocks maintain keyboard navigation
- Focus states remain clear

## Non-Functional Requirements

### Performance
- No performance regression from UI changes
- Code block rendering: < 100ms for typical blocks
- Header updates: < 50ms after state change
- List item rendering: No impact on virtual scrolling

### Maintainability
- Simpler component tree (fewer wrapper components)
- Clear separation of concerns
- Reusable status logic
- Consistent styling patterns

## Related Features

- [Feature 003]: Session management - session list UI
- [Feature 006]: Chat interface - code blocks and headers
- [Feature 011]: Keyboard shortcuts - session switching reflects in header

## References

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [React Markdown Documentation](https://github.com/remarkjs/react-markdown)
- [Shadcn/ui Components](https://ui.shadcn.com/)

---

**Document History**:
- 2025-10-27: Initial use-case document created
