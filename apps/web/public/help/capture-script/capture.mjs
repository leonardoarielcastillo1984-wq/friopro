#!/usr/bin/env node
/**
 * Script automático para capturar screenshots del Centro de Ayuda SGI 360
 *
 * Uso:
 *   cd capture-script
 *   npm install
 *   npm run capture
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── CONFIG ───
const BASE_URL = 'http://46.62.253.81:4000';
const EMAIL = 'admin@sgi360.com';
const PASSWORD = 'Admin123!';
const OUTPUT_DIR = join(__dirname, '..'); // va a /public/help/

const VIEWPORT = { width: 1440, height: 900 };
const HEADLESS = true; // cambiar a false para ver el navegador

// ─── RUTAS A CAPTURAR ───
const routes = [
  { id: 'inicio',    path: '/dashboard',         label: 'Dashboard principal' },
  { id: 'panel',     path: '/panel',             label: 'Panel General' },
  { id: 'documentos',path: '/documents',         label: 'Listado documentos' },
  { id: 'normativos',path: '/normativos',        label: 'Listado normativos' },
  { id: 'audit-ia',  path: '/audit',             label: 'Auditoría IA' },
  { id: 'auditorias-iso', path: '/auditorias',   label: 'Auditorías ISO' },
  { id: 'no-conformidades', path: '/no-conformidades', label: 'No Conformidades' },
  { id: 'riesgos',   path: '/riesgos',           label: 'Matriz de riesgos' },
  { id: 'indicadores', path: '/indicadores',     label: 'Indicadores' },
  { id: 'capacitaciones', path: '/capacitaciones', label: 'Capacitaciones' },
  { id: 'rrhh',      path: '/rrhh',              label: 'RRHH' },
  { id: 'clientes',  path: '/clientes',          label: 'Clientes' },
  { id: 'licencias', path: '/licencias',         label: 'Licencias' },
  { id: 'notificaciones', path: '/notificaciones', label: 'Notificaciones' },
  { id: 'configuracion', path: '/configuracion', label: 'Configuración' },
  { id: 'integraciones', path: '/integraciones', label: 'Integraciones' },
  { id: 'mantenimiento', path: '/mantenimiento', label: 'Mantenimiento' },
  { id: 'simulacros', path: '/simulacros',       label: 'Simulacros' },
  { id: 'activos',   path: '/activos',           label: 'Activos' },
  { id: 'incidentes', path: '/incidentes',        label: 'Incidentes' },
  { id: 'calidad',   path: '/calidad',           label: 'Calidad' },
  { id: 'ambientales', path: '/ambientales',       label: 'Ambientales' },
  { id: 'contexto',  path: '/contexto',          label: 'Contexto' },
  { id: 'partes-interesadas', path: '/partes-interesadas', label: 'Partes Interesadas' },
  { id: 'reportes',  path: '/reportes',          label: 'Reportes' },
  { id: 'planes',    path: '/planes',            label: 'Planes' },
  { id: 'objetivos', path: '/objetivos',         label: 'Objetivos' },
  { id: 'empresa',   path: '/configuracion/empresa', label: 'Empresa' },
  { id: 'cumplimiento', path: '/cumplimiento',   label: 'Cumplimiento' },
  { id: 'gestion-cambios', path: '/gestion-cambios', label: 'Gestión Cambios' },
  { id: 'encuestas', path: '/encuestas',         label: 'Encuestas' },
  { id: 'calendario', path: '/calendario',        label: 'Calendario' },
  { id: 'infraestructura', path: '/infraestructura', label: 'Infraestructura' },
  { id: 'iperc',     path: '/iperc',             label: 'IPERC' },
  { id: 'legales',   path: '/legales',           label: 'Legales' },
  { id: 'calibraciones', path: '/calibraciones', label: 'Calibraciones' },
  { id: 'acciones',  path: '/acciones',          label: 'Acciones' },
  { id: 'auditoria', path: '/auditoria',         label: 'Auditoría' },
  { id: 'audit360',  path: '/audit360',          label: 'Audit360' },
  { id: 'contexto-sgi', path: '/contexto-sgi',   label: 'Contexto SGI' },
  { id: 'dashboard-simple', path: '/dashboard-simple', label: 'Dashboard Simple' },
  { id: 'proveedores', path: '/proveedores',     label: 'Proveedores' },
  { id: 'revision-direccion', path: '/revision-direccion', label: 'Revisión Dirección' },
  { id: 'seguridad360', path: '/seguridad360',   label: 'Seguridad 360' },
  { id: 'project360', path: '/project360',       label: 'PROJECT360' },
];

async function login(page) {
  console.log('🔐 Login...');
  await page.goto(`${BASE_URL}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  // Tomar screenshot de diagnóstico inicial
  const diagPath = join(OUTPUT_DIR, '_login-diagnostico.png');
  await page.screenshot({ path: diagPath, fullPage: false });
  console.log(`  📸 Diagnóstico guardado: _login-diagnostico.png`);

  // Buscar inputs de email/password
  const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="mail" i], input[placeholder*="usuario" i], input[placeholder*="user" i]');
  const passInput  = await page.$('input[type="password"], input[name="password"], input[placeholder*="contraseña" i], input[placeholder*="pass" i]');

  if (!emailInput || !passInput) {
    console.log('  ⚠️ No se encontraron inputs de login estándar, buscando inputs genéricos...');
    const inputs = await page.$$('input');
    console.log(`  Encontrados ${inputs.length} inputs en la página`);
    if (inputs.length >= 2) {
      await inputs[0].fill(EMAIL);
      await inputs[1].fill(PASSWORD);
      const btn = await page.$('button[type="submit"], button:has-text("Iniciar"), button:has-text("Entrar"), button:has-text("Login"), button:has-text("Acceder")');
      if (btn) await btn.click();
    } else {
      console.log('  ❌ No se encontró formulario de login. La sesión podría estar ya iniciada o la URL es diferente.');
    }
  } else {
    await emailInput.fill(EMAIL);
    await passInput.fill(PASSWORD);
    const btn = await page.$('button[type="submit"], button:has-text("Iniciar"), button:has-text("Entrar"), button:has-text("Login"), button:has-text("Acceder")');
    if (btn) await btn.click();
  }

  await page.waitForTimeout(5000);

  // Si aparece selección de tenant, clickear el primero
  const tenantCards = await page.$$('[data-testid="tenant-card"], .tenant-card, [role="button"]');
  if (tenantCards.length > 0) {
    console.log('  Seleccionando tenant...');
    await tenantCards[0].click();
    await page.waitForTimeout(3000);
  }

  // Si hay onboarding / welcome, cerrarlo
  const closeOnboarding = await page.$('text="Saltar" , text="Omitir" , text="Cerrar" , button:has-text("Saltar") , button:has-text("Omitir")');
  if (closeOnboarding) {
    await closeOnboarding.click();
    await page.waitForTimeout(1000);
  }

  console.log('  ✅ Logueado');
}

async function capture(page, route) {
  const url = `${BASE_URL}${route.path}`;
  const fileName = `${route.id}-1.png`;
  const filePath = join(OUTPUT_DIR, fileName);

  try {
    console.log(`📸 ${route.label} → ${fileName}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500); // esperar que carguen datos

    // Scroll al inicio
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    await page.screenshot({ path: filePath, fullPage: false });
    console.log(`   ✅ Guardado: ${filePath}`);
    return true;
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Iniciando captura automática de screenshots...');
  console.log(`   URL base: ${BASE_URL}`);
  console.log(`   Salida:   ${OUTPUT_DIR}`);
  console.log(`   Total:    ${routes.length} módulos`);
  console.log('');

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  await login(page);

  let ok = 0;
  let fail = 0;

  for (const route of routes) {
    const success = await capture(page, route);
    if (success) ok++; else fail++;
  }

  await browser.close();

  console.log('');
  console.log('✅ Captura finalizada');
  console.log(`   Éxitos: ${ok}/${routes.length}`);
  console.log(`   Fallos: ${fail}/${routes.length}`);
  console.log('');
  console.log('📂 Las imágenes están en:');
  console.log(`   ${OUTPUT_DIR}`);
  console.log('');
  console.log('🔁 Para verlas en el Centro de Ayuda:');
  console.log('   1. Redeploy del contenedor web (las imágenes van empaquetadas en el build)');
  console.log('   2. O montar /public/help como volumen en docker-compose');
}

main().catch(err => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
});
