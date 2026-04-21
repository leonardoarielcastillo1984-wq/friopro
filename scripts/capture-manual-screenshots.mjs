#!/usr/bin/env node
/**
 * Captures real screenshots of each module for the "Modo de Uso" manual.
 * Runs against testing: http://46.62.253.81:4000
 *
 * Usage:
 *   npx playwright install chromium   # first time
 *   node scripts/capture-manual-screenshots.mjs
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'apps', 'web', 'public', 'manual');
const BASE_URL = process.env.MANUAL_BASE_URL || 'http://46.62.253.81:4000';
const EMAIL = process.env.MANUAL_EMAIL || 'admin@sgi360.com';
const PASSWORD = process.env.MANUAL_PASSWORD || 'Admin123!';

const MODULES = [
  { id: 'inicio', path: '/dashboard' },
  { id: 'panel', path: '/panel' },
  { id: 'project360', path: '/project360' },
  { id: 'mantenimiento', path: '/mantenimiento' },
  { id: 'simulacros', path: '/simulacros' },
  { id: 'documentos', path: '/documents' },
  { id: 'normativos', path: '/normativos' },
  { id: 'auditoria-ia', path: '/audit' },
  { id: 'auditorias-iso', path: '/auditorias' },
  { id: 'no-conformidades', path: '/no-conformidades' },
  { id: 'riesgos', path: '/riesgos' },
  { id: 'indicadores', path: '/indicadores' },
  { id: 'capacitaciones', path: '/capacitaciones' },
  { id: 'rrhh', path: '/rrhh' },
  { id: 'rrhh-empleados', path: '/rrhh/empleados' },
  { id: 'rrhh-competencias', path: '/rrhh/competencias' },
  { id: 'rrhh-organigrama', path: '/rrhh/organigrama' },
  { id: 'clientes', path: '/clientes' },
  { id: 'clientes-encuestas', path: '/encuestas' },
  { id: 'licencias', path: '/licencia' },
  { id: 'reportes', path: '/reportes' },
  { id: 'notificaciones', path: '/notificaciones' },
  { id: 'configuracion', path: '/configuracion' },
  { id: 'integraciones', path: '/integraciones' },
  { id: 'empresa', path: '/configuracion/empresa' },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  ensureDir(OUT_DIR);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Login via API to obtain cookies reliably, then inject them into the browser context.
  async function loginViaAPI() {
    console.log(`[manual] Login via API ${BASE_URL}/api/auth/login`);
    const url = new URL(BASE_URL);
    const resp = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const setCookies = resp.headers.getSetCookie?.() || [];
    const data = await resp.json();
    if (!resp.ok) throw new Error(`Login failed: ${resp.status} ${JSON.stringify(data)}`);

    const cookies = [];
    for (const raw of setCookies) {
      const [pair] = raw.split(';');
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      cookies.push({ name, value, domain: url.hostname, path: '/', httpOnly: name === 'access_token', sameSite: 'Lax' });
    }
    if (data.accessToken) {
      cookies.push({ name: 'access_token', value: data.accessToken, domain: url.hostname, path: '/', httpOnly: true, sameSite: 'Lax' });
    }
    if (data.csrfToken) {
      cookies.push({ name: 'csrf_token', value: data.csrfToken, domain: url.hostname, path: '/', httpOnly: false, sameSite: 'Lax' });
    }
    await context.addCookies(cookies);
  }

  await loginViaAPI();

  for (const mod of MODULES) {
    const outFile = path.join(OUT_DIR, `${mod.id}.png`);
    try {
      console.log(`[manual] Capturando ${mod.id} -> ${mod.path}`);
      await page.goto(`${BASE_URL}${mod.path}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(2500);
      if (/\/login/.test(page.url())) {
        console.log('[manual]   sesión perdida, re-login via API...');
        await loginViaAPI();
        await page.goto(`${BASE_URL}${mod.path}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await page.waitForTimeout(2500);
      }
      await page.screenshot({ path: outFile, fullPage: false });
    } catch (err) {
      console.warn(`[manual] Falló ${mod.id}:`, err.message);
    }
  }

  await browser.close();
  console.log(`[manual] Listo. Imágenes en ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
