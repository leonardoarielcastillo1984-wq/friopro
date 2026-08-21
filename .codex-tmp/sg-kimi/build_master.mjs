import fs from 'node:fs/promises';
import {Workbook, SpreadsheetFile} from '@oai/artifact-tool';

const csv=await fs.readFile('outputs/sg-kimi-work/maestro_base.csv','utf8');
const wb=await Workbook.fromCSV(csv,{sheetName:'Maestro Documental'});
const master=wb.worksheets.getItem('Maestro Documental');
master.showGridLines=false; master.freezePanes.freezeRows(1); master.freezePanes.freezeColumns(3);
const used=master.getUsedRange(); used.format.font={name:'Aptos',size:9,color:'#1F2937'}; used.format.verticalAlignment='center';
master.getRange('A1:S1').format={fill:'#1F4E78',font:{bold:true,color:'#FFFFFF',size:10},wrapText:true,rowHeight:34,borders:{preset:'outside',style:'medium',color:'#17365D'}};
master.getRange('A2:S919').format.borders={insideHorizontal:{style:'thin',color:'#E5E7EB'}};
master.getRange('A2:A919').format.horizontalAlignment='center'; master.getRange('G2:H919').format.horizontalAlignment='center';
master.getRange('A:A').format.columnWidth=8; master.getRange('B:B').format.columnWidth=15; master.getRange('C:C').format.columnWidth=42;
master.getRange('D:D').format.columnWidth=22; master.getRange('E:E').format.columnWidth=24; master.getRange('F:F').format.columnWidth=58;
master.getRange('G:H').format.columnWidth=14; master.getRange('I:I').format.columnWidth=32; master.getRange('J:J').format.columnWidth=18;
master.getRange('K:K').format.columnWidth=32; master.getRange('L:M').format.columnWidth=26; master.getRange('N:O').format.columnWidth=16;
master.getRange('P:P').format.columnWidth=30; master.getRange('Q:Q').format.columnWidth=12; master.getRange('R:R').format.columnWidth=31; master.getRange('S:S').format.columnWidth=18;
master.getRange('A1:S919').format.wrapText=true;
master.getRange('I2:I919').conditionalFormats.add('containsText',{text:'Obsoleto',format:{fill:'#FDE2E1',font:{color:'#9B1C1C'}}});
master.getRange('I2:I919').conditionalFormats.add('containsText',{text:'Vigente',format:{fill:'#FFF4CE',font:{color:'#7A5A00'}}});
master.getRange('I2:I919').conditionalFormats.add('containsText',{text:'Registro',format:{fill:'#E2F0D9',font:{color:'#375623'}}});

const sum=wb.worksheets.add('Resumen'); sum.showGridLines=false;
sum.getRange('A1:H2').merge(); sum.getRange('A1').values=[['SISTEMA DE GESTIÓN KIMI — MAESTRO DOCUMENTAL']]; sum.getRange('A1:H2').format={fill:'#1F4E78',font:{bold:true,color:'#FFFFFF',size:20},verticalAlignment:'center'};
sum.getRange('A4:B10').values=[['Indicador','Resultado'],['Total de archivos',null],['Vigentes a validar',null],['Registros / evidencias',null],['Obsoletos',null],['Departamentos / procesos',16],['Fecha de corte','2026-08-19']];
sum.getRange('B5:B8').values=[[918],[592],[218],[108]];
sum.getRange('A4:B4').format={fill:'#5B9BD5',font:{bold:true,color:'#FFFFFF'}}; sum.getRange('A4:B10').format.borders={preset:'all',style:'thin',color:'#D9E2F3'};
sum.getRange('A:A').format.columnWidth=34; sum.getRange('B:B').format.columnWidth=22;
sum.getRange('D4:H4').merge(); sum.getRange('D4').values=[['Criterios de uso']]; sum.getRange('D4:H4').format={fill:'#5B9BD5',font:{bold:true,color:'#FFFFFF'}};
sum.getRange('D5:H10').merge(); sum.getRange('D5').values=[['Los documentos identificados como “Vigente — validar contenido y aprobar” requieren validación del dueño de proceso y aprobación formal antes de su liberación. Los archivos ubicados en carpetas Obsoleto/Obsoletos quedan bloqueados para uso operativo. Los registros y evidencias se conservan sin alterar para preservar integridad y trazabilidad.']]; sum.getRange('D5:H10').format={fill:'#EAF2F8',wrapText:true,verticalAlignment:'top',font:{size:11,color:'#1F2937'},rowHeight:28};

const gap=wb.worksheets.add('Plan de adecuación'); gap.showGridLines=false; gap.freezePanes.freezeRows(1);
gap.getRange('A1:H1').values=[['N°','Acción requerida','Norma / cláusula','Responsable','Prioridad','Estado','Fecha objetivo','Evidencia de cierre']];
gap.getRange('A2:H13').values=[
[1,'Aprobar alcance, contexto y partes interesadas','ISO 4.1–4.3','Dirección / Calidad','Alta','Pendiente','2026-09-15','Acta y manual aprobados'],
[2,'Aprobar política y objetivos medibles','ISO 5.2; 6.2','Dirección','Alta','Pendiente','2026-09-15','Política publicada y tablero'],
[3,'Validar mapa e interacción de procesos','ISO 4.4','Calidad / Procesos','Alta','Pendiente','2026-09-30','Mapa y fichas aprobadas'],
[4,'Consolidar requisitos específicos de clientes','IATF 4.3.2; 5.1.1.1','Comercial / Calidad','Alta','Pendiente','2026-09-30','Matriz CSR'],
[5,'Completar análisis de riesgos y contingencias','ISO 6.1; IATF 6.1.2.1, 6.1.2.3','Todos los procesos','Alta','Pendiente','2026-10-15','Matrices y simulacros'],
[6,'Validar competencia y eficacia de capacitación','ISO 7.2; IATF 7.2.1','RRHH / Procesos','Media','Pendiente','2026-10-15','Matriz y evaluaciones'],
[7,'Controlar proveedores y desarrollo','ISO 8.4; IATF 8.4.2.3','Compras / Calidad','Alta','Pendiente','2026-10-31','Evaluaciones y planes'],
[8,'Alinear PFMEA, planes de control e instrucciones','IATF 8.5.1.1–8.5.1.3','Operaciones / Calidad','Alta','Pendiente','2026-11-15','Documentos coherentes'],
[9,'Validar calibración, MSA y laboratorios','ISO 7.1.5; IATF 7.1.5.1','Calidad / Mantenimiento','Alta','Pendiente','2026-11-15','Programa y estudios'],
[10,'Ejecutar auditorías de sistema, proceso y producto','IATF 9.2.2.1–9.2.2.4','Calidad','Alta','Pendiente','2026-12-15','Informes y cierres'],
[11,'Realizar revisión por la dirección','ISO 9.3; IATF 9.3.2.1','Dirección','Alta','Pendiente','2027-01-15','Acta y acciones'],
[12,'Cerrar no conformidades y verificar eficacia','ISO 10.2; IATF 10.2.3','Dueños de proceso','Alta','Pendiente','2027-02-15','8D / acciones cerradas']];
gap.getRange('A1:H1').format={fill:'#1F4E78',font:{bold:true,color:'#FFFFFF'},wrapText:true}; gap.getRange('A1:H13').format.borders={preset:'all',style:'thin',color:'#D9E2F3'}; gap.getRange('A1:H13').format.wrapText=true;
for (const [c,w] of [['A:A',7],['B:B',44],['C:C',27],['D:D',25],['E:F',14],['G:G',16],['H:H',32]]) gap.getRange(c).format.columnWidth=w;
gap.getRange('F2:F13').dataValidation={rule:{type:'list',values:['Pendiente','En curso','Cerrado','Bloqueado']}};

const out='outputs/sg-kimi-work/FG-18.H_Maestro_de_Documentos_SG_KIMI.xlsx'; const blob=await SpreadsheetFile.exportXlsx(wb); await blob.save(out);
console.log((await wb.inspect({kind:'sheet',include:'id,name',maxChars:2000})).ndjson);
const err=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',options:{useRegex:true,maxResults:50},summary:'formula errors'}); console.log(err.ndjson);
for (const [s,r,n] of [['Resumen','A1:H12','resumen'],['Maestro Documental','A1:S25','maestro'],['Plan de adecuación','A1:H13','plan']]) {const im=await wb.render({sheetName:s,range:r,scale:1.5,format:'png'}); await fs.writeFile(`outputs/sg-kimi-work/${n}.png`,new Uint8Array(await im.arrayBuffer()));}
