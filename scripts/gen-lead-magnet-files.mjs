// Genera los .xlsx de lead magnets en apps/web/public/descargas/ — con formato profesional (exceljs)
// Correr: node scripts/gen-lead-magnet-files.mjs   (desde la raíz del repo)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const ExcelJS = require(path.resolve('apps/api/node_modules/exceljs'));

const OUT = path.resolve('apps/web/public/descargas');
fs.mkdirSync(OUT, { recursive: true });

// ── Paleta corporativa ──
const C = {
  primary: 'FF166534',      // verde oscuro
  accent: 'FF1E40AF',       // azul
  purple: 'FF6D28D9',       // violeta
  headerText: 'FFFFFFFF',
  border: 'FFCBD5E1',
  label: 'FF475569',
  zebra: 'FFF8FAFC',
  riskBajo: 'FF86EFAC',
  riskMod: 'FFFDE047',
  riskAlto: 'FFFDBA74',
  riskCrit: 'FFFCA5A5',
};

const thin = { style: 'thin', color: { argb: C.border } };
const allBorders = { top: thin, left: thin, bottom: thin, right: thin };

const styleTitle = (ws, row, nCols, text, fill = C.primary) => {
  ws.mergeCells(row, 1, row, nCols);
  const c = ws.getCell(row, 1);
  c.value = text;
  c.font = { bold: true, size: 14, color: { argb: C.headerText } };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  c.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(row).height = 30;
};

const styleHeaderRow = (ws, row, nCols, fill = C.primary) => {
  for (let i = 1; i <= nCols; i++) {
    const c = ws.getCell(row, i);
    c.font = { bold: true, size: 10, color: { argb: C.headerText } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = allBorders;
  }
  ws.getRow(row).height = 34;
};

const styleDataRow = (ws, row, nCols, zebra) => {
  for (let i = 1; i <= nCols; i++) {
    const c = ws.getCell(row, i);
    c.font = { size: 10 };
    c.alignment = { vertical: 'middle', wrapText: true };
    c.border = allBorders;
    if (zebra) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.zebra } };
  }
  ws.getRow(row).height = 28;
};

const styleEmptyRows = (ws, startRow, count, nCols) => {
  for (let r = startRow; r < startRow + count; r++) {
    for (let i = 1; i <= nCols; i++) {
      const c = ws.getCell(r, i);
      c.border = allBorders;
      c.font = { size: 10 };
      c.alignment = { vertical: 'middle', wrapText: true };
    }
    ws.getRow(r).height = 22;
  }
};

const riskFill = (level) =>
  level >= 15 ? C.riskCrit : level >= 10 ? C.riskAlto : level >= 5 ? C.riskMod : C.riskBajo;

const fieldRow = (ws, row, fields) => {
  fields.forEach(([col, label, span = 1]) => {
    const lc = ws.getCell(row, col);
    lc.value = label;
    lc.font = { bold: true, size: 10, color: { argb: C.label } };
    for (let i = col + 1; i <= col + span; i++) {
      ws.getCell(row, i).border = { bottom: { style: 'medium', color: { argb: C.primary } } };
    }
  });
  ws.getRow(row).height = 22;
};

const guideSheet = async (wb, title, lines) => {
  const ws = wb.addWorksheet('Guía');
  ws.columns = [{ width: 110 }];
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { bold: true, size: 13, color: { argb: C.headerText } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.primary } };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;
  lines.forEach((line, i) => {
    const c = ws.getCell(i + 3, 1);
    c.value = line;
    c.font = { size: 11, bold: line.startsWith('TIP'), color: line.startsWith('TIP') ? { argb: C.primary } : undefined };
    c.alignment = { wrapText: true, vertical: 'top' };
  });
};

// ══════════════════════════════════════════════════════════════════
// 1. MATRIZ IPERC
// ══════════════════════════════════════════════════════════════════
async function genIPERC() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SGI360 — LOGISMART';
  const ws = wb.addWorksheet('IPERC');

  const headers = ['N°', 'Proceso / Tarea', 'Peligro identificado', 'Tipo de peligro', 'Personas expuestas',
    'Probabilidad (1-5)', 'Impacto / Severidad (1-5)', 'Nivel de riesgo (P×I)', 'Evaluación del riesgo',
    'Controles existentes', '¿Suficiente? (S/N)', 'Plan de acción', 'Responsable', 'Fecha límite',
    'Prob. post', 'Imp. post', 'Nivel residual'];
  ws.columns = [5, 26, 24, 14, 18, 11, 12, 11, 14, 30, 11, 26, 14, 12, 8, 8, 11].map(w => ({ width: w }));
  const N = headers.length;

  styleTitle(ws, 1, N, 'MATRIZ IPERC — Identificación de Peligros, Evaluación de Riesgos y Controles');
  fieldRow(ws, 2, [[1, 'Empresa:', 3], [5, 'Área / Proceso:', 4], [9, 'Fecha:', 3], [12, 'Responsable:', 4]]);
  ws.getRow(3).height = 6;

  const HR = 4;
  headers.forEach((h, i) => { ws.getCell(HR, i + 1).value = h; });
  styleHeaderRow(ws, HR, N);
  ws.views = [{ state: 'frozen', ySplit: HR }];

  const ejemplos = [
    [1, 'Carga y descarga de mercadería', 'Golpe por autoelevador', 'Mecánico', 'Operarios de depósito', 3, 4, null, null,
      'Delimitación de zonas peatonales, chaleco reflectivo', 'N', 'Instalar barreras físicas y semáforo de cruce', 'Resp. SSOMA', '', 1, 4, null],
    [2, 'Mantenimiento eléctrico', 'Contacto con partes energizadas', 'Eléctrico', 'Técnicos de mantenimiento', 2, 5, null, null,
      'Bloqueo y etiquetado (LOTO), guantes dieléctricos', 'S', '', 'Resp. Mantenimiento', '', 1, 5, null],
    [3, 'Trabajo administrativo en oficina', 'Trastorno musculoesquelético', 'Ergonómico', 'Personal administrativo', 4, 2, null, null,
      'Pausas activas cada 2 horas', 'N', 'Evaluación ergonómica de puestos de trabajo', 'Resp. RRHH', '', 2, 2, null],
  ];
  const evalLabel = (v) => v >= 15 ? 'CRÍTICO' : v >= 10 ? 'ALTO' : v >= 5 ? 'MODERADO' : 'BAJO';

  ejemplos.forEach((e, idx) => {
    const r = HR + 1 + idx;
    e.forEach((v, i) => { if (v !== null) ws.getCell(r, i + 1).value = v; });
    const lvl = e[5] * e[6];
    ws.getCell(r, 8).value = { formula: `F${r}*G${r}`, result: lvl };
    ws.getCell(r, 9).value = evalLabel(lvl);
    const lvlRes = e[14] * e[15];
    ws.getCell(r, 17).value = { formula: `O${r}*P${r}`, result: lvlRes };

    styleDataRow(ws, r, N, idx % 2 === 1);
    ws.getCell(r, 8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: riskFill(lvl) } };
    ws.getCell(r, 8).font = { bold: true, size: 10 };
    ws.getCell(r, 9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: riskFill(lvl) } };
    ws.getCell(r, 9).font = { bold: true, size: 10 };
    ws.getCell(r, 17).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: riskFill(lvlRes) } };
    ws.getCell(r, 17).font = { bold: true, size: 10 };
  });

  const EMPTY = 12;
  for (let i = 0; i < EMPTY; i++) {
    const r = HR + 4 + i;
    ws.getCell(r, 1).value = 4 + i;
    ws.getCell(r, 8).value = { formula: `IF(AND(F${r}<>"",G${r}<>""),F${r}*G${r},"")` };
    ws.getCell(r, 9).value = { formula: `IF(H${r}="","",IF(H${r}>=15,"CRÍTICO",IF(H${r}>=10,"ALTO",IF(H${r}>=5,"MODERADO","BAJO"))))` };
    ws.getCell(r, 17).value = { formula: `IF(AND(O${r}<>"",P${r}<>""),O${r}*P${r},"")` };
  }
  styleEmptyRows(ws, HR + 4, EMPTY, N);

  const legRow = HR + 4 + EMPTY + 1;
  ws.mergeCells(legRow, 1, legRow, N);
  ws.getCell(legRow, 1).value = 'Escala: 1-4 BAJO (aceptable) · 5-9 MODERADO (controlar) · 10-14 ALTO (acción requerida) · 15-25 CRÍTICO (acción inmediata)';
  ws.getCell(legRow, 1).font = { bold: true, size: 10, color: { argb: C.label } };
  ws.getCell(legRow, 1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  ws.getRow(legRow).height = 24;

  const noteRow = legRow + 1;
  ws.mergeCells(noteRow, 1, noteRow, N);
  ws.getCell(noteRow, 1).value = 'Las filas 5-7 son ejemplos — borralas y cargá tu matriz. El nivel de riesgo y la evaluación se calculan automáticamente.';
  ws.getCell(noteRow, 1).font = { size: 9, italic: true, color: { argb: 'FF94A3B8' } };
  ws.getCell(noteRow, 1).alignment = { horizontal: 'center' };

  await guideSheet(wb, 'CÓMO USAR LA MATRIZ IPERC', [
    '1. Listá los procesos o tareas del área a evaluar (columna B).',
    '2. Para cada tarea identificá los peligros (mecánico, eléctrico, ergonómico, químico, biológico, físico, psicosocial).',
    '3. Evaluá probabilidad (1 = raro … 5 = casi seguro) e impacto (1 = leve … 5 = catastrófico).',
    '4. El nivel de riesgo (P×I) y la evaluación se calculan automáticamente.',
    '5. Priorizá acciones en riesgos ALTOS y CRÍTICOS; documentá controles existentes.',
    '6. Si el control no es suficiente, definí plan de acción con responsable y fecha límite.',
    '7. Re-evaluá después de implementar el control (columnas post-control) — esa es la evidencia de eficacia para el auditor.',
    '',
    'TIP: en SGI360 esta matriz vive dentro del sistema con responsables, alertas de vencimiento y trazabilidad completa → logismart.ar',
  ]);

  await wb.xlsx.writeFile(path.join(OUT, 'plantilla-matriz-iperc.xlsx'));
  console.log('✓ plantilla-matriz-iperc.xlsx');
}

// ══════════════════════════════════════════════════════════════════
// 2. BIA — Análisis de Impacto al Negocio
// ══════════════════════════════════════════════════════════════════
async function genBIA() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SGI360 — LOGISMART';
  const ws = wb.addWorksheet('BIA');

  const headers = ['N°', 'Proceso', 'Responsable del proceso', 'Producto / Servicio afectado',
    'Impacto financiero (1-5)', 'Impacto operativo (1-5)', 'Impacto legal (1-5)', 'Impacto reputacional (1-5)',
    'Puntaje total', 'Criticidad', 'RTO — tiempo máx. recuperación', 'RPO — pérdida de datos tolerable',
    'MTPD — interrupción máx. tolerable', 'Dependencias críticas'];
  ws.columns = [5, 24, 18, 22, 11, 11, 10, 13, 10, 11, 15, 15, 15, 30].map(w => ({ width: w }));
  const N = headers.length;

  styleTitle(ws, 1, N, 'BIA — Análisis de Impacto al Negocio (ISO 22301)', C.accent);
  fieldRow(ws, 2, [[1, 'Empresa:', 3], [5, 'Fecha:', 3], [8, 'Responsable:', 4], [12, 'Período analizado:', 3]]);
  ws.getRow(3).height = 6;

  const HR = 4;
  headers.forEach((h, i) => { ws.getCell(HR, i + 1).value = h; });
  styleHeaderRow(ws, HR, N, C.accent);
  ws.views = [{ state: 'frozen', ySplit: HR }];

  const critFill = (score) => score >= 16 ? 'FFFCA5A5' : score >= 10 ? 'FFFDE047' : 'FF86EFAC';
  const critLabel = (score) => score >= 16 ? 'CRÍTICO' : score >= 10 ? 'ALTO' : 'MEDIO';

  const ejemplos = [
    [1, 'Facturación y cobranza', 'Resp. Administración', 'Facturación a clientes', 4, 3, 4, 3, null, null, '8 hs', '4 hs', '24 hs', 'Sistema ERP, conectividad a internet'],
    [2, 'Despacho de mercadería', 'Resp. Logística', 'Entregas a clientes', 4, 5, 2, 4, null, null, '4 hs', '—', '48 hs', 'Depósito, flota propia, WMS'],
    [3, 'Atención al cliente', 'Resp. Comercial', 'Soporte post-venta', 2, 3, 2, 4, null, null, '24 hs', '—', '72 hs', 'CRM, telefonía'],
  ];

  ejemplos.forEach((e, idx) => {
    const r = HR + 1 + idx;
    e.forEach((v, i) => { if (v !== null) ws.getCell(r, i + 1).value = v; });
    const score = e[4] + e[5] + e[6] + e[7];
    ws.getCell(r, 9).value = { formula: `SUM(E${r}:H${r})`, result: score };
    ws.getCell(r, 10).value = critLabel(score);
    styleDataRow(ws, r, N, idx % 2 === 1);
    ws.getCell(r, 9).font = { bold: true, size: 10 };
    ws.getCell(r, 10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: critFill(score) } };
    ws.getCell(r, 10).font = { bold: true, size: 10 };
    ws.getCell(r, 10).alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const EMPTY = 12;
  for (let i = 0; i < EMPTY; i++) {
    const r = HR + 4 + i;
    ws.getCell(r, 1).value = 4 + i;
    ws.getCell(r, 9).value = { formula: `IF(COUNT(E${r}:H${r})>0,SUM(E${r}:H${r}),"")` };
    ws.getCell(r, 10).value = { formula: `IF(I${r}="","",IF(I${r}>=16,"CRÍTICO",IF(I${r}>=10,"ALTO","MEDIO")))` };
  }
  styleEmptyRows(ws, HR + 4, EMPTY, N);

  const legRow = HR + 4 + EMPTY + 1;
  ws.mergeCells(legRow, 1, legRow, N);
  ws.getCell(legRow, 1).value = 'Escalas: impacto 1 = despreciable … 5 = severo · RTO = tiempo máx. para restablecer · RPO = pérdida de datos tolerable · MTPD = interrupción máx. antes de daño inaceptable';
  ws.getCell(legRow, 1).font = { bold: true, size: 10, color: { argb: C.label } };
  ws.getCell(legRow, 1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  ws.getRow(legRow).height = 26;

  const noteRow = legRow + 1;
  ws.mergeCells(noteRow, 1, noteRow, N);
  ws.getCell(noteRow, 1).value = 'Las filas 5-7 son ejemplos — borralas y cargá tu análisis. Puntaje y criticidad se calculan automáticamente.';
  ws.getCell(noteRow, 1).font = { size: 9, italic: true, color: { argb: 'FF94A3B8' } };
  ws.getCell(noteRow, 1).alignment = { horizontal: 'center' };

  await guideSheet(wb, 'CÓMO HACER EL BIA', [
    '1. Listá los procesos del negocio (tomalos del mapa de procesos si lo tenés).',
    '2. Con el responsable de cada proceso, evaluá el impacto de una interrupción en 4 dimensiones (1-5).',
    '3. El puntaje total y la criticidad se calculan automáticamente.',
    '4. Definí RTO (cuánto tarda en volver a funcionar), RPO (cuántos datos podés perder) y MTPD (límite tolerable).',
    '5. Anotá las dependencias: sistemas, personas clave, proveedores, infraestructura.',
    '6. Los procesos CRÍTICOS son la prioridad del plan de continuidad del negocio.',
    '',
    'TIP: en SGI360 el BIA alimenta los planes de continuidad y el mapa de procesos — cuando cambia un proceso, el análisis se actualiza solo → logismart.ar',
  ]);

  await wb.xlsx.writeFile(path.join(OUT, 'plantilla-bia.xlsx'));
  console.log('✓ plantilla-bia.xlsx');
}

// ══════════════════════════════════════════════════════════════════
// 3. SoA ISO 27001:2022 — Declaración de Aplicabilidad
// ══════════════════════════════════════════════════════════════════
async function genSoA() {
  const lib = fs.readFileSync(path.resolve('apps/api/src/data/normClauseLibraries.ts'), 'utf-8');
  const themes = { 'A.5': 'Organizacionales', 'A.6': 'Personas', 'A.7': 'Físicos', 'A.8': 'Tecnológicos' };
  const re = /\{ number: '(A\.[5-8]\.\d+)', title: '([^']+)'/g;
  const controls = [];
  let m;
  while ((m = re.exec(lib))) controls.push({ num: m[1], title: m[2], theme: themes[m[1].split('.').slice(0, 2).join('.')] });
  if (controls.length !== 93) console.warn(`⚠ Esperaba 93 controles, extraje ${controls.length}`);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'SGI360 — LOGISMART';
  const ws = wb.addWorksheet('SoA — Anexo A');

  const headers = ['Control', 'Tema', 'Nombre del control', '¿Aplica? (SI/NO)',
    'Justificación de inclusión / exclusión', 'Estado de implementación', 'Responsable',
    'Documento / Evidencia vinculada', 'Fecha de revisión'];
  ws.columns = [9, 16, 42, 12, 34, 16, 16, 28, 13].map(w => ({ width: w }));
  const N = headers.length;

  styleTitle(ws, 1, N, 'DECLARACIÓN DE APLICABILIDAD (SoA) — ISO/IEC 27001:2022', C.purple);
  fieldRow(ws, 2, [[1, 'Organización:', 2], [4, 'Versión:', 1], [5, 'Fecha de aprobación:', 2], [7, 'Aprobada por:', 3]]);
  ws.getRow(3).height = 6;

  const HR = 4;
  headers.forEach((h, i) => { ws.getCell(HR, i + 1).value = h; });
  styleHeaderRow(ws, HR, N, C.purple);
  ws.views = [{ state: 'frozen', ySplit: HR }];

  let r = HR + 1;
  let lastTheme = '';
  const themeColors = { Organizacionales: 'FFEDE9FE', Personas: 'FFDBEAFE', Físicos: 'FFDCFCE7', Tecnológicos: 'FFFEE2E2' };
  const themeDark = { Organizacionales: 'FF6D28D9', Personas: 'FF1E40AF', Físicos: 'FF166534', Tecnológicos: 'FFB91C1C' };
  const counts = { Organizacionales: 37, Personas: 8, Físicos: 14, Tecnológicos: 34 };

  for (const c of controls) {
    if (c.theme !== lastTheme) {
      ws.mergeCells(r, 1, r, N);
      const tc = ws.getCell(r, 1);
      tc.value = `CONTROLES ${c.theme.toUpperCase()} — ${c.num.split('.').slice(0, 2).join('.')} (${counts[c.theme]} controles)`;
      tc.font = { bold: true, size: 10, color: { argb: themeDark[c.theme] } };
      tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: themeColors[c.theme] } };
      tc.alignment = { horizontal: 'left', vertical: 'middle' };
      for (let i = 1; i <= N; i++) ws.getCell(r, i).border = allBorders;
      ws.getRow(r).height = 22;
      lastTheme = c.theme;
      r++;
    }
    ws.getCell(r, 1).value = c.num;
    ws.getCell(r, 2).value = c.theme;
    ws.getCell(r, 3).value = c.title;
    styleDataRow(ws, r, N, false);
    ws.getCell(r, 1).font = { bold: true, size: 10, color: { argb: themeDark[c.theme] } };
    ws.getCell(r, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(r).height = 20;
    r++;
  }

  const lastData = r - 1;
  for (let rr = HR + 1; rr <= lastData; rr++) {
    if (typeof ws.getCell(rr, 4).value === 'undefined' || ws.getCell(rr, 4).value === null) {
      ws.getCell(rr, 4).dataValidation = { type: 'list', allowBlank: true, formulae: ['"SI,NO"'] };
      ws.getCell(rr, 6).dataValidation = { type: 'list', allowBlank: true, formulae: ['"No iniciado,En progreso,Implementado,Verificado"'] };
    }
  }

  r += 1;
  ws.mergeCells(r, 1, r, N);
  const sum = ws.getCell(r, 1);
  sum.value = `Total de controles: ${controls.length} · Aplicables: contar "SI" en la columna D · El SoA se aprueba por dirección y se revisa al menos anualmente`;
  sum.font = { bold: true, size: 10, color: { argb: C.label } };
  sum.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  ws.getRow(r).height = 24;

  await guideSheet(wb, 'CÓMO USAR EL SoA', [
    '1. Recorré los 93 controles y elegí SI o NO en la columna "¿Aplica?" (lista desplegable).',
    '2. SI aplica: justificá por qué es necesario (riesgo identificado, requisito legal, exigencia de contrato).',
    '3. NO aplica: justificá la exclusión (ej: "no desarrollamos software" para controles de desarrollo seguro).',
    '4. Completá el estado de implementación (desplegable), el responsable y la evidencia vinculada.',
    '5. El SoA se aprueba por la dirección y se revisa al menos una vez al año o ante cambios significativos.',
    '',
    'TIP: en SGI360 el SoA no es un archivo — cada control queda vinculado a documentos, riesgos y evidencias del SGSI → logismart.ar',
  ]);

  await wb.xlsx.writeFile(path.join(OUT, 'soa-iso-27001.xlsx'));
  console.log('✓ soa-iso-27001.xlsx');
}

await genIPERC();
await genBIA();
await genSoA();
console.log('Listo — archivos en', OUT);
