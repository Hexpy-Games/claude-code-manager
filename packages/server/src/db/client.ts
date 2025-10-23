import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import type {
  Session,
  InsertSession,
  UpdateSession,
  Message,
  InsertMessage,
  Setting,
} from './types.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export class DatabaseClient {
  public readonly raw: Database.Database;
  private readonly dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;

    // Create parent directories if needed
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    // Open database
    this.raw = new Database(dbPath);

    // Enable WAL mode for better concurrency
    this.raw.pragma('journal_mode = WAL');

    // Enable foreign keys
    this.raw.pragma('foreign_keys = ON');

    // Initialize schema
    this.initializeSchema();
  }

  private initializeSchema(): void {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Execute schema (multiple statements)
    this.raw.exec(schema);
  }

  // ============================================================================
  // Session Operations
  // ============================================================================

  insertSession(session: InsertSession): Session {
    const now = Date.now();
    const stmt = this.raw.prepare(`
      INSERT INTO sessions (
        id, title, root_directory, branch_name, base_branch,
        git_status, created_at, updated_at, metadata, is_active
      ) VALUES (
        @id, @title, @rootDirectory, @branchName, @baseBranch,
        @gitStatus, @createdAt, @updatedAt, @metadata, 0
      )
    `);

    stmt.run({
      id: session.id,
      title: session.title,
      rootDirectory: session.rootDirectory,
      branchName: session.branchName,
      baseBranch: session.baseBranch ?? 'main',
      gitStatus: session.gitStatus ?? null,
      createdAt: now,
      updatedAt: now,
      metadata: session.metadata ? JSON.stringify(session.metadata) : null,
    });

    return this.getSession(session.id)!;
  }

  getSession(id: string): Session | null {
    const stmt = this.raw.prepare(`
      SELECT
        id, title, root_directory as rootDirectory, branch_name as branchName,
        base_branch as baseBranch, git_status as gitStatus,
        created_at as createdAt, updated_at as updatedAt,
        last_message_at as lastMessageAt, metadata, is_active as isActive
      FROM sessions
      WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return {
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      isActive: Boolean(row.isActive),
    };
  }

  getSessions(): Session[] {
    const stmt = this.raw.prepare(`
      SELECT
        id, title, root_directory as rootDirectory, branch_name as branchName,
        base_branch as baseBranch, git_status as gitStatus,
        created_at as createdAt, updated_at as updatedAt,
        last_message_at as lastMessageAt, metadata, is_active as isActive
      FROM sessions
      ORDER BY updated_at DESC
    `);

    const rows = stmt.all() as any[];
    return rows.map((row) => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      isActive: Boolean(row.isActive),
    }));
  }

  updateSession(id: string, updates: UpdateSession): Session {
    const session = this.getSession(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }

    const now = Date.now();
    const fields: string[] = ['updated_at = @updatedAt'];
    const params: Record<string, any> = { id, updatedAt: now };

    if (updates.title !== undefined) {
      fields.push('title = @title');
      params.title = updates.title;
    }

    if (updates.gitStatus !== undefined) {
      fields.push('git_status = @gitStatus');
      params.gitStatus = updates.gitStatus;
    }

    if (updates.lastMessageAt !== undefined) {
      fields.push('last_message_at = @lastMessageAt');
      params.lastMessageAt = updates.lastMessageAt;
    }

    if (updates.metadata !== undefined) {
      fields.push('metadata = @metadata');
      params.metadata = updates.metadata ? JSON.stringify(updates.metadata) : null;
    }

    if (updates.isActive !== undefined) {
      fields.push('is_active = @isActive');
      params.isActive = updates.isActive ? 1 : 0;
    }

    const stmt = this.raw.prepare(`
      UPDATE sessions
      SET ${fields.join(', ')}
      WHERE id = @id
    `);

    stmt.run(params);

    return this.getSession(id)!;
  }

  deleteSession(id: string): void {
    const stmt = this.raw.prepare('DELETE FROM sessions WHERE id = ?');
    stmt.run(id);
  }

  // ============================================================================
  // Message Operations
  // ============================================================================

  insertMessage(message: InsertMessage): Message {
    const now = Date.now();
    const stmt = this.raw.prepare(`
      INSERT INTO messages (id, session_id, role, content, tool_calls, timestamp)
      VALUES (@id, @sessionId, @role, @content, @toolCalls, @timestamp)
    `);

    stmt.run({
      id: message.id,
      sessionId: message.sessionId,
      role: message.role,
      content: message.content,
      toolCalls: message.toolCalls ? JSON.stringify(message.toolCalls) : null,
      timestamp: now,
    });

    // Update session's last_message_at
    this.raw
      .prepare('UPDATE sessions SET last_message_at = ? WHERE id = ?')
      .run(now, message.sessionId);

    return this.getMessage(message.id)!;
  }

  getMessage(id: string): Message | null {
    const stmt = this.raw.prepare(`
      SELECT
        id, session_id as sessionId, role, content, tool_calls as toolCalls, timestamp
      FROM messages
      WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return {
      ...row,
      toolCalls: row.toolCalls ? JSON.parse(row.toolCalls) : null,
    };
  }

  getMessages(sessionId: string, limit?: number): Message[] {
    const sql = `
      SELECT
        id, session_id as sessionId, role, content, tool_calls as toolCalls, timestamp
      FROM messages
      WHERE session_id = ?
      ORDER BY timestamp ASC
      ${limit ? 'LIMIT ?' : ''}
    `;

    const stmt = this.raw.prepare(sql);
    const rows = limit ? (stmt.all(sessionId, limit) as any[]) : (stmt.all(sessionId) as any[]);

    return rows.map((row) => ({
      ...row,
      toolCalls: row.toolCalls ? JSON.parse(row.toolCalls) : null,
    }));
  }

  deleteMessages(sessionId: string): void {
    const stmt = this.raw.prepare('DELETE FROM messages WHERE session_id = ?');
    stmt.run(sessionId);
  }

  // ============================================================================
  // Settings Operations
  // ============================================================================

  getSetting(key: string, scope?: string): Setting | null {
    const actualScope = scope ?? '';
    const stmt = this.raw.prepare(
      'SELECT key, value, scope, updated_at as updatedAt FROM settings WHERE key = ? AND scope = ?'
    );
    const row = stmt.get(key, actualScope) as any;

    if (!row) return null;

    return {
      ...row,
      scope: row.scope === '' ? null : row.scope,
      value: JSON.parse(row.value),
    };
  }

  setSetting(key: string, value: any, scope?: string): Setting {
    const now = Date.now();
    const actualScope = scope ?? '';
    const stmt = this.raw.prepare(`
      INSERT INTO settings (key, value, scope, updated_at)
      VALUES (@key, @value, @scope, @updatedAt)
      ON CONFLICT(key, scope) DO UPDATE SET
        value = @value,
        updated_at = @updatedAt
    `);

    stmt.run({
      key,
      value: JSON.stringify(value),
      scope: actualScope,
      updatedAt: now,
    });

    return this.getSetting(key, scope)!;
  }

  deleteSetting(key: string): void {
    const stmt = this.raw.prepare('DELETE FROM settings WHERE key = ?');
    stmt.run(key);
  }

  // ============================================================================
  // Utility
  // ============================================================================

  close(): void {
    this.raw.close();
  }
}
