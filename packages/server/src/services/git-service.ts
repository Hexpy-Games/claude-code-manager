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

  /**
   * Merge a source branch into a target branch
   *
   * @param sourceBranch - Branch to merge from
   * @param targetBranch - Branch to merge into
   * @param directory - Repository directory
   */
  async mergeBranch(sourceBranch: string, targetBranch: string, directory: string): Promise<void> {
    try {
      // Verify it's a Git repository
      const isRepo = await this.isGitRepo(directory);
      if (!isRepo) {
        throw new NotGitRepoError(directory);
      }

      const git = simpleGit(directory);

      // Verify both branches exist
      const sourceExists = await this.branchExists(sourceBranch, directory);
      if (!sourceExists) {
        throw new GitOperationError(`Source branch does not exist: ${sourceBranch}`);
      }

      const targetExists = await this.branchExists(targetBranch, directory);
      if (!targetExists) {
        throw new GitOperationError(`Target branch does not exist: ${targetBranch}`);
      }

      // Checkout target branch
      await git.checkout(targetBranch);

      // Merge source branch into target
      await git.merge([sourceBranch]);
    } catch (error) {
      if (error instanceof NotGitRepoError || error instanceof GitOperationError) {
        throw error;
      }

      throw new GitOperationError(
        `Failed to merge ${sourceBranch} into ${targetBranch}: ${(error as Error).message}`,
        error,
      );
    }
  }

  /**
   * Detect if merging would cause conflicts
   *
   * @param sourceBranch - Branch to merge from
   * @param targetBranch - Branch to merge into
   * @param directory - Repository directory
   * @returns True if conflicts would occur, false otherwise
   */
  async detectMergeConflicts(sourceBranch: string, targetBranch: string, directory: string): Promise<boolean> {
    try {
      // Verify it's a Git repository
      const isRepo = await this.isGitRepo(directory);
      if (!isRepo) {
        throw new NotGitRepoError(directory);
      }

      const git = simpleGit(directory);

      // Verify both branches exist
      const sourceExists = await this.branchExists(sourceBranch, directory);
      if (!sourceExists) {
        throw new GitOperationError(`Source branch does not exist: ${sourceBranch}`);
      }

      const targetExists = await this.branchExists(targetBranch, directory);
      if (!targetExists) {
        throw new GitOperationError(`Target branch does not exist: ${targetBranch}`);
      }

      // Save current branch to restore later
      const currentBranch = await this.getCurrentBranch(directory);

      try {
        // Checkout target branch
        await git.checkout(targetBranch);

        // Try to merge with --no-commit to detect conflicts without completing the merge
        // Note: --no-commit doesn't error on conflicts; it leaves files in conflicted state
        let mergeError: Error | null = null;
        try {
          await git.raw(['merge', '--no-commit', '--no-ff', sourceBranch]);
        } catch (error) {
          mergeError = error as Error;
        }

        // Check repository status to see if there are conflicts
        const status = await git.status();
        const hasConflicts = status.conflicted.length > 0;

        // Abort/cleanup the merge attempt
        try {
          await git.raw(['merge', '--abort']);
        } catch {
          // If abort fails, try to reset
          try {
            await git.raw(['reset', '--hard', 'HEAD']);
          } catch {
            // Ignore cleanup errors
          }
        }

        // If there are conflicts, return true
        if (hasConflicts) {
          return true;
        }

        // If there was a merge error but no conflicts in status, check error message
        if (mergeError) {
          const errorMessage = mergeError.message;
          const hasConflictIndicator =
            errorMessage.toLowerCase().includes('conflict') ||
            errorMessage.includes('Automatic merge failed') ||
            errorMessage.includes('CONFLICT');

          if (hasConflictIndicator) {
            return true;
          }

          // Other merge errors (not conflicts) - throw
          throw mergeError;
        }

        // No conflicts detected
        return false;
      } finally {
        // Restore original branch
        try {
          await git.checkout(currentBranch);
        } catch {
          // Ignore checkout errors during cleanup
        }
      }
    } catch (error) {
      if (error instanceof NotGitRepoError || error instanceof GitOperationError) {
        throw error;
      }

      throw new GitOperationError(
        `Failed to detect merge conflicts: ${(error as Error).message}`,
        error,
      );
    }
  }

  /**
   * Delete a Git branch
   *
   * @param branchName - Branch name to delete
   * @param directory - Repository directory
   */
  async deleteBranch(branchName: string, directory: string): Promise<void> {
    try {
      // Verify it's a Git repository
      const isRepo = await this.isGitRepo(directory);
      if (!isRepo) {
        throw new NotGitRepoError(directory);
      }

      const git = simpleGit(directory);

      // Verify branch exists
      const exists = await this.branchExists(branchName, directory);
      if (!exists) {
        throw new GitOperationError(`Branch does not exist: ${branchName}`);
      }

      // Verify we're not on the branch we're trying to delete
      const currentBranch = await this.getCurrentBranch(directory);
      if (currentBranch === branchName) {
        throw new GitOperationError(`Cannot delete current branch: ${branchName}`);
      }

      // Delete the branch
      await git.deleteLocalBranch(branchName);
    } catch (error) {
      if (error instanceof NotGitRepoError || error instanceof GitOperationError) {
        throw error;
      }

      throw new GitOperationError(
        `Failed to delete branch ${branchName}: ${(error as Error).message}`,
        error,
      );
    }
  }
}

// Export singleton instance
export const gitService = new GitService();
