const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set window size
  await page.setViewportSize({ width: 1280, height: 800 });

  // Capture analytics for previous month (Oct 2026) to see actual spend
  await page.goto('http://localhost:8000/grocery.html');
  await page.waitForTimeout(500);

  // Click prev month
  await page.click('#prev-month-btn');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'analytics_prev.png' });

  // Add bill
  await page.goto('http://localhost:8000/bills.html');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
      TrackerStore.addBill({ name: 'Netflix', type: 'fixed', amount: 15.99, dueDay: 1 });
  });
  await page.goto('http://localhost:8000/bills.html');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'bills.png' });

  await browser.close();
})();
