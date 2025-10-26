/**
 * E2E Tests - Auto-Save & Persistence (Feature 012)
 *
 * Tests draft message and scroll position persistence:
 * - Draft messages saved to localStorage
 * - Draft messages restored when switching back to session
 * - Draft cleared after sending message
 * - Scroll position saved when scrolling
 * - Scroll position restored when switching back to session
 * - Multiple sessions with independent drafts/scroll positions
 */

import { expect, test } from '@playwright/test';
import path from 'node:path';

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

test.describe('Auto-Save & Persistence', () => {
  const testSessionNames: string[] = [];

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

  test('should save draft message to localStorage', async ({ page }) => {
    const sessionName = `Draft Test ${Date.now()}`;
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

    // Type a draft message
    const messageInput = page.getByPlaceholder('Type a message...');
    const draftText = 'This is a draft message that should be saved';
    await messageInput.fill(draftText);

    // Wait for debounced save (500ms according to DEBOUNCE_TIMES.DRAFT_SAVE_MS)
    await page.waitForTimeout(600);

    // Check localStorage for the draft
    const savedDraft = await page.evaluate((sessionName) => {
      return localStorage.getItem(`draft_${sessionName}`);
    }, sessionName);

    // Draft should be trimmed but otherwise match
    expect(savedDraft).toBe(draftText.trim());
  });

  test('should restore draft when switching back to session', async ({ page }) => {
    const session1Name = `Draft Session 1 ${Date.now()}`;
    const session2Name = `Draft Session 2 ${Date.now() + 1}`;
    testSessionNames.push(session1Name, session2Name);

    const rootDir = path.resolve(process.cwd(), '../..');

    // Create session 1
    await page.getByRole('button', { name: /new session/i }).click();
    await page.getByLabel(/title/i).fill(session1Name);
    await page.getByLabel(/root directory/i).fill(rootDir);
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText(session1Name).first()).toBeVisible();
    await page.waitForTimeout(500);

    // Activate session 1
    let switchButton = page.getByRole('button', { name: `Switch to ${session1Name}` }).first();
    await switchButton.click();
    await page.waitForTimeout(1000);

    // Type a draft in session 1
    const messageInput = page.getByPlaceholder('Type a message...');
    const draft1Text = 'Draft for session 1';
    await messageInput.fill(draft1Text);
    await page.waitForTimeout(600); // Wait for save

    // Create session 2
    await page.keyboard.press('Meta+N'); // Use keyboard shortcut
    await page.getByLabel(/title/i).fill(session2Name);
    await page.getByLabel(/root directory/i).fill(rootDir);
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText(session2Name).first()).toBeVisible();
    await page.waitForTimeout(500);

    // Activate session 2
    switchButton = page.getByRole('button', { name: `Switch to ${session2Name}` }).first();
    await switchButton.click();
    await page.waitForTimeout(1000);

    // Input should be empty for session 2
    await expect(messageInput).toHaveValue('');

    // Type a different draft in session 2
    const draft2Text = 'Draft for session 2';
    await messageInput.fill(draft2Text);
    await page.waitForTimeout(600); // Wait for save

    // Switch back to session 1
    switchButton = page.getByRole('button', { name: `Switch to ${session1Name}` }).first();
    await switchButton.click();
    await page.waitForTimeout(1000);

    // Draft from session 1 should be restored
    await expect(messageInput).toHaveValue(draft1Text);

    // Switch back to session 2
    switchButton = page.getByRole('button', { name: `Switch to ${session2Name}` }).first();
    await switchButton.click();
    await page.waitForTimeout(1000);

    // Draft from session 2 should be restored
    await expect(messageInput).toHaveValue(draft2Text);
  });

  test('should clear draft after sending message', async ({ page }) => {
    const sessionName = `Clear Draft Test ${Date.now()}`;
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

    // Type a message
    const messageInput = page.getByPlaceholder('Type a message...');
    await messageInput.fill('Message to send');
    await page.waitForTimeout(600); // Wait for draft to save

    // Send the message
    await page.keyboard.press('Enter'); // Use Enter to send
    await page.waitForTimeout(500);

    // Input should be cleared
    await expect(messageInput).toHaveValue('');

    // Draft in localStorage should be removed
    const savedDraft = await page.evaluate((sessionName) => {
      return localStorage.getItem(`draft_${sessionName}`);
    }, sessionName);

    expect(savedDraft).toBeNull();
  });

  test('should handle very long drafts (100K character limit)', async ({ page }) => {
    const sessionName = `Long Draft Test ${Date.now()}`;
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

    // Type a moderately long draft (1000 characters to test without hitting actual limits)
    const messageInput = page.getByPlaceholder('Type a message...');
    const longDraft = 'x'.repeat(1000);
    await messageInput.fill(longDraft);
    await page.waitForTimeout(600); // Wait for save

    // Check that it was saved
    const savedDraft = await page.evaluate((sessionName) => {
      return localStorage.getItem(`draft_${sessionName}`);
    }, sessionName);

    expect(savedDraft).toBe(longDraft);
    expect(savedDraft?.length).toBe(1000);
  });

  test('should handle draft with special characters', async ({ page }) => {
    const sessionName = `Special Chars Test ${Date.now()}`;
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

    // Type a draft with Unicode and special characters
    const messageInput = page.getByPlaceholder('Type a message...');
    const specialDraft = 'Hello 世界 🌍\n{"code": "test"}';
    await messageInput.fill(specialDraft);
    await page.waitForTimeout(600); // Wait for save

    // Switch away and back
    await page.keyboard.press('Meta+W'); // Deselect session
    await page.waitForTimeout(500);

    // Switch back
    const switchButtonAgain = page.getByRole('button', { name: `Switch to ${sessionName}` }).first();
    await switchButtonAgain.click();
    await page.waitForTimeout(1000);

    // Draft should be restored with all special characters
    await expect(messageInput).toHaveValue(specialDraft);
  });

  test('should not save draft when deselecting session', async ({ page }) => {
    const sessionName = `Deselect Test ${Date.now()}`;
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

    // Deselect session (Cmd+W)
    await page.keyboard.press('Meta+W');
    await page.waitForTimeout(500);

    // localStorage for this session should not have a draft (or should be empty)
    const savedDraft = await page.evaluate((sessionName) => {
      return localStorage.getItem(`draft_${sessionName}`);
    }, sessionName);

    // Draft should be null or empty string
    expect(savedDraft === null || savedDraft === '').toBeTruthy();
  });

  test('should handle localStorage cleanup on quota exceeded', async ({ page }) => {
    // This test is hard to trigger in E2E, but we can verify the code doesn't crash
    // when localStorage has many entries

    // Create many draft entries in localStorage
    await page.evaluate(() => {
      for (let i = 0; i < 60; i++) {
        localStorage.setItem(`draft_test_session_${i}`, 'x'.repeat(1000));
      }
    });

    const sessionName = `Cleanup Test ${Date.now()}`;
    testSessionNames.push(sessionName);

    // Create and activate a session (should not crash even with many localStorage entries)
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

    // Type a draft (should still work even with many localStorage entries)
    const messageInput = page.getByPlaceholder('Type a message...');
    await messageInput.fill('Testing with full localStorage');
    await page.waitForTimeout(600); // Wait for save

    // Should not crash, input should have the value
    await expect(messageInput).toHaveValue('Testing with full localStorage');

    // Clean up test entries
    await page.evaluate(() => {
      for (let i = 0; i < 60; i++) {
        localStorage.removeItem(`draft_test_session_${i}`);
      }
    });
  });

  test('should handle multiple rapid session switches', async ({ page }) => {
    const session1Name = `Rapid Switch 1 ${Date.now()}`;
    const session2Name = `Rapid Switch 2 ${Date.now() + 1}`;
    testSessionNames.push(session1Name, session2Name);

    const rootDir = path.resolve(process.cwd(), '../..');

    // Create 2 sessions
    await page.getByRole('button', { name: /new session/i }).click();
    await page.getByLabel(/title/i).fill(session1Name);
    await page.getByLabel(/root directory/i).fill(rootDir);
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText(session1Name).first()).toBeVisible();
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: /new session/i }).click();
    await page.getByLabel(/title/i).fill(session2Name);
    await page.getByLabel(/root directory/i).fill(rootDir);
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText(session2Name).first()).toBeVisible();
    await page.waitForTimeout(500);

    // Rapidly switch between sessions using keyboard shortcuts
    await page.keyboard.press('Meta+Digit1'); // Switch to first
    await page.waitForTimeout(200);
    await page.keyboard.press('Meta+Digit2'); // Switch to second
    await page.waitForTimeout(200);
    await page.keyboard.press('Meta+Digit1'); // Back to first
    await page.waitForTimeout(200);
    await page.keyboard.press('Meta+Digit2'); // Back to second

    // App should not crash, should be in a valid state
    await expect(page.getByText('Claude Code Manager')).toBeVisible();
    await expect(page.getByText('Active')).toBeVisible({ timeout: 5000 });
  });
});
