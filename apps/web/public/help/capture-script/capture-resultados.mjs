import { chromium } from 'playwright';

const BASE = 'https://test.logismart.ar';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

try {
  console.log('login...');
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  const email = page.locator('input[type="email"], input[name="email"], input[placeholder*="mail" i]').first();
  await email.fill('admin@sgi360.com');
  await page.locator('input[type="password"]').first().fill('Admin123!');
  await page.locator('button[type="submit"], button:has-text("Ingresar"), button:has-text("Iniciar")').first().click();
  await sleep(5000);
  console.log('login ok, capturando /resultados...');
  await page.goto(`${BASE}/resultados`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(6000);
  await page.screenshot({ path: '/tmp/resultados-real.png' });
  console.log('guardada /tmp/resultados-real.png');
} catch (e) {
  console.log('ERROR:', e.message);
  await page.screenshot({ path: '/tmp/resultados-error.png' }).catch(() => {});
} finally {
  await browser.close();
}
