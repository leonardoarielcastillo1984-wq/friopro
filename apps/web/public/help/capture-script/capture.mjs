#!/usr/bin/env node
/**
 * Script automático para capturar screenshots del Centro de Ayuda SGI 360
 * Reescrito desde cero para mayor robustez.
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync, statSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = 'http://46.62.253.81:4000';
const EMAIL = 'admin@sgi360.com';
const PASSWORD = 'Admin123!';
const OUTPUT_DIR = join(__dirname, '..');

const routes = [
  { id: 'inicio',            path: '/dashboard',            label: 'Dashboard principal' },
  { id: 'panel',             path: '/panel',                label: 'Panel General' },
  { id: 'documentos',        path: '/documents',            label: 'Listado documentos' },
  { id: 'normativos',        path: '/normativos',           label: 'Listado normativos' },
  { id: 'audit-ia',          path: '/audit',                label: 'Auditoría IA' },
  { id: 'auditorias-iso',    path: '/auditorias',           label: 'Auditorías ISO' },
  { id: 'no-conformidades',  path: '/no-conformidades',     label: 'No Conformidades' },
  { id: 'riesgos',           path: '/riesgos',              label: 'Matriz de riesgos' },
  { id: 'indicadores',       path: '/indicadores',          label: 'Indicadores' },
  { id: 'capacitaciones',    path: '/capacitaciones',       label: 'Capacitaciones' },
  { id: 'rrhh',              path: '/rrhh',                 label: 'RRHH' },
  { id: 'clientes',          path: '/clientes',             label: 'Clientes' },
  { id: 'licencias',         path: '/licencias',            label: 'Licencias' },
  { id: 'notificaciones',    path: '/notificaciones',       label: 'Notificaciones' },
  { id: 'configuracion',     path: '/configuracion',        label: 'Configuración' },
  { id: 'integraciones',     path: '/integraciones',        label: 'Integraciones' },
  { id: 'mantenimiento',     path: '/mantenimiento',        label: 'Mantenimiento' },
  { id: 'simulacros',        path: '/simulacros',           label: 'Simulacros' },
  { id: 'activos',           path: '/activos',              label: 'Activos' },
  { id: 'incidentes',        path: '/incidentes',           label: 'Incidentes' },
  { id: 'calidad',           path: '/calidad',              label: 'Calidad' },
  { id: 'ambientales',       path: '/ambientales',          label: 'Ambientales' },
  { id: 'contexto',          path: '/contexto',             label: 'Contexto' },
  { id: 'partes-interesadas',path: '/partes-interesadas',   label: 'Partes Interesadas' },
  { id: 'reportes',          path: '/reportes',             label: 'Reportes' },
  { id: 'planes',            path: '/planes',               label: 'Planes' },
  { id: 'objetivos',         path: '/objetivos',            label: 'Objetivos' },
  { id: 'empresa',           path: '/configuracion/empresa',  label: 'Empresa' },
  { id: 'cumplimiento',      path: '/cumplimiento',         label: 'Cumplimiento' },
  { id: 'gestion-cambios',   path: '/gestion-cambios',      label: 'Gestión Cambios' },
  { id: 'encuestas',         path: '/encuestas',            label: 'Encuestas' },
  { id: 'calendario',        path: '/calendario',           label: 'Calendario' },
  { id: 'infraestructura',   path: '/infraestructura',      label: 'Infraestructura' },
  { id: 'iperc',             path: '/iperc',                label: 'IPERC' },
  { id: 'legales',           path: '/legales',              label: 'Legales' },
  { id: 'calibraciones',     path: '/calibraciones',        label: 'Calibraciones' },
  { id: 'acciones',          path: '/acciones',             label: 'Acciones' },
  { id: 'auditoria',         path: '/auditoria',            label: 'Auditoría' },
  { id: 'audit360',          path: '/audit360',             label: 'Audit360' },
  { id: 'contexto-sgi',      path: '/contexto-sgi',         label: 'Contexto SGI' },
  { id: 'dashboard-simple',  path: '/dashboard-simple',     label: 'Dashboard Simple' },
  { id: 'proveedores',       path: '/proveedores',          label: 'Proveedores' },
  { id: 'revision-direccion',path: '/revision-direccion',   label: 'Revisión Dirección' },
  { id: 'seguridad360',      path: '/seguridad360',         label: 'Seguridad 360' },
  { id: 'project360',        path: '/project360',           label: 'Proyectos' },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function screenshot(page, fileName) {
  const path = join(OUTPUT_DIR, fileName);
  await page.screenshot({ path, fullPage: false });
  return path;
}

async function doLogin(page) {
  console.log('🔐 Login...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);

  await screenshot(page, '_debug-login.png');

  // Probar múltiples selectores
  const emailSelectors = [
    'input[type="email"]',
    'input[name="email"]',
    'input[placeholder*="mail" i]',
    'input[name="username"]',
    'input[placeholder*="usuario" i]',
    'input[placeholder*="correo" i]',
  ];
  const passSelectors = [
    'input[type="password"]',
    'input[name="password"]',
    'input[placeholder*="contraseña" i]',
    'input[placeholder*="pass" i]',
  ];

  let emailInput = null;
  let passInput = null;

  for (const sel of emailSelectors) {
    const el = await page.$(sel);
    if (el) { emailInput = el; break; }
  }
  for (const sel of passSelectors) {
    const el = await page.$(sel);
    if (el) { passInput = el; break; }
  }

  if (!emailInput || !passInput) {
    console.log('  No se encontró formulario de login. Listando todos los inputs...');
    const allInputs = await page.$$('input');
    for (const inp of allInputs) {
      const type = await inp.getAttribute('type');
      const name = await inp.getAttribute('name');
      const placeholder = await inp.getAttribute('placeholder');
      console.log(`    Input: type=${type} name=${name} placeholder=${placeholder}`);
    }
    throw new Error('Formulario de login no encontrado');
  }

  console.log('  📝 Completando credenciales...');
  await emailInput.fill(EMAIL);
  await passInput.fill(PASSWORD);

  const submitBtn = await page.$('button[type="submit"]');
  if (submitBtn) {
    await submitBtn.click();
  } else {
    await passInput.press('Enter');
  }

  console.log('  ⏳ Esperando redirección...');
  await sleep(5000);

  // Si hay pantalla de selección de tenant
  const tenantBtn = await page.$('[data-testid="tenant-card"], .tenant-card, button');
  const url = page.url();
  if (tenantBtn && (url.includes('tenant') || url.includes('select'))) {
    console.log('  🏢 Seleccionando tenant...');
    await tenantBtn.click();
    await sleep(3000);
  }

  console.log(`  ✅ Login completado (URL: ${page.url()})`);
}

async function capture(page, route) {
  const fileName = `${route.id}-1.png`;
  try {
    console.log(`📸 ${route.label} → ${fileName}`);
    await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(4000);

    const currentUrl = page.url();
    console.log(`   URL actual: ${currentUrl}`);

    // Si terminamos en /login, la sesión expiró
    if (currentUrl.includes('/login')) {
      console.log('   ⚠️ Redireccionado a login, reintentando login...');
      await doLogin(page);
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(4000);
    }

    // Scroll al inicio
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(500);

    const path = await screenshot(page, fileName);
    const fs = await import('fs');
    const stats = fs.statSync(path);
    console.log(`   ✅ Guardado: ${path} (${(stats.size / 1024).toFixed(0)}KB)`);
    return { ok: true, size: stats.size };
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

async function main() {
  console.log('🚀 Captura automática SGI 360 Centro de Ayuda');
  console.log(`   Total módulos: ${routes.length}`);
  console.log('');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await doLogin(page);

  const results = [];
  for (const route of routes) {
    const result = await capture(page, route);
    results.push({ ...route, ...result });
    // Pequeña pausa entre capturas para no saturar
    await sleep(500);
  }

  await browser.close();

  // Resumen
  const okCount = results.filter(r => r.ok).length;
  const failCount = results.filter(r => !r.ok).length;

  console.log('');
  console.log('📊 RESUMEN');
  console.log(`   Éxitos: ${okCount}/${routes.length}`);
  console.log(`   Fallos: ${failCount}/${routes.length}`);
  console.log('');

  // Verificar que las imágenes no sean todas iguales
  const sizes = results.filter(r => r.ok).map(r => r.size);
  const uniqueSizes = new Set(sizes);
  if (uniqueSizes.size === 1 && sizes.length > 1) {
    console.log('⚠️ ADVERTENCIA: Todas las imágenes tienen el mismo tamaño.');
    console.log('   Probablemente se capturó la misma pantalla repetidamente.');
  } else if (uniqueSizes.size > 1) {
    console.log(`✅ Las imágenes tienen ${uniqueSizes.size} tamaños distintos. Parece correcto.`);
  }

  if (failCount > 0) {
    console.log('');
    console.log('❌ Módulos con error:');
    for (const r of results.filter(r => !r.ok)) {
      console.log(`   - ${r.label}: ${r.error}`);
    }
  }
}

main().catch(err => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
});
