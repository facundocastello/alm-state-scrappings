import { chromium } from 'playwright';
import fs from 'fs';

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Try Welcome page first
  console.log('Navigating to Welcome...');
  await page.goto('https://www.pfr.maine.gov/ALMSOnline/Welcome.aspx', { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/tmp/me-welcome.png', fullPage: true });
  fs.writeFileSync('/tmp/me-welcome.html', await page.content());
  console.log('Title:', await page.title());

  // Look for assisted housing link
  const links = await page.$$eval('a', els =>
    els.filter(e => e.textContent?.toLowerCase().includes('assisted')).map(e => ({ text: e.textContent?.trim(), href: e.href }))
  );
  console.log('Assisted Housing links:', links);

  // Click on Assisted Housing Programs if found
  const ahLink = await page.$('a:has-text("Assisted Housing")');
  if (ahLink) {
    console.log('Clicking Assisted Housing link...');
    await ahLink.click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/me-ah-search.png', fullPage: true });
    fs.writeFileSync('/tmp/me-ah-search.html', await page.content());
    console.log('Title after click:', await page.title());
  }

  await browser.close();
}

debug().catch(console.error);
