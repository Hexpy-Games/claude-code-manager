/**
 * Git Service
 *
 * Provides Git operations for managing repositories and branches.
 * Wraps simple-git library with error handling and type safety.
 */

import simpleGit, { type SimpleGit, type StatusResult } from 'simple-git';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Custom error classes for Git operations
 */
export class GitNotInstalledError extends Error {
  name = 'GitNotInstalledError';

  constructor(message = 'Git is not installed or not found in PATH') {
    super(message);
  }
}

export class NotGitRepoError extends Error {
  name = 'NotGitRepoError';

  constructor(directory: string) {
    super(`Directory is not a Git repository: ${directory}`);
  }
}

export class BranchExistsError extends Error {
  name = 'BranchExistsError';

  constructor(branchName: string) {
    super(`Branch already exists: ${branchName}`);
  }
}

export class GitOperationError extends Error {
  name = 'GitOperationError';

  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
  }
}

/**
 * Git status interface
 */
export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  created: string[];
  deleted: string[];
  renamed: string[];
  isClean: boolean;
}

/**
 * Git Service
 *
 * Provides operations for checking Git installation, validating repositories,
 * creating branches, and managing session branches.
 */
export class GitService {
  /**
   * Check if Git is installed on the system
   */
  async checkGitInstalled(): Promise<boolean> {
    try {
      const git = simpleGit();
      await git.version();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if a directory is a Git repository
   */
  async isGitRepo(directory: string): Promise<boolean> {
    try {
      // Check if directory exists
      if (!fs.existsSync(directory)) {
        return false;
      }

      const git = simpleGit(directory);
      const isRepo = await git.checkIsRepo();
      return isRepo;
    } catch (error) {
      return false;
    }
  }

  /**
   * Initialize a new Git repository
   */
  async initRepo(directory: string): Promise<void> {
    try {
      // Check if directory exists
      if (!fs.existsSync(directory)) {
        throw new GitOperationError(`Directory does not exist: ${directory}`);
      }

      const git = simpleGit(directory);
      await git.init();
    } catch (error) {
      if (error instanceof GitOperationError) {
        throw error;
      }
      throw new GitOperationError(
        `Failed to initialize Git repository: ${(error as Error).message}`,
        error,
      );
    }
  }

  /**
   * Create a new branch from a base branch
   */
  async createBranch(
    branchName: string,
    baseBranch: string,
    directory: string,
  ): Promise<void> {
    try {
      // Verify it's a Git repository
      const isRepo = await this.isGitRepo(directory);
      if (!isRepo) {
        throw new NotGitRepoError(directory);
      }

      // Check if branch already exists
      const exists = await this.branchExists(branchName, directory);
      if (exists) {
        throw new BranchExistsError(branchName);
      }

      const git = simpleGit(directory);

      // Create branch from base branch
      await git.checkoutBranch(branchName, baseBranch);
    } catch (error) {
      if (
        error instanceof NotGitRepoError ||
        error instanceof BranchExistsError
      ) {
        throw error;
      }

      // Check for empty repository error
      const errorMessage = (error as Error).message;
      if (
        errorMessage.includes('does not have any commits yet') ||
        errorMessage.includes('not a valid object name')
      ) {
        throw new GitOperationError(
          'Cannot create branch: repository has no commits yet',
          error,
        );
      }

      throw new GitOperationError(
        `Failed to create branch: ${errorMessage}`,
        error,
      );
    }
  }

  /**
   * Checkout an existing branch
   */
  async checkoutBranch(branchName: string, directory: string): Promise<void> {
    try {
      // Verify it's a Git repository
      const isRepo = await this.isGitRepo(directory);
      if (!isRepo) {
        throw new NotGitRepoError(directory);
      }

      const git = simpleGit(directory);
      await git.checkout(branchName);
    } catch (error) {
      if (error instanceof NotGitRepoError) {
        throw error;
      }

      throw new GitOperationError(
        `Failed to checkout branch: ${(error as Error).message}`,
        error,
      );
    }
  }

  /**
   * Get the current branch name
   */
  async getCurrentBranch(directory: string): Promise<string> {
    try {
      // Verify it's a Git repository
      const isRepo = await this.isGitRepo(directory);
      if (!isRepo) {
        throw new NotGitRepoError(directory);
      }

      const git = simpleGit(directory);
      const branchSummary = await git.branch();
      return branchSummary.current;
    } catch (error) {
      if (error instanceof NotGitRepoError) {
        throw error;
      }

      throw new GitOperationError(
        `Failed to get current branch: ${(error as Error).message}`,
        error,
      );
    }
  }

  /**
   * Get all branches in the repository
   */
  async getBranches(directory: string): Promise<string[]> {
    try {
      // Verify it's a Git repository
      const isRepo = await this.isGitRepo(directory);
      if (!isRepo) {
        throw new NotGitRepoError(directory);
      }

      const git = simpleGit(directory);
      const branchSummary = await git.branch();

      // Return all branch names
      return branchSummary.all;
    } catch (error) {
      if (error instanceof NotGitRepoError) {
        throw error;
      }

      // Handle empty repository (no commits yet)
      const errorMessage = (error as Error).message;
      if (
        errorMessage.includes('does not have any commits yet') ||
        errorMessage.includes('bad revision')
      ) {
        return [];
      }

      throw new GitOperationError(
        `Failed to get branches: ${errorMessage}`,
        error,
      );
    }
  }

  /**
   * Check if a branch exists
   */
  async branchExists(branchName: string, directory: string): Promise<boolean> {
    try {
      const branches = await this.getBranches(directory);
      return branches.includes(branchName);
    } catch (error) {
      // If we can't get branches (e.g., empty repo), branch doesn't exist
      return false;
    }
  }

  /**
   * Get repository status
   */
  async getStatus(directory: string): Promise<GitStatus> {
    try {
      // Verify it's a Git repository
      const isRepo = await this.isGitRepo(directory);
      if (!isRepo) {
        throw new NotGitRepoError(directory);
      }

      const git = simpleGit(directory);
      const status: StatusResult = await git.status();

      return {
        branch: status.current || 'HEAD',
        ahead: status.ahead,
        behind: status.behind,
        modified: status.modified,
        created: [...status.not_added, ...status.created],
        deleted: status.deleted,
        renamed: status.renamed.map((r) => `${r.from} -> ${r.to}`),
        isClean: status.isClean(),
      };
    } catch (error) {
      if (error instanceof NotGitRepoError) {
        throw error;
      }

      throw new GitOperationError(
        `Failed to get repository status: ${(error as Error).message}`,
        error,
      );
    }
  }
}

// Export singleton instance
export const gitService = new GitService();
