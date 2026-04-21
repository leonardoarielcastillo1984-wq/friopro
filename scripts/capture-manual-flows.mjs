#!/usr/bin/env node
/**
 * Captures step-by-step flows for the "Modo de Uso" manual.
 * Runs against testing: http://46.62.253.81:4000
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'apps', 'web', 'public', 'manual', 'flows');
const BASE_URL = process.env.MANUAL_BASE_URL || 'http://46.62.253.81:4000';
const EMAIL = process.env.MANUAL_EMAIL || 'admin@sgi360.com';
const PASSWORD = process.env.MANUAL_PASSWORD || 'Admin123!';

fs.mkdirSync(OUT_DIR, { recursive: true });

/**
 * Each flow has steps. Each step:
 *  - navigate?: path to go to
 *  - click?: text to find and click (button:has-text)
 *  - clickSelector?: raw selector
 *  - waitMs?: ms after action
 *  - file: output filename (without extension)
 *  - caption: text shown in the manual
 */
const FLOWS = [
  {
    module: 'documentos',
    title: 'Subir un documento al repositorio',
    steps: [
      { navigate: '/documents', waitMs: 2500, file: 'documentos-01', caption: '1. Entrá al módulo "Documentos" desde el sidebar.' },
      { click: 'Subir', waitMs: 1500, file: 'documentos-02', caption: '2. Hacé click en "Subir" (o "Nuevo documento") para abrir el formulario de carga.' },
    ],
  },
  {
    module: 'no-conformidades',
    title: 'Registrar una no conformidad',
    steps: [
      { navigate: '/no-conformidades', waitMs: 2500, file: 'nc-01', caption: '1. Abrí el módulo "No Conformidades".' },
      { click: 'Nueva', waitMs: 1500, file: 'nc-02', caption: '2. Click en "Nueva" para abrir el formulario de creación.' },
    ],
  },
  {
    module: 'riesgos',
    title: 'Registrar un riesgo',
    steps: [
      { navigate: '/riesgos', waitMs: 2500, file: 'riesgos-01', caption: '1. Entrá a "Riesgos".' },
      { click: 'Nuevo', waitMs: 1500, file: 'riesgos-02', caption: '2. Click en "Nuevo riesgo" para comenzar la carga.' },
    ],
  },
  {
    module: 'clientes',
    title: 'Alta de un cliente',
    steps: [
      { navigate: '/clientes', waitMs: 2500, file: 'clientes-01', caption: '1. Abrí el módulo "Clientes".' },
      { click: 'Nuevo Cliente', waitMs: 1500, file: 'clientes-02', caption: '2. Click en "Nuevo Cliente".' },
    ],
  },
  {
    module: 'clientes-encuestas',
    title: 'Crear una encuesta de satisfacción',
    steps: [
      { navigate: '/clientes', waitMs: 2500, file: 'encuestas-01', caption: '1. En el módulo "Clientes", cambiá a la pestaña "Encuestas".' },
      { click: 'Encuestas', waitMs: 1500, file: 'encuestas-02', caption: '2. Ya estás viendo la lista de encuestas existentes.' },
      { click: 'Nueva', waitMs: 1500, file: 'encuestas-03', caption: '3. Click en "Nueva encuesta" para diseñarla.' },
    ],
  },
  {
    module: 'rrhh-empleados',
    title: 'Alta de un empleado',
    steps: [
      { navigate: '/rrhh/empleados', waitMs: 2500, file: 'empleados-01', caption: '1. Entrá a "RRHH > Empleados".' },
      { click: 'Nuevo', waitMs: 1500, file: 'empleados-02', caption: '2. Click en "Nuevo Empleado" para abrir el formulario.' },
    ],
  },
  {
    module: 'auditoria-ia',
    title: 'Usar Auditoría IA',
    steps: [
      { navigate: '/audit', waitMs: 3000, file: 'audit-01', caption: '1. Abrí "Auditoría IA" desde el sidebar.' },
      { click: 'Analizar', waitMs: 2000, file: 'audit-02', caption: '2. Click en "Analizar" para iniciar el análisis de un documento.' },
    ],
  },
  {
    module: 'auditorias-iso',
    title: 'Crear una auditoría ISO',
    steps: [
      { navigate: '/auditorias', waitMs: 2500, file: 'audiso-01', caption: '1. Entrá a "Auditorías ISO".' },
      { click: 'Nueva', waitMs: 1500, file: 'audiso-02', caption: '2. Click en "Nueva auditoría".' },
    ],
  },
  {
    module: 'indicadores',
    title: 'Registrar un indicador',
    steps: [
      { navigate: '/indicadores', waitMs: 2500, file: 'indicadores-01', caption: '1. Abrí el módulo "Indicadores".' },
      { click: 'Nuevo', waitMs: 1500, file: 'indicadores-02', caption: '2. Click en "Nuevo indicador" para definirlo.' },
    ],
  },
];

async function loginViaAPI(context) {
  const url = new URL(BASE_URL);
  const resp = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const setCookies = resp.headers.getSetCookie?.() || [];
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Login failed: ${resp.status}`);
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
  // Warm-up dashboard so app auth state is hydrated
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  for (const flow of FLOWS) {
    console.log(`\n[flow] ${flow.module} — ${flow.title}`);
    for (const step of flow.steps) {
      try {
        if (step.navigate) {
          await page.goto(`${BASE_URL}${step.navigate}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
        }
        if (/\/login/.test(page.url())) {
          console.log('  sesión perdida, re-login...');
          await loginViaAPI(context);
          if (step.navigate) {
            await page.goto(`${BASE_URL}${step.navigate}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
          }
        }
        await page.waitForTimeout(step.waitMs ?? 2000);

        if (step.click) {
          // Try several button patterns
          const patterns = [
            `button:has-text("${step.click}"):visible`,
            `a:has-text("${step.click}"):visible`,
            `[role="button"]:has-text("${step.click}"):visible`,
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
          if (!clicked) {
            console.warn(`  [warn] No se encontró botón: "${step.click}"`);
          }
          await page.waitForTimeout(step.waitMs ?? 1500);
        }

        const outFile = path.join(OUT_DIR, `${step.file}.png`);
        await page.screenshot({ path: outFile, fullPage: false });
        console.log(`  ✓ ${step.file}.png`);
      } catch (err) {
        console.warn(`  [warn] Step ${step.file} falló:`, err.message);
      }
    }
  }

  await browser.close();
  console.log(`\n[flows] Listo. Capturas en ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
