// Captura el Hub del chofer (/unidad/[token]) y el QR del mecánico
// (/mantenimiento-qr/[token]) en viewport mobile. NO envía datos.
// Uso: node capture-hub-flow.mjs [token] [baseUrl]
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..');
const TOKEN = process.argv[2] || 'e73e8f7884adad286d241eb71219a8c942c0190c';
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
const shot = (n) => page.screenshot({ path: path.join(OUT, `hub-${n}.png`) });
const volver = async () => {
  const b = page.locator('button:has-text("Volver"), button:has-text("←")').first();
  if (await b.count()) await b.click();
  await page.waitForTimeout(400);
};

try {
  // ═══ HUB DEL CHOFER ═══
  await page.goto(`${BASE}/unidad/${TOKEN}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot('1-menu');

  // Reportar incidente
  await page.click('text=Reportar incidente');
  await page.waitForTimeout(500);
  await shot('2-incidente');
  await volver();

  // Cargué combustible
  await page.click('text=Cargué combustible');
  await page.waitForTimeout(500);
  await shot('3-combustible');
  await volver();

  // Control pre-servicio
  await page.click('text=Control pre-servicio');
  await page.waitForTimeout(500);
  await shot('4-control');
  await volver();

  // Inicio / fin de servicio
  await page.click('text=Inicio / fin de servicio');
  await page.waitForTimeout(500);
  await shot('5-servicio');
  await volver();

  // Documentación
  await page.click('text=Documentación');
  await page.waitForTimeout(800);
  await shot('6-documentos');
  await volver();

  // ═══ QR DEL MECÁNICO ═══
  await page.goto(`${BASE}/mantenimiento-qr/${TOKEN}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot('7-mecanico-top');

  // scroll a la sección de tareas
  await page.evaluate(() => window.scrollTo(0, 700));
  await page.waitForTimeout(400);
  await shot('8-mecanico-tareas');

  // scroll al final (repuestos + botón)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await shot('9-mecanico-repuestos');

  console.log('OK — capturas en', OUT);
} catch (e) {
  console.error('ERROR:', e.message);
  await page.screenshot({ path: path.join(OUT, 'hub-error.png') });
} finally {
  await browser.close();
}
