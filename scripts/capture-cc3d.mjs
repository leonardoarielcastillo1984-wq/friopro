#!/usr/bin/env node
/**
 * Captura del Centro de Control 3D (harness /cc3d-preview) para verificar
 * el escenario DADA y el genérico. Solo lectura — no toca datos.
 *
 * Uso:
 *   CC3D_BASE=http://localhost:3100 node scripts/capture-cc3d.mjs
 *
 * Env:
 *   CC3D_BASE  (default http://localhost:3100)
 *   CC3D_OUT   (default ~/Desktop/CC3D-CAPTURAS)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const BASE = process.env.CC3D_BASE || 'http://localhost:3100';
const OUT = process.env.CC3D_OUT || path.join(os.homedir(), 'Desktop', 'CC3D-CAPTURAS');
fs.mkdirSync(OUT, { recursive: true });

const SHOTS = [
  { file: '10-dada-general.png', url: '/cc3d-preview?yard=dada', wait: 9000 },
  { file: '11-dada-garita.png', url: '/cc3d-preview?yard=dada', click: 'button:has-text("Garita")' },
  { file: '12-dada-taller.png', url: '/cc3d-preview?yard=dada', click: 'button:has-text("Taller")' },
  { file: '13-dada-estacionamiento.png', url: '/cc3d-preview?yard=dada', click: 'button:has-text("Estacionamiento")' },
  { file: '14-dada-livianos.png', url: '/cc3d-preview?yard=dada', click: 'button:has-text("Vehículos livianos")' },
  { file: '15-dada-fuera-servicio.png', url: '/cc3d-preview?yard=dada', click: 'button:has-text("Fuera de servicio")' },
  { file: '16-dada-noche.png', url: '/cc3d-preview?yard=dada', click: 'button[aria-label="Iluminación Noche"]' },
  { file: '17-dada-lluvia.png', url: '/cc3d-preview?yard=dada', clicks: ['button[aria-label="Iluminación Día"]', 'button[aria-label="Clima Lluvia"]'] },
  { file: '18-dada-expansion.png', url: '/cc3d-preview?yard=dada', click: '.cc3-cluster' },
  { file: '20-generic-general.png', url: '/cc3d-preview?yard=generic' },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();

  for (const s of SHOTS) {
    const outFile = path.join(OUT, s.file);
    try {
      console.log(`[cc3d] ${s.file} -> ${s.url}`);
      await page.goto(`${BASE}${s.url}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      // esperar a que termine el loader de modelos GLB
      await page.waitForSelector('.cc3-loading', { state: 'detached', timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(s.wait ?? 2500);
      const clicks = s.clicks ?? (s.click ? [s.click] : []);
      for (const sel of clicks) {
        const loc = page.locator(sel).first();
        if (await loc.count() > 0) {
          await loc.dispatchEvent('click').catch(() => {});
          console.log(`[cc3d]   click ${sel}`);
        } else console.warn(`[cc3d]   [warn] no se encontró ${sel}`);
        await page.waitForTimeout(2200);
      }
      await page.screenshot({ path: outFile, fullPage: false });
      console.log(`[cc3d]   ✓ ${s.file}`);
    } catch (err) {
      console.warn(`[cc3d]   ✗ ${s.file}: ${err.message}`);
    }
  }
  await browser.close();
  console.log(`\n[cc3d] Listo. Carpeta: ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
