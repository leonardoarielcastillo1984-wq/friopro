/**
 * Document Export Service — Sistema Global de Exportación Documental
 * Orquesta: datos → plantilla → PDF → registro → QR
 */
import type { PrismaClient } from '@prisma/client';
import { renderPdf, buildMetadataTable, type PdfTemplateConfig, type PdfDocumentMetadata } from './pdf-render.js';
import crypto from 'crypto';

export interface ExportContext {
  tenantId: string;
  userId?: string;
  userName?: string;
  userIp?: string;
  userAgent?: string;
}

export interface ExportRequest {
  outputDefinitionId: string;
  exportType: 'CONTROLLED' | 'INFORMATIVE';
  bodyHtml: string;
  title?: string;
  filters?: Record<string, any>;
  recordCount?: number;
}

export interface ExportResult {
  buffer: Buffer;
  fileName: string;
  fileSize: number;
  pageCount: number;
  fileHash: string;
  exportId: string;
  validationToken?: string;
}

export async function executeExport(
  prisma: PrismaClient,
  ctx: ExportContext,
  req: ExportRequest
): Promise<ExportResult> {
  const prismaAny = prisma as any;

  // 1. Obtener la definición de salida
  const outputDef = await prismaAny.documentOutputDefinition.findFirst({
    where: {
      id: req.outputDefinitionId,
      tenantId: ctx.tenantId,
      deletedAt: null,
    },
    include: {
      template: true,
    },
  });

  if (!outputDef) {
    throw new Error('Definición de salida no encontrada');
  }

  if (!outputDef.allowExport) {
    throw new Error('Esta salida no permite exportación');
  }

  // 2. Solo documentos EFFECTIVE pueden exportarse como CONTROLLED
  if (req.exportType === 'CONTROLLED' && outputDef.status !== 'EFFECTIVE') {
    throw new Error('Solo los documentos vigentes pueden exportarse como PDF controlado');
  }

  // 3. Construir configuración de plantilla
  const template: PdfTemplateConfig = outputDef.template
    ? {
        headerLogoUrl: outputDef.template.headerLogoUrl,
        headerLogoSecondaryUrl: outputDef.template.headerLogoSecondaryUrl,
        companyName: outputDef.template.companyName,
        commercialName: outputDef.template.commercialName,
        companyAddress: outputDef.template.companyAddress,
        companyCuit: outputDef.template.companyCuit,
        companySite: outputDef.template.companySite,
        footerText: outputDef.template.footerText,
        footerLegalText: outputDef.template.footerLegalText,
        footerShowPageNum: outputDef.template.footerShowPageNum,
        footerShowDate: outputDef.template.footerShowDate,
        footerShowUser: outputDef.template.footerShowUser,
        footerShowQR: outputDef.template.footerShowQR,
        footerShowStatus: outputDef.template.footerShowStatus,
        pageSize: outputDef.template.pageSize,
        orientation: outputDef.template.orientation,
        marginTop: outputDef.template.marginTop,
        marginBottom: outputDef.template.marginBottom,
        marginLeft: outputDef.template.marginLeft,
        marginRight: outputDef.template.marginRight,
        primaryColor: outputDef.template.primaryColor,
        secondaryColor: outputDef.template.secondaryColor,
        fontFamily: outputDef.template.fontFamily,
        fontSize: outputDef.template.fontSize,
        showCoverPage: outputDef.template.showCoverPage,
        showTableOfContents: outputDef.template.showTableOfContents,
        watermarkText: outputDef.template.watermarkText,
        watermarkOpacity: outputDef.template.watermarkOpacity,
        showSignatures: outputDef.template.showSignatures,
        signatureStyle: outputDef.template.signatureStyle,
      }
    : {
        primaryColor: '#1e40af',
        secondaryColor: '#64748b',
        fontSize: 11,
        showSignatures: outputDef.includeSignatures,
        footerShowQR: outputDef.includeQR,
        footerShowStatus: true,
      };

  // 4. Construir metadata del documento
  const metadata: PdfDocumentMetadata = {
    documentCode: outputDef.documentCode || 'SIN-CODIGO',
    revision: outputDef.revision || 0,
    title: req.title || outputDef.screenName,
    status: outputDef.status,
    exportType: req.exportType,
    module: outputDef.module,
    subModule: outputDef.subModule || undefined,
    confidentialLevel: outputDef.confidentialLevel || undefined,
  };

  // 5. Generar token de validación
  const validationToken = crypto.randomBytes(24).toString('hex');
  const validationUrl = `${process.env.PUBLIC_URL || 'https://logismart.ar'}/validate-doc?token=${validationToken}`;

  // 6. Renderizar PDF
  const fullBody = buildMetadataTable(metadata) + req.bodyHtml;

  const pdfResult = await renderPdf({
    template,
    metadata,
    bodyHtml: fullBody,
    validationUrl: outputDef.includeQR ? validationUrl : undefined,
    userName: ctx.userName,
  });

  // 7. Generar nombre de archivo
  const safeCode = (outputDef.documentCode || 'documento').replace(/[^a-zA-Z0-9-]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `${safeCode}_R${String(outputDef.revision || 0).padStart(2, '0')}_${dateStr}.pdf`;

  // 8. Registrar exportación
  const exportRecord = await prismaAny.documentExport.create({
    data: {
      tenantId: ctx.tenantId,
      outputDefinitionId: outputDef.id,
      documentCode: outputDef.documentCode,
      revisionNumber: outputDef.revision || 0,
      documentTitle: metadata.title,
      exportType: req.exportType,
      templateName: outputDef.template?.name,
      fileName,
      fileSize: pdfResult.buffer.length,
      pageCount: pdfResult.pageCount,
      fileHash: pdfResult.fileHash,
      filters: req.filters || undefined,
      recordCount: req.recordCount || 0,
      userId: ctx.userId,
      userName: ctx.userName,
      userIp: ctx.userIp,
      userAgent: ctx.userAgent,
    },
  });

  // 9. Crear token de validación
  if (outputDef.includeQR) {
    const valToken = await prismaAny.documentValidationToken.create({
      data: {
        tenantId: ctx.tenantId,
        token: validationToken,
        outputDefinitionId: outputDef.id,
        documentCode: outputDef.documentCode,
        revision: outputDef.revision || 0,
        exportId: exportRecord.id,
        documentStatus: outputDef.status,
        documentTitle: metadata.title,
        expiresAt: null,
      },
    });

    await prismaAny.documentExport.update({
      where: { id: exportRecord.id },
      data: { validationTokenId: valToken.id },
    });
  }

  // 10. Actualizar estadísticas de la definición
  await prismaAny.documentOutputDefinition.update({
    where: { id: outputDef.id },
    data: {
      lastExportAt: new Date(),
      exportCount: { increment: 1 },
    },
  });

  return {
    buffer: pdfResult.buffer,
    fileName,
    fileSize: pdfResult.buffer.length,
    pageCount: pdfResult.pageCount,
    fileHash: pdfResult.fileHash,
    exportId: exportRecord.id,
    validationToken: outputDef.includeQR ? validationToken : undefined,
  };
}
