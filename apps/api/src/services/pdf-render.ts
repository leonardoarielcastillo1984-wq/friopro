/**
 * PDF Render Service — Sistema Global de Exportación Documental
 * Renderiza HTML → PDF usando Puppeteer con plantillas institucionales.
 */
// @ts-ignore - puppeteer ya está instalado
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';
import crypto from 'crypto';

export interface PdfTemplateConfig {
  headerLogoUrl?: string;
  headerLogoSecondaryUrl?: string;
  companyName?: string;
  commercialName?: string;
  companyAddress?: string;
  companyCuit?: string;
  companySite?: string;
  footerText?: string;
  footerLegalText?: string;
  footerShowPageNum?: boolean;
  footerShowDate?: boolean;
  footerShowUser?: boolean;
  footerShowQR?: boolean;
  footerShowStatus?: boolean;
  pageSize?: string;
  orientation?: string;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  fontSize?: number;
  showCoverPage?: boolean;
  showTableOfContents?: boolean;
  watermarkText?: string;
  watermarkOpacity?: number;
  showSignatures?: boolean;
  signatureStyle?: string;
}

export interface PdfDocumentMetadata {
  documentCode: string;
  revision: number;
  title: string;
  status: string;
  exportType: 'CONTROLLED' | 'INFORMATIVE';
  module?: string;
  subModule?: string;
  elaboratedBy?: string;
  reviewedBy?: string;
  approvedBy?: string;
  approvedAt?: Date | null;
  nextReviewDate?: Date | null;
  createdAt?: Date | null;
  confidentialLevel?: string;
}

export interface PdfRenderOptions {
  template: PdfTemplateConfig;
  metadata: PdfDocumentMetadata;
  bodyHtml: string;
  validationUrl?: string;
  userName?: string;
}

export interface PdfRenderResult {
  buffer: Buffer;
  pageCount: number;
  fileHash: string;
  qrDataUrl?: string;
}

function translateStatus(s: string): string {
  const map: Record<string, string> = {
    EFFECTIVE: 'VIGENTE', OBSOLETE: 'OBSOLETO', DRAFT: 'BORRADOR',
    REVIEW: 'EN REVISIÓN', PENDING_APPROVAL: 'PENDIENTE DE APROBACIÓN',
    PENDING: 'PENDIENTE', SUSPENDED: 'SUSPENDIDO', ARCHIVED: 'ARCHIVADO',
  };
  return map[s] ?? s;
}

function cleanModuleName(m: string): string {
  const map: Record<string, string> = {
    calidad: 'Calidad', rrhh: 'Recursos Humanos', objetivos: 'Objetivos',
    normativos: 'Normativos', riesgos: 'Riesgos', indicadores: 'Indicadores',
    capacitaciones: 'Capacitaciones', audit: 'Auditorías', 'no-conformidades': 'No Conformidades',
    proveedores: 'Proveedores', mantenimiento: 'Mantenimiento', documentos: 'Documentos',
    sgi: 'SGI', contexto: 'Contexto', procesos: 'Procesos',
  };
  const key = m.replace(/^page-/, '').replace(/-+$/, '').toLowerCase();
  return map[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function formatDateTime(d: Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

async function generateQR(data: string): Promise<string> {
  return await QRCode.toDataURL(data, {
    width: 120,
    margin: 1,
    color: { dark: '#1e293b', light: '#ffffff' },
  });
}

function buildHeaderHtml(template: PdfTemplateConfig, metadata: PdfDocumentMetadata): string {
  const logo = template.headerLogoUrl
    ? `<img src="${template.headerLogoUrl}" style="max-height:60px;max-width:180px;object-fit:contain;" />`
    : '';
  const logoSec = template.headerLogoSecondaryUrl
    ? `<img src="${template.headerLogoSecondaryUrl}" style="max-height:50px;max-width:120px;object-fit:contain;" />`
    : '';

  const companyName = template.companyName || '';
  const commercialName = template.commercialName || '';
  const address = template.companyAddress || '';
  const cuit = template.companyCuit ? `CUIT: ${template.companyCuit}` : '';
  const site = template.companySite || '';

  const statusLabel = metadata.status === 'EFFECTIVE' ? 'VIGENTE'
    : metadata.status === 'OBSOLETE' ? 'OBSOLETO'
    : metadata.status === 'DRAFT' ? 'BORRADOR'
    : metadata.status === 'REVIEW' ? 'EN REVISIÓN'
    : metadata.status === 'PENDING_APPROVAL' ? 'PENDIENTE APROBACIÓN'
    : metadata.status;

  const statusColor = metadata.status === 'EFFECTIVE' ? '#16a34a'
    : metadata.status === 'OBSOLETE' ? '#dc2626'
    : metadata.status === 'DRAFT' ? '#d97706'
    : '#64748b';

  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%;border-bottom:2px solid ${template.primaryColor || '#1e40af'};padding-bottom:8px;">
      <div style="display:flex;align-items:center;gap:12px;">
        ${logo}
        <div>
          <div style="font-size:14px;font-weight:bold;color:${template.primaryColor || '#1e40af'};">${companyName}</div>
          ${commercialName ? `<div style="font-size:11px;color:#64748b;">${commercialName}</div>` : ''}
          ${address ? `<div style="font-size:9px;color:#94a3b8;">${address}</div>` : ''}
          <div style="font-size:9px;color:#94a3b8;">${cuit}${site ? ' · ' + site : ''}</div>
        </div>
      </div>
      <div style="text-align:right;">
        ${logoSec}
        <div style="margin-top:4px;">
          <span style="font-size:10px;font-weight:bold;color:${statusColor};border:1px solid ${statusColor};padding:2px 8px;border-radius:4px;">${statusLabel}</span>
        </div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;width:100%;margin-top:6px;">
      <div style="font-size:10px;color:#64748b;">
        <strong>Código:</strong> <span style="font-family:monospace;font-weight:bold;color:${template.primaryColor || '#1e40af'};">${metadata.documentCode}</span>
        ${metadata.revision > 0 ? ` · <strong>Revisión:</strong> R${String(metadata.revision).padStart(2, '0')}` : ''}
      </div>
      <div style="font-size:10px;color:#64748b;font-weight:bold;">${metadata.title}</div>
    </div>
  `;
}

function buildFooterHtml(template: PdfTemplateConfig, metadata: PdfDocumentMetadata, qrDataUrl?: string, userName?: string): string {
  const pageNum = template.footerShowPageNum
    ? '<span class="pageNumber"></span> / <span class="totalPages"></span>'
    : '';
  const date = template.footerShowDate ? formatDateTime(new Date()) : '';
  const user = template.footerShowUser && userName ? `Exportado por: ${userName}` : '';
  const status = template.footerShowStatus
    ? (metadata.exportType === 'INFORMATIVE' ? 'COPIA NO CONTROLADA' : 'COPIA CONTROLADA')
    : '';
  const qr = template.footerShowQR && qrDataUrl
    ? `<img src="${qrDataUrl}" style="width:50px;height:50px;" />`
    : '';

  const legalText = template.footerLegalText || '';
  const footerText = template.footerText || '';

  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-end;width:100%;border-top:1px solid #cbd5e1;padding-top:6px;font-size:8px;color:#94a3b8;">
      <div style="display:flex;align-items:center;gap:8px;">
        ${qr}
        <div>
          ${footerText ? `<div>${footerText}</div>` : ''}
          ${legalText ? `<div style="font-style:italic;">${legalText}</div>` : ''}
          <div style="margin-top:2px;">
            ${status ? `<span style="font-weight:bold;color:${metadata.exportType === 'INFORMATIVE' ? '#dc2626' : '#16a34a'};">${status}</span>` : ''}
            ${user ? ` · ${user}` : ''}
            ${date ? ` · ${date}` : ''}
          </div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:9px;">${pageNum}</div>
      </div>
    </div>
  `;
}

function buildSignatureSection(template: PdfTemplateConfig, metadata: PdfDocumentMetadata): string {
  if (!template.showSignatures || template.signatureStyle === 'none') return '';

  const style = template.signatureStyle || 'table';

  if (style === 'qr_only') {
    return '<div style="margin-top:30px;text-align:center;font-size:9px;color:#94a3b8;">Documento validable mediante código QR</div>';
  }

  const elaborated = metadata.elaboratedBy || '—';
  const reviewed = metadata.reviewedBy || '—';
  const approved = metadata.approvedBy || '—';
  const approvedDate = formatDate(metadata.approvedAt);

  return `
    <div style="margin-top:40px;">
      <table style="width:100%;border-collapse:collapse;font-size:10px;">
        <tr>
          <td style="width:33%;text-align:center;padding:8px;border:1px solid #cbd5e1;">
            <div style="height:40px;border-bottom:1px solid #94a3b8;margin-bottom:4px;"></div>
            <div style="font-weight:bold;">Elaborado por</div>
            <div>${elaborated}</div>
          </td>
          <td style="width:33%;text-align:center;padding:8px;border:1px solid #cbd5e1;">
            <div style="height:40px;border-bottom:1px solid #94a3b8;margin-bottom:4px;"></div>
            <div style="font-weight:bold;">Revisado por</div>
            <div>${reviewed}</div>
          </td>
          <td style="width:33%;text-align:center;padding:8px;border:1px solid #cbd5e1;">
            <div style="height:40px;border-bottom:1px solid #94a3b8;margin-bottom:4px;"></div>
            <div style="font-weight:bold;">Aprobado por</div>
            <div>${approved}</div>
            <div style="font-size:8px;color:#94a3b8;">${approvedDate}</div>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function buildWatermark(template: PdfTemplateConfig, metadata: PdfDocumentMetadata): string {
  const wmText = template.watermarkText
    || (metadata.exportType === 'INFORMATIVE' ? 'COPIA NO CONTROLADA' : '');
  if (!wmText) return '';

  const opacity = template.watermarkOpacity ?? 0.1;

  return `
    <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);
         font-size:60px;font-weight:bold;color:rgba(220,38,38,${opacity});
         z-index:0;pointer-events:none;white-space:nowrap;">${wmText}</div>
  `;
}

function buildCoverPage(template: PdfTemplateConfig, metadata: PdfDocumentMetadata): string {
  if (!template.showCoverPage) return '';

  return `
    <div style="page-break-after:always;text-align:center;padding-top:120px;">
      ${template.headerLogoUrl ? `<img src="${template.headerLogoUrl}" style="max-height:100px;max-width:300px;margin-bottom:40px;" />` : ''}
      <h1 style="color:${template.primaryColor || '#1e40af'};font-size:24px;margin-bottom:12px;">${metadata.title}</h1>
      <div style="font-size:14px;color:#64748b;margin-bottom:30px;">
        <span style="font-family:monospace;font-weight:bold;">${metadata.documentCode}</span>
        ${metadata.revision > 0 ? ` · Revisión R${String(metadata.revision).padStart(2, '0')}` : ''}
      </div>
      <div style="font-size:12px;color:#94a3b8;">
        ${template.companyName || ''}
        ${template.companyAddress ? '<br/>' + template.companyAddress : ''}
      </div>
      <div style="margin-top:60px;font-size:10px;color:#94a3b8;">
        Fecha de emisión: ${formatDate(new Date())}
      </div>
    </div>
  `;
}

export async function renderPdf(options: PdfRenderOptions): Promise<PdfRenderResult> {
  const { template, metadata, bodyHtml, validationUrl, userName } = options;

  const qrData = validationUrl || `${metadata.documentCode}-R${String(metadata.revision).padStart(2, '0')}`;
  const qrDataUrl = await generateQR(qrData);

  const headerHtml = buildHeaderHtml(template, metadata);
  const footerHtml = buildFooterHtml(template, metadata, qrDataUrl, userName);
  const signatureSection = buildSignatureSection(template, metadata);
  const watermark = buildWatermark(template, metadata);
  const coverPage = buildCoverPage(template, metadata);

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: ${template.fontFamily || 'Arial, sans-serif'};
          font-size: ${template.fontSize || 11}px;
          color: #1e293b;
          line-height: 1.5;
        }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 6px 8px; border: 1px solid #e2e8f0; text-align: left; font-size: ${template.fontSize || 11}px; }
        thead { display: table-header-group; }
        th { background: ${template.secondaryColor || '#64748b'}; color: #fff; font-weight: bold; }
        tr:nth-child(even) { background: #f8fafc; }
        h1, h2, h3, h4 { color: ${template.primaryColor || '#1e40af'}; margin-top: 16px; margin-bottom: 8px; }
        h1 { font-size: 20px; }
        h2 { font-size: 16px; }
        h3 { font-size: 14px; }
        .page-break { page-break-before: always; }
        .document-header { position: running(header); }
        .document-footer { position: running(footer); }
        @page {
          size: ${template.pageSize || 'A4'} ${template.orientation || 'portrait'};
          margin: ${template.marginTop || 25}mm ${template.marginRight || 20}mm ${template.marginBottom || 25}mm ${template.marginLeft || 20}mm;
          @top-center { content: element(header); }
          @bottom-center { content: element(footer); }
        }
        .content { position: relative; z-index: 1; }
        .info-box {
          background: #f1f5f9; border-left: 4px solid ${template.primaryColor || '#1e40af'};
          padding: 10px 14px; margin: 12px 0; border-radius: 4px;
        }
        .meta-table { font-size: 10px; }
        .meta-table th { background: #f1f5f9; color: #475569; }
        .meta-table td { background: #fff; }
      </style>
    </head>
    <body>
      ${watermark}
      ${coverPage}
      <div class="document-header">${headerHtml}</div>
      <div class="document-footer">${footerHtml}</div>
      <div class="content">
        ${bodyHtml}
        ${signatureSection}
      </div>
    </body>
    </html>
  `;

  let browser: any = null;
  try {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
    browser = await puppeteer.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 60000 });

    const pdfBuffer = await page.pdf({
      format: (template.pageSize || 'A4') as any,
      landscape: template.orientation === 'landscape',
      printBackground: true,
      margin: {
        top: `${template.marginTop || 25}mm`,
        bottom: `${template.marginBottom || 25}mm`,
        left: `${template.marginLeft || 20}mm`,
        right: `${template.marginRight || 20}mm`,
      },
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: `<div></div>`,
    });

    const pageCount = await page.evaluate(() => {
      // Estimate page count from PDF
      return 1;
    });

    const fileHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

    return {
      buffer: pdfBuffer,
      pageCount,
      fileHash,
      qrDataUrl,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export function buildMetadataTable(metadata: PdfDocumentMetadata): string {
  const rows: string[] = [];

  if (metadata.module) {
    const modName = cleanModuleName(metadata.module);
    const subName = metadata.subModule ? ' / ' + cleanModuleName(metadata.subModule) : '';
    rows.push(`<tr><th>Módulo</th><td>${modName}${subName}</td></tr>`);
  }
  rows.push(`<tr><th>Código</th><td style="font-family:monospace;font-weight:bold;">${metadata.documentCode}</td></tr>`);
  rows.push(`<tr><th>Revisión</th><td>R${String(metadata.revision).padStart(2, '0')}${metadata.revision === 0 ? ' — Versión inicial' : ''}</td></tr>`);
  rows.push(`<tr><th>Estado</th><td>${translateStatus(metadata.status)}</td></tr>`);
  if (metadata.createdAt) {
    rows.push(`<tr><th>Fecha de creación</th><td>${formatDate(metadata.createdAt)}</td></tr>`);
  }
  if (metadata.approvedAt) {
    rows.push(`<tr><th>Fecha de aprobación</th><td>${formatDate(metadata.approvedAt)}</td></tr>`);
  }
  if (metadata.nextReviewDate) {
    rows.push(`<tr><th>Próxima revisión</th><td>${formatDate(metadata.nextReviewDate)}</td></tr>`);
  }
  if (metadata.confidentialLevel) {
    rows.push(`<tr><th>Clasificación</th><td>${metadata.confidentialLevel}</td></tr>`);
  }

  return `
    <table class="meta-table" style="width:100%;margin-bottom:16px;">
      ${rows.join('')}
    </table>
  `;
}
