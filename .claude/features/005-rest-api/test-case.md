# Test Cases: REST API Routes

> **Feature ID**: 005
> **Created**: 2025-10-23
> **Updated**: 2025-10-23

## Test Overview

This document outlines comprehensive test cases for the REST API Routes feature. Tests focus on HTTP endpoint behavior, request/response validation, error handling, and integration with backend services.

## Test Strategy

- **Integration tests**: Test full request/response cycle with real Fastify server
- **Service mocking**: Mock ClaudeAgentService to avoid real API calls
- **Database**: Use in-memory SQLite for tests
- **Coverage target**: 80%+ line coverage

## Session Endpoints Tests

### TC-001: Create Session - Success
**Description**: Successfully create a new session with valid data
**Type**: Integration
**Priority**: High

**Given**:
- Server is running
- Valid request body with title and rootDirectory

**When**:
- POST /api/sessions with body: `{ title: "Test Session", rootDirectory: "/path/to/repo" }`

**Then**:
- Response status: 201 Created
- Response body contains session object with generated ID
- Session is saved to database
- Git branch is created

### TC-002: Create Session - Missing Title
**Description**: Reject request with missing required title field
**Type**: Integration
**Priority**: High

**Given**: Server is running

**When**: POST /api/sessions with body: `{ rootDirectory: "/path/to/repo" }`

**Then**:
- Response status: 400 Bad Request
- Response body: `{ error: "ValidationError", message: "...", statusCode: 400, issues: [...] }`
- No session created

### TC-003: Create Session - Empty Title
**Description**: Reject request with empty title string
**Type**: Integration
**Priority**: High

**Given**: Server is running

**When**: POST /api/sessions with body: `{ title: "", rootDirectory: "/path/to/repo" }`

**Then**:
- Response status: 400 Bad Request
- Error indicates title must not be empty

### TC-004: Create Session - Non-Git Directory
**Description**: Reject request when directory is not a Git repository
**Type**: Integration
**Priority**: High

**Given**:
- Server is running
- Directory exists but is not a Git repo

**When**: POST /api/sessions with body: `{ title: "Test", rootDirectory: "/non/git/dir" }`

**Then**:
- Response status: 400 Bad Request
- Response body: `{ error: "NotGitRepoError", message: "...", statusCode: 400 }`

### TC-005: Create Session - Non-Existent Directory
**Description**: Reject request when directory doesn't exist
**Type**: Integration
**Priority**: High

**Given**: Server is running

**When**: POST /api/sessions with body: `{ title: "Test", rootDirectory: "/does/not/exist" }`

**Then**:
- Response status: 400 Bad Request
- Response body: `{ error: "InvalidSessionDataError", message: "...", statusCode: 400 }`

### TC-006: Create Session - With Optional Fields
**Description**: Successfully create session with baseBranch and metadata
**Type**: Integration
**Priority**: Medium

**Given**: Server is running

**When**: POST /api/sessions with body:
```json
{
  "title": "Test Session",
  "rootDirectory": "/path/to/repo",
  "baseBranch": "develop",
  "metadata": { "author": "test" }
}
```

**Then**:
- Response status: 201 Created
- Session has baseBranch="develop"
- Session has metadata with author field

### TC-007: List Sessions - Empty
**Description**: List sessions when none exist
**Type**: Integration
**Priority**: High

**Given**:
- Server is running
- No sessions in database

**When**: GET /api/sessions

**Then**:
- Response status: 200 OK
- Response body: `{ data: { sessions: [] } }`

### TC-008: List Sessions - Multiple
**Description**: List all sessions in descending order by updatedAt
**Type**: Integration
**Priority**: High

**Given**:
- Server is running
- 3 sessions exist in database

**When**: GET /api/sessions

**Then**:
- Response status: 200 OK
- Response body contains all 3 sessions
- Sessions sorted by updatedAt DESC

### TC-009: Get Session - Success
**Description**: Retrieve specific session by ID
**Type**: Integration
**Priority**: High

**Given**:
- Server is running
- Session exists with ID "sess_abc123xyz"

**When**: GET /api/sessions/sess_abc123xyz

**Then**:
- Response status: 200 OK
- Response body: `{ data: { session: {...} } }`
- Session ID matches requested ID

### TC-010: Get Session - Not Found
**Description**: Return 404 when session doesn't exist
**Type**: Integration
**Priority**: High

**Given**: Server is running

**When**: GET /api/sessions/sess_nonexistent

**Then**:
- Response status: 404 Not Found
- Response body: `{ error: "SessionNotFoundError", message: "...", statusCode: 404 }`

### TC-011: Get Session - Invalid ID Format
**Description**: Return 400 for malformed session ID
**Type**: Integration
**Priority**: Medium

**Given**: Server is running

**When**: GET /api/sessions/invalid-id-format

**Then**:
- Response status: 400 Bad Request
- Error indicates invalid ID format

### TC-012: Update Session - Success
**Description**: Successfully update session title
**Type**: Integration
**Priority**: High

**Given**:
- Server is running
- Session exists with ID "sess_abc123xyz"

**When**: PATCH /api/sessions/sess_abc123xyz with body: `{ title: "Updated Title" }`

**Then**:
- Response status: 200 OK
- Response body contains updated session
- Session title is "Updated Title"
- updatedAt timestamp is updated

### TC-013: Update Session - Not Found
**Description**: Return 404 when updating non-existent session
**Type**: Integration
**Priority**: High

**Given**: Server is running

**When**: PATCH /api/sessions/sess_nonexistent with body: `{ title: "New Title" }`

**Then**:
- Response status: 404 Not Found
- Response body: `{ error: "SessionNotFoundError", ... }`

### TC-014: Update Session - Empty Title
**Description**: Reject update with empty title
**Type**: Integration
**Priority**: High

**Given**:
- Server is running
- Session exists

**When**: PATCH /api/sessions/:id with body: `{ title: "" }`

**Then**:
- Response status: 400 Bad Request
- Error indicates title must not be empty

### TC-015: Update Session - Metadata
**Description**: Successfully update session metadata
**Type**: Integration
**Priority**: Medium

**Given**:
- Server is running
- Session exists

**When**: PATCH /api/sessions/:id with body: `{ metadata: { key: "value" } }`

**Then**:
- Response status: 200 OK
- Session metadata updated

### TC-016: Delete Session - Success
**Description**: Successfully delete session
**Type**: Integration
**Priority**: High

**Given**:
- Server is running
- Session exists with ID "sess_abc123xyz"

**When**: DELETE /api/sessions/sess_abc123xyz

**Then**:
- Response status: 200 OK
- Response body: `{ data: { success: true } }`
- Session removed from database
- Associated messages deleted (cascade)

### TC-017: Delete Session - Not Found
**Description**: Return 404 when deleting non-existent session
**Type**: Integration
**Priority**: High

**Given**: Server is running

**When**: DELETE /api/sessions/sess_nonexistent

**Then**:
- Response status: 404 Not Found
- Response body: `{ error: "SessionNotFoundError", ... }`

### TC-018: Delete Session - With Git Branch
**Description**: Delete session and request Git branch deletion
**Type**: Integration
**Priority**: Medium

**Given**:
- Server is running
- Session exists with Git branch

**When**: DELETE /api/sessions/:id?deleteGitBranch=true

**Then**:
- Response status: 200 OK
- Session deleted from database
- Git branch deletion attempted (may log warning if not implemented)

### TC-019: Delete Active Session
**Description**: Successfully delete currently active session
**Type**: Integration
**Priority**: High

**Given**:
- Server is running
- Session exists and is active

**When**: DELETE /api/sessions/:id

**Then**:
- Response status: 200 OK
- Session is deactivated before deletion
- Session deleted successfully

### TC-020: Switch Session - Success
**Description**: Successfully switch to different session
**Type**: Integration
**Priority**: High

**Given**:
- Server is running
- Two sessions exist: A (active) and B (inactive)

**When**: POST /api/sessions/:idB/switch

**Then**:
- Response status: 200 OK
- Response body contains session B with isActive=true
- Session A is now inactive
- Git branch checked out to B's branch

### TC-021: Switch Session - Not Found
**Description**: Return 404 when switching to non-existent session
**Type**: Integration
**Priority**: High

**Given**: Server is running

**When**: POST /api/sessions/sess_nonexistent/switch

**Then**:
- Response status: 404 Not Found
- No sessions change active status

### TC-022: Switch Session - Already Active
**Description**: Idempotent switch to already active session
**Type**: Integration
**Priority**: Medium

**Given**:
- Server is running
- Session A is already active

**When**: POST /api/sessions/:idA/switch

**Then**:
- Response status: 200 OK
- Session A remains active
- No Git operations performed

### TC-023: Switch Session - Git Checkout Fails
**Description**: Return error when Git checkout fails
**Type**: Integration
**Priority**: High

**Given**:
- Server is running
- Session exists but Git checkout will fail

**When**: POST /api/sessions/:id/switch

**Then**:
- Response status: 500 Internal Server Error
- Original active session remains active
- Error message indicates Git operation failure

## Message Endpoints Tests

### TC-024: Get Messages - Empty
**Description**: Get messages for session with no messages
**Type**: Integration
**Priority**: High

**Given**:
- Server is running
- Session exists with no messages

**When**: GET /api/sessions/:id/messages

**Then**:
- Response status: 200 OK
- Response body: `{ data: { messages: [] } }`

### TC-025: Get Messages - Multiple
**Description**: Get all messages for session in chronological order
**Type**: Integration
**Priority**: High

**Given**:
- Server is running
- Session has 5 messages (user + assistant pairs)

**When**: GET /api/sessions/:id/messages

**Then**:
- Response status: 200 OK
- Response body contains all 5 messages
- Messages ordered by timestamp ASC

### TC-026: Get Messages - Session Not Found
**Description**: Return 404 when session doesn't exist
**Type**: Integration
**Priority**: High

**Given**: Server is running

**When**: GET /api/sessions/sess_nonexistent/messages

**Then**:
- Response status: 404 Not Found
- Response body: `{ error: "SessionNotFoundError", ... }`

### TC-027: Send Message - Success
**Description**: Successfully send message and get response
**Type**: Integration
**Priority**: High

**Given**:
- Server is running
- Session exists
- ClaudeAgentService mocked to return response

**When**: POST /api/sessions/:id/messages with body: `{ content: "Hello, Claude!" }`

**Then**:
- Response status: 200 OK
- Response body: `{ data: { userMessage: {...}, assistantMessage: {...} } }`
- User message saved with role='user'
- Assistant message saved with role='assistant'
- Session lastMessageAt updated

### TC-028: Send Message - Empty Content
**Description**: Reject message with empty content
**Type**: Integration
**Priority**: High

**Given**: Server is running

**When**: POST /api/sessions/:id/messages with body: `{ content: "" }`

**Then**:
- Response status: 400 Bad Request
- Error indicates content must not be empty
- No messages saved

### TC-029: Send Message - Missing Content
**Description**: Reject message without content field
**Type**: Integration
**Priority**: High

**Given**: Server is running

**When**: POST /api/sessions/:id/messages with body: `{}`

**Then**:
- Response status: 400 Bad Request
- Error indicates content is required

### TC-030: Send Message - Session Not Found
**Description**: Return 404 when sending to non-existent session
**Type**: Integration
**Priority**: High

**Given**: Server is running

**When**: POST /api/sessions/sess_nonexistent/messages with body: `{ content: "Hello" }`

**Then**:
- Response status: 404 Not Found
- No messages saved

### TC-031: Send Message - Claude API Error
**Description**: Handle Claude API errors gracefully
**Type**: Integration
**Priority**: High

**Given**:
- Server is running
- ClaudeAgentService throws ClaudeAPIError

**When**: POST /api/sessions/:id/messages with body: `{ content: "Hello" }`

**Then**:
- Response status: 502 Bad Gateway
- Response body: `{ error: "ClaudeAPIError", message: "...", statusCode: 502 }`
- User message saved
- No assistant message saved

### TC-032: Send Message - Rate Limit
**Description**: Handle Claude API rate limiting
**Type**: Integration
**Priority**: Medium

**Given**:
- Server is running
- ClaudeAgentService throws RateLimitError

**When**: POST /api/sessions/:id/messages with body: `{ content: "Hello" }`

**Then**:
- Response status: 429 Too Many Requests
- Response body includes retry-after information
- User message saved

### TC-033: Send Message - Network Error
**Description**: Handle network failures
**Type**: Integration
**Priority**: Medium

**Given**:
- Server is running
- ClaudeAgentService throws NetworkError

**When**: POST /api/sessions/:id/messages with body: `{ content: "Hello" }`

**Then**:
- Response status: 503 Service Unavailable
- Error message indicates network failure

### TC-034: Send Message - With Tool Calls
**Description**: Successfully handle assistant response with tool calls
**Type**: Integration
**Priority**: Medium

**Given**:
- Server is running
- ClaudeAgentService returns response with tool_calls

**When**: POST /api/sessions/:id/messages with body: `{ content: "What's the weather?" }`

**Then**:
- Response status: 200 OK
- Assistant message includes toolCalls array
- Tool calls saved to database

## Settings Endpoints Tests

### TC-035: Get Setting - Success
**Description**: Retrieve existing setting value
**Type**: Integration
**Priority**: High

**Given**:
- Server is running
- Setting exists: key="theme", value="dark"

**When**: GET /api/settings/theme

**Then**:
- Response status: 200 OK
- Response body: `{ data: { key: "theme", value: "dark" } }`

### TC-036: Get Setting - Not Found
**Description**: Return 404 when setting doesn't exist
**Type**: Integration
**Priority**: High

**Given**: Server is running

**When**: GET /api/settings/nonexistent

**Then**:
- Response status: 404 Not Found
- Response body: `{ error: "SettingNotFoundError", ... }`

### TC-037: Get Setting - Invalid Key
**Description**: Reject invalid setting key format
**Type**: Integration
**Priority**: Medium

**Given**: Server is running

**When**: GET /api/settings/

**Then**:
- Response status: 400 Bad Request
- Error indicates invalid key

### TC-038: Set Setting - Success (Create)
**Description**: Successfully create new setting
**Type**: Integration
**Priority**: High

**Given**:
- Server is running
- Setting "theme" doesn't exist

**When**: PUT /api/settings/theme with body: `{ value: "dark" }`

**Then**:
- Response status: 200 OK
- Response body: `{ data: { key: "theme", value: "dark" } }`
- Setting saved to database

### TC-039: Set Setting - Success (Update)
**Description**: Successfully update existing setting
**Type**: Integration
**Priority**: High

**Given**:
- Server is running
- Setting "theme" exists with value="light"

**When**: PUT /api/settings/theme with body: `{ value: "dark" }`

**Then**:
- Response status: 200 OK
- Setting value updated to "dark"
- updatedAt timestamp updated

### TC-040: Set Setting - Complex Value
**Description**: Successfully store complex JSON value
**Type**: Integration
**Priority**: Medium

**Given**: Server is running

**When**: PUT /api/settings/config with body:
```json
{
  "value": {
    "notifications": true,
    "autoSave": 5000,
    "theme": { "mode": "dark", "accent": "blue" }
  }
}
```

**Then**:
- Response status: 200 OK
- Complex object stored and retrieved correctly

### TC-041: Set Setting - Missing Value
**Description**: Reject request without value field
**Type**: Integration
**Priority**: High

**Given**: Server is running

**When**: PUT /api/settings/theme with body: `{}`

**Then**:
- Response status: 400 Bad Request
- Error indicates value is required

### TC-042: Set Setting - Null Value
**Description**: Successfully store null value
**Type**: Integration
**Priority**: Low

**Given**: Server is running

**When**: PUT /api/settings/temp with body: `{ value: null }`

**Then**:
- Response status: 200 OK
- Setting stored with null value

## General API Tests

### TC-043: CORS Headers
**Description**: Verify CORS headers are present
**Type**: Integration
**Priority**: High

**Given**: Server is running

**When**: OPTIONS /api/sessions

**Then**:
- Response includes Access-Control-Allow-Origin header
- Response includes Access-Control-Allow-Methods header

### TC-044: Invalid JSON
**Description**: Handle malformed JSON gracefully
**Type**: Integration
**Priority**: High

**Given**: Server is running

**When**: POST /api/sessions with body: `{ invalid json }`

**Then**:
- Response status: 400 Bad Request
- Error indicates JSON parse failure

### TC-045: Content-Type Header
**Description**: Accept JSON with proper Content-Type
**Type**: Integration
**Priority**: Medium

**Given**: Server is running

**When**: POST /api/sessions with header: `Content-Type: application/json`

**Then**:
- Request processed correctly
- Response has Content-Type: application/json

### TC-046: Large Payload
**Description**: Reject excessively large payloads
**Type**: Integration
**Priority**: Low

**Given**: Server is running

**When**: POST /api/sessions with 10MB JSON body

**Then**:
- Response status: 413 Payload Too Large

### TC-047: Method Not Allowed
**Description**: Return 405 for unsupported HTTP methods
**Type**: Integration
**Priority**: Medium

**Given**: Server is running

**When**: PUT /api/sessions (should be POST)

**Then**:
- Response status: 405 Method Not Allowed

### TC-048: Not Found Route
**Description**: Return 404 for non-existent routes
**Type**: Integration
**Priority**: Medium

**Given**: Server is running

**When**: GET /api/nonexistent

**Then**:
- Response status: 404 Not Found

### TC-049: Server Initialization
**Description**: Server starts successfully with valid config
**Type**: Integration
**Priority**: High

**Given**: Valid configuration provided

**When**: Server.createServer(config) called

**Then**:
- Server instance created
- Services initialized
- Routes registered
- No errors thrown

### TC-050: Server Initialization - Missing API Key
**Description**: Server fails to start without Claude API key
**Type**: Integration
**Priority**: High

**Given**: Configuration missing claudeApiKey

**When**: Server.createServer(config) called

**Then**:
- ConfigurationError thrown
- Server does not start

## Test Utilities

### Helper Functions Needed

```typescript
// Test server factory
async function createTestServer(): Promise<FastifyInstance>

// Create test session
async function createTestSession(title: string): Promise<Session>

// Mock Claude Agent
function mockClaudeAgent(response: ClaudeResponse): void

// Assert error response format
function assertErrorResponse(response: any, expectedError: string): void

// Assert success response format
function assertSuccessResponse(response: any): void
```

## Coverage Requirements

- **Line coverage**: ≥ 80%
- **Branch coverage**: ≥ 70%
- **Function coverage**: ≥ 80%

## Test Execution

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

---

**Document History**:
- 2025-10-23: Initial draft with 50 test cases
