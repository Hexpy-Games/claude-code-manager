/**
 * E2E Tests - Keyboard Shortcuts (Feature 011)
 *
 * Tests all global keyboard shortcuts:
 * - Cmd/Ctrl+N: New session
 * - Cmd/Ctrl+W: Close active session
 * - Cmd/Ctrl+1-9: Switch to session by number
 * - Cmd/Ctrl+,: Open settings
 * - Cmd/Ctrl+Enter: Send message (tested in chat tests)
 */

import { expect, test } from '@playwright/test';
import path from 'node:path';

// Helper to get modifier key based on platform
function getModifierKey() {
  return process.platform === 'darwin' ? 'Meta' : 'Control';
}

// Helper function to delete a session
async function deleteSessionByTitle(page: any, title: string) {
  try {
    const sessionTitle = page.getByText(title, { exact: true }).first();
    if (!(await sessionTitle.isVisible())) {
      return;
    }

    const menuTrigger = page.getByRole('button', { name: 'Delete session' }).first();
    await menuTrigger.click();
    await page.getByRole('menuitem', { name: /delete session/i }).click();
    await page.waitForSelector('text=Are you sure you want to delete this session?');
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
    await page.waitForTimeout(500);
  } catch (error) {
    console.log(`Could not delete session "${title}": ${error}`);
  }
}

test.describe('Keyboard Shortcuts', () => {
  const testSessionNames: string[] = [];
  const modifierKey = getModifierKey();

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=Claude Code Manager');
  });

  test.afterEach(async ({ page }) => {
    for (const sessionName of testSessionNames) {
      await deleteSessionByTitle(page, sessionName);
    }
    testSessionNames.length = 0;
  });

  test('should open new session dialog with Cmd/Ctrl+N', async ({ page }) => {
    // Press Cmd/Ctrl+N
    await page.keyboard.press(`${modifierKey}+N`);

    // New session dialog should open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New Session' })).toBeVisible();

    // Close dialog with Escape
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('should open settings with Cmd/Ctrl+,', async ({ page }) => {
    // Press Cmd/Ctrl+,
    await page.keyboard.press(`${modifierKey}+Comma`);

    // Settings dialog should open
    await expect(page.getByText(/configure your application/i)).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(page.getByText(/configure your application/i)).not.toBeVisible();
  });

  test('should deselect active session with Cmd/Ctrl+W', async ({ page }) => {
    const sessionName = `Keyboard Test Session ${Date.now()}`;
    testSessionNames.push(sessionName);

    // Create and activate a session first
    await page.getByRole('button', { name: /new session/i }).click();
    await page.getByLabel(/title/i).fill(sessionName);
    const rootDir = path.resolve(process.cwd(), '../..');
    await page.getByLabel(/root directory/i).fill(rootDir);
    await page.getByRole('button', { name: /^create$/i }).click();

    await expect(page.getByText(sessionName).first()).toBeVisible();
    await page.waitForTimeout(500);

    // Click to activate session
    const switchButton = page.getByRole('button', { name: `Switch to ${sessionName}` }).first();
    await switchButton.click();
    await page.waitForTimeout(1000);

    // Verify session is active (chat interface should be visible)
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible();

    // Press Cmd/Ctrl+W to deselect
    await page.keyboard.press(`${modifierKey}+W`);
    await page.waitForTimeout(500);

    // Chat input should be hidden, "select a session" message should appear
    await expect(page.getByText(/select a session from the sidebar/i)).toBeVisible();
  });

  test('should switch to session 1 with Cmd/Ctrl+1', async ({ page }) => {
    // Create 2 sessions
    const session1Name = `KBD Session 1 ${Date.now()}`;
    const session2Name = `KBD Session 2 ${Date.now() + 1}`;
    testSessionNames.push(session1Name, session2Name);

    const rootDir = path.resolve(process.cwd(), '../..');

    // Create session 1
    await page.getByRole('button', { name: /new session/i }).click();
    await page.getByLabel(/title/i).fill(session1Name);
    await page.getByLabel(/root directory/i).fill(rootDir);
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText(session1Name).first()).toBeVisible();
    await page.waitForTimeout(500);

    // Create session 2
    await page.getByRole('button', { name: /new session/i }).click();
    await page.getByLabel(/title/i).fill(session2Name);
    await page.getByLabel(/root directory/i).fill(rootDir);
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText(session2Name).first()).toBeVisible();
    await page.waitForTimeout(500);

    // Session 2 is most recent (at top of list), Session 1 is second
    // Press Cmd/Ctrl+1 to switch to first session in list (Session 2 - most recent)
    await page.keyboard.press(`${modifierKey}+Digit1`);
    await page.waitForTimeout(1000);

    // The first session in the list should now be active
    // Verify Active badge is shown
    await expect(page.getByText('Active')).toBeVisible({ timeout: 5000 });
  });

  test('should switch to session 2 with Cmd/Ctrl+2', async ({ page }) => {
    // Create 2 sessions
    const session1Name = `KBD Session A ${Date.now()}`;
    const session2Name = `KBD Session B ${Date.now() + 1}`;
    testSessionNames.push(session1Name, session2Name);

    const rootDir = path.resolve(process.cwd(), '../..');

    // Create session 1
    await page.getByRole('button', { name: /new session/i }).click();
    await page.getByLabel(/title/i).fill(session1Name);
    await page.getByLabel(/root directory/i).fill(rootDir);
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText(session1Name).first()).toBeVisible();
    await page.waitForTimeout(500);

    // Create session 2
    await page.getByRole('button', { name: /new session/i }).click();
    await page.getByLabel(/title/i).fill(session2Name);
    await page.getByLabel(/root directory/i).fill(rootDir);
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText(session2Name).first()).toBeVisible();
    await page.waitForTimeout(1000);

    // Press Cmd/Ctrl+2 to switch to second session in list
    await page.keyboard.press(`${modifierKey}+Digit2`);
    await page.waitForTimeout(1000);

    // Second session should now be active
    await expect(page.getByText('Active')).toBeVisible({ timeout: 5000 });
  });

  test('should handle keyboard shortcuts in input fields', async ({ page }) => {
    const sessionName = `KBD Input Test ${Date.now()}`;
    testSessionNames.push(sessionName);

    // Create and activate a session
    await page.getByRole('button', { name: /new session/i }).click();
    await page.getByLabel(/title/i).fill(sessionName);
    const rootDir = path.resolve(process.cwd(), '../..');
    await page.getByLabel(/root directory/i).fill(rootDir);
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText(sessionName).first()).toBeVisible();
    await page.waitForTimeout(500);

    const switchButton = page.getByRole('button', { name: `Switch to ${sessionName}` }).first();
    await switchButton.click();
    await page.waitForTimeout(1000);

    // Focus on the message input
    const messageInput = page.getByPlaceholder('Type a message...');
    await messageInput.focus();

    // Type some text
    await messageInput.fill('Testing keyboard shortcuts');

    // Cmd+N should still work even when input is focused (enableOnFormTags: true)
    await page.keyboard.press(`${modifierKey}+N`);
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');

    // Cmd+, should still work
    await messageInput.focus();
    await page.keyboard.press(`${modifierKey}+Comma`);
    await expect(page.getByText(/configure your application/i)).toBeVisible();
    await page.keyboard.press('Escape');

    // Message input should still have the text
    await expect(messageInput).toHaveValue('Testing keyboard shortcuts');
  });

  test('should not switch sessions when pressing numbers without modifier', async ({ page }) => {
    const sessionName = `KBD No Modifier ${Date.now()}`;
    testSessionNames.push(sessionName);

    // Create a session
    await page.getByRole('button', { name: /new session/i }).click();
    await page.getByLabel(/title/i).fill(sessionName);
    const rootDir = path.resolve(process.cwd(), '../..');
    await page.getByLabel(/root directory/i).fill(rootDir);
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText(sessionName).first()).toBeVisible();
    await page.waitForTimeout(500);

    // Activate session
    const switchButton = page.getByRole('button', { name: `Switch to ${sessionName}` }).first();
    await switchButton.click();
    await page.waitForTimeout(1000);

    const messageInput = page.getByPlaceholder('Type a message...');
    await messageInput.focus();

    // Press "1" without modifier (should just type in the input)
    await page.keyboard.press('Digit1');

    // Should have typed "1" in the input, not switched sessions
    await expect(messageInput).toHaveValue('1');
  });

  test('should handle Cmd/Ctrl+W when no session is active', async ({ page }) => {
    // Make sure no session is selected
    await expect(page.getByText(/select a session from the sidebar/i)).toBeVisible();

    // Press Cmd/Ctrl+W (should do nothing, not crash)
    await page.keyboard.press(`${modifierKey}+W`);

    // Should still show "select a session" message
    await expect(page.getByText(/select a session from the sidebar/i)).toBeVisible();
  });

  test('should handle keyboard shortcuts 1-9 with no sessions', async ({ page }) => {
    // Delete all sessions first or ensure we're on a clean state
    await expect(page.getByText(/sessions/i)).toBeVisible();

    // Press Cmd/Ctrl+1 when there are no sessions (or fewer than 1)
    await page.keyboard.press(`${modifierKey}+Digit1`);

    // Should not crash, app should still be responsive
    await expect(page.getByText('Claude Code Manager')).toBeVisible();
  });

  test('should handle keyboard shortcuts 1-9 beyond available sessions', async ({ page }) => {
    const sessionName = `KBD Only One ${Date.now()}`;
    testSessionNames.push(sessionName);

    // Create only 1 session
    await page.getByRole('button', { name: /new session/i }).click();
    await page.getByLabel(/title/i).fill(sessionName);
    const rootDir = path.resolve(process.cwd(), '../..');
    await page.getByLabel(/root directory/i).fill(rootDir);
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText(sessionName).first()).toBeVisible();
    await page.waitForTimeout(500);

    // Try to switch to session #9 (doesn't exist)
    await page.keyboard.press(`${modifierKey}+Digit9`);

    // Should not crash or change anything
    await expect(page.getByText('Claude Code Manager')).toBeVisible();
  });
});
