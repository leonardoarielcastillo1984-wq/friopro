#!/usr/bin/env node
/**
 * Captura TODAS las pantallas del módulo FLOTA 360 para armar material de video.
 * Guarda en ~/Desktop/FLOTA360-CAPTURAS/ con nombres numerados por flujo.
 *
 * Uso:
 *   FLOTA_BASE_URL=https://test.logismart.ar \
 *   FLOTA_EMAIL=lcastillo@dadalogistica.com \
 *   FLOTA_PASSWORD='***' \
 *   node scripts/capture-flota360.mjs
 *
 * Env:
 *   FLOTA_BASE_URL  (default https://test.logismart.ar)
 *   FLOTA_EMAIL     (requerido)
 *   FLOTA_PASSWORD  (requerido)
 *   FLOTA_OUT       (default ~/Desktop/FLOTA360-CAPTURAS)
 *   FLOTA_ONLY      (csv de prefijos a capturar, ej: "10-,50-")
 *
 * IMPORTANTE: nunca hace submit de formularios ni borra nada — solo navega,
 * abre modales y captura. Los datos de DADA S.A quedan intactos.
 */

import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const BASE_URL = process.env.FLOTA_BASE_URL || 'https://test.logismart.ar';
const EMAIL = process.env.FLOTA_EMAIL;
const PASSWORD = process.env.FLOTA_PASSWORD;
const OUT_DIR = process.env.FLOTA_OUT || path.join(os.homedir(), 'Desktop', 'FLOTA360-CAPTURAS');
const ONLY = (process.env.FLOTA_ONLY || '').split(',').map(s => s.trim()).filter(Boolean);

// Tokens QR reales (DADA S.A — maintenance_intervention_qrs / inspeccion_qrs)
const QR_UNIDAD = '847bbc853d1dccb08d2c05e8fb3e12b0d84ffea1'; // IVECO CURSOR AH878CG
const QR_INSPECCION = '53e72b21cb13f8ffe46e9ebffb7eee297f082f2c';

if (!EMAIL || !PASSWORD) {
  console.error('Falta FLOTA_EMAIL / FLOTA_PASSWORD');
  process.exit(1);
}

/**
 * Shots desktop. Campos:
 *  file      → nombre exacto del PNG
 *  path      → ruta a navegar
 *  click     → texto exacto de botón/tab a clickear antes de capturar (opcional)
 *  openModal → lista de textos candidatos para abrir un modal (opcional)
 *  vehicleDetail → navega a la primera ficha /flota-360/vehiculos/{uuid}
 *  firstLink → selector CSS de link a seguir (opcional)
 *  waitFor   → selector a esperar (opcional)
 *  scrollTo  → selector a scrollear a la vista (opcional)
 *  wait      → ms extra de espera
 */
const SHOTS_DESKTOP = [
  // ── Panel general ──
  { file: '01-dashboard-flota360.png', path: '/flota-360' },
  { file: '02-panel-kpis.png', path: '/flota-360/panel' },

  // ── Unidades (alta, ficha, gemelo digital, proyección) ──
  { file: '10-vehiculos-listado.png', path: '/flota-360/vehiculos' },
  { file: '11-vehiculo-alta-modal.png', path: '/flota-360/vehiculos', openModal: ['Nueva unidad', 'Nuevo vehículo', '+ Unidad', 'Agregar'] },
  { file: '12-vehiculo-ficha-gemelo-digital.png', path: '/flota-360/vehiculos', vehicleDetail: true, waitFor: 'text=Gemelo digital' },
  { file: '13-vehiculo-proyeccion-flota.png', path: '/flota-360/vehiculos', vehicleDetail: true, waitFor: 'text=Gemelo digital', scrollTo: 'text=recorro', click: '+50k km' },
  { file: '14-semis-listado.png', path: '/flota-360/semis' },
  { file: '15-conjuntos-operativos.png', path: '/flota-360/conjuntos' },
  { file: '16-conjunto-detalle.png', path: '/flota-360/conjuntos', firstLink: 'a[href^="/flota-360/conjuntos/"]' },

  // ── Personas de la operación ──
  { file: '20-conductores-listado.png', path: '/flota-360/conductores' },
  { file: '21-conductor-alta-modal.png', path: '/flota-360/conductores', openModal: ['Nuevo conductor', '+ Conductor', 'Agregar'] },
  { file: '22-conductor-asignar-pin.png', path: '/flota-360/conductores', openModal: ['PIN', 'Asignar PIN', 'Definir PIN'] },
  { file: '23-mecanicos-qr.png', path: '/flota-360/mecanicos' },
  { file: '24-talleres.png', path: '/flota-360/talleres' },

  // ── Mantenimiento ──
  { file: '30-planes-mantenimiento.png', path: '/flota-360/planes' },
  { file: '31-ordenes-trabajo.png', path: '/flota-360/ordenes' },
  { file: '32-orden-trabajo-nueva-modal.png', path: '/flota-360/ordenes', openModal: ['Nueva OT', 'Nueva orden', '+ OT', 'Crear OT'] },
  { file: '33-repuestos-stock.png', path: '/flota-360/repuestos' },
  { file: '34-neumaticos.png', path: '/flota-360/neumaticos' },

  // ── Inspecciones y QRs ──
  { file: '40-inspecciones-lista.png', path: '/flota-360/inspecciones' },
  { file: '41-inspecciones-qr-operativos.png', path: '/flota-360/inspecciones', click: 'QR Operativos' },
  { file: '42-inspecciones-hallazgos.png', path: '/flota-360/inspecciones', click: 'Hallazgos' },
  { file: '43-inspecciones-intervenciones-qr.png', path: '/flota-360/inspecciones', click: 'Intervenciones QR' },

  // ── Operación y costos ──
  { file: '50-servicios.png', path: '/flota-360/servicios' },
  { file: '51-combustible-cargas.png', path: '/flota-360/combustible' },
  { file: '52-costos-tco.png', path: '/flota-360/costos' },
  { file: '53-disponibilidad.png', path: '/flota-360/disponibilidad' },
  { file: '54-documentacion-vencimientos.png', path: '/flota-360/documentacion' },

  // ── Reportes y config ──
  { file: '60-reportes.png', path: '/flota-360/reportes' },
  { file: '61-configuracion-flota.png', path: '/flota-360/configuracion' },
];

/**
 * Shots mobile (hub del chofer + QR públicos, sin login).
 * clickHub: texto del HubBtn a tocar.
 */
const SHOTS_MOBILE = [
  { file: '70-qr-hub-chofer-inicio.png', path: `/unidad/${QR_UNIDAD}` },
  { file: '71-qr-reportar-incidente.png', path: `/unidad/${QR_UNIDAD}`, clickHub: 'Reportar incidente' },
  { file: '72-qr-carga-combustible.png', path: `/unidad/${QR_UNIDAD}`, clickHub: 'Cargué combustible' },
  { file: '73-qr-control-preservicio.png', path: `/unidad/${QR_UNIDAD}`, clickHub: 'Control pre-servicio' },
  { file: '74-qr-inicio-servicio-pin.png', path: `/unidad/${QR_UNIDAD}`, clickHub: 'Inicio / fin de servicio', selectChofer: true },
  { file: '75-qr-documentacion-chofer.png', path: `/unidad/${QR_UNIDAD}`, clickHub: 'Documentación' },
  { file: '76-qr-intervencion-mecanica.png', path: `/unidad/${QR_UNIDAD}`, clickHub: 'Intervención mecánica', followHref: true },
  { file: '77-qr-checklist-previaje.png', path: `/inspeccionar/${QR_INSPECCION}` },
  { file: '78-qr-mantenimiento-mecanico.png', path: `/mantenimiento-qr/${QR_UNIDAD}` },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

async function loginViaAPI(context) {
  console.log(`[flota] Login API ${BASE_URL}/api/auth/login (${EMAIL})`);
  const url = new URL(BASE_URL);
  const resp = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const setCookies = resp.headers.getSetCookie?.() || [];
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`Login falló: ${resp.status} ${JSON.stringify(data).slice(0, 200)}`);

  const cookies = [];
  for (const raw of setCookies) {
    const [pair] = raw.split(';');
    const eq = pair.indexOf('=');
    cookies.push({ name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim(), domain: url.hostname, path: '/', sameSite: 'Lax' });
  }
  if (data.accessToken) cookies.push({ name: 'access_token', value: data.accessToken, domain: url.hostname, path: '/', httpOnly: true, sameSite: 'Lax' });
  if (data.csrfToken) cookies.push({ name: 'csrf_token', value: data.csrfToken, domain: url.hostname, path: '/', httpOnly: false, sameSite: 'Lax' });
  await context.addCookies(cookies);
}

/** Si cae en /select-tenant (super admin o multi-tenant), elige DADA S.A */
async function ensureTenant(page) {
  if (!/select-tenant/.test(page.url())) return;
  console.log('[flota] Selector de tenant — elijo DADA S.A');
  const candidates = [
    'button:has-text("DADA S.A")', 'a:has-text("DADA S.A")',
    '[role="button"]:has-text("DADA")', 'div:has-text("DADA S.A")',
  ];
  for (const sel of candidates) {
    const loc = page.locator(sel).first();
    if (await loc.count() > 0) {
      await loc.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2500);
      return;
    }
  }
  console.warn('[flota]   [warn] no encontré la card de DADA S.A');
}

async function shot(page, s, outFile, { checkSession } = {}) {
  await page.goto(`${BASE_URL}${s.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (checkSession && /\/login/.test(page.url())) {
    console.log('[flota]   sesión perdida, re-login…');
    await loginViaAPI(page.context());
    await page.goto(`${BASE_URL}${s.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }
  await ensureTenant(page);
  await page.waitForTimeout(s.wait ?? 2600);

  if (s.firstLink) {
    const href = await page.locator(s.firstLink).first().getAttribute('href').catch(() => null);
    if (href && /^\/flota-360\//.test(href)) {
      await page.goto(`${BASE_URL}${href}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);
    } else {
      console.warn(`[flota]   [warn] sin link "${s.firstLink}" — capturo lista`);
    }
  }

  if (s.vehicleDetail) {
    const findCard = () => page.waitForFunction(() => {
      const l = [...document.querySelectorAll('a[href^="/flota-360/vehiculos/"]')]
        .find((a) => /vehiculos\/[0-9a-fA-F-]{8,}/.test(a.getAttribute('href') || ''));
      return l ? l.getAttribute('href') : false;
    }, { timeout: 30000 }).then((h) => h.jsonValue()).catch(() => null);
    let href = await findCard();
    if (!href) {
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(2500);
      href = await findCard();
    }
    if (href) {
      console.log(`[flota]   ficha -> ${href}`);
      await page.goto(`${BASE_URL}${href}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
    } else console.warn('[flota]   [warn] sin tarjetas de vehículo — capturo lista');
  }

  if (s.waitFor) {
    await page.waitForSelector(s.waitFor, { timeout: 25000 }).catch(() => console.warn(`[flota]   [warn] waitFor "${s.waitFor}" no apareció`));
    await page.waitForTimeout(800);
  }
  if (s.scrollTo) {
    await page.locator(s.scrollTo).first().scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(600);
  }
  if (s.click) {
    const patterns = [
      `button:has-text("${s.click}"):visible`,
      `a:has-text("${s.click}"):visible`,
      `[role="tab"]:has-text("${s.click}"):visible`,
    ];
    let clicked = false;
    for (const sel of patterns) {
      const loc = page.locator(sel).first();
      if (await loc.count() > 0) { await loc.click({ timeout: 5000 }).catch(() => {}); clicked = true; break; }
    }
    if (!clicked) console.warn(`[flota]   [warn] no se encontró "${s.click}"`);
    await page.waitForTimeout(1800);
  }
  if (s.openModal) {
    let opened = false;
    for (const label of s.openModal) {
      for (const tag of ['button', 'a']) {
        const loc = page.locator(`${tag}:has-text("${label}"):visible`).first();
        if (await loc.count() > 0) {
          await loc.click({ timeout: 4000 }).catch(() => {});
          await page.waitForTimeout(1200);
          const modal = page.locator('[role="dialog"], .fixed.inset-0, .modal').first();
          if (await modal.count() > 0) { opened = true; break; }
        }
      }
      if (opened) break;
    }
    if (!opened) console.warn(`[flota]   [warn] no pude abrir modal (${s.openModal.join('/')}) — capturo la página`);
    await page.waitForTimeout(600);
  }

  await page.screenshot({ path: outFile, fullPage: false });
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // ─────────────────── DESKTOP: backoffice Flota 360 ───────────────────
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await loginViaAPI(ctx);
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 40000 }).catch(() => {});
  await ensureTenant(page);
  await page.waitForTimeout(2500);

  let ok = 0, fail = 0;
  const desktop = ONLY.length ? SHOTS_DESKTOP.filter(s => ONLY.some(p => s.file.startsWith(p))) : SHOTS_DESKTOP;
  for (const s of desktop) {
    const outFile = path.join(OUT_DIR, s.file);
    try {
      console.log(`[flota] ${s.file} -> ${s.path}`);
      await shot(page, s, outFile, { checkSession: true });
      console.log(`[flota]   ✓ ${s.file}`);
      ok++;
    } catch (err) {
      console.warn(`[flota]   ✗ ${s.file}: ${err.message}`);
      fail++;
    }
  }
  await ctx.close();

  // ─────────────────── MOBILE: hub del chofer + QR públicos ───────────────────
  const mctx = await browser.newContext({
    ...devices['iPhone 14 Pro'],
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  });
  const mp = await mctx.newPage();
  for (const s of SHOTS_MOBILE) {
    if (ONLY.length && !ONLY.some(p => s.file.startsWith(p))) continue;
    const outFile = path.join(OUT_DIR, s.file);
    try {
      console.log(`[flota-m] ${s.file} -> ${s.path}`);
      await mp.goto(`${BASE_URL}${s.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await mp.waitForTimeout(3000);

      if (s.clickHub) {
        const btn = mp.locator(`button:has-text("${s.clickHub}"), a:has-text("${s.clickHub}")`).first();
        if (await btn.count() > 0) {
          if (s.followHref) {
            const href = await btn.getAttribute('href');
            if (href) await mp.goto(`${BASE_URL}${href}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
          } else {
            await btn.click({ timeout: 5000 }).catch(() => {});
          }
          await mp.waitForTimeout(1500);
        } else console.warn(`[flota-m]   [warn] no se encontró "${s.clickHub}"`);
      }
      // En servicio: seleccionar el primer chofer para que aparezca el campo PIN
      if (s.selectChofer) {
        const sel = mp.locator('select').first();
        if (await sel.count() > 0) {
          const opts = await sel.locator('option').allTextContents();
          const idx = opts.findIndex(o => o.trim() && !o.includes('¿Quién'));
          if (idx > 0) { await sel.selectOption({ index: idx }); await mp.waitForTimeout(1200); }
        }
      }
      await mp.screenshot({ path: outFile, fullPage: false });
      console.log(`[flota-m]   ✓ ${s.file}`);
      ok++;
    } catch (err) {
      console.warn(`[flota-m]   ✗ ${s.file}: ${err.message}`);
      fail++;
    }
  }
  await mctx.close();
  await browser.close();
  console.log(`\n[flota] Listo. OK=${ok} FALLOS=${fail}\nCarpeta: ${OUT_DIR}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
