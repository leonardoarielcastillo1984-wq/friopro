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

  // cookies si aparece
  const aceptar = page.locator('button:has-text("Aceptar todas")');
  if (await aceptar.count()) { await aceptar.first().click(); await sleep(800); }

  // qué empresa/tenant está activa? leer sidebar
  const body = await page.locator('body').innerText();
  const empresas = body.match(/DADA[^\n]*/g) || [];
  console.log('empresas visibles:', JSON.stringify(empresas.slice(0, 5)));
  console.log('titulo sidebar:', body.split('\n').slice(0, 12).join(' | '));

  await page.screenshot({ path: '/tmp/prod-post-login.png' });

  // buscar selector de empresa si existe
  const switcher = page.locator('text=/Demo Company|Mi Empresa|Empresa/i').first();
  if (await switcher.count()) console.log('hay selector de empresa');

  console.log('-> /resultados');
  await page.goto(`${BASE}/resultados`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(7000);
  await page.screenshot({ path: '/tmp/prod-resultados.png' });
  console.log('guardada /tmp/prod-resultados.png');
} catch (e) {
  console.log('ERROR:', e.message);
  await page.screenshot({ path: '/tmp/prod-error.png' }).catch(() => {});
} finally {
  await browser.close();
}
