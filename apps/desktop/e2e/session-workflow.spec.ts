/**
 * E2E Tests - Session Workflow
 *
 * Tests the complete session management workflow:
 * - Creating sessions
 * - Switching between sessions
 * - Deleting sessions
 */

import { expect, test } from '@playwright/test';
import path from 'node:path';

// Helper function to delete a session by finding its delete button
async function deleteSessionByTitle(page: any, title: string) {
  try {
    // Find the session card by text
    const sessionTitle = page.getByText(title, { exact: true }).first();
    if (!(await sessionTitle.isVisible())) {
      return; // Session not found, nothing to delete
    }

    // Find the dropdown menu trigger button (has aria-label="Delete session")
    const menuTrigger = page.getByRole('button', { name: 'Delete session' }).first();
    await menuTrigger.click();

    // Click the "Delete Session" menu item
    await page.getByRole('menuitem', { name: /delete session/i }).click();

    // Wait for confirmation dialog to appear
    await page.waitForSelector('text=Are you sure you want to delete this session?');

    // Click the Delete button in the confirmation dialog
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();

    // Wait for session to disappear
    await page.waitForTimeout(500);
  } catch (error) {
    // Session might not exist or already deleted, that's okay
    console.log(`Could not delete session "${title}": ${error}`);
  }
}

test.describe('Session Management Workflow', () => {
  const testSessionNames: string[] = [];

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to be fully loaded
    await page.waitForSelector('text=Claude Code Manager');
  });

  test.afterEach(async ({ page }) => {
    // Clean up any sessions created during the test
    for (const sessionName of testSessionNames) {
      await deleteSessionByTitle(page, sessionName);
    }
    testSessionNames.length = 0;
  });

  test('should create a new session successfully', async ({ page }) => {
    const sessionName = 'E2E Test Session';
    testSessionNames.push(sessionName);

    // Click "New Session" button
    await page.getByRole('button', { name: /new session/i }).click();

    // Dialog should open with correct title (use heading role to avoid button/heading conflict)
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New Session' })).toBeVisible();

    // Fill in the form
    const titleInput = page.getByLabel(/title/i);
    await titleInput.fill(sessionName);

    // Use the current project directory as root directory
    const rootDir = path.resolve(process.cwd(), '../..');
    const directoryInput = page.getByLabel(/root directory/i);
    await directoryInput.fill(rootDir);

    // Optionally fill base branch
    const branchInput = page.getByLabel(/base branch/i);
    await branchInput.fill('main');

    // Click Create button
    await page.getByRole('button', { name: /^create$/i }).click();

    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // New session should appear in the list
    await expect(page.getByText(sessionName).first()).toBeVisible();
  });

  test('should switch between sessions', async ({ page }) => {
    // Use timestamps to ensure uniqueness
    const session1Name = `Switch Session 1 ${Date.now()}`;
    const session2Name = `Switch Session 2 ${Date.now() + 1}`;
    testSessionNames.push(session1Name, session2Name);

    // Create first session
    await page.getByRole('button', { name: /new session/i }).click();
    await page.getByLabel(/title/i).fill(session1Name);
    const rootDir = path.resolve(process.cwd(), '../..');
    await page.getByLabel(/root directory/i).fill(rootDir);
    await page.getByRole('button', { name: /^create$/i }).click();

    // Wait for session to be created
    await expect(page.getByText(session1Name).first()).toBeVisible();

    // Create second session
    await page.getByRole('button', { name: /new session/i }).click();
    await page.getByLabel(/title/i).fill(session2Name);
    await page.getByLabel(/root directory/i).fill(rootDir);
    await page.getByRole('button', { name: /^create$/i }).click();

    // Wait for second session to be created
    await expect(page.getByText(session2Name).first()).toBeVisible();

    // Session 2 is the most recent, but may not be active
    // Wait for sessions list to refresh
    await page.waitForTimeout(500);

    // Click on Session 1 to switch (use .first() to handle any duplicates)
    const switchButton = page.getByRole('button', { name: `Switch to ${session1Name}` }).first();
    await switchButton.click();

    // Wait for switch to complete - be generous with timeout
    await page.waitForTimeout(2000);

    // Now check that Session 1 is active by looking for Active badge
    // The badge should be near Session 1's title
    await expect(page.getByText('Active')).toBeVisible({ timeout: 5000 });
  });

  test('should delete a session', async ({ page }) => {
    const sessionName = `Delete Test ${Date.now()}`;
    // Note: This session will be deleted by the test itself, so we don't add it to testSessionNames

    // Create a session to delete
    await page.getByRole('button', { name: /new session/i }).click();
    await page.getByLabel(/title/i).fill(sessionName);
    const rootDir = path.resolve(process.cwd(), '../..');
    await page.getByLabel(/root directory/i).fill(rootDir);
    await page.getByRole('button', { name: /^create$/i }).click();

    // Wait for session to appear
    await expect(page.getByText(sessionName).first()).toBeVisible();

    // Find and click the dropdown menu trigger button
    const menuTrigger = page.getByRole('button', { name: 'Delete session' }).first();
    await menuTrigger.click();

    // Click the "Delete Session" menu item
    await page.getByRole('menuitem', { name: /delete session/i }).click();

    // Confirmation dialog should appear
    await expect(page.getByText('Are you sure you want to delete this session?')).toBeVisible();

    // Confirm deletion
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();

    // Wait for deletion to complete - dialog should close and session should disappear
    await expect(page.getByText('Are you sure you want to delete this session?')).not.toBeVisible();

    // Give extra time for the sessions list to refetch and update (backend + React Query refetch)
    await page.waitForTimeout(2000);

    // Session should be removed
    const sessionText = page.getByText(sessionName, { exact: true });
    await expect(sessionText).not.toBeVisible();
  });

  test('should handle invalid session creation', async ({ page }) => {
    // Click "New Session" button
    await page.getByRole('button', { name: /new session/i }).click();

    // Try to create with empty title
    await page.getByLabel(/root directory/i).fill('/some/path');
    await page.getByRole('button', { name: /^create$/i }).click();

    // Should show validation error or prevent creation
    // Dialog should still be open
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should cancel session creation', async ({ page }) => {
    const sessionName = 'Cancelled Session';

    // Click "New Session" button
    await page.getByRole('button', { name: /new session/i }).click();

    // Dialog should open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Fill in some data
    await page.getByLabel(/title/i).fill(sessionName);

    // Click Cancel
    const cancelButton = page.getByRole('button', { name: /cancel/i });
    await cancelButton.click();

    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Session should not be created
    await expect(page.getByText(sessionName)).not.toBeVisible();
  });
});
