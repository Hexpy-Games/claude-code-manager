/**
 * E2E Tests - Settings Workflow
 *
 * Tests the settings panel functionality:
 * - Opening/closing settings
 * - Changing settings
 * - Settings persistence
 */

import { expect, test } from '@playwright/test';

test.describe('Settings Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=Claude Code Manager');
  });

  test('should open and close settings panel', async ({ page }) => {
    // Open settings
    await page.getByRole('button', { name: 'Settings' }).click();

    // Settings dialog should be visible
    await expect(page.getByText(/configure your application/i)).toBeVisible();

    // Close settings dialog by pressing ESC
    await page.keyboard.press('Escape');

    // Settings should be hidden
    await expect(page.getByText(/configure your application/i)).not.toBeVisible();
  });

  test('should change model setting', async ({ page }) => {
    // Open settings
    await page.getByRole('button', { name: 'Settings' }).click();

    // Find and click model dropdown trigger
    await page.locator('button#model').click();

    // Click on Opus option
    await page.getByRole('option', { name: /claude opus/i }).click();

    // Save settings
    await page.getByRole('button', { name: /save/i }).click();

    // Should show success message
    await expect(page.getByText(/settings saved/i)).toBeVisible();
  });

  test('should change theme setting', async ({ page }) => {
    // Open settings
    await page.getByRole('button', { name: 'Settings' }).click();

    // Find and click theme dropdown trigger
    await page.locator('button#theme').click();

    // Click on Dark option
    await page.getByRole('option', { name: /dark/i }).click();

    // Save settings
    await page.getByRole('button', { name: /save/i }).click();

    // Should show success message
    await expect(page.getByText(/settings saved/i)).toBeVisible();
  });

  test('should persist settings after save', async ({ page }) => {
    // Open settings
    await page.getByRole('button', { name: 'Settings' }).click();

    // Wait for settings to load
    await page.waitForTimeout(500);

    // Change model to Haiku
    await page.locator('button#model').click();
    await page.getByRole('option', { name: /haiku/i }).click();

    // Save
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText(/settings saved/i)).toBeVisible();

    // Wait for save to complete and dialog to auto-close
    await page.waitForTimeout(2000);

    // Reopen settings
    await page.getByRole('button', { name: 'Settings' }).click();

    // Wait for settings to load from backend - give extra time for React Query to refetch
    // React Query might be caching old data, and component initializes with 'sonnet' default
    // so we need to wait for the query to complete and update the UI
    await page.waitForTimeout(5000);

    // Model should still be Haiku - check the trigger button text
    await expect(page.locator('button#model')).toContainText(/haiku/i);
  });

  test('should show API key management notice', async ({ page }) => {
    // Open settings
    await page.getByRole('button', { name: 'Settings' }).click();

    // Should show notice about Claude CLI
    await expect(page.getByText(/API key is managed by Claude Code CLI/i)).toBeVisible();
    await expect(page.getByText(/claude configure/i)).toBeVisible();
  });

  test('should not have API key input field', async ({ page }) => {
    // Open settings
    await page.getByRole('button', { name: 'Settings' }).click();

    // Should NOT have an API key input
    const apiKeyInput = page.getByLabel(/api key/i);
    await expect(apiKeyInput).not.toBeVisible();
  });
});
