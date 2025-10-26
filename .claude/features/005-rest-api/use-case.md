# Feature: REST API Routes

> **Feature ID**: 005
> **Status**: In Progress
> **Owner**: Development Team
> **Created**: 2025-10-23
> **Updated**: 2025-10-23

## Overview

Implement a REST API using Fastify that exposes all backend services (SessionManager, ClaudeAgentService, DatabaseClient) through HTTP endpoints. This API serves as the primary interface for client applications to interact with the Claude Code Manager backend.

## User Story

**As a** client application
**I want** to interact with Claude Code Manager through HTTP REST API endpoints
**So that** I can manage sessions, send messages, and configure settings remotely

## Acceptance Criteria

- [ ] **AC1**: Fastify server initializes with CORS support
- [ ] **AC2**: Server accepts JSON request bodies and returns JSON responses
- [ ] **AC3**: All requests/responses validated with Zod schemas
- [ ] **AC4**: POST /api/sessions creates new session with validation
- [ ] **AC5**: GET /api/sessions lists all sessions
- [ ] **AC6**: GET /api/sessions/:id returns specific session
- [ ] **AC7**: PATCH /api/sessions/:id updates session fields
- [ ] **AC8**: DELETE /api/sessions/:id deletes session and optionally Git branch
- [ ] **AC9**: POST /api/sessions/:id/switch activates session and checks out branch
- [ ] **AC10**: GET /api/sessions/:id/messages lists messages for session
- [ ] **AC11**: POST /api/sessions/:id/messages sends message to Claude
- [ ] **AC12**: GET /api/settings/:key retrieves setting value
- [ ] **AC13**: PUT /api/settings/:key updates setting value
- [ ] **AC14**: Error responses follow standard format: { error: string, message: string, statusCode: number }
- [ ] **AC15**: Success responses follow format: { data: {...} }
- [ ] **AC16**: 404 errors for non-existent resources
- [ ] **AC17**: 400 errors for validation failures
- [ ] **AC18**: 500 errors for server/database failures
- [ ] **AC19**: TypeScript strict mode compliance

## Success Metrics

### Quantitative Metrics
- **Response time**: < 100ms for GET requests (excluding Claude API)
- **Response time**: < 200ms for POST/PATCH/DELETE requests
- **Validation**: 100% of requests validated with Zod
- **Test coverage**: ≥ 80%
- **API success rate**: > 99% (excluding invalid requests)

### Qualitative Metrics
- Consistent error response format
- Clear validation error messages
- RESTful resource design
- Easy to extend with new endpoints

## User Flows

### Primary Flow 1: Create Session via API

1. **Client sends POST request**
   - POST /api/sessions
   - Body: { title: string, rootDirectory: string, baseBranch?: string, metadata?: object }
   - Headers: Content-Type: application/json

2. **Server validates request**
   - Zod schema validates request body
   - Returns 400 if validation fails with detailed errors

3. **Server creates session**
   - Calls SessionManager.createSession()
   - Creates Git branch
   - Saves to database

4. **Server returns response**
   - Status: 201 Created
   - Body: { data: { session: {...} } }

### Primary Flow 2: Send Message via API

1. **Client sends POST request**
   - POST /api/sessions/:id/messages
   - Body: { content: string, stream?: boolean }

2. **Server validates request**
   - Validates session ID format
   - Validates message content not empty
   - Returns 404 if session doesn't exist

3. **Server sends to Claude**
   - Calls ClaudeAgentService.sendMessage()
   - Saves user and assistant messages
   - Updates session timestamp

4. **Server returns response**
   - Status: 200 OK
   - Body: { data: { userMessage: {...}, assistantMessage: {...} } }

### Primary Flow 3: List Sessions via API

1. **Client sends GET request**
   - GET /api/sessions
   - No body required

2. **Server fetches sessions**
   - Calls SessionManager.listSessions()
   - Returns all sessions sorted by updatedAt DESC

3. **Server returns response**
   - Status: 200 OK
   - Body: { data: { sessions: [...] } }

### Primary Flow 4: Update Session via API

1. **Client sends PATCH request**
   - PATCH /api/sessions/:id
   - Body: { title?: string, metadata?: object }

2. **Server validates request**
   - Validates session exists
   - Validates update fields

3. **Server updates session**
   - Calls SessionManager.updateSession()
   - Updates only provided fields

4. **Server returns response**
   - Status: 200 OK
   - Body: { data: { session: {...} } }

### Primary Flow 5: Switch Session via API

1. **Client sends POST request**
   - POST /api/sessions/:id/switch
   - No body required

2. **Server validates session**
   - Checks session exists
   - Returns 404 if not found

3. **Server switches session**
   - Calls SessionManager.switchSession()
   - Checks out Git branch
   - Updates active status

4. **Server returns response**
   - Status: 200 OK
   - Body: { data: { session: {...} } }

### Primary Flow 6: Get/Set Settings

1. **Client requests setting**
   - GET /api/settings/:key
   - Server returns: { data: { key: string, value: any } }

2. **Client updates setting**
   - PUT /api/settings/:key
   - Body: { value: any }
   - Server returns: { data: { key: string, value: any } }

## Alternative Flows

### Alt Flow 1: Validation Failure

1. Client sends request with invalid data
2. Zod validation fails
3. Server returns 400 Bad Request
4. Body: { error: "ValidationError", message: "...", statusCode: 400, issues: [...] }

### Alt Flow 2: Session Not Found

1. Client requests non-existent session
2. SessionManager throws SessionNotFoundError
3. Server catches error and returns 404
4. Body: { error: "SessionNotFoundError", message: "Session not found: sess_xxx", statusCode: 404 }

### Alt Flow 3: Git Operation Failure

1. Client creates session in non-Git directory
2. GitService throws NotGitRepoError
3. Server catches error and returns 400
4. Body: { error: "NotGitRepoError", message: "...", statusCode: 400 }

### Alt Flow 4: Database Error

1. Client sends valid request
2. Database operation fails
3. Server catches error and returns 500
4. Body: { error: "DatabaseError", message: "Internal server error", statusCode: 500 }

### Alt Flow 5: Claude API Error

1. Client sends message
2. ClaudeAgentService API call fails
3. Server catches error and returns 502
4. Body: { error: "ClaudeAPIError", message: "...", statusCode: 502 }

## Edge Cases

### Edge Case 1: Empty Request Body

- **Situation**: Client sends POST/PATCH with empty body
- **Expected behavior**: 400 error with validation details
- **Rationale**: Explicit validation prevents silent failures

### Edge Case 2: Invalid JSON

- **Situation**: Client sends malformed JSON
- **Expected behavior**: 400 error with JSON parse error
- **Rationale**: Fastify automatically handles and returns clear error

### Edge Case 3: Missing Content-Type Header

- **Situation**: Client sends JSON without Content-Type header
- **Expected behavior**: Fastify still parses if body is valid JSON
- **Rationale**: Be lenient with clients

### Edge Case 4: Very Large Request Body

- **Situation**: Client sends enormous JSON payload
- **Expected behavior**: 413 Payload Too Large
- **Rationale**: Protect server resources

### Edge Case 5: Concurrent Requests to Same Session

- **Situation**: Multiple clients modify same session simultaneously
- **Expected behavior**: All requests processed, last write wins
- **Rationale**: SQLite handles concurrent writes with transactions

### Edge Case 6: Delete Active Session

- **Situation**: Client deletes currently active session
- **Expected behavior**: Session deleted, becomes inactive first
- **Rationale**: SessionManager handles this internally

## Dependencies

### Required Features
- [Feature 001]: Database Setup - DatabaseClient for data persistence
- [Feature 002]: Git Service - GitService for Git operations
- [Feature 003]: Session Manager - SessionManager for business logic
- [Feature 004]: Claude Agent Integration - ClaudeAgentService for AI

### External Dependencies
- fastify - Web framework
- @fastify/cors - CORS support
- zod - Schema validation
- pino - Logging (built into Fastify)

## Technical Notes

### Architecture Considerations

- Server is stateless, all state in database
- Services injected into route handlers via decorators
- Zod schemas define request/response types
- Error handling middleware catches all errors
- TypeScript types derived from Zod schemas

### API Design

#### Base URL
```
http://localhost:3000/api
```

#### Session Endpoints

**POST /api/sessions** - Create session
```typescript
Request: {
  title: string;
  rootDirectory: string;
  baseBranch?: string;
  metadata?: Record<string, any>;
}
Response: {
  data: { session: Session }
}
```

**GET /api/sessions** - List sessions
```typescript
Response: {
  data: { sessions: Session[] }
}
```

**GET /api/sessions/:id** - Get session
```typescript
Response: {
  data: { session: Session }
}
```

**PATCH /api/sessions/:id** - Update session
```typescript
Request: {
  title?: string;
  metadata?: Record<string, any>;
}
Response: {
  data: { session: Session }
}
```

**DELETE /api/sessions/:id** - Delete session
```typescript
Query: {
  deleteGitBranch?: boolean;
}
Response: {
  data: { success: true }
}
```

**POST /api/sessions/:id/switch** - Switch session
```typescript
Response: {
  data: { session: Session }
}
```

#### Message Endpoints

**GET /api/sessions/:id/messages** - Get messages
```typescript
Response: {
  data: { messages: Message[] }
}
```

**POST /api/sessions/:id/messages** - Send message
```typescript
Request: {
  content: string;
}
Response: {
  data: {
    userMessage: Message;
    assistantMessage: Message;
  }
}
```

#### Settings Endpoints

**GET /api/settings/:key** - Get setting
```typescript
Response: {
  data: {
    key: string;
    value: any;
  }
}
```

**PUT /api/settings/:key** - Set setting
```typescript
Request: {
  value: any;
}
Response: {
  data: {
    key: string;
    value: any;
  }
}
```

### Zod Schema Design

```typescript
import { z } from 'zod';

// Session schemas
export const createSessionSchema = z.object({
  title: z.string().min(1).max(255),
  rootDirectory: z.string().min(1),
  baseBranch: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const updateSessionSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  metadata: z.record(z.any()).optional(),
});

export const sessionIdSchema = z.string().regex(/^sess_[a-zA-Z0-9_-]{12}$/);

// Message schemas
export const sendMessageSchema = z.object({
  content: z.string().min(1),
});

// Settings schemas
export const setSettingSchema = z.object({
  value: z.any(),
});

export const settingKeySchema = z.string().min(1);

// Response schemas
export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
  issues: z.array(z.any()).optional(),
});

export const successResponseSchema = z.object({
  data: z.any(),
});
```

### Error Handling Strategy

```typescript
// Error handler hook
fastify.setErrorHandler((error, request, reply) => {
  // Log error
  request.log.error(error);

  // Validation errors
  if (error.validation) {
    return reply.status(400).send({
      error: 'ValidationError',
      message: 'Request validation failed',
      statusCode: 400,
      issues: error.validation,
    });
  }

  // Known errors from services
  if (error.name === 'SessionNotFoundError') {
    return reply.status(404).send({
      error: error.name,
      message: error.message,
      statusCode: 404,
    });
  }

  if (error.name === 'InvalidSessionDataError') {
    return reply.status(400).send({
      error: error.name,
      message: error.message,
      statusCode: 400,
    });
  }

  if (error.name === 'ClaudeAPIError') {
    return reply.status(502).send({
      error: error.name,
      message: error.message,
      statusCode: 502,
    });
  }

  // Default to 500
  return reply.status(500).send({
    error: 'InternalServerError',
    message: 'An internal server error occurred',
    statusCode: 500,
  });
});
```

### Server Initialization

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { DatabaseClient } from './db/client.js';
import { GitService } from './services/git-service.js';
import { SessionManager } from './services/session-manager.js';
import { ClaudeAgentService } from './services/claude-agent-service.js';

export interface ServerConfig {
  port?: number;
  host?: string;
  databasePath: string;
  claudeApiKey: string;
}

export async function createServer(config: ServerConfig) {
  const fastify = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
      },
    },
  });

  // Register CORS
  await fastify.register(cors, {
    origin: true, // Allow all origins in development
  });

  // Initialize services
  const db = new DatabaseClient(config.databasePath);
  const git = new GitService();
  const sessionManager = new SessionManager(db, git);
  const claudeAgent = new ClaudeAgentService(db, {
    apiKey: config.claudeApiKey,
  });

  // Decorate fastify with services
  fastify.decorate('db', db);
  fastify.decorate('sessionManager', sessionManager);
  fastify.decorate('claudeAgent', claudeAgent);

  // Register routes
  await fastify.register(sessionsRoutes, { prefix: '/api' });
  await fastify.register(messagesRoutes, { prefix: '/api' });
  await fastify.register(settingsRoutes, { prefix: '/api' });

  return fastify;
}
```

### Route Handler Pattern

```typescript
// Example route handler
fastify.post('/sessions', {
  schema: {
    body: createSessionSchema,
  },
  async handler(request, reply) {
    const { title, rootDirectory, baseBranch, metadata } = request.body;

    try {
      const session = await this.sessionManager.createSession({
        title,
        rootDirectory,
        baseBranch,
        metadata,
      });

      return reply.status(201).send({ data: { session } });
    } catch (error) {
      throw error; // Let error handler deal with it
    }
  },
});
```

## UI/UX Considerations

N/A - This is a backend API with no UI. However, API design follows REST conventions for easy integration with frontend clients.

## Non-Functional Requirements

### Performance
- GET requests: < 100ms response time
- POST/PATCH/DELETE: < 200ms response time
- Handle 100+ concurrent requests
- Minimal memory footprint

### Security
- CORS configured to allow specific origins in production
- No authentication in MVP (add in future feature)
- Input validation on all endpoints
- Error messages don't leak sensitive data
- API key never exposed in responses

### Reliability
- Graceful error handling for all failures
- All errors logged with request context
- Database connection errors handled
- Service initialization errors prevent server start
- Health check endpoint (future)

### Maintainability
- Clear separation of routes, schemas, and business logic
- Consistent error response format
- TypeScript types for all requests/responses
- Comprehensive test coverage
- Inline documentation for complex logic

## Open Questions

- [x] **Q1**: Should we implement authentication in this feature?
  - **Answer**: No, authentication is a future feature. MVP has no auth.

- [x] **Q2**: Should we implement rate limiting?
  - **Answer**: No, not in MVP. Add in future feature if needed.

- [x] **Q3**: Should we support streaming responses for messages?
  - **Answer**: No, streaming will be handled by WebSocket server (Feature 006).

- [x] **Q4**: Should we implement pagination for listing sessions/messages?
  - **Answer**: No, not in MVP. Assume small number of sessions/messages.

- [x] **Q5**: Should we validate Git directories in the API layer?
  - **Answer**: No, let SessionManager handle all validation. API just passes through.

## Related Features

- [Feature 001]: Database Setup - Provides DatabaseClient
- [Feature 002]: Git Service - Provides GitService
- [Feature 003]: Session Manager - Provides SessionManager
- [Feature 004]: Claude Agent Integration - Provides ClaudeAgentService
- [Feature 006]: WebSocket Server - Will provide real-time streaming
- [Feature 007]: Tool System - Will add tool execution endpoints

## References

- [Fastify Documentation](https://www.fastify.io/docs/latest/)
- [Zod Documentation](https://zod.dev/)
- [REST API Best Practices](https://restfulapi.net/)
- [HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)

---

**Document History**:
- 2025-10-23: Initial draft
