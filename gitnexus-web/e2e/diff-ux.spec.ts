import { test, expect, Page } from '@playwright/test';

const APP_URL = 'http://localhost:5175';
const SERVER_URL = 'localhost:4747';

async function connectToServer(page: Page) {
  await page.goto(APP_URL);
  await page.locator('button', { hasText: 'Server' }).waitFor({ timeout: 15000 });
  await page.locator('button', { hasText: 'Server' }).click();
  const input = page.locator('input[name="server-url-input"]');
  await input.waitFor({ timeout: 5000 });
  await input.fill(SERVER_URL);
  await page.locator('button', { hasText: 'Connect' }).click();
  await expect(page.locator('h2', { hasText: 'Compare Branches' })).toBeVisible({ timeout: 30000 });
  await expect(page.locator('text=Loading branches')).not.toBeVisible({ timeout: 15000 });
}

async function connectAndDiff(page: Page) {
  await connectToServer(page);
  await page.locator('button', { hasText: 'Compare & Load' }).click();
  await expect(page.locator('text=Diff View')).toBeVisible({ timeout: 90000 });
}

async function connectAndSkip(page: Page) {
  await connectToServer(page);
  await page.locator('button', { hasText: 'Skip' }).click();
  await expect(page.locator('text=Ready').first()).toBeVisible({ timeout: 30000 });
}

// =====================================================================
test.describe('Branch Picker Dialog', () => {
  test('appears with all UI elements', async ({ page }) => {
    await connectToServer(page);
    await expect(page.locator('h2', { hasText: 'Compare Branches' })).toBeVisible();
    await expect(page.locator('text=Base (from)')).toBeVisible();
    await expect(page.locator('text=Compare (to)')).toBeVisible();
    await expect(page.locator('button', { hasText: 'Compare & Load' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Skip' })).toBeVisible();
  });

  test('loads branches in dropdowns', async ({ page }) => {
    await connectToServer(page);
    const options = await page.locator('select').first().locator('option').count();
    expect(options).toBeGreaterThan(1);
  });

  test('Skip loads full graph without diff', async ({ page }) => {
    await connectAndSkip(page);
    await expect(page.locator('text=Diff View')).not.toBeVisible({ timeout: 3000 });
  });

  test('Compare & Load opens diff mode', async ({ page }) => {
    await connectAndDiff(page);
    await expect(page.locator('text=Diff View')).toBeVisible();
  });
});

// =====================================================================
test.describe('Collapsible DiffPanel', () => {
  test('collapse and expand round-trip', async ({ page }) => {
    await connectAndDiff(page);
    const collapseBtn = page.locator('button[title="Collapse panel"]');
    await expect(collapseBtn).toBeVisible({ timeout: 5000 });
    await collapseBtn.click();
    const expandBtn = page.locator('button[title="Expand diff panel"]');
    await expect(expandBtn).toBeVisible({ timeout: 3000 });
    const box = await expandBtn.boundingBox();
    expect(box!.y).toBeLessThan(200);
    await expandBtn.click();
    await expect(page.locator('text=Diff View')).toBeVisible({ timeout: 3000 });
  });
});

// =====================================================================
test.describe('Condensed Summary', () => {
  test('see more/less toggle works', async ({ page }) => {
    await connectAndDiff(page);
    await expect(page.locator('text=/Modifies/')).toBeVisible();
    await expect(page.locator('text=see more...')).toBeVisible();
    await page.locator('text=see more...').click();
    await expect(page.locator('text=see less')).toBeVisible();
    await page.locator('text=see less').click();
    await expect(page.locator('text=see more...')).toBeVisible();
  });
});

// =====================================================================
test.describe('Show All Nodes', () => {
  test('inline toggle in summary exists', async ({ page }) => {
    await connectAndDiff(page);
    await expect(
      page.locator('button', { hasText: /Show all nodes|Impacted only/ }).first()
    ).toBeVisible({ timeout: 3000 });
  });
});

// =====================================================================
test.describe('View Mode Shortcuts', () => {
  test('1/3 keys switch Focus/Review', async ({ page }) => {
    await connectAndDiff(page);
    await page.keyboard.press('1');
    await page.waitForTimeout(500);
    await expect(page.locator('text=Showing impacted nodes only')).not.toBeVisible({ timeout: 2000 });
    await page.keyboard.press('3');
    await page.waitForTimeout(500);
    await expect(page.locator('text=Diff View')).toBeVisible({ timeout: 5000 });
  });
});

// =====================================================================
test.describe('Depth Slider', () => {
  test('defaults to Changed only', async ({ page }) => {
    await connectAndDiff(page);
    await expect(page.locator('text=Changed only')).toBeVisible({ timeout: 5000 });
  });
});

// =====================================================================
test.describe('Exit Diff Mode', () => {
  test('X button closes diff', async ({ page }) => {
    await connectAndDiff(page);
    await page.locator('button:has(svg.lucide-x)').first().click();
    await expect(page.locator('text=Diff View')).not.toBeVisible({ timeout: 5000 });
  });
});
