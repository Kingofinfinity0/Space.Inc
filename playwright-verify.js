import { test, expect } from '@playwright/test';

test('Verify minimalist layout and menu', async ({ page }) => {
  await page.goto('http://localhost:3000/dashboard');
  // Check background color
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  console.log('Body background:', bodyBg);

  // Check if dock exists
  const dock = page.locator('.dock-container');
  await expect(dock).toBeVisible();

  // Check if sidebar is gone
  const sidebar = page.locator('aside');
  await expect(sidebar).not.toBeVisible();

  // Check if header is gone (the old sticky one)
  const oldHeader = page.locator('header.sticky');
  await expect(oldHeader).not.toBeVisible();
});
