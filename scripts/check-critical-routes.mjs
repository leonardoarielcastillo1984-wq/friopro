#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────
// Guarda de rutas críticas del sidebar de SGI360.
//
// Previene regresiones recurrentes donde el item "Proyectos" (u otros)
// del sidebar apunta a la ruta equivocada (ej: /project360, el producto
// STANDALONE independiente, en lugar de /proyectos, el módulo INTERNO).
//
// Uso:
//   node scripts/check-critical-routes.mjs
//
// Sale con código 1 (y mensaje claro) si alguna ruta crítica está mal,
// para que pueda cortar un build/deploy. Sale 0 si todo está OK.
// ──────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const SIDEBAR_PATH = resolve(
  repoRoot,
  'apps/web/src/components/layout/Sidebar.tsx',
);

// label esperado en el sidebar  →  href correcto que DEBE tener
// + hrefs prohibidos que NO debe tener (regresiones conocidas)
const EXPECTED_ROUTES = [
  {
    label: 'Proyectos',
    mustBe: '/proyectos',
    mustNotBe: ['/project360', '/project360/projects'],
    why: '/proyectos es el módulo INTERNO de SGI. /project360 es el producto STANDALONE PROYECT360 que redirige a /proyect360-landing.',
  },
];

function fail(msg) {
  console.error(`\n❌ CHECK DE RUTAS CRÍTICAS FALLÓ\n${msg}\n`);
  process.exit(1);
}

let source;
try {
  source = readFileSync(SIDEBAR_PATH, 'utf8');
} catch (err) {
  fail(`No se pudo leer ${SIDEBAR_PATH}: ${err.message}`);
}

const problems = [];

for (const route of EXPECTED_ROUTES) {
  // Match flexible del objeto del nav que contiene el label.
  // Soporta orden { label, icon, href } y comillas simples/dobles.
  const labelRe = new RegExp(
    `label:\\s*['"]${route.label}['"][^}]*?href:\\s*['"]([^'"]+)['"]`,
  );
  const m = source.match(labelRe);

  if (!m) {
    problems.push(
      `• No se encontró el item "${route.label}" con un href en Sidebar.tsx. ` +
        `¿Se renombró o se quitó? Revisá mainNav.`,
    );
    continue;
  }

  const actual = m[1];

  if (route.mustNotBe.includes(actual)) {
    problems.push(
      `• "${route.label}" apunta a "${actual}" — RUTA PROHIBIDA.\n` +
        `    Debe ser "${route.mustBe}".\n` +
        `    Motivo: ${route.why}`,
    );
  } else if (actual !== route.mustBe) {
    problems.push(
      `• "${route.label}" apunta a "${actual}" pero se esperaba "${route.mustBe}".\n` +
        `    Motivo: ${route.why}`,
    );
  }
}

if (problems.length > 0) {
  fail(problems.join('\n'));
}

console.log('✅ Rutas críticas del sidebar OK:');
for (const route of EXPECTED_ROUTES) {
  console.log(`   • ${route.label} → ${route.mustBe}`);
}
process.exit(0);
