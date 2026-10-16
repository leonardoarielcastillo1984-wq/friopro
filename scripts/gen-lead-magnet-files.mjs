// Genera los .xlsx de lead magnets en apps/web/public/descargas/
// Correr: node scripts/gen-lead-magnet-files.mjs   (desde la raíz del repo)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
// xlsx vive en apps/api (usado por ausencias/finanzas)
const XLSX = require(path.resolve('apps/api/node_modules/xlsx'));

const OUT = path.resolve('apps/web/public/descargas');
fs.mkdirSync(OUT, { recursive: true });

const write = (name, sheets) => {
  const wb = XLSX.utils.book_new();
  for (const [title, rows] of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = rows[0].map((h, i) => ({ wch: Math.max(String(h).length + 2, ...rows.slice(1).map(r => String(r[i] ?? '').length).map(l => Math.min(l + 2, 60))) }));
    XLSX.utils.book_append_sheet(wb, ws, title);
  }
  XLSX.writeFile(wb, path.join(OUT, name));
  console.log('✓', name);
};

// ── 1. Matriz IPERC ──
write('plantilla-matriz-iperc.xlsx', [
  ['IPERC', [
    ['MATRIZ IPERC — Identificación de Peligros, Evaluación de Riesgos y Controles'],
    ['Empresa:', '', 'Área/Proceso:', '', 'Fecha:', '', 'Responsable:', ''],
    [],
    ['N°', 'Proceso/Tarea', 'Peligro identificado', 'Tipo de peligro', 'Personas expuestas', 'Probabilidad (1-5)', 'Impacto/Severidad (1-5)', 'Nivel de riesgo (PxI)', 'Controles existentes', '¿Control suficiente? (S/N)', 'Plan de acción', 'Responsable', 'Fecha límite', 'Prob. post-control', 'Imp. post-control', 'Nivel residual'],
    [1, 'Ej: Carga y descarga de mercadería', 'Golpe por autoelevador', 'Mecánico', 'Operarios de depósito', 3, 4, '=F5*G5', 'Delimitación de zonas peatonales, chaleco reflectivo', 'N', 'Instalar barreras físicas y semáforo de cruce', 'Resp. SSOMA', '', 1, 4, '=M5*N5'],
    [2, 'Ej: Mantenimiento eléctrico', 'Contacto con partes energizadas', 'Eléctrico', 'Técnicos', 2, 5, '=F6*G6', 'Bloqueo y etiquetado (LOTO)', 'S', '', 'Resp. Mantenimiento', '', 1, 5, '=M6*N6'],
    [3, 'Ej: Trabajo en mostrador', 'Trastorno musculoesquelético', 'Ergonómico', 'Personal administrativo', 4, 2, '=F7*G7', 'Pausas activas cada 2h', 'N', 'Evaluación ergonómica de puestos', 'Resp. RRHH', '', 2, 2, '=M7*N7'],
    [],
    ['Escala de nivel de riesgo:  1-4 Bajo (aceptable) · 5-9 Moderado (controlar) · 10-14 Alto (acción requerida) · 15-25 Crítico (acción inmediata)'],
  ]],
  ['Guía', [
    ['CÓMO USAR LA PLANTILLA'],
    [],
    ['1. Listá los procesos o tareas del área a evaluar.'],
    ['2. Para cada tarea identificá los peligros (mecánico, eléctrico, ergonómico, químico, biológico, físico, psicosocial).'],
    ['3. Evaluá probabilidad (1=raro … 5=casi seguro) e impacto (1=leve … 5=catastrófico).'],
    ['4. Nivel = P×I se calcula solo. Priorizá acciones en riesgos Altos y Críticos.'],
    ['5. Documentá controles existentes; si no son suficientes, definí plan de acción con responsable y fecha.'],
    ['6. Re-evaluá después de implementar el control (columnas post-control) — es la evidencia de eficacia.'],
    [],
    ['TIP: en SGI360 esta matriz vive dentro del sistema con responsables, alertas y trazabilidad → logismart.ar'],
  ]],
]);

// ── 2. BIA ──
write('plantilla-bia.xlsx', [
  ['BIA', [
    ['BIA — Análisis de Impacto al Negocio (ISO 22301)'],
    ['Empresa:', '', 'Fecha:', '', 'Responsable:', ''],
    [],
    ['N°', 'Proceso', 'Responsable del proceso', 'Producto/Servicio afectado', 'Impacto financiero (1-5)', 'Impacto operativo (1-5)', 'Impacto legal/regulatorio (1-5)', 'Impacto reputacional (1-5)', 'Puntaje total', 'RTO (máx. tiempo de recuperación)', 'RPO (máx. pérdida de datos)', 'MTPD (máx. interrupción tolerable)', 'Dependencias críticas', 'Criticidad'],
    [1, 'Ej: Facturación y cobranza', 'Resp. Administración', 'Facturación a clientes', 4, 3, 4, 3, '=SUM(E5:H5)', '8 hs', '4 hs', '24 hs', 'Sistema ERP, internet', '=IF(I5>=16,"Crítico",IF(I5>=10,"Alto","Medio"))'],
    [2, 'Ej: Despacho de mercadería', 'Resp. Logística', 'Entregas a clientes', 4, 5, 2, 4, '=SUM(E6:H6)', '4 hs', '—', '48 hs', 'Depósito, flota, WMS', '=IF(I6>=16,"Crítico",IF(I6>=10,"Alto","Medio"))'],
    [3, 'Ej: Atención al cliente', 'Resp. Comercial', 'Soporte post-venta', 2, 3, 2, 4, '=SUM(E7:H7)', '24 hs', '—', '72 hs', 'CRM, telefonía', '=IF(I7>=16,"Crítico",IF(I7>=10,"Alto","Medio"))'],
    [],
    ['Escalas: impacto 1=despreciable … 5=severo · RTO=tiempo máx. para restablecer · RPO=pérdida de datos tolerable · MTPD=interrupción máx. antes de daño inaceptable'],
  ]],
  ['Guía', [
    ['CÓMO HACER EL BIA'],
    [],
    ['1. Listá los procesos del negocio (tomalos del mapa de procesos si lo tenés).'],
    ['2. Con el responsable de cada proceso, evaluá el impacto de una interrupción en 4 dimensiones (1-5).'],
    ['3. Definí RTO (cuánto tarda en volver a funcionar), RPO (cuántos datos podés perder) y MTPD (límite máximo tolerable).'],
    ['4. Anotá las dependencias: sistemas, personas clave, proveedores, infraestructura.'],
    ['5. Los procesos Críticos son la prioridad del plan de continuidad.'],
    [],
    ['TIP: en SGI360 el BIA alimenta los planes de continuidad y el mapa de procesos → logismart.ar'],
  ]],
]);

// ── 3. SoA ISO 27001:2022 — extraído de normClauseLibraries.ts (los 93 controles reales) ──
const lib = fs.readFileSync(path.resolve('apps/api/src/data/normClauseLibraries.ts'), 'utf-8');
const themes = { 'A.5': 'Organizacionales', 'A.6': 'Personas', 'A.7': 'Físicos', 'A.8': 'Tecnológicos' };
const re = /\{ number: '(A\.[5-8]\.\d+)', title: '([^']+)'/g;
const controls = [];
let m;
while ((m = re.exec(lib))) controls.push({ num: m[1], title: m[2], theme: themes[m[1].split('.').slice(0, 2).join('.')] });
if (controls.length !== 93) console.warn(`⚠ Esperaba 93 controles, extraje ${controls.length}`);

const soaRows = [
  ['DECLARACIÓN DE APLICABILIDAD (SoA) — ISO/IEC 27001:2022'],
  ['Organización:', '', 'Versión:', '', 'Fecha de aprobación:', '', 'Aprobada por:', ''],
  [],
  ['Control', 'Tema', 'Nombre del control', '¿Aplica? (SI/NO)', 'Justificación de inclusión/exclusión', 'Estado de implementación', 'Responsable', 'Documento/Evidencia vinculada', 'Fecha de revisión'],
  ...controls.map((c, i) => [c.num, c.theme, c.title, '', '', '', '', '', '']),
  [],
  ['Total controles: ' + controls.length, '', 'Aplicables: =CONTAR.SI(D:D;"SI")', '', 'Implementados:', '', '', '', ''],
];
write('soa-iso-27001.xlsx', [
  ['SoA — Anexo A', soaRows],
  ['Guía', [
    ['CÓMO USAR EL SoA'],
    [],
    ['1. Recorré los 93 controles y marcá SI/NO en "¿Aplica?".'],
    ['2. SI aplica: justificá por qué es necesario (riesgo, requisito legal, contrato).'],
    ['3. NO aplica: justificá la exclusión (ej: "no desarrollamos software" para A.8.25).'],
    ['4. Completá estado (No iniciado / En progreso / Implementado), responsable y evidencia.'],
    ['5. El SoA se aprueba por dirección y se revisa al menos anualmente o ante cambios.'],
    [],
    ['TIP: en SGI360 el SoA vive dentro del SGSI vinculado a documentos y evidencias → logismart.ar'],
  ]],
]);

console.log('Listo — archivos en', OUT);
