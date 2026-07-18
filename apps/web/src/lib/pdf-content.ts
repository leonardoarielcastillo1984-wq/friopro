/**
 * PDF Content Builder — utilidades para generar HTML de tablas/contenido PDF
 * desde datos de cualquier módulo. Reutilizable por todos los módulos.
 */

export interface PdfColumn {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  format?: (value: any, row: any) => string;
}

export interface PdfSection {
  title: string;
  html: string;
}

export function buildTableHtml(
  columns: PdfColumn[],
  rows: Record<string, any>[],
  options?: { striped?: boolean; compact?: boolean }
): string {
  const striped = options?.striped ?? true;
  const compact = options?.compact ?? false;
  const cellPadding = compact ? '4px 6px' : '6px 8px';

  const headerCells = columns.map(c => {
    const align = c.align || 'left';
    const width = c.width ? `width:${c.width};` : '';
    return `<th style="text-align:${align};${width}padding:${cellPadding};">${escapeHtml(c.label)}</th>`;
  }).join('');

  const bodyRows = rows.map((row, i) => {
    const bg = striped && i % 2 === 1 ? 'background:#f8fafc;' : '';
    const cells = columns.map(c => {
      const val = row[c.key];
      const formatted = c.format ? c.format(val, row) : escapeHtml(String(val ?? ''));
      const align = c.align || 'left';
      return `<td style="text-align:${align};padding:${cellPadding};${bg}">${formatted}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `
    <table style="width:100%;border-collapse:collapse;margin:8px 0;">
      <thead><tr>${headerCells}</thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;
}

export function buildSection(title: string, content: string): string {
  return `
    <div style="margin-top:16px;">
      <h2 style="font-size:14px;color:#1e40af;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:8px;">${escapeHtml(title)}</h2>
      ${content}
    </div>
  `;
}

export function buildInfoBox(label: string, value: string): string {
  return `
    <div style="background:#f1f5f9;border-left:4px solid #1e40af;padding:8px 12px;margin:8px 0;border-radius:4px;">
      <span style="font-size:10px;color:#64748b;font-weight:bold;">${escapeHtml(label)}</span>
      <div style="font-size:12px;color:#1e293b;margin-top:2px;">${escapeHtml(value)}</div>
    </div>
  `;
}

export function buildKeyValueGrid(
  items: { label: string; value: string }[],
  columns = 2
): string {
  const cells = items.map(item => `
    <td style="padding:4px 8px;border:1px solid #e2e8f0;">
      <div style="font-size:9px;color:#94a3b8;font-weight:bold;">${escapeHtml(item.label)}</div>
      <div style="font-size:11px;color:#1e293b;">${escapeHtml(item.value)}</div>
    </td>
  `).join('');

  const rows: string[] = [];
  for (let i = 0; i < items.length; i += columns) {
    const slice = cells.slice(i, i + columns);
    rows.push(`<tr>${slice}</tr>`);
  }

  return `<table style="width:100%;border-collapse:collapse;margin:8px 0;">${rows.join('')}</table>`;
}

export function buildFullDocument(
  sections: PdfSection[],
  options?: { intro?: string }
): string {
  const intro = options?.intro ? `<p style="margin-bottom:12px;font-size:11px;color:#64748b;">${escapeHtml(options.intro)}</p>` : '';
  return intro + sections.map(s => buildSection(s.title, s.html)).join('');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
