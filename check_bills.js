const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

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

  const content = await page.evaluate(() => {
    return {
      fixed: document.getElementById('summary-fixed')?.textContent,
      variable: document.getElementById('summary-variable')?.textContent,
      projected: document.getElementById('summary-projected')?.textContent,
      nextBill: document.getElementById('summary-next-bill')?.textContent,
      billsCount: document.querySelectorAll('#bills-container .card').length,
    }
  });
  console.log(content);

  await browser.close();
})();
