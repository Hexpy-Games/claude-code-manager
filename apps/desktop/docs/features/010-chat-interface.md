# Feature 010: Chat Interface Component

## Overview
Chat UI component for viewing messages and sending new ones with real-time streaming support.

## Dependencies
- `@tanstack/react-virtual` - For efficient rendering of long message lists

## Architecture

### Components

#### ChatInterface
**File**: `src/components/ChatInterface.tsx`

Main chat container that:
- Fetches messages for active session
- Displays MessageList
- Provides MessageInput
- Manages WebSocket connection for streaming
- Auto-scrolls to latest message

#### MessageList
**File**: `src/components/MessageList.tsx`

Virtualized message list that:
- Renders messages in chronological order
- Uses react-virtual for performance
- Differentiates user vs assistant messages
- Displays ToolCallDisplay for messages with tool calls
- Supports streaming message updates

#### MessageInput
**File**: `src/components/MessageInput.tsx`

Message input component that:
- Textarea for message composition
- Send button with loading state
- Prevents empty messages
- Disabled during streaming
- Auto-focus on mount

#### ToolCallDisplay
**File**: `src/components/ToolCallDisplay.tsx`

Tool call visualization that:
- Shows tool name and arguments
- Displays tool results
- Expandable/collapsible view
- Syntax highlighting for JSON

## API Integration

Uses clients from Feature 008:
- REST: `getMessages()`, `sendMessage()`
- WebSocket: Streaming message responses

## Testing Strategy

### Unit Tests
- Components: Rendering, user interactions, props
- Message ordering and grouping
- Streaming updates
- Tool call display

### Integration Tests
- REST + WebSocket integration
- Real-time message updates
- Error handling

### Test Coverage
- Minimum 80% coverage required
- Focus on chat workflows

## UI Requirements

- Messages in chronological order (oldest first)
- User messages aligned right
- Assistant messages aligned left
- Show timestamps
- Loading indicator during streaming
- Typing indicator
- Error messages inline
- Auto-scroll to bottom on new messages
- Virtualization for >50 messages

## Implementation Checklist

- [x] Documentation
- [ ] Install @tanstack/react-virtual
- [ ] Create MessageInput with tests (TDD)
- [ ] Create ToolCallDisplay with tests (TDD)
- [ ] Create MessageList with tests (TDD)
- [ ] Create ChatInterface with tests (TDD)
- [ ] WebSocket integration
- [ ] Manual UI testing
