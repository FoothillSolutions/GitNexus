import { test, expect } from '@playwright/test';

/**
 * E2E tests for the PR Diff Visualization feature.
 *
 * Tests the backend API directly and the frontend UI through
 * the server connection onboarding flow.
 *
 * Prerequisites:
 * - Backend server running at localhost:4747 with at least one indexed repo
 * - Frontend dev server running at localhost:5178
 */

const BACKEND_URL = 'http://localhost:4747';
const FRONTEND_URL = 'http://localhost:5178';

// ── Backend API Tests ────────────────────────────────────────────────────

test.describe('Backend API: /api/branches', () => {
  test('returns branches and current branch', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/branches`);
    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('branches');
    expect(data).toHaveProperty('tags');
    expect(data).toHaveProperty('currentBranch');
    expect(Array.isArray(data.branches)).toBe(true);
    expect(data.branches.length).toBeGreaterThan(0);
  });
});

test.describe('Backend API: /api/diff', () => {
  test('returns error when base is missing', async ({ request }) => {
    const response = await request.post(`${BACKEND_URL}/api/diff`, {
      data: {},
    });
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('base');
  });

  test('returns structured diff for valid branch comparison', async ({ request }) => {
    // First get branches to find a real one
    const branchRes = await request.get(`${BACKEND_URL}/api/branches`);
    const branchData = await branchRes.json();
    const branch = branchData.branches.find((b: string) => b !== branchData.currentBranch);

    if (!branch) {
      test.skip(true, 'Only one branch available, cannot compare');
      return;
    }

    const response = await request.post(`${BACKEND_URL}/api/diff`, {
      data: { base: branch, head: 'HEAD' },
    });
    expect(response.ok()).toBe(true);

    const data = await response.json();

    // Validate summary structure
    expect(data).toHaveProperty('summary');
    expect(data.summary).toHaveProperty('base');
    expect(data.summary).toHaveProperty('head');
    expect(data.summary).toHaveProperty('changedFiles');
    expect(data.summary).toHaveProperty('additions');
    expect(data.summary).toHaveProperty('deletions');
    expect(data.summary).toHaveProperty('changedSymbolCount');
    expect(data.summary).toHaveProperty('affectedProcessCount');
    expect(data.summary).toHaveProperty('riskLevel');
    expect(['none', 'low', 'medium', 'high', 'critical']).toContain(data.summary.riskLevel);

    // Validate files structure
    expect(data).toHaveProperty('files');
    expect(Array.isArray(data.files)).toBe(true);

    if (data.files.length > 0) {
      const file = data.files[0];
      expect(file).toHaveProperty('filePath');
      expect(file).toHaveProperty('status');
      expect(file).toHaveProperty('hunks');
      expect(file).toHaveProperty('symbols');
      expect(file).toHaveProperty('additions');
      expect(file).toHaveProperty('deletions');
      expect(['added', 'modified', 'deleted', 'renamed']).toContain(file.status);
    }

    // Validate changedSymbols structure
    expect(data).toHaveProperty('changedSymbols');
    expect(Array.isArray(data.changedSymbols)).toBe(true);

    // Validate affectedProcesses structure
    expect(data).toHaveProperty('affectedProcesses');
    expect(Array.isArray(data.affectedProcesses)).toBe(true);
  });

  test('returns empty result for identical refs', async ({ request }) => {
    const response = await request.post(`${BACKEND_URL}/api/diff`, {
      data: { base: 'HEAD', head: 'HEAD' },
    });
    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data.summary.changedFiles).toBe(0);
    expect(data.summary.riskLevel).toBe('none');
    expect(data.files).toHaveLength(0);
  });

  test('diff hunks have valid line numbers', async ({ request }) => {
    const branchRes = await request.get(`${BACKEND_URL}/api/branches`);
    const branchData = await branchRes.json();
    const branch = branchData.branches.find((b: string) => b !== branchData.currentBranch);

    if (!branch) {
      test.skip(true, 'Only one branch available');
      return;
    }

    const response = await request.post(`${BACKEND_URL}/api/diff`, {
      data: { base: branch, head: 'HEAD' },
    });
    const data = await response.json();

    for (const file of data.files.slice(0, 5)) {
      for (const hunk of file.hunks) {
        expect(hunk.oldStart).toBeGreaterThanOrEqual(0);
        expect(hunk.newStart).toBeGreaterThanOrEqual(0);
        expect(hunk.lines.length).toBeGreaterThan(0);
        // Each line should start with +, -, or space
        for (const line of hunk.lines) {
          expect(line[0]).toMatch(/[\+\- ]/);
        }
      }
    }
  });

  test('changed symbols have correct changeScope values', async ({ request }) => {
    const branchRes = await request.get(`${BACKEND_URL}/api/branches`);
    const branchData = await branchRes.json();
    const branch = branchData.branches.find((b: string) => b !== branchData.currentBranch);

    if (!branch) {
      test.skip(true, 'Only one branch available');
      return;
    }

    const response = await request.post(`${BACKEND_URL}/api/diff`, {
      data: { base: branch, head: 'HEAD' },
    });
    const data = await response.json();

    for (const sym of data.changedSymbols) {
      expect(sym).toHaveProperty('id');
      expect(sym).toHaveProperty('name');
      // type may be null for some node kinds (e.g., Section)
      expect(sym).toHaveProperty('filePath');
      expect(sym).toHaveProperty('changeScope');
      expect(['directly_changed', 'in_changed_file']).toContain(sym.changeScope);
    }
  });
});

// ── Frontend UI Tests ────────────────────────────────────────────────────

test.describe.skip('Frontend: Diff UI Components', () => {
  // NOTE: These tests are skipped in CI because the Vite dev server's
  // Cross-Origin-Embedder-Policy: require-corp headers block cross-origin
  // fetch to the backend (localhost:4747). In a real browser, users connect
  // via the onboarding flow which handles this. To run these tests locally,
  // disable COEP headers in vite.config.ts temporarily.
  test.beforeEach(async ({ page }) => {
    // Navigate to the onboarding page
    await page.goto(FRONTEND_URL);
    // Wait for the DropZone to load (shows tabs)
    await expect(page.getByRole('heading', { name: 'Drop your codebase' })).toBeVisible({ timeout: 10_000 });
  });

  test('server connection with diff button flow', async ({ page }) => {
    // Click the "Server" tab to switch to server connection mode
    await page.getByRole('button', { name: 'Server' }).click();

    // Fill in server URL
    const serverInput = page.locator('input[name="server-url-input"]');
    await serverInput.fill(BACKEND_URL);

    // Click the Connect button
    const connectButton = page.locator('button', { hasText: /connect/i });
    await connectButton.click();

    // Wait for the graph to load (exploring view with header stats)
    await expect(page.locator('text=/\\d+ nodes/')).toBeVisible({ timeout: 45_000 });

    // Diff button should be visible
    const diffButton = page.locator('button', { hasText: 'Diff' });
    await expect(diffButton).toBeVisible();

    // Click the diff button
    await diffButton.click();

    // Branch selector dropdown should open
    await expect(page.locator('text=Compare Branches')).toBeVisible({ timeout: 10_000 });

    // Should have branch select dropdowns
    await expect(page.locator('select')).toHaveCount(2);

    // Should have Compare button
    await expect(page.locator('button', { hasText: 'Compare' })).toBeVisible();
  });

  test('full diff comparison flow', async ({ page }) => {
    // Click Server tab and connect
    await page.getByRole('button', { name: 'Server' }).click();
    const serverInput = page.locator('input[name="server-url-input"]');
    await serverInput.fill(BACKEND_URL);
    await page.locator('button', { hasText: /connect/i }).click();
    await expect(page.locator('text=/\\d+ nodes/')).toBeVisible({ timeout: 45_000 });

    // Open diff selector
    await page.locator('button', { hasText: 'Diff' }).click();
    await expect(page.locator('text=Compare Branches')).toBeVisible({ timeout: 10_000 });

    // Wait for branches to load
    await expect(page.locator('text=Loading branches')).toBeHidden({ timeout: 10_000 });

    // Select base branch
    const baseSelect = page.locator('select').first();
    const options = await baseSelect.locator('option').allTextContents();
    const realBranch = options.find(o => o !== 'Select branch...' && o !== 'HEAD (working tree)');
    if (!realBranch) {
      test.skip(true, 'No branches available');
      return;
    }
    await baseSelect.selectOption({ label: realBranch });

    // Click Compare
    await page.locator('button', { hasText: 'Compare' }).click();

    // Wait for diff results
    await expect(
      page.locator('text=Diff View').or(page.locator('text=Analyzing changes'))
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('text=Diff View')).toBeVisible({ timeout: 45_000 });

    // Summary should show stats
    await expect(page.locator('text=/\\d+ files/')).toBeVisible();

    // Take a screenshot of the diff view for visual verification
    await page.screenshot({ path: 'test-results/diff-view-screenshot.png', fullPage: true });

    // Exit diff mode
    const diffHeader = page.locator('text=Diff View').locator('..');
    await diffHeader.locator('button').last().click();
    await expect(page.locator('text=Diff View')).toBeHidden({ timeout: 5_000 });

    // Diff button should reappear
    await expect(page.locator('button', { hasText: 'Diff' })).toBeVisible();
  });
});
