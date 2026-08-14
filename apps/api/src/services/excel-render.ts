/**
 * Excel Render Service — Sistema Global de Exportación Documental
 * Genera archivos .xlsx con estilos, logo, QR y metadata documental.
 * Reutiliza los mismos PdfTemplateConfig y PdfDocumentMetadata que pdf-render.
 */
import ExcelJS from 'exceljs';
import QRCode from 'qrcode';
import crypto from 'crypto';
import type { PdfTemplateConfig, PdfDocumentMetadata } from './pdf-render.js';

export interface ExcelSection {
  type: 'heading' | 'table' | 'cards' | 'text' | 'badges' | 'spacer';
  level?: number;
  text?: string;
  columns?: string[];
  rows?: string[][];
  cards?: { label: string; value: string; color?: string }[];
  badges?: { text: string; color?: string }[];
}

export interface ExcelExportRequest {
  template: PdfTemplateConfig;
  metadata: PdfDocumentMetadata;
  sections: ExcelSection[];
  validationUrl?: string;
  userName?: string;
}

export interface ExcelRenderResult {
  buffer: Buffer;
  fileHash: string;
}

async function generateQR(data: string): Promise<Buffer> {
  const dataUrl = await QRCode.toDataURL(data, {
    width: 150,
    margin: 1,
    color: { dark: '#1e293b', light: '#ffffff' },
  });
  const base64 = dataUrl.split(',')[1];
  return Buffer.from(base64, 'base64');
}

function hexToArgb(hex: string): string {
  const clean = hex.replace('#', '');
  return 'FF' + clean;
}

function statusColor(status?: string): string {
  if (status === 'EFFECTIVE') return 'FF16A34A';
  if (status === 'OBSOLETE') return 'FFDC2626';
  if (status === 'DRAFT') return 'FFD97706';
  return 'FF64748B';
}

function statusLabel(status?: string): string {
  if (status === 'EFFECTIVE') return 'VIGENTE';
  if (status === 'OBSOLETE') return 'OBSOLETO';
  if (status === 'DRAFT') return 'BORRADOR';
  if (status === 'REVIEW') return 'EN REVISIÓN';
  if (status === 'PENDING_APPROVAL') return 'PENDIENTE APROBACIÓN';
  return status || '';
}

function colorFromClassName(classNames: string): string | undefined {
  const map: Record<string, string> = {
    'bg-blue-50': 'FFEFF6FF', 'text-blue-700': 'FF1D4ED8', 'text-blue-800': 'FF1E40AF',
    'bg-green-50': 'FFECFDF5', 'bg-emerald-50': 'FFECFDF5',
    'text-green-700': 'FF059669', 'text-green-800': 'FF065F46', 'text-emerald-700': 'FF059669',
    'bg-red-50': 'FFFEF2F2', 'text-red-700': 'FFDC2626', 'text-red-800': 'FF991B1B',
    'bg-yellow-50': 'FFFFFEBEB', 'bg-amber-50': 'FFFFF7ED',
    'text-yellow-800': 'FF92400E', 'text-amber-800': 'FF9A3412',
    'bg-orange-50': 'FFFFF7ED', 'text-orange-800': 'FF9A3412',
    'bg-gray-50': 'FFF9FAFB', 'bg-neutral-50': 'FFF9FAFB',
    'text-gray-500': 'FF6B7280', 'text-gray-600': 'FF4B5563', 'text-gray-700': 'FF374151', 'text-gray-900': 'FF111827',
  };
  for (const cls of classNames.split(/\s+/)) {
    if (map[cls]) return map[cls];
  }
  return undefined;
}

export async function renderExcel(options: ExcelExportRequest): Promise<ExcelRenderResult> {
  const { template, metadata, sections, validationUrl, userName } = options;

  const qrData = validationUrl || `${metadata.documentCode}-R${String(metadata.revision).padStart(2, '0')}`;
  const qrBuffer = await generateQR(qrData);

  const wb = new ExcelJS.Workbook();
  wb.creator = template.companyName || 'SGI 360';
  wb.created = new Date();

  const sheetName = (metadata.title || 'Documento').substring(0, 31).replace(/[\\/?*[\]:]/g, '');
  const ws = wb.addWorksheet(sheetName || 'Documento', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3,
      },
    },
    views: [{ showGridLines: false }],
  });

  // Columnas base — 8 columnas para flexibilidad
  ws.columns = [
    { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 },
    { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 },
  ];

  const primaryArgb = hexToArgb(template.primaryColor || '#1e40af');
  const secondaryArgb = hexToArgb(template.secondaryColor || '#64748b');
  let row = 1;

  // ── HEADER DOCUMENTAL ──
  // Fila 1: Logo (si hay) | Espacio | Estado badge
  let logoAdded = false;
  if (template.headerLogoUrl) {
    try {
      const logoRes = await fetch(template.headerLogoUrl);
      if (logoRes.ok) {
        const logoBuf = Buffer.from(await logoRes.arrayBuffer());
        // ExcelJS only supports png, jpg, jpeg, gif — NOT webp/svg
        let logoExt = template.headerLogoUrl.match(/[?&]format=(png|jpg|jpeg|gif)/i)?.[1]?.toLowerCase()
          || template.headerLogoUrl.replace(/[?#].*$/, '').match(/\.(png|jpe?g|gif)$/i)?.[1]?.toLowerCase()
          || null;
        // Fallback: detect from magic bytes
        if (!logoExt && logoBuf.length >= 4) {
          if (logoBuf[0] === 0x89 && logoBuf[1] === 0x50) logoExt = 'png';
          else if (logoBuf[0] === 0xFF && logoBuf[1] === 0xD8) logoExt = 'jpg';
          else if (logoBuf[0] === 0x47 && logoBuf[1] === 0x49) logoExt = 'gif';
        }
        console.log('[EXCEL] logo URL:', template.headerLogoUrl, 'ext:', logoExt, 'bufLen:', logoBuf.length, 'firstBytes:', logoBuf.slice(0, 4).toString('hex'));
        if (logoExt && logoBuf.length > 0) {
          const imageId = (wb as any).addImage({ buffer: logoBuf, extension: logoExt });
          (ws as any).addImage(imageId, {
            tl: { col: 0, row: 0 },
            ext: { width: 140, height: 50 },
          });
          logoAdded = true;
        }
      }
    } catch { /* logo fetch fails silently */ }
  }

  // Estado (VIGENTE) arriba a la derecha
  ws.mergeCells(row, 6, row, 8);
  const statusCell = ws.getCell(row, 6);
  statusCell.value = statusLabel(metadata.status);
  statusCell.font = { bold: true, size: 10, color: { argb: statusColor(metadata.status) } };
  statusCell.alignment = { horizontal: 'right', vertical: 'middle' };
  statusCell.border = {
    top: { style: 'thin', color: { argb: statusColor(metadata.status) } },
    bottom: { style: 'thin', color: { argb: statusColor(metadata.status) } },
    left: { style: 'thin', color: { argb: statusColor(metadata.status) } },
    right: { style: 'thin', color: { argb: statusColor(metadata.status) } },
  };
  ws.getRow(row).height = 30;
  row++;

  // Fila 2: Nombre empresa (o fallback si no hay logo)
  if (!template.headerLogoUrl && template.companyName) {
    ws.mergeCells(row, 1, row, 4);
    const nameCell = ws.getCell(row, 1);
    nameCell.value = template.companyName;
    nameCell.font = { bold: true, size: 14, color: { argb: primaryArgb } };
    nameCell.alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(row).height = 24;
  }
  row++;

  // Fila 3: Línea azul (border bottom thick)
  ws.mergeCells(row, 1, row, 8);
  const lineCell = ws.getCell(row, 1);
  lineCell.border = { bottom: { style: 'medium', color: { argb: primaryArgb } } };
  ws.getRow(row).height = 4;
  row++;

  // Fila 4: Código | Revisión | Módulo | Fecha
  const metaRow = ws.getRow(row);
  metaRow.height = 20;
  ws.mergeCells(row, 1, row, 2);
  const codeCell = ws.getCell(row, 1);
  codeCell.value = `Código: ${metadata.documentCode}`;
  codeCell.font = { bold: true, size: 10, color: { argb: primaryArgb } };

  ws.mergeCells(row, 3, row, 4);
  ws.getCell(row, 3).value = `Revisión: R${String(metadata.revision || 0).padStart(2, '0')}`;
  ws.getCell(row, 3).font = { size: 10, color: { argb: 'FF475569' } };

  ws.mergeCells(row, 5, row, 6);
  ws.getCell(row, 5).value = metadata.module || '';
  ws.getCell(row, 5).font = { size: 10, color: { argb: 'FF475569' } };

  ws.mergeCells(row, 7, row, 8);
  ws.getCell(row, 7).value = `Fecha: ${new Date().toLocaleDateString('es-AR')}`;
  ws.getCell(row, 7).font = { size: 10, color: { argb: 'FF475569' } };
  ws.getCell(row, 7).alignment = { horizontal: 'right' };
  row++;

  // Fila 5: COPIA CONTROLADA
  ws.mergeCells(row, 1, row, 8);
  const copyCell = ws.getCell(row, 1);
  copyCell.value = 'COPIA CONTROLADA';
  copyCell.font = { bold: true, size: 9, color: { argb: 'FFDC2626' } };
  copyCell.alignment = { horizontal: 'center' };
  copyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
  ws.getRow(row).height = 18;
  row++;

  // Fila 6: Título del documento
  ws.mergeCells(row, 1, row, 8);
  const titleCell = ws.getCell(row, 1);
  titleCell.value = metadata.title || '';
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF111827' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(row).height = 28;
  row++;

  // Spacer
  ws.getRow(row).height = 8;
  row++;

  // ── CONTENIDO ──
  for (const section of sections) {
    if (section.type === 'heading') {
      const level = section.level || 2;
      ws.mergeCells(row, 1, row, 8);
      const cell = ws.getCell(row, 1);
      cell.value = section.text || '';
      const fontSize = level === 1 ? 14 : level === 2 ? 12 : 11;
      cell.font = { bold: true, size: fontSize, color: { argb: primaryArgb } };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      ws.getRow(row).height = level === 1 ? 26 : 22;
      row++;

    } else if (section.type === 'text') {
      ws.mergeCells(row, 1, row, 8);
      const cell = ws.getCell(row, 1);
      cell.value = section.text || '';
      cell.font = { size: 10, color: { argb: 'FF374151' } };
      cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
      ws.getRow(row).height = 18;
      row++;

    } else if (section.type === 'spacer') {
      ws.getRow(row).height = 10;
      row++;

    } else if (section.type === 'cards' && section.cards?.length) {
      // Render cards as merged blocks side by side
      const cards = section.cards;
      const cardsPerRow = Math.min(cards.length, 4);
      const colsPerCard = Math.floor(8 / cardsPerRow);

      for (let i = 0; i < cards.length; i += cardsPerRow) {
        const batch = cards.slice(i, i + cardsPerRow);
        // Label row
        for (let j = 0; j < batch.length; j++) {
          const startCol = j * colsPerCard + 1;
          const endCol = startCol + colsPerCard - 1;
          ws.mergeCells(row, startCol, row, endCol);
          const labelCell = ws.getCell(row, startCol);
          labelCell.value = batch[j].label;
          labelCell.font = { size: 9, color: { argb: 'FF6B7280' } };
          labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
          const cardColor = batch[j].color ? hexToArgb(batch[j].color!) : 'FFEFF6FF';
          labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cardColor } };
          labelCell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          };
        }
        ws.getRow(row).height = 18;
        row++;

        // Value row
        for (let j = 0; j < batch.length; j++) {
          const startCol = j * colsPerCard + 1;
          const endCol = startCol + colsPerCard - 1;
          ws.mergeCells(row, startCol, row, endCol);
          const valCell = ws.getCell(row, startCol);
          valCell.value = batch[j].value;
          valCell.font = { bold: true, size: 14, color: { argb: 'FF111827' } };
          valCell.alignment = { horizontal: 'center', vertical: 'middle' };
          const cardColor = batch[j].color ? hexToArgb(batch[j].color!) : 'FFEFF6FF';
          valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cardColor } };
          valCell.border = {
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          };
        }
        ws.getRow(row).height = 30;
        row++;
      }
      ws.getRow(row).height = 6;
      row++;

    } else if (section.type === 'badges' && section.badges?.length) {
      for (const badge of section.badges) {
        ws.mergeCells(row, 1, row, 8);
        const cell = ws.getCell(row, 1);
        cell.value = badge.text;
        cell.font = { bold: true, size: 9, color: { argb: 'FF111827' } };
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        const badgeBg = badge.color ? hexToArgb(badge.color) : 'FFF3F4F6';
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: badgeBg } };
        cell.border = {
          top: { style: 'thin', color: { argb: badgeBg } },
          bottom: { style: 'thin', color: { argb: badgeBg } },
          left: { style: 'thin', color: { argb: badgeBg } },
          right: { style: 'thin', color: { argb: badgeBg } },
        };
        ws.getRow(row).height = 18;
        row++;
      }

    } else if (section.type === 'table' && section.columns) {
      const cols = section.columns;
      const numCols = Math.min(cols.length, 8);

      // Header row
      const headerRow = ws.getRow(row);
      for (let c = 0; c < numCols; c++) {
        const cell = headerRow.getCell(c + 1);
        cell.value = cols[c];
        cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryArgb } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
      }
      headerRow.height = 22;
      row++;

      // Data rows
      if (section.rows) {
        for (let r = 0; r < section.rows.length; r++) {
          const dataRow = ws.getRow(row);
          const rowData = section.rows[r];
          const isEven = r % 2 === 0;
          for (let c = 0; c < numCols; c++) {
            const cell = dataRow.getCell(c + 1);
            cell.value = rowData[c] ?? '';
            cell.font = { size: 10, color: { argb: 'FF1E293B' } };
            cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
              right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            };
            if (isEven) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            }
          }
          dataRow.height = 18;
          row++;
        }
      }
      ws.getRow(row).height = 6;
      row++;
    }
  }

  // ── FOOTER: QR + Trazabilidad ──
  row += 1;
  ws.getRow(row).height = 6;
  row++;

  // Línea separadora
  ws.mergeCells(row, 1, row, 8);
  ws.getCell(row, 1).border = { top: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
  row++;

  // QR image (col 1-2) | Trazabilidad info (col 3-8)
  try {
    console.log('[EXCEL] QR buffer len:', qrBuffer.length, 'firstBytes:', qrBuffer.slice(0, 4).toString('hex'));
    const imageId = (wb as any).addImage({ buffer: qrBuffer, extension: 'png' });
    (ws as any).addImage(imageId, {
      tl: { col: 0, row: row - 1 },
      ext: { width: 90, height: 90 },
    });
  } catch (e) { console.log('[EXCEL] QR addImage error:', e); /* QR fails silently */ }

  ws.mergeCells(row, 3, row, 8);
  const traceCell = ws.getCell(row, 3);
  traceCell.value = 'TRAZABILIDAD DOCUMENTAL';
  traceCell.font = { bold: true, size: 9, color: { argb: secondaryArgb } };
  traceCell.alignment = { horizontal: 'left', vertical: 'top' };
  row++;

  const traceLines = [
    `Documento: ${metadata.documentCode} · Rev R${String(metadata.revision || 0).padStart(2, '0')}`,
    `Estado: ${statusLabel(metadata.status)}`,
    `Tipo: COPIA CONTROLADA`,
    `Generado: ${new Date().toLocaleString('es-AR')}`,
    userName ? `Usuario: ${userName}` : '',
    `Validación: ${qrData}`,
  ].filter(Boolean);

  for (const line of traceLines) {
    ws.mergeCells(row, 3, row, 8);
    const cell = ws.getCell(row, 3);
    cell.value = line;
    cell.font = { size: 8, color: { argb: 'FF64748B' } };
    cell.alignment = { horizontal: 'left', vertical: 'top' };
    row++;
  }

  // Asegurar espacio para el QR (5 filas)
  while (row < (traceLines.length + 3 + 5)) row++;

  // Freeze panes después del header documental (fila 8 aprox)
  ws.views = [{ state: 'frozen', ySplit: 8, showGridLines: false }];

  // Print settings
  ws.pageSetup.printTitlesRow = '1:8';

  const buffer = await wb.xlsx.writeBuffer();
  const buf = Buffer.from(buffer);
  const fileHash = crypto.createHash('sha256').update(buf).digest('hex');

  return { buffer: buf, fileHash };
}
