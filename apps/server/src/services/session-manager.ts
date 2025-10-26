/**
 * Session Manager Service
 *
 * Orchestrates session lifecycle management by coordinating between
 * DatabaseClient and GitService. This is the core business logic layer.
 */

import { nanoid } from 'nanoid';
import { DatabaseClient } from '../db/client.js';
import type { Session, UpdateSession } from '../db/types.js';
import {
  GitService,
  NotGitRepoError,
  BranchExistsError,
  GitOperationError,
} from './git-service.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Custom error classes for SessionManager
 */
export class SessionNotFoundError extends Error {
  name = 'SessionNotFoundError';

  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`);
  }
}

export class SessionAlreadyExistsError extends Error {
  name = 'SessionAlreadyExistsError';

  constructor(sessionId: string) {
    super(`Session already exists: ${sessionId}`);
  }
}

export class InvalidSessionDataError extends Error {
  name = 'InvalidSessionDataError';

  constructor(message: string) {
    super(message);
  }
}

/**
 * Options for creating a new session
 */
export interface CreateSessionOptions {
  title: string;
  rootDirectory: string;
  baseBranch?: string;
  metadata?: Record<string, any>;
}

/**
 * Options for deleting a session
 */
export interface DeleteSessionOptions {
  deleteGitBranch?: boolean;
}

/**
 * Session Manager
 *
 * Coordinates database and Git operations for session management.
 * Handles creating, retrieving, updating, deleting, and switching sessions.
 */
export class SessionManager {
  private readonly db: DatabaseClient;
  private readonly git: GitService;
  private readonly maxRetries = 3;

  constructor(db: DatabaseClient, git: GitService) {
    this.db = db;
    this.git = git;
  }

  /**
   * Create a new session
   *
   * Creates a session by:
   * 1. Creating a branch in the original repository
   * 2. Cloning the repository to an isolated workspace
   * 3. Checking out the session branch in the workspace
   *
   * @param options - Session creation options
   * @returns Created session
   * @throws {InvalidSessionDataError} If validation fails
   * @throws {NotGitRepoError} If directory is not a Git repository
   * @throws {GitOperationError} If Git operations fail
   */
  async createSession(options: CreateSessionOptions): Promise<Session> {
    // Validate input
    this.validateCreateOptions(options);

    // Validate directory exists and is a Git repository
    await this.validateDirectory(options.rootDirectory);

    // Generate unique session ID and branch name
    let sessionId!: string;
    let branchName!: string;
    let workspacePath!: string;
    let attempts = 0;

    // Retry loop in case of branch name collision
    while (attempts < this.maxRetries) {
      sessionId = this.generateSessionId();
      branchName = this.getBranchName(sessionId);
      workspacePath = this.getWorkspacePath(sessionId, options.rootDirectory);

      try {
        // Create Git branch in original repository
        const baseBranch = options.baseBranch ?? 'main';
        await this.git.createBranch(branchName, baseBranch, options.rootDirectory);

        // Clone repository to workspace
        await this.git.cloneRepository(options.rootDirectory, workspacePath, branchName);

        // Branch and workspace created successfully, break out of retry loop
        break;
      } catch (error) {
        if (error instanceof BranchExistsError) {
          // Branch name collision, retry with new ID
          attempts++;
          if (attempts >= this.maxRetries) {
            throw new GitOperationError(
              `Failed to create unique branch after ${this.maxRetries} attempts`,
              error,
            );
          }
          continue;
        }

        // Other Git errors, don't retry
        throw error;
      }
    }

    // Store session in database
    try {
      const session = this.db.insertSession({
        id: sessionId,
        title: options.title,
        rootDirectory: options.rootDirectory,
        workspacePath: workspacePath,
        branchName: branchName,
        baseBranch: options.baseBranch ?? 'main',
        metadata: options.metadata,
      });

      return session;
    } catch (error) {
      // Database insert failed after Git branch and workspace created
      // Clean up workspace and log orphaned branch
      try {
        if (fs.existsSync(workspacePath)) {
          fs.rmSync(workspacePath, { recursive: true, force: true });
        }
      } catch {
        // Ignore cleanup errors
      }

      console.error(
        `Warning: Git branch "${branchName}" and workspace created but database insert failed. Branch may be orphaned.`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get a session by ID
   *
   * @param id - Session ID
   * @returns Session or null if not found
   */
  async getSession(id: string): Promise<Session | null> {
    if (!id) {
      throw new InvalidSessionDataError('Session ID is required');
    }

    return this.db.getSession(id);
  }

  /**
   * List all sessions
   *
   * @returns Array of sessions, sorted by created_at ASC (creation order)
   */
  async listSessions(): Promise<Session[]> {
    return this.db.getSessions();
  }

  /**
   * Get the currently active session
   *
   * @returns Active session or null if none active
   */
  async getActiveSession(): Promise<Session | null> {
    const sessions = this.db.getSessions();
    const activeSessions = sessions.filter((s) => s.isActive);

    if (activeSessions.length === 0) {
      return null;
    }

    if (activeSessions.length > 1) {
      console.warn(
        `Data integrity warning: Multiple active sessions found (${activeSessions.length}). Returning first.`,
      );
    }

    return activeSessions[0];
  }

  /**
   * Update a session
   *
   * @param id - Session ID
   * @param updates - Fields to update
   * @returns Updated session
   * @throws {SessionNotFoundError} If session doesn't exist
   */
  async updateSession(id: string, updates: UpdateSession): Promise<Session> {
    // Check if session exists
    const existing = this.db.getSession(id);
    if (!existing) {
      throw new SessionNotFoundError(id);
    }

    return this.db.updateSession(id, updates);
  }

  /**
   * Delete a session
   *
   * Deletes the session and cleans up its workspace directory.
   * Optionally deletes the Git branch from the original repository.
   *
   * @param id - Session ID
   * @param options - Deletion options
   * @throws {SessionNotFoundError} If session doesn't exist
   */
  async deleteSession(id: string, options?: DeleteSessionOptions): Promise<void> {
    // Check if session exists
    const session = this.db.getSession(id);
    if (!session) {
      throw new SessionNotFoundError(id);
    }

    // If session is active, deactivate it first
    if (session.isActive) {
      this.db.updateSession(id, { isActive: false });
    }

    // Clean up workspace directory
    try {
      if (fs.existsSync(session.workspacePath)) {
        fs.rmSync(session.workspacePath, { recursive: true, force: true });
        console.log(`Cleaned up workspace: ${session.workspacePath}`);
      }
    } catch (error) {
      // Log error but continue with deletion
      console.error(`Failed to delete workspace: ${session.workspacePath}`, error);
    }

    // Delete Git branch if requested
    if (options?.deleteGitBranch) {
      try {
        await this.git.deleteBranch(session.branchName, session.rootDirectory);
        console.log(`Deleted Git branch: ${session.branchName}`);
      } catch (error) {
        // Log error but continue with database deletion
        console.error(`Failed to delete Git branch: ${session.branchName}`, error);
      }
    }

    // Delete from database (cascades to messages)
    this.db.deleteSession(id);
  }

  /**
   * Switch to a different session
   *
   * Makes the target session active. The workspace path is already cloned
   * and ready to use. Claude Code CLI should use the workspace path when
   * this session is active.
   *
   * @param id - Target session ID
   * @returns Activated session with workspacePath
   * @throws {SessionNotFoundError} If session doesn't exist
   */
  async switchSession(id: string): Promise<Session> {
    // Get target session
    const targetSession = this.db.getSession(id);
    if (!targetSession) {
      throw new SessionNotFoundError(id);
    }

    // If already active, return immediately (idempotent)
    if (targetSession.isActive) {
      return targetSession;
    }

    // Verify workspace exists
    if (!fs.existsSync(targetSession.workspacePath)) {
      throw new GitOperationError(
        `Workspace does not exist: ${targetSession.workspacePath}. Session may be corrupted.`
      );
    }

    // Get current active session
    const currentActive = await this.getActiveSession();

    // Update database state
    if (currentActive) {
      this.db.updateSession(currentActive.id, { isActive: false });
    }

    const updatedSession = this.db.updateSession(id, { isActive: true });
    return updatedSession;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Validate create session options
   */
  private validateCreateOptions(options: CreateSessionOptions): void {
    if (!options.title || options.title.trim() === '') {
      throw new InvalidSessionDataError('Session title is required');
    }

    if (!options.rootDirectory || options.rootDirectory.trim() === '') {
      throw new InvalidSessionDataError('Root directory is required');
    }
  }

  /**
   * Validate directory exists and is a Git repository
   */
  private async validateDirectory(directory: string): Promise<void> {
    // Check if directory exists
    if (!fs.existsSync(directory)) {
      throw new InvalidSessionDataError(`Directory does not exist: ${directory}`);
    }

    // Check if it's a directory
    const stats = fs.statSync(directory);
    if (!stats.isDirectory()) {
      throw new InvalidSessionDataError(`Path is not a directory: ${directory}`);
    }

    // Check if it's a Git repository
    const isRepo = await this.git.isGitRepo(directory);
    if (!isRepo) {
      throw new NotGitRepoError(directory);
    }
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `sess_${nanoid(12)}`;
  }

  /**
   * Get branch name for a session ID
   */
  private getBranchName(sessionId: string): string {
    return `session/${sessionId}`;
  }

  /**
   * Get workspace path for a session
   */
  private getWorkspacePath(sessionId: string, rootDirectory: string): string {
    // Use tmp directory for workspaces
    const tmpDir = os.tmpdir();
    const workspacesDir = path.join(tmpDir, 'claude-sessions');

    // Get repository name from root directory
    const repoName = path.basename(rootDirectory);

    // Create workspace path: /tmp/claude-sessions/sess_abc123/repo-name
    return path.join(workspacesDir, sessionId, repoName);
  }
}

// Export singleton instance (requires initialization with dependencies)
let sessionManagerInstance: SessionManager | null = null;

export function initializeSessionManager(db: DatabaseClient, git: GitService): SessionManager {
  sessionManagerInstance = new SessionManager(db, git);
  return sessionManagerInstance;
}

export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    throw new Error('SessionManager not initialized. Call initializeSessionManager() first.');
  }
  return sessionManagerInstance;
}
