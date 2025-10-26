# Feature 006: WebSocket Streaming

**Feature ID**: 006
**Feature Name**: WebSocket Streaming
**Status**: Complete ✅
**Date**: 2025-10-23
**Dependencies**: Feature 004 (ClaudeAgent), Feature 005 (REST API)

## Overview

WebSocket streaming enables real-time, bidirectional communication between clients and the Claude API. This feature provides instant streaming of Claude's responses, tool calls, and status updates, creating a responsive and interactive user experience.

## Use Cases

### UC-006-001: Establish WebSocket Connection
**Actor**: Client Application
**Goal**: Connect to a session's WebSocket stream

**Preconditions**:
- Session exists and is valid
- Client has session ID

**Flow**:
1. Client initiates WebSocket connection to `ws://localhost:PORT/api/sessions/:sessionId/stream`
2. Server validates session exists
3. Server sends connection acknowledgment: `{ type: 'connected', sessionId: string }`
4. Connection is ready for bidirectional communication

**Postconditions**:
- WebSocket connection established
- Client can send messages
- Client can receive streaming responses

---

### UC-006-002: Send Message and Receive Streaming Response
**Actor**: Client Application
**Goal**: Send a message and receive Claude's response in real-time chunks

**Preconditions**:
- WebSocket connection established
- Session is active

**Flow**:
1. Client sends message: `{ type: 'message', content: string }`
2. Server validates message format
3. Server forwards to ClaudeAgentService.streamMessage()
4. Server streams response chunks:
   - Content chunks: `{ type: 'content_chunk', content: string, index: number }`
   - Tool calls: `{ type: 'tool_use', tool: string, toolUseId: string, input: any }`
   - Completion: `{ type: 'done', stopReason: string }`
5. Server persists message to database
6. Client receives all chunks in order

**Postconditions**:
- Message saved to database
- Full response streamed to client
- Session history updated

---

### UC-006-003: Handle Tool Calls During Streaming
**Actor**: Client Application
**Goal**: Receive real-time updates when Claude uses tools

**Preconditions**:
- WebSocket connection established
- Message requires tool usage

**Flow**:
1. Client sends message requesting information requiring tools
2. Server begins streaming response
3. When Claude uses a tool, server sends:
   - `{ type: 'tool_use', tool: string, toolUseId: string, input: any }`
4. Server executes tool and sends result:
   - `{ type: 'tool_result', toolUseId: string, content: any }`
5. Claude processes tool result and continues streaming
6. Final response includes tool usage information

**Postconditions**:
- Client receives all tool calls in real-time
- Client can display tool execution to user
- Complete interaction logged

---

### UC-006-004: Handle Connection Errors
**Actor**: System
**Goal**: Gracefully handle and communicate errors over WebSocket

**Preconditions**:
- WebSocket connection exists

**Flow**:
1. Error occurs (invalid session, API error, network issue)
2. Server sends error message: `{ type: 'error', error: string, message: string, code?: string }`
3. For recoverable errors, connection remains open
4. For fatal errors, server closes connection with code and reason
5. Client receives error and can retry or reconnect

**Postconditions**:
- Error communicated to client
- Resources cleaned up if connection closed
- Client can take appropriate action

---

### UC-006-005: Handle Connection Close
**Actor**: Client or Server
**Goal**: Gracefully close WebSocket connection and clean up resources

**Preconditions**:
- WebSocket connection established

**Flow**:
1. Client or server initiates close
2. Server cleans up connection resources
3. Server unregisters event listeners
4. Server sends close frame if client-initiated
5. Connection terminated

**Postconditions**:
- No resource leaks
- Session remains in database
- Client can reconnect if needed

---

## WebSocket Protocol Specification

### Connection URL
```
ws://localhost:PORT/api/sessions/:sessionId/stream
```

### Client → Server Messages

#### Send Message
```json
{
  "type": "message",
  "content": "What is the weather like?"
}
```

#### Ping (Keep-Alive)
```json
{
  "type": "ping"
}
```

### Server → Client Messages

#### Connection Acknowledged
```json
{
  "type": "connected",
  "sessionId": "sess_123"
}
```

#### Content Chunk
```json
{
  "type": "content_chunk",
  "content": "The weather is",
  "index": 0
}
```

#### Tool Use
```json
{
  "type": "tool_use",
  "tool": "get_weather",
  "toolUseId": "tool_abc123",
  "input": {
    "location": "San Francisco"
  }
}
```

#### Tool Result
```json
{
  "type": "tool_result",
  "toolUseId": "tool_abc123",
  "content": "Sunny, 72°F"
}
```

#### Message Complete
```json
{
  "type": "done",
  "stopReason": "end_turn",
  "usage": {
    "inputTokens": 150,
    "outputTokens": 200
  }
}
```

#### Error
```json
{
  "type": "error",
  "error": "InvalidMessage",
  "message": "Message content is required",
  "code": "INVALID_MESSAGE"
}
```

#### Pong (Keep-Alive Response)
```json
{
  "type": "pong"
}
```

---

## Integration Points

### ClaudeAgentService
- Uses `ClaudeAgentService.streamMessage()` for streaming responses
- Receives AsyncGenerator of streaming events
- Transforms events to WebSocket protocol format

### Database
- Saves complete messages after streaming completes
- Updates session history
- Stores tool usage information

### Error Handling
- Validates session exists before accepting connection
- Validates message format
- Handles Claude API errors gracefully
- Cleans up resources on disconnect

---

## Error Scenarios

### Invalid Session
**Error**: Session not found
**Response**: Close connection with code 4404 and reason "Session not found"
**Client Action**: Verify session ID or create new session

### Invalid Message Format
**Error**: Message missing required fields
**Response**: Send error message and keep connection open
**Client Action**: Correct message format and retry

### Claude API Error
**Error**: API returns error or times out
**Response**: Send error message with details
**Client Action**: Display error to user, allow retry

### Rate Limit
**Error**: Too many requests
**Response**: Send error with retry-after information
**Client Action**: Wait and retry after specified time

### Network Interruption
**Error**: Connection lost
**Response**: Automatic cleanup on server
**Client Action**: Reconnect when network available

---

## Performance Considerations

### Streaming Efficiency
- Minimal latency between Claude API and client
- Efficient JSON serialization
- Buffering strategy for optimal throughput

### Resource Management
- Connection timeout for inactive connections
- Memory cleanup on disconnect
- Limit concurrent connections per session

### Scalability
- Stateless design allows horizontal scaling
- Connection pooling for database access
- Efficient event handling

---

## Security Considerations

### Authentication
- Session ID validates access
- No additional auth required (session ownership verified)

### Input Validation
- Validate all client messages
- Sanitize content before processing
- Reject malformed JSON

### Rate Limiting
- Prevent abuse through message frequency limits
- Connection attempt limits
- Per-session request limits

---

## Acceptance Criteria

1. ✅ **AC-006-001**: Client can establish WebSocket connection to `/api/sessions/:id/stream`
2. ✅ **AC-006-002**: Server validates session exists before accepting connection
3. ✅ **AC-006-003**: Server sends connection acknowledgment on successful connection
4. ✅ **AC-006-004**: Client can send message with `{ type: 'message', content: string }`
5. ✅ **AC-006-005**: Server streams response chunks with `{ type: 'content_chunk', content: string, index: number }`
6. ✅ **AC-006-006**: Server sends tool use events with `{ type: 'tool_use', tool, toolUseId, input }`
7. ✅ **AC-006-007**: Server sends completion event with `{ type: 'done', stopReason, usage }`
8. ✅ **AC-006-008**: Server sends errors with `{ type: 'error', error, message, code }`
9. ✅ **AC-006-009**: Server closes connection with appropriate code for invalid session
10. ✅ **AC-006-010**: Server integrates with ClaudeAgentService.streamMessage()
11. ✅ **AC-006-011**: Server saves complete message to database after streaming
12. ✅ **AC-006-012**: Server handles connection close gracefully and cleans up resources
13. ✅ **AC-006-013**: Server handles multiple concurrent connections to different sessions
14. ✅ **AC-006-014**: Server validates message format and rejects invalid messages
15. ✅ **AC-006-015**: All WebSocket functionality covered by automated tests (80%+ coverage)

---

## Implementation Notes

### Technology Stack
- **@fastify/websocket**: Fastify WebSocket plugin
- **ws**: WebSocket library for Node.js
- **ClaudeAgentService**: Integration for Claude API streaming

### Code Structure
```
packages/server/src/
├── routes/
│   └── stream.ts          # WebSocket route handler
└── server.ts              # Register WebSocket plugin
```

### Testing Strategy
- Unit tests for message handling
- Integration tests for streaming flow
- Error scenario tests
- Connection lifecycle tests
- Cleanup and resource management tests

---

## Future Enhancements

### Phase 2 Considerations
- Desktop UI integration with real-time updates
- Visual indicators for streaming status
- Tool execution visualization

### Potential Improvements
- Compression for large responses
- Binary message support for attachments
- Multi-user session collaboration
- Broadcast to multiple clients
- Session replay functionality

---

## Related Documentation
- Feature 004: ClaudeAgent Service
- Feature 005: REST API
- @fastify/websocket documentation
- WebSocket protocol specification (RFC 6455)
