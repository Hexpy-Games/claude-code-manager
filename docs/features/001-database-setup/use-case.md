# Feature: Database Setup

> **Feature ID**: 001
> **Status**: In Progress
> **Owner**: Development Team
> **Created**: 2025-10-23
> **Updated**: 2025-10-23

## Overview

Set up SQLite database infrastructure for Claude Code Manager to persist sessions, messages, Git state, and settings.

## User Story

**As a** backend developer
**I want** a reliable database layer with schema and client
**So that** the application can persist session data and conversation history

## Acceptance Criteria

- [ ] **AC1**: SQLite database can be created at configured path
- [ ] **AC2**: All required tables are created from schema
- [ ] **AC3**: Database client provides type-safe CRUD operations
- [ ] **AC4**: Sessions can be inserted and queried
- [ ] **AC5**: Messages can be inserted and queried with foreign keys
- [ ] **AC6**: Settings can be inserted, updated, and queried
- [ ] **AC7**: Database client handles errors gracefully
- [ ] **AC8**: Database uses WAL mode for better concurrency
- [ ] **AC9**: Proper indexes exist on foreign keys
- [ ] **AC10**: All database operations are tested

## Success Metrics

### Quantitative Metrics
- **Database creation**: < 100ms
- **Insert operation**: < 10ms per record
- **Query operation**: < 5ms for indexed queries
- **Test coverage**: ≥ 80%

### Qualitative Metrics
- Code is type-safe with TypeScript
- Easy to use API for other services
- Proper error messages for debugging

## User Flows

### Primary Flow (Happy Path)

1. **Application starts**
   - Database client initializes
   - Checks if database file exists
   - Creates database if not exists
   - Runs schema migrations

2. **Service inserts session**
   - Calls `db.insertSession(data)`
   - Returns session object with ID

3. **Service queries sessions**
   - Calls `db.getSessions()`
   - Returns array of session objects

### Alternative Flows

#### Alt Flow 1: Database File Doesn't Exist

1. Application starts
2. Database path directory doesn't exist
3. System creates parent directories
4. Creates database file
5. Initializes schema

#### Alt Flow 2: Schema Needs Migration

1. Application starts with existing database
2. Schema version is outdated
3. System runs migration scripts
4. Updates schema version
5. Application continues

## Edge Cases

### Edge Case 1: Database Path Not Writable
- **Situation**: Configured database path is read-only
- **Expected behavior**: Throw clear error with suggested fix
- **Rationale**: User needs to know exactly what's wrong

### Edge Case 2: Corrupted Database File
- **Situation**: Database file exists but is corrupted
- **Expected behavior**: Log error, optionally backup and recreate
- **Rationale**: Don't lose data if possible, but app should recover

### Edge Case 3: Concurrent Access
- **Situation**: Multiple operations happen simultaneously
- **Expected behavior**: WAL mode handles concurrency safely
- **Rationale**: Better-sqlite3 is synchronous, but WAL mode helps

### Edge Case 4: Large Message Content
- **Situation**: Message content is very large (>1MB)
- **Expected behavior**: Store successfully, no size limit in SQLite
- **Rationale**: Claude responses can be long with code

## Dependencies

### Required Features
- None (this is the first feature)

### External Dependencies
- better-sqlite3 npm package (already installed)
- Node.js file system APIs
- TypeScript for type safety

## Technical Notes

### Architecture Considerations
- Use better-sqlite3 (synchronous) for simplicity
- WAL mode for better concurrency
- Prepared statements for performance
- Type-safe interfaces for all data models

### Data Model Changes

```sql
-- Sessions table
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  root_directory TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  base_branch TEXT DEFAULT 'main',
  git_status TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_message_at INTEGER,
  metadata TEXT,
  is_active INTEGER DEFAULT 0
);

-- Messages table
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls TEXT,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Git state table
CREATE TABLE session_git_state (
  session_id TEXT PRIMARY KEY,
  current_commit TEXT,
  uncommitted_files TEXT,
  stash_ref TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Settings table
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  scope TEXT,
  updated_at INTEGER NOT NULL
);

-- Indexes
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);
CREATE INDEX idx_sessions_updated_at ON sessions(updated_at);
```

### API Design

```typescript
interface DatabaseClient {
  // Session operations
  insertSession(session: InsertSession): Session;
  getSession(id: string): Session | null;
  getSessions(): Session[];
  updateSession(id: string, updates: Partial<Session>): Session;
  deleteSession(id: string): void;

  // Message operations
  insertMessage(message: InsertMessage): Message;
  getMessages(sessionId: string, limit?: number): Message[];
  deleteMessages(sessionId: string): void;

  // Settings operations
  getSetting(key: string): Setting | null;
  setSetting(key: string, value: any, scope?: string): Setting;
  deleteSetting(key: string): void;

  // Utility
  close(): void;
}
```

## UI/UX Considerations

N/A - This is a backend feature with no UI

## Non-Functional Requirements

### Performance
- Database initialization: < 100ms
- Insert operations: < 10ms
- Query operations: < 5ms (indexed)

### Security
- SQL injection prevented by prepared statements
- File permissions set correctly (600)

### Reliability
- WAL mode for crash recovery
- Foreign key constraints enforced
- Transactions for consistency

## Open Questions

- [x] **Q1**: Should we support database migrations?
  - **Answer**: Yes, simple version-based migrations

- [x] **Q2**: Should we store JSON as TEXT or in separate columns?
  - **Answer**: TEXT (JSON strings) for flexibility

- [x] **Q3**: Should we use INTEGER or TEXT for timestamps?
  - **Answer**: INTEGER (Unix milliseconds) for efficiency

## Related Features

- [Feature 003]: Session Manager - Will use this database client
- [Feature 004]: Claude Agent - Will store messages here
- [Feature 005]: REST API - Will query data through this layer

## References

- [better-sqlite3 Documentation](https://github.com/WiseLibs/better-sqlite3)
- [SQLite WAL Mode](https://www.sqlite.org/wal.html)
- [SQLite Data Types](https://www.sqlite.org/datatype3.html)

---

**Document History**:
- 2025-10-23: Initial draft
