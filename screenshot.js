const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set window size
  await page.setViewportSize({ width: 1280, height: 800 });

  // Add some test data
  await page.goto('http://localhost:8000/dashboard.html');
  await page.evaluate(() => {
      TrackerStore.addEntry('grocery', { date: '2026-10-31', amount: 300, notes: 'Whole Foods' });
      TrackerStore.addEntry('spend', { date: '2026-10-31', amount: 50, notes: 'Dinner', category: 'Dining Out' });
      TrackerStore.addEntry('income', { date: '2026-10-31', amount: 2000, notes: 'Paycheck' });

      TrackerStore.addEntry('grocery', { date: '2026-10-15', amount: 50, notes: 'Trader Joes' });
      TrackerStore.addEntry('spend', { date: '2026-10-15', amount: 80, notes: 'Electric Bill', category: 'Utilities' });
  });

  // Capture dashboard
  await page.goto('http://localhost:8000/dashboard.html');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'dashboard.png' });

  // Capture entries
  await page.goto('http://localhost:8000/entries.html');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'entries.png' });

  // Capture analytics
  await page.goto('http://localhost:8000/grocery.html');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'analytics.png' });

  // Capture settings
  await page.goto('http://localhost:8000/settings.html');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'settings.png' });

  await browser.close();
})();
