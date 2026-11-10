import { chromium } from 'playwright';

const BASE = 'https://logismart.ar';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

try {
  console.log('login prod...');
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  await page.locator('input[type="email"], input[name="email"]').first().fill('admin@sgi360.com');
  await page.locator('input[type="password"]').first().fill('Admin123!');
  await page.locator('button[type="submit"], button:has-text("Ingresar"), button:has-text("Iniciar")').first().click();
  await sleep(6000);

  const aceptar = page.locator('button:has-text("Aceptar todas")');
  if (await aceptar.count()) { await aceptar.first().click(); await sleep(800); }

  console.log('select-tenant...');
  await page.goto(`${BASE}/select-tenant`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(4000);
  const listado = await page.locator('body').innerText();
  console.log('tenants:', listado.split('\n').filter(l => l.trim()).slice(0, 15).join(' | '));

  const btn = page.locator('button', { hasText: /Chile/i }).first();
  if (await btn.count()) {
    console.log('switch a Chile...');
    await btn.click();
    await sleep(7000);
  } else {
    console.log('NO hay tenant Chile');
  }

  console.log('-> /resultados');
  await page.goto(`${BASE}/resultados`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(7000);
  await page.screenshot({ path: '/tmp/chile-resultados.png' });
  console.log('guardada /tmp/chile-resultados.png');
} catch (e) {
  console.log('ERROR:', e.message);
  await page.screenshot({ path: '/tmp/prod-error.png' }).catch(() => {});
} finally {
  await browser.close();
}
