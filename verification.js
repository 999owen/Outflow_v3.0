const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`file://${__dirname}/bills.html`);

  // Set some local storage data to simulate
  await page.evaluate(() => {
    localStorage.setItem('owens_tracker_data', JSON.stringify({
      recurring_bills: [
        { id: '1', name: 'Utilities', type: 'fixed', amount: 50, dueDay: 1, isActive: true },
        { id: '2', name: 'Wifi', type: 'fixed', amount: 45, dueDay: 15, isActive: true },
        { id: '3', name: 'Car Insurance', type: 'variable', amount: 100, dueDay: 20, isActive: true }
      ]
    }));
  });

  await page.reload({ waitUntil: 'networkidle' });

  await page.screenshot({ path: 'verification.png' });

  await browser.close();
})();
