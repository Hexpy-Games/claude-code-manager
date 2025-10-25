# Feature: Phase 3 UX Improvements

> **Feature ID**: 010
> **Status**: ✅ Completed
> **Owner**: Development Team
> **Created**: 2025-10-25
> **Updated**: 2025-10-25
> **Completed**: 2025-10-25

## Overview

Enhance the desktop application's user experience to match Claude.ai's responsiveness and fluidity. This includes optimistic UI updates for instant feedback, streaming text display for real-time responses, resizable panel layouts, and virtual scrolling for efficient session list rendering.

## User Story

**As a** desktop application user
**I want** instant visual feedback, real-time streaming responses, customizable layout, and smooth performance with many sessions
**So that** the app feels responsive, modern, and efficient like Claude.ai

### Example 1: Optimistic UI
**As a** user typing a message
**I want** to see my message appear immediately when I hit send
**So that** I get instant feedback that my input was received

### Example 2: Streaming
**As a** user waiting for Claude's response
**I want** to see the response appear word-by-word as Claude types
**So that** I can start reading while Claude is still thinking

### Example 3: Resizable Layout
**As a** user with many sessions
**I want** to resize the session panel to see more chat history
**So that** I can customize my workspace based on my needs

### Example 4: Virtual Scrolling
**As a** user with 100+ sessions
**I want** the session list to scroll smoothly without lag
**So that** I can quickly find and switch between sessions

## Acceptance Criteria

### Optimistic UI
- [ ] **AC1**: User messages appear instantly (<100ms) when sent
- [ ] **AC2**: Optimistic messages added to UI before server confirmation
- [ ] **AC3**: If send fails, optimistic message removed and error shown
- [ ] **AC4**: Timestamp reflects when message was sent, not confirmed
- [ ] **AC5**: No duplicate messages when server confirms
- [ ] **AC6**: Loading indicator shown while waiting for Claude response

### Streaming Text Display
- [ ] **AC7**: Claude responses stream character-by-character or word-by-word
- [ ] **AC8**: Typing/loading indicator shown while waiting for first chunk
- [ ] **AC9**: Auto-scroll follows streaming text to keep it visible
- [ ] **AC10**: Stream can be interrupted/cancelled gracefully
- [ ] **AC11**: If stream fails, partial message shown with error indicator
- [ ] **AC12**: Message finalizes when stream completes (done event)
- [ ] **AC13**: Spinning loader icon during streaming

### Resizable Session Panel
- [ ] **AC14**: Drag handle visible between session panel and main content
- [ ] **AC15**: Panel width adjustable by dragging handle
- [ ] **AC16**: Minimum width constraint (15% of window width)
- [ ] **AC17**: Maximum width constraint (40% of window width)
- [ ] **AC18**: Panel width persisted to localStorage
- [ ] **AC19**: Panel width restored on app reload
- [ ] **AC20**: Smooth resize with visual feedback
- [ ] **AC21**: Default width: 25% of window

### Virtual Scrolling
- [ ] **AC22**: Only visible session cards rendered in DOM
- [ ] **AC23**: Scrolling smooth with 100+ sessions (60fps)
- [ ] **AC24**: Session card heights calculated correctly
- [ ] **AC25**: Active session remains visible when list updates
- [ ] **AC26**: No visual glitches during scroll
- [ ] **AC27**: Memory usage constant regardless of session count
- [ ] **AC28**: Uses @tanstack/react-virtual library

## Success Metrics

### Performance
- **User message appears**: < 100ms
- **First streaming chunk**: < 500ms
- **Session list scrolling**: 60fps with 100+ sessions
- **Memory for 100 sessions**: < 50MB increase
- **Panel resize latency**: < 16ms (60fps)

### User Experience
- **Perceived responsiveness**: Messages feel instant
- **Streaming naturalness**: Like watching Claude.ai type
- **Layout customization**: Users can adjust to preference
- **No UI jank**: Smooth animations, no stuttering

## User Flows

### Primary Flow 1: Send Message with Optimistic UI

1. **User types message in input**
   - Message content in textarea

2. **User clicks Send button**
   - Button triggers onSend handler

3. **Component adds optimistic message immediately**
   - Creates temporary user message with id `temp-${Date.now()}`
   - Adds to messages array
   - Renders in chat immediately

4. **Component shows loading state**
   - Disables send button
   - Shows "Claude is thinking..." placeholder

5. **Component sends API request**
   - Calls `client.sendMessage(sessionId, content)`
   - Request sent in background

6. **Server confirms and responds**
   - Real message stored in database
   - Claude response generated

7. **Component receives confirmation**
   - Removes optimistic message
   - Adds real user message + assistant response
   - Re-enables send button

### Primary Flow 2: Receive Streaming Response

1. **WebSocket connected to session**
   - Connection established on mount

2. **User sends message**
   - Message sent, optimistic UI updated

3. **Component receives first chunk**
   - Creates streaming assistant message with id `streaming-${Date.now()}`
   - Shows spinning loader icon

4. **Component receives content chunks**
   - Each chunk: `{ type: 'content_chunk', content: 'Hello', index: 0 }`
   - Appends content to streaming message
   - Auto-scrolls to keep text visible

5. **Component receives done event**
   - `{ type: 'done', stopReason: 'end_turn' }`
   - Finalizes message
   - Fetches from server for persistence

6. **UI updates complete**
   - Streaming message replaced with final message
   - Ready for next interaction

### Primary Flow 3: Resize Session Panel

1. **User hovers over panel border**
   - Resize handle appears (visible line)

2. **User clicks and drags handle**
   - Cursor changes to resize cursor
   - Panel width updates in real-time

3. **User releases mouse**
   - Final width saved to localStorage
   - Key: `sessionPanelWidth`, Value: `25` (percentage)

4. **User reloads app**
   - Panel width read from localStorage
   - Panel rendered at saved width

### Primary Flow 4: Scroll Session List

1. **User has 150 sessions**
   - All sessions in database

2. **Component renders virtual scroller**
   - Calculates viewport height
   - Renders only visible items (∼10 cards)

3. **User scrolls down**
   - Virtual scroller calculates new visible range
   - Unmounts invisible cards
   - Mounts newly visible cards

4. **UI remains smooth**
   - Only 10-15 cards in DOM at once
   - Smooth 60fps scrolling
   - No lag or stuttering

## Alternative Flows

#### Alt Flow 1: Message Send Fails

1. User sends message → Optimistic message appears
2. API request fails (network error)
3. Component removes optimistic message
4. Error toast shown: "Failed to send message"
5. Message text remains in input for retry

#### Alt Flow 2: Stream Interruption

1. Streaming in progress
2. Network drops mid-stream
3. Component receives WebSocket close event
4. Partial message shown with "Stream interrupted" indicator
5. User can retry sending message

#### Alt Flow 3: Resize Beyond Constraints

1. User drags resize handle
2. User tries to make panel < 15% or > 40%
3. Panel stops at constraint boundary
4. Cursor can continue moving (no stuck feel)
5. Panel snaps to constraint

#### Alt Flow 4: No Sessions for Virtual Scrolling

1. User has 0 sessions
2. Virtual scroller not needed
3. Empty state shown instead
4. "Create your first session" message

## Edge Cases

### Edge Case 1: Rapid Message Sending

- **Situation**: User sends 5 messages quickly
- **Expected behavior**: All 5 appear optimistically, all get confirmed in order
- **Rationale**: Queue messages, don't block on confirmation

### Edge Case 2: Very Long Streaming Response

- **Situation**: Claude generates 10,000+ token response
- **Expected behavior**: Stream smoothly, auto-scroll stays performant
- **Rationale**: Efficient text rendering, throttled scroll updates

### Edge Case 3: Resize During Animation

- **Situation**: User resizes while messages are being added
- **Expected behavior**: Layout updates correctly, no visual glitches
- **Rationale**: React handles updates gracefully

### Edge Case 4: Session List Empty Then Populated

- **Situation**: Start with 0 sessions, create 10 rapidly
- **Expected behavior**: Virtual scroller initializes correctly
- **Rationale**: Handle empty → populated transition

### Edge Case 5: localStorage Unavailable

- **Situation**: Browser blocks localStorage (privacy mode)
- **Expected behavior**: Use default panel width, don't crash
- **Rationale**: Graceful degradation

### Edge Case 6: Streaming Message ID Collision

- **Situation**: Two streaming messages with same timestamp
- **Expected behavior**: Add random suffix to ensure uniqueness
- **Rationale**: Prevent React key conflicts

### Edge Case 7: Very Narrow Window

- **Situation**: User resizes app window to 400px wide
- **Expected behavior**: Panel respects min/max constraints, content readable
- **Rationale**: Maintain usability at all window sizes

## Dependencies

### Required Features
- [Feature 007]: Tauri Setup - React environment
- [Feature 008]: API Client - REST and WebSocket clients
- [Feature 009]: Clone-Based Sessions - Session data structure

### External Dependencies
- **@tanstack/react-virtual**: Virtual scrolling (^3.0.0)
- **react-resizable-panels**: Resizable layout (^3.0.6)
- **React Query**: Optimistic updates and cache management
- **Zustand**: State management (already installed)

## Technical Notes

### Architecture Considerations

**Optimistic UI Pattern**:
```typescript
// Add optimistic message immediately
const optimisticMessage = {
  id: `temp-${Date.now()}`,
  role: 'user',
  content,
  timestamp: Date.now()
};
setOptimisticMessages(prev => [...prev, optimisticMessage]);

// Send to server
const response = await client.sendMessage(sessionId, content);

// Replace optimistic with real
setOptimisticMessages([]);
queryClient.invalidateQueries(['messages', sessionId]);
```

**Streaming Pattern**:
```typescript
// Initialize streaming message
const streamingMessage = {
  id: `streaming-${Date.now()}`,
  role: 'assistant',
  content: '',
  timestamp: Date.now()
};
setStreamingMessage(streamingMessage);

// Accumulate chunks
wsClient.onMessage((msg) => {
  if (msg.type === 'content_chunk') {
    setStreamingMessage(prev => ({
      ...prev,
      content: prev.content + msg.content
    }));
  } else if (msg.type === 'done') {
    setStreamingMessage(null);
    refetchMessages();
  }
});
```

**Virtual Scrolling Pattern**:
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const parentRef = useRef<HTMLDivElement>(null);
const virtualizer = useVirtualizer({
  count: sessions.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 100, // Estimated card height
  overscan: 5 // Render 5 extra items above/below
});

return (
  <div ref={parentRef} style={{ height: '100%', overflow: 'auto' }}>
    <div style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map(virtualRow => (
        <SessionCard
          key={sessions[virtualRow.index].id}
          session={sessions[virtualRow.index]}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualRow.start}px)`
          }}
        />
      ))}
    </div>
  </div>
);
```

**Resizable Panels Pattern**:
```typescript
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

<PanelGroup direction="horizontal">
  <Panel
    defaultSize={25}
    minSize={15}
    maxSize={40}
    id="session-panel"
    onResize={(size) => {
      localStorage.setItem('sessionPanelWidth', size.toString());
    }}
  >
    <SessionList />
  </Panel>

  <PanelResizeHandle className="w-1 bg-border hover:bg-primary" />

  <Panel defaultSize={75} minSize={50} id="main-panel">
    <ChatInterface />
  </Panel>
</PanelGroup>
```

### Data Model Changes

N/A - No database changes required

### API Changes

N/A - Uses existing WebSocket streaming API

## UI/UX Considerations

### Visual Design
- **Optimistic messages**: Slightly muted until confirmed
- **Streaming indicator**: Spinning icon, "Claude is thinking..."
- **Resize handle**: 1px border, highlights on hover
- **Virtual scrolling**: No visual difference from normal scrolling

### Accessibility
- **Optimistic UI**: Screen reader announces message sent
- **Streaming**: Screen reader announces partial content
- **Resize handle**: Keyboard accessible (arrow keys)
- **Virtual scrolling**: Maintains focus on active session

### Animations
- **Message appear**: Fade in + slide up (200ms)
- **Streaming text**: Smooth append, no flicker
- **Panel resize**: Real-time, no delay
- **Scroll**: Native browser scroll, 60fps

## Non-Functional Requirements

### Performance
- **Message render**: < 16ms (60fps)
- **Streaming chunk**: < 10ms processing per chunk
- **Virtual scroll**: Maintain 60fps with 1000+ sessions
- **Panel resize**: < 16ms per frame

### Reliability
- **Optimistic UI**: Rollback on error
- **Streaming**: Handle partial messages
- **Resize**: Save on every change
- **Virtual scroll**: No memory leaks

### Usability
- **Instant feedback**: Users feel in control
- **Predictable behavior**: Matches Claude.ai UX
- **Smooth interactions**: No jank or lag

## Open Questions

- [x] **Q1**: Stream word-by-word or character-by-character?
  - **Answer**: Character-by-character for smoothness

- [x] **Q2**: Persist panel width per-session or globally?
  - **Answer**: Globally (simpler UX)

- [x] **Q3**: Virtual scroll library?
  - **Answer**: @tanstack/react-virtual (well-maintained, performant)

- [x] **Q4**: Optimistic message ID format?
  - **Answer**: `temp-${Date.now()}` for uniqueness

- [x] **Q5**: Auto-scroll threshold?
  - **Answer**: Always auto-scroll during streaming

## Related Features

- [Feature 007]: Tauri Setup - React environment
- [Feature 008]: API Client - WebSocket streaming
- [Feature 009]: Clone-Based Sessions - Session management

## References

- [React Query Optimistic Updates](https://tanstack.com/query/latest/docs/react/guides/optimistic-updates)
- [@tanstack/react-virtual Documentation](https://tanstack.com/virtual/latest)
- [react-resizable-panels Documentation](https://github.com/bvaughn/react-resizable-panels)
- [WebSocket Streaming Pattern](../../architecture/websocket-streaming.md)

---

**Document History**:
- 2025-10-25: Initial use-case creation for Phase 3 implementation
