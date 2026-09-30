// Captura el flujo público de inspección QR (vista del chofer) en viewport mobile.
// NO envía la inspección — solo captura pantallas. Uso:
//   node capture-qr-flow.mjs [token] [baseUrl]
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..');
const TOKEN = process.argv[2] || '53e72b21cb13f8ffe46e9ebffb7eee297f082f2c';
const BASE = process.argv[3] || 'https://logismart.ar';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();
const shot = (n) => page.screenshot({ path: path.join(OUT, `qr-paso-${n}.png`) });

try {
  await page.goto(`${BASE}/inspeccionar/${TOKEN}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  // 1. Pantalla de bienvenida / datos del inspector
  await shot('1-intro');

  // Completar datos mínimos y avanzar
  await page.fill('input[placeholder="Nombre y apellido *"]', 'Juan Pérez');
  const domTractor = page.locator('input[placeholder="Dominio tractor *"]');
  if (await domTractor.count()) await domTractor.fill('MME875');
  const km = page.locator('input[placeholder*="Kilometraje actual"]');
  if (await km.count()) await km.fill('245300');
  const ruta = page.locator('input[placeholder="Ruta"]');
  if (await ruta.count()) await ruta.fill('Bs.As. — Córdoba');
  await shot('2-datos');

  await page.click('text=Comenzar inspección');
  await page.waitForTimeout(800);

  // 3. Checklist — primera sección visible
  await shot('3-checklist');

  // 4. Marcar un ítem como "No cumple" para mostrar el campo de hallazgo
  const noCumple = page.locator('button:has-text("No cumple")').first();
  if (await noCumple.count()) {
    await noCumple.click();
    await page.waitForTimeout(400);
    await page.locator('input[placeholder*="Describí el problema"]').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await shot('4-hallazgo');
  }

  // 5. Scroll al final: puntaje estimado + botón enviar
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await shot('5-enviar');

  console.log('OK — capturas en', OUT);
} catch (e) {
  console.error('ERROR:', e.message);
  await page.screenshot({ path: path.join(OUT, 'qr-paso-error.png') });
} finally {
  await browser.close();
}
