#!/usr/bin/env node
/**
 * Captura screenshots REALES de cada módulo para el "Centro de Ayuda" (modo-de-uso).
 * Guarda en apps/web/public/help/{id}-{n}.png — naming que consume modo-de-uso/page.tsx.
 *
 * Uso:
 *   npx playwright install chromium          # primera vez
 *   node scripts/capture-help-screenshots.mjs
 *
 * Variables de entorno:
 *   HELP_BASE_URL  (default https://test.logismart.ar)
 *   HELP_EMAIL     (default admin@sgi360.com)
 *   HELP_PASSWORD  (default Admin123!)
 *   HELP_ONLY      (opcional, csv de ids a capturar, ej: "calidad,seguridad")
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'apps', 'web', 'public', 'help');
const BASE_URL = process.env.HELP_BASE_URL || 'https://test.logismart.ar';
const EMAIL = process.env.HELP_EMAIL || 'admin@sgi360.com';
const PASSWORD = process.env.HELP_PASSWORD || 'Admin123!';
const ONLY = (process.env.HELP_ONLY || '').split(',').map(s => s.trim()).filter(Boolean);

/**
 * Cada módulo: id + lista de "shots".
 * Cada shot: { path, click? }
 *  - path: ruta a navegar (puede incluir ?tab=)
 *  - click: texto de botón a clickear antes de capturar (para tabs por estado interno)
 * El archivo resultante es {id}-{indice+1}.png
 */
const MODULES = [
  { id: 'dashboard', shots: [{ path: '/dashboard' }] },
  { id: 'command-center', shots: [{ path: '/command-center' }] },
  { id: 'documents', shots: [
    { path: '/documents' },
    { path: '/documents', click: 'Maestro' },
    { path: '/documents', click: 'Codificación' },
  ] },
  { id: 'rrhh', shots: [{ path: '/rrhh' }] },
  { id: 'capacitaciones', shots: [{ path: '/capacitaciones' }] },
  { id: 'clientes', shots: [{ path: '/clientes' }] },
  { id: 'proveedores', shots: [{ path: '/proveedores' }] },
  { id: 'cumplimiento', shots: [
    { path: '/cumplimiento' },
    { path: '/cumplimiento?tab=legales' },
  ] },
  { id: 'contexto-sgi', shots: [
    { path: '/contexto-sgi' },
    { path: '/contexto-sgi?tab=partes' },
    { path: '/contexto-sgi?tab=mapa' },
  ] },
  { id: 'objetivos', shots: [{ path: '/objetivos' }] },
  { id: 'politicas', shots: [{ path: '/objetivos/politicas' }] },
  { id: 'calidad', shots: [
    { path: '/calidad' },
    { path: '/calidad?tab=incidentes' },
    { path: '/calidad?tab=acciones' },
    { path: '/calidad?tab=cambios' },
  ] },
  { id: 'auditoria', shots: [
    { path: '/auditoria' },
    { path: '/auditoria?tab=iso' },
  ] },
  { id: 'revision-direccion', shots: [{ path: '/revision-direccion' }] },
  { id: 'seguridad', shots: [
    { path: '/seguridad' },
    { path: '/seguridad?tab=iperc' },
    { path: '/seguridad?tab=ambientales' },
    { path: '/seguridad?tab=simulacros' },
  ] },
  { id: 'indicadores', shots: [{ path: '/indicadores' }] },
  { id: 'proyectos', shots: [{ path: '/project360' }] },
  { id: 'calendario', shots: [{ path: '/calendario' }] },
  { id: 'infraestructura', shots: [
    { path: '/infraestructura' },
    { path: '/infraestructura?tab=calibraciones' },
    { path: '/infraestructura?tab=inspecciones' },
  ] },
  { id: 'reportes', shots: [{ path: '/reportes' }] },
  { id: 'clima', shots: [{ path: '/clima' }] },
  { id: 'configuracion', shots: [{ path: '/configuracion' }] },
  { id: 'configuracion-empresa', shots: [{ path: '/configuracion/empresa' }] },
  { id: 'notificaciones', shots: [{ path: '/notificaciones' }] },
  { id: 'modo-de-uso', shots: [{ path: '/modo-de-uso' }] },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

async function loginViaAPI(context) {
  console.log(`[help] Login via API ${BASE_URL}/api/auth/login (${EMAIL})`);
  const url = new URL(BASE_URL);
  const resp = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const setCookies = resp.headers.getSetCookie?.() || [];
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`Login failed: ${resp.status} ${JSON.stringify(data)}`);

  const cookies = [];
  for (const raw of setCookies) {
    const [pair] = raw.split(';');
    const eq = pair.indexOf('=');
    cookies.push({
      name: pair.slice(0, eq).trim(),
      value: pair.slice(eq + 1).trim(),
      domain: url.hostname, path: '/', sameSite: 'Lax',
    });
  }
  if (data.accessToken) cookies.push({ name: 'access_token', value: data.accessToken, domain: url.hostname, path: '/', httpOnly: true, sameSite: 'Lax' });
  if (data.csrfToken) cookies.push({ name: 'csrf_token', value: data.csrfToken, domain: url.hostname, path: '/', httpOnly: false, sameSite: 'Lax' });
  await context.addCookies(cookies);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await loginViaAPI(context);
  // Warm-up para hidratar el estado de auth de la app
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(2500);

  let ok = 0, fail = 0;
  const modules = ONLY.length ? MODULES.filter(m => ONLY.includes(m.id)) : MODULES;

  for (const mod of modules) {
    for (let i = 0; i < mod.shots.length; i++) {
      const shot = mod.shots[i];
      const outFile = path.join(OUT_DIR, `${mod.id}-${i + 1}.png`);
      try {
        console.log(`[help] ${mod.id}-${i + 1} -> ${shot.path}${shot.click ? ` (click "${shot.click}")` : ''}`);
        await page.goto(`${BASE_URL}${shot.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        if (/\/login/.test(page.url())) {
          console.log('[help]   sesión perdida, re-login...');
          await loginViaAPI(context);
          await page.goto(`${BASE_URL}${shot.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        }
        await page.waitForTimeout(2600);

        if (shot.click) {
          const patterns = [
            `button:has-text("${shot.click}"):visible`,
            `a:has-text("${shot.click}"):visible`,
            `[role="tab"]:has-text("${shot.click}"):visible`,
          ];
          let clicked = false;
          for (const sel of patterns) {
            const loc = page.locator(sel).first();
            if (await loc.count() > 0) {
              await loc.click({ timeout: 5000 }).catch(() => {});
              clicked = true;
              break;
            }
          }
          if (!clicked) console.warn(`[help]   [warn] no se encontró el botón "${shot.click}"`);
          await page.waitForTimeout(1800);
        }

        await page.screenshot({ path: outFile, fullPage: false });
        console.log(`[help]   ✓ ${path.basename(outFile)}`);
        ok++;
      } catch (err) {
        console.warn(`[help]   ✗ ${mod.id}-${i + 1} falló: ${err.message}`);
        fail++;
      }
    }
  }

  await browser.close();
  console.log(`\n[help] Listo. OK=${ok} FALLOS=${fail}. Imágenes en ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
