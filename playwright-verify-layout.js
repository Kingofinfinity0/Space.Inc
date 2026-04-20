const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  // We can't easily login here, but we can check if the LandingPage or the general shell structure looks right
  // Given it's a dev environment, let's just try to hit the root
  try {
    await page.goto('http://localhost:3000/');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/home/jules/verification/layout_check.png', fullPage: true });
    console.log('Screenshot saved to /home/jules/verification/layout_check.png');
  } catch (e) {
    console.error('Failed to load page:', e.message);
  }

  await browser.close();
})();
