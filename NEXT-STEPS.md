# Next Steps - UX Improvements

## Current Status ✅

**Clone-Based Session Architecture**: Complete
- All 257 tests passing (232 backend + 25 e2e)
- Backend: 15.77s
- E2E: 43.7s

## Immediate Tasks (Phase 3 - UX Improvements)

### 1. Fix Session Card Flooding 🔧
**Problem**: Session cards may overflow the session panel
**Solution**: 
- Implement virtual scrolling for session list
- Add max-height with proper scroll behavior
- Consider pagination or infinite scroll

### 2. Make Session Panel Resizable 🔧
**Problem**: Fixed width session panel
**Solution**:
- Add resize handle between session panel and main content
- Use `react-resizable-panels` or custom implementation
- Persist panel width to localStorage
- Min/max width constraints

### 3. Show User Messages Immediately 🔧
**Problem**: User messages may not appear instantly
**Solution**:
- Add optimistic UI update
- Show user message immediately when sent
- Add loading indicator for Claude response
- Handle send errors gracefully

### 4. Implement Streaming Text Display 🔧
**Problem**: Claude responses appear all at once
**Solution**:
- Connect to WebSocket streaming endpoint
- Display text character-by-character or word-by-word
- Add smooth scrolling to follow streaming text
- Show typing indicator while streaming
- Handle stream interruption/errors

## Implementation Order

1. **User Message Immediate Display** (Quick Win)
   - Estimated: 2-3 hours
   - Impact: High (better perceived performance)

2. **Streaming Text Display** (Core Feature)
   - Estimated: 4-6 hours
   - Impact: Very High (matches Claude.ai experience)

3. **Session Panel Resizable** (UX Enhancement)
   - Estimated: 3-4 hours
   - Impact: Medium (better workspace customization)

4. **Session Card Virtual Scrolling** (Performance)
   - Estimated: 2-3 hours
   - Impact: Medium (handles many sessions)

## Files to Modify

### User Messages Immediate Display
- `apps/desktop/src/components/ChatInterface.tsx`
- `apps/desktop/src/stores/chatStore.ts` (if using Zustand)

### Streaming Text Display
- `apps/desktop/src/components/MessageList.tsx`
- `apps/desktop/src/components/Message.tsx` (new component)
- `apps/desktop/src/services/api/ws-client.ts`

### Resizable Panel
- `apps/desktop/src/App.tsx`
- Install: `pnpm add react-resizable-panels`

### Virtual Scrolling
- `apps/desktop/src/components/SessionList.tsx`
- Install: `pnpm add @tanstack/react-virtual`

## Testing Strategy

1. **Unit Tests**: Test each component in isolation
2. **Integration Tests**: Test message flow and streaming
3. **E2E Tests**: Test complete user workflows
4. **Manual Testing**: Verify smooth animations and UX

## Success Criteria

- ✅ User messages appear instantly (<100ms)
- ✅ Streaming text displays smoothly (no lag)
- ✅ Session panel can be resized and remembers width
- ✅ Session list handles 100+ sessions without performance issues
- ✅ All existing tests still pass
- ✅ New features have >80% test coverage

---

**Ready to start Phase 3!** 🚀
