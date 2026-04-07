import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Type-safe XLSX utils interface
interface XLSXUtils {
  aoa_to_sheet(data: any[][]): any;
  book_new(): any;
  book_append_sheet(wb: any, ws: any, name: string): void;
  write(wb: any, opts: any): ArrayBuffer;
}

const xlsxUtils = XLSX.utils as unknown as XLSXUtils;

export interface ExcelExportData {
  fileName: string;
  sheetName: string;
  headers: string[];
  data: any[][];
  metadata?: {
    title?: string;
    subtitle?: string;
    generatedBy?: string;
    generatedAt?: string;
  };
}

export function exportToExcel({
  fileName,
  sheetName,
  headers,
  data,
  metadata
}: ExcelExportData) {
  // Create workbook
  const wb = xlsxUtils.book_new();

  // Prepare data with headers
  const wsData = [headers, ...data];

  // Create worksheet
  const ws = xlsxUtils.aoa_to_sheet(wsData);

  // Add metadata at the top if provided
  if (metadata) {
    const metadataRows = [];
    if (metadata.title) metadataRows.push([metadata.title]);
    if (metadata.subtitle) metadataRows.push([metadata.subtitle]);
    if (metadata.generatedBy) metadataRows.push([`Generado por: ${metadata.generatedBy}`]);
    if (metadata.generatedAt) metadataRows.push([`Fecha: ${metadata.generatedAt}`]);
    metadataRows.push([]); // Empty row before headers

    // Insert metadata rows at the beginning
    const finalData = [...metadataRows, ...wsData];
    const wsWithMetadata = xlsxUtils.aoa_to_sheet(finalData);
    
    // Set column widths
    const colWidths = headers.map(() => ({ wch: 15 }));
    wsWithMetadata['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, wsWithMetadata, sheetName);
  } else {
    // Set column widths
    const colWidths = headers.map(() => ({ wch: 15 }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  // Generate Excel file
  const excelBuffer = xlsxUtils.write(wb, { bookType: 'xlsx', type: 'array' });

  // Save file
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const finalFileName = `${fileName}-${new Date().toISOString().split('T')[0]}.xlsx`;
  saveAs(blob, finalFileName);
}

// Specific export functions for different modules
export function exportIndicatorsToExcel(indicators: any[], metadata?: any) {
  const headers = [
    'Código',
    'Nombre',
    'Descripción',
    'Categoría',
    'Valor Actual',
    'Valor Objetivo',
    'Unidad',
    'Estado',
    'Frecuencia',
    'Última Medición',
    'Responsable'
  ];

  const data = indicators.map(indicator => [
    indicator.code || '',
    indicator.name || '',
    indicator.description || '',
    indicator.category || '',
    indicator.currentValue || 0,
    indicator.targetValue || 0,
    indicator.unit || '',
    indicator.status || '',
    indicator.frequency || '',
    indicator.lastMeasuredAt ? new Date(indicator.lastMeasuredAt).toLocaleDateString() : '',
    indicator.owner ? `${indicator.owner.firstName} ${indicator.owner.lastName}` : ''
  ]);

  exportToExcel({
    fileName: 'indicadores',
    sheetName: 'Indicadores',
    headers,
    data,
    metadata: {
      title: 'Reporte de Indicadores',
      subtitle: `Total de indicadores: ${indicators.length}`,
      generatedBy: 'SGI 360',
      generatedAt: new Date().toLocaleString(),
      ...metadata
    }
  });
}

export function exportRisksToExcel(risks: any[], metadata?: any) {
  const headers = [
    'ID',
    'Título',
    'Descripción',
    'Categoría',
    'Probabilidad',
    'Impacto',
    'Nivel de Riesgo',
    'Estado',
    'Dueño',
    'Fecha de Detección',
    'Fecha Límite'
  ];

  const data = risks.map(risk => [
    risk.id || '',
    risk.title || '',
    risk.description || '',
    risk.category || '',
    risk.probability || 0,
    risk.impact || 0,
    risk.riskLevel || '',
    risk.status || '',
    risk.owner ? `${risk.owner.firstName} ${risk.owner.lastName}` : '',
    risk.createdAt ? new Date(risk.createdAt).toLocaleDateString() : '',
    risk.dueDate ? new Date(risk.dueDate).toLocaleDateString() : ''
  ]);

  exportToExcel({
    fileName: 'riesgos',
    sheetName: 'Riesgos',
    headers,
    data,
    metadata: {
      title: 'Reporte de Riesgos',
      subtitle: `Total de riesgos: ${risks.length}`,
      generatedBy: 'SGI 360',
      generatedAt: new Date().toLocaleString(),
      ...metadata
    }
  });
}

export function exportTrainingsToExcel(trainings: any[], metadata?: any) {
  const headers = [
    'Código',
    'Título',
    'Categoría',
    'Modalidad',
    'Estado',
    'Fecha Programada',
    'Duración (horas)',
    'Instructor',
    'Participantes',
    'Ubicación'
  ];

  const data = trainings.map(training => [
    training.code || '',
    training.title || '',
    training.category || '',
    training.modality || '',
    training.status || '',
    training.scheduledDate ? new Date(training.scheduledDate).toLocaleDateString() : '',
    training.durationHours || 0,
    training.instructor || '',
    training.attendees ? training.attendees.length : 0,
    training.location || ''
  ]);

  exportToExcel({
    fileName: 'capacitaciones',
    sheetName: 'Capacitaciones',
    headers,
    data,
    metadata: {
      title: 'Reporte de Capacitaciones',
      subtitle: `Total de capacitaciones: ${trainings.length}`,
      generatedBy: 'SGI 360',
      generatedAt: new Date().toLocaleString(),
      ...metadata
    }
  });
}

export function exportNCRsToExcel(ncrs: any[], metadata?: any) {
  const headers = [
    'Código',
    'Título',
    'Descripción',
    'Severidad',
    'Origen',
    'Estado',
    'Norma',
    'Cláusula',
    'Fecha de Detección',
    'Fecha Límite',
    'Asignado a',
    'Creado por'
  ];

  const data = ncrs.map(ncr => [
    ncr.code || '',
    ncr.title || '',
    ncr.description || '',
    ncr.severity || '',
    ncr.source || '',
    ncr.status || '',
    ncr.standard || '',
    ncr.clause || '',
    ncr.detectedAt ? new Date(ncr.detectedAt).toLocaleDateString() : '',
    ncr.dueDate ? new Date(ncr.dueDate).toLocaleDateString() : '',
    ncr.assignedTo ? `${ncr.assignedTo.firstName} ${ncr.assignedTo.lastName}` : '',
    ncr.createdBy ? `${ncr.createdBy.firstName} ${ncr.createdBy.lastName}` : ''
  ]);

  exportToExcel({
    fileName: 'no-conformidades',
    sheetName: 'No Conformidades',
    headers,
    data,
    metadata: {
      title: 'Reporte de No Conformidades',
      subtitle: `Total de NCRs: ${ncrs.length}`,
      generatedBy: 'SGI 360',
      generatedAt: new Date().toLocaleString(),
      ...metadata
    }
  });
}

export function exportCustomerComplaintsToExcel(complaints: any[], metadata?: any) {
  const headers = [
    'Código',
    'Título',
    'Descripción',
    'Severidad',
    'Estado',
    'Fecha de Detección',
    'Tiempo de Respuesta (horas)',
    'Asignado a',
    'Acciones',
    'Estado de Acciones'
  ];

  const data = complaints.map(complaint => {
    const responseTime = complaint.createdAt && complaint.firstActionAt 
      ? (new Date(complaint.firstActionAt).getTime() - new Date(complaint.createdAt).getTime()) / (1000 * 60 * 60)
      : 0;

    return [
      complaint.code || '',
      complaint.title || '',
      complaint.description || '',
      complaint.severity || '',
      complaint.status || '',
      complaint.detectedAt ? new Date(complaint.detectedAt).toLocaleDateString() : '',
      responseTime.toFixed(1),
      complaint.assignedTo ? `${complaint.assignedTo.firstName} ${complaint.assignedTo.lastName}` : '',
      complaint.actions ? complaint.actions.length : 0,
      complaint.actions ? complaint.actions.filter((a: any) => a.status === 'COMPLETED').length : 0
    ];
  });

  exportToExcel({
    fileName: 'reclamos-clientes',
    sheetName: 'Reclamos de Clientes',
    headers,
    data,
    metadata: {
      title: 'Reporte de Reclamos de Clientes',
      subtitle: `Total de reclamos: ${complaints.length}`,
      generatedBy: 'SGI 360',
      generatedAt: new Date().toLocaleString(),
      ...metadata
    }
  });
}
