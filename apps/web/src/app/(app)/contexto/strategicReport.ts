import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ContextRow {
  year: number;
  strengths?: string[]; weaknesses?: string[]; opportunities?: string[]; threats?: string[];
  political?: string; economic?: string; social?: string; technological?: string; environmental?: string; legal?: string;
  mission?: string; vision?: string; values?: string;
  dafoFo?: string; dafoFa?: string; dafoDo?: string; dafoDa?: string;
}

interface Dashboard {
  current: { year: number; score: number; contextScore: number; operationalHealth: number; bandLabel: string; counts: any };
  history: { year: number; score: number }[];
  live: any;
}

const arr = (v?: string[] | null): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []);

export function generateStrategicPDF(opts: {
  year: number;
  dashboard: Dashboard;
  context: ContextRow;
  review?: string;
  companyName?: string;
}) {
  const { year, dashboard, context, review, companyName } = opts;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) { doc.addPage(); y = margin; }
  };
  const heading = (text: string) => {
    ensureSpace(12);
    doc.setFillColor(37, 99, 235);
    doc.rect(margin, y, pageW - margin * 2, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(text, margin + 2, y + 5.5);
    y += 12;
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'normal');
  };
  const paragraph = (text: string, size = 9) => {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, pageW - margin * 2);
    for (const ln of lines) {
      ensureSpace(5);
      doc.text(ln, margin, y);
      y += 4.6;
    }
    y += 2;
  };
  const bullets = (items: string[]) => {
    doc.setFontSize(9);
    if (items.length === 0) { paragraph('(sin datos)'); return; }
    for (const it of items) {
      const lines = doc.splitTextToSize(`•  ${it}`, pageW - margin * 2 - 2);
      for (const ln of lines) { ensureSpace(5); doc.text(ln, margin + 2, y); y += 4.6; }
    }
    y += 2;
  };

  // ── Portada / encabezado ──
  doc.setFillColor(17, 24, 39);
  doc.rect(0, 0, pageW, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Informe Ejecutivo del Contexto del SGI', margin, 14);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${companyName || 'Organización'}  ·  Año ${year}  ·  ISO 9001 / 14001 / 45001`, margin, 22);
  doc.setFontSize(8);
  doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`, margin, 27);
  y = 38;
  doc.setTextColor(30, 30, 30);

  // ── Resumen ejecutivo ──
  heading('1. Resumen Ejecutivo');
  const c = dashboard.current;
  paragraph(`El índice estratégico global del SGI para el año ${year} es ${c.score}% (${c.bandLabel}), compuesto por un ${c.contextScore}% de madurez del contexto y un ${c.operationalHealth}% de salud operativa. Este informe consolida el análisis FODA, PESTEL, la matriz DAFO cruzada, los objetivos, riesgos, indicadores, acciones y proyectos derivados, como evidencia para la Revisión por la Dirección.`);

  // Indicadores clave (tabla)
  const L = dashboard.live;
  autoTable(doc, {
    startY: y,
    head: [['Indicador', 'Valor']],
    body: [
      ['Score estratégico', `${c.score}%`],
      ['Madurez del contexto', `${c.contextScore}%`],
      ['Salud operativa', `${c.operationalHealth}%`],
      ['Fortalezas / Debilidades', `${c.counts.s} / ${c.counts.w}`],
      ['Oportunidades / Amenazas', `${c.counts.o} / ${c.counts.t}`],
      ['Estrategias DAFO', `${c.counts.dafoFilled}/4`],
      ['Cobertura PESTEL', `${c.counts.pestelFilled}/6`],
      ['Objetivos (logrados)', `${c.counts.objTotal} (${c.counts.objAchieved})`],
      ['Riesgos abiertos (altos)', `${L.openRisks} (${L.highRisks})`],
      ['Acciones abiertas', `${L.openActions}`],
      ['No conformidades abiertas', `${L.openNCs}`],
      ['Indicadores', `${L.indicatorsTotal}`],
      ['Partes interesadas', `${L.stakeholders}${L.avgCompliance !== null ? ` (${L.avgCompliance}% cumpl.)` : ''}`],
    ],
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 8, cellPadding: 1.5 },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── Contexto organizacional ──
  heading('2. Contexto Organizacional');
  paragraph(`Misión: ${context.mission || '(no definida)'}`);
  paragraph(`Visión: ${context.vision || '(no definida)'}`);
  paragraph(`Valores: ${context.values || '(no definidos)'}`);

  // ── Evolución anual ──
  heading('3. Evolución Anual');
  if (dashboard.history.length) {
    autoTable(doc, {
      startY: y,
      head: [['Año', 'Score', 'Variación']],
      body: dashboard.history.map((h, i) => {
        const prev = i > 0 ? dashboard.history[i - 1].score : null;
        const delta = prev !== null ? `${h.score - prev > 0 ? '+' : ''}${h.score - prev}%` : '—';
        return [String(h.year), `${h.score}%`, delta];
      }),
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 8, cellPadding: 1.5 },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  } else { paragraph('Sin histórico disponible.'); }

  // ── FODA ──
  heading('4. Análisis FODA');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); ensureSpace(6); doc.text('Fortalezas', margin, y); y += 5; doc.setFont('helvetica', 'normal');
  bullets(arr(context.strengths));
  doc.setFont('helvetica', 'bold'); ensureSpace(6); doc.text('Debilidades', margin, y); y += 5; doc.setFont('helvetica', 'normal');
  bullets(arr(context.weaknesses));
  doc.setFont('helvetica', 'bold'); ensureSpace(6); doc.text('Oportunidades', margin, y); y += 5; doc.setFont('helvetica', 'normal');
  bullets(arr(context.opportunities));
  doc.setFont('helvetica', 'bold'); ensureSpace(6); doc.text('Amenazas', margin, y); y += 5; doc.setFont('helvetica', 'normal');
  bullets(arr(context.threats));

  // ── PESTEL ──
  heading('5. Análisis PESTEL');
  const pestel: [string, keyof ContextRow][] = [
    ['Político', 'political'], ['Económico', 'economic'], ['Social', 'social'],
    ['Tecnológico', 'technological'], ['Ambiental', 'environmental'], ['Legal', 'legal'],
  ];
  for (const [label, key] of pestel) {
    const val = String(context[key] || '').trim();
    if (val) { doc.setFont('helvetica', 'bold'); doc.setFontSize(9); ensureSpace(5); doc.text(`${label}:`, margin, y); y += 4.6; doc.setFont('helvetica', 'normal'); paragraph(val); }
  }

  // ── DAFO ──
  heading('6. Matriz DAFO Cruzado');
  const dafo: [string, keyof ContextRow][] = [
    ['FO (Fortalezas + Oportunidades)', 'dafoFo'], ['DO (Debilidades + Oportunidades)', 'dafoDo'],
    ['FA (Fortalezas + Amenazas)', 'dafoFa'], ['DA (Debilidades + Amenazas)', 'dafoDa'],
  ];
  for (const [label, key] of dafo) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); ensureSpace(5); doc.text(label, margin, y); y += 4.6; doc.setFont('helvetica', 'normal');
    paragraph(String(context[key] || '(sin estrategias)'));
  }

  // ── Recomendaciones IA ──
  if (review && review.trim()) {
    heading('7. Recomendaciones (Análisis IA)');
    // Renderiza el markdown de forma simple
    const cleaned = review.replace(/\*\*/g, '');
    for (const raw of cleaned.split('\n')) {
      const line = raw.trimEnd();
      if (/^#{1,3}\s+/.test(line)) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
        ensureSpace(6); doc.text(line.replace(/^#{1,3}\s+/, ''), margin, y); y += 5.5;
        doc.setFont('helvetica', 'normal');
      } else if (/^\s*[-*]\s+/.test(line)) {
        bullets([line.replace(/^\s*[-*]\s+/, '')]);
      } else if (line.trim()) {
        paragraph(line);
      }
    }
  }

  // ── Firma / pie ──
  ensureSpace(30);
  y += 6;
  doc.setDrawColor(180);
  doc.line(margin, y, margin + 70, y); y += 4;
  doc.setFontSize(8); doc.text('Firma y aclaración — Representante de la Dirección', margin, y);
  y += 10;
  doc.line(margin, y, margin + 70, y); y += 4;
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-AR')}`, margin, y);

  // Numeración de páginas
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(150);
    doc.text(`SGI360 · Informe de Contexto ${year} · Página ${i}/${pages}`, pageW / 2, pageH - 6, { align: 'center' });
  }

  doc.save(`Informe_Contexto_SGI_${year}.pdf`);
}
