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
    let attempts = 0;

    // Retry loop in case of branch name collision
    while (attempts < this.maxRetries) {
      sessionId = this.generateSessionId();
      branchName = this.getBranchName(sessionId);

      try {
        // Create Git branch first
        const baseBranch = options.baseBranch ?? 'main';
        await this.git.createBranch(branchName, baseBranch, options.rootDirectory);

        // Branch created successfully, break out of retry loop
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
        branchName: branchName,
        baseBranch: options.baseBranch ?? 'main',
        metadata: options.metadata,
      });

      return session;
    } catch (error) {
      // Database insert failed after Git branch created
      // Log the orphaned branch for manual cleanup
      console.error(
        `Warning: Git branch "${branchName}" created but database insert failed. Branch may be orphaned.`,
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
   * @returns Array of sessions, sorted by updated_at DESC
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

    // Delete Git branch if requested
    if (options?.deleteGitBranch) {
      try {
        // Check if branch exists before trying to delete
        const branchExists = await this.git.branchExists(
          session.branchName,
          session.rootDirectory,
        );

        if (branchExists) {
          // Note: simple-git doesn't have direct branch deletion in the interface
          // We'll need to use raw Git command or extend GitService
          // For now, we'll skip actual branch deletion and just document it
          console.warn(
            `Git branch deletion requested but not yet implemented: ${session.branchName}`,
          );
        }
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
   * Makes the target session active and checks out its Git branch.
   * Deactivates the currently active session if one exists.
   *
   * @param id - Target session ID
   * @returns Activated session
   * @throws {SessionNotFoundError} If session doesn't exist
   * @throws {GitOperationError} If Git checkout fails
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

    // Get current active session
    const currentActive = await this.getActiveSession();

    try {
      // Checkout Git branch
      await this.git.checkoutBranch(targetSession.branchName, targetSession.rootDirectory);

      // Update database state
      if (currentActive) {
        this.db.updateSession(currentActive.id, { isActive: false });
      }

      const updatedSession = this.db.updateSession(id, { isActive: true });
      return updatedSession;
    } catch (error) {
      // Git checkout failed, don't change database state
      if (error instanceof GitOperationError) {
        throw new GitOperationError(
          `Failed to switch to session "${targetSession.title}": ${error.message}`,
          error,
        );
      }
      throw error;
    }
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
