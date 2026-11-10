import { chromium } from 'playwright';

const BASE = 'https://logismart.ar';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  await page.locator('input[type="email"], input[name="email"]').first().fill('admin@sgi360.com');
  await page.locator('input[type="password"]').first().fill('Admin123!');
  await page.locator('button[type="submit"], button:has-text("Ingresar")').first().click();
  await sleep(6000);
  const aceptar = page.locator('button:has-text("Aceptar todas")');
  if (await aceptar.count()) { await aceptar.first().click(); await sleep(800); }

  await page.goto(`${BASE}/select-tenant`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(4000);
  await page.locator('button', { hasText: /Chile/i }).first().click();
  await sleep(7000);

  await page.goto(`${BASE}/resultados`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(7000);

  const tabs = [
    { nombre: 'Cuentas por cobrar', file: '/tmp/chile-cobrar.png' },
    { nombre: 'Rentabilidad', file: '/tmp/chile-renta.png' },
  ];
  for (const t of tabs) {
    const tab = page.locator(`text="${t.nombre}"`).first();
    if (await tab.count()) {
      await tab.click();
      await sleep(4000);
      await page.screenshot({ path: t.file });
      console.log('shot:', t.file);
    } else console.log('no tab:', t.nombre);
  }
} catch (e) {
  console.log('ERROR:', e.message);
} finally {
  await browser.close();
}
