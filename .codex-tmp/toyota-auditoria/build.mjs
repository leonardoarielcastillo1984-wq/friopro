import fs from "node:fs/promises";
import { FileBlob, Workbook, SpreadsheetFile } from "@oai/artifact-tool";

const rows = [
[1,"Normativa","N-00 – Subcontratación","Matriz que demuestre que los subcontratados cumplen las mismas políticas, capacitaciones, sanciones, controles, mantenimiento y tecnología. Contratos y evaluaciones de proveedores.","Contrataciones"],
[2,"Normativa","N-1 – Gestión legal","Matriz legal actualizada, porcentaje de cumplimiento, vencimientos, responsables, desvíos, planes de adecuación y calendario de auditorías internas.","Legales"],
[3,"Normativa","N-2 – Certificaciones ISO","Certificados vigentes, alcance, vencimientos, informes de auditorías internas y externas y seguimiento de hallazgos.","Calidad/Sistema de Gestión"],
[4,"Normativa","N-3 – ISO 39001","Certificado vigente o, si no existe, diagnóstico de brecha, sistema equivalente implementado y plan de certificación.","Calidad/Sistema de Gestión"],
[5,"Normativa","N-4 – Política de Seguridad y Salud","Política firmada por Dirección, versión vigente y evidencias de difusión: cartelería, plataforma, inducciones y acuses de lectura.","Seguridad e Higiene"],
[6,"Normativa","N-5 – Responsable de Seguridad","Designación formal, título habilitante, organigrama, descripción del puesto y evidencias de acciones lideradas.","Dirección/Gerencia General"],
[7,"Normativa","N-6 – Manual de Conducción Segura","Manual vigente, control de versiones, contenidos, registros de entrega y comprobación de lectura de los conductores.","Seguridad e Higiene"],
[8,"Normativa","N-7 – Plan ante emergencias","Procedimientos para accidentes, somnolencia, pérdida de carga, averías y emergencias; contactos, simulacros, registros y mejoras posteriores.","Seguridad e Higiene"],
[9,"Normativa","N-8 – Jornada de trabajo","Procedimiento, planificación de turnos, horas conducidas, descansos, excesos, autorizaciones de horas extra, alertas e indicadores.","Tráfico"],
[10,"Normativa","N-9 – Evaluaciones médicas","Procedimiento, cronograma, aptitudes médicas vigentes y controles de sueño, audición, visión y condición física. Presentar los datos sensibles anonimizados.","RR. HH."],
[11,"Normativa","N-10 – Comité de Seguridad","Calendario, conformación, minutas, asistentes, temas tratados, compromisos, responsables y evidencias de cierre.","Seguridad e Higiene"],
[12,"Normativa","N-11 – Reducción de siniestralidad","Constancia ante ART o aseguradora, plan de reducción, metas, seguimiento y acciones aplicadas a conducción o mantenimiento.","Seguridad e Higiene"],
[13,"Normativa","N-12 – Investigación de accidentes","Procedimiento y caso anonimizado con descripción, causa raíz, contramedidas, responsables, cierre, Yokoten y revisión de riesgos.","Seguridad e Higiene"],
[14,"Normativa","N-13 – Velocidad máxima","Tabla de velocidades por ruta y clima, estándar comunicado, configuración de alertas y reportes de excesos con acciones tomadas.","Seguridad e Higiene"],
[15,"Método y Gestión","M/G 14 – Liderazgo en seguridad","Recorridas, charlas, reuniones, decisiones, recursos aprobados y seguimiento de indicadores por parte de la Dirección.","Dirección/Gerencia General"],
[16,"Método y Gestión","M/G 15 – Compromiso","Declaración de compromiso firmada por la alta gerencia, vinculada con los riesgos reales y comunicada a toda la organización.","Dirección/Gerencia General"],
[17,"Método y Gestión","M/G 16 – Objetivos de SST","Objetivos anuales, metas cuantificadas, KPI, responsables, plazos, evolución interanual y criterio de actualización.","Seguridad e Higiene"],
[18,"Método y Gestión","M/G 17 – Plan de acción","Plan con acción, origen, riesgo, prioridad, responsable, fecha prevista, estado, evidencia y verificación de eficacia.","Seguridad e Higiene"],
[19,"Método y Gestión","M/G 18 – Evaluación de riesgos","Matriz por operación, ruta, parada, carga, abastecimiento y pernocte; metodología, valoración y controles definidos.","Seguridad e Higiene"],
[20,"Método y Gestión","M/G 19 – Reducción de riesgos","Acciones derivadas de la matriz, priorización, avance, fotografías de antes y después y comprobación de eficacia en campo.","Seguridad e Higiene"],
[21,"Método y Gestión","M/G 20 – Selección e inducción","Procedimiento de selección, antecedentes viales, evaluaciones conductuales, inducción, examen y habilitación del conductor.","RR. HH."],
[22,"Método y Gestión","M/G 21 – Régimen de sanciones","Política de consecuencias, clasificación y gradualidad de desvíos, trazabilidad de casos, capacitación y seguimiento posterior.","RR. HH."],
[23,"Método y Gestión","M/G 22 – Puesto de trabajo","Estándar de cabina, checklist 4S, estudio ergonómico, inventario de tecnologías y resultados de auditorías por unidad.","Seguridad e Higiene"],
[24,"Método y Gestión","M/G 23 – Verificación del descanso","Registros de sueño y descanso, criterios de aptitud, lugares homologados y evidencias de higiene y confort.","Tráfico"],
[25,"Método y Gestión","M/G 24 – Reportes de terceros","Canal de denuncias, casos recibidos, investigaciones, KPI, respuestas y contramedidas implementadas.","Calidad/Sistema de Gestión"],
[26,"Método y Gestión","M/G 25 – Auditoría de manejo","Checklist de observación, auditorías en ruta, telemetría, cámaras, devolución al conductor y acciones correctivas.","Seguridad e Higiene"],
[27,"Método y Gestión","M/G 26 – Documentación del vehículo","Estándar documental, checklist previo al viaje, documentación vigente y alertas o bloqueos por vencimientos.","Tráfico"],
[28,"Método y Gestión","M/G 27 – Carga física y cognitiva","Evaluación por ruta y tarea, esquema de pausas y postas, semáforo de riesgo, capacitación y análisis de incidentes por fatiga.","RR. HH."],
[29,"Método y Gestión","M/G 28 – Reportes a autoridades","Notas, expedientes o tickets por deterioro de rutas, periodicidad, seguimiento, respuestas y reiteraciones.","Legales"],
[30,"Método y Gestión","M/G 29 – Aviso de peligro","Procedimiento, formulario o canal de reporte, capacitación, mapa de avisos, tendencias y medidas adoptadas.","Seguridad e Higiene"],
[31,"Método y Gestión","M/G 30 – KPI internos","Tablero con accidentes, incidentes, infracciones, fatiga, jornada, velocidad y conducción riesgosa; metas, tendencias y causas.","Calidad/Sistema de Gestión"],
[32,"Método y Gestión","M/G 31 – Cultura de seguridad","Programa anual, campañas, charlas, encuestas, reconocimientos y comunicación de aprendizajes de incidentes.","RR. HH."],
[33,"Método y Gestión","M/G 32 – Auditoría de cultura","Metodología, encuesta, dimensiones medidas, resultados segmentados, evolución y plan de mejora.","RR. HH."],
[34,"Método y Gestión","M/G 33 – Puntos críticos","Rotogramas, mapas de riesgos, curvas, pendientes, accesos, zonas inseguras, velocidades y paradas homologadas.","Tráfico"],
[35,"Método y Gestión","M/G 34 – Campañas internas","Calendario, piezas utilizadas, asistentes, participación de Dirección y conductores, fotografías y medición de alcance.","RR. HH."],
[36,"Método y Gestión","M/G 35 – Chequeo de salud","Registros de presión, temperatura, descanso, medicación y alcohol; criterios de bloqueo y calibración de los equipos.","RR. HH."],
[37,"Factor humano","M/O 36 – Verificación cognitiva","Entrevista o encuesta, criterios de riesgo psicosocial, registros anonimizados, derivaciones y seguimiento.","RR. HH."],
[38,"Factor humano","M/O 37 – Charlas diarias","Cronograma, temas, minutas, asistentes, afiches y evidencia de charlas de cinco minutos.","Tráfico"],
[39,"Factor humano","M/O 38 – Charlas posteriores a eventos","Procedimiento, material utilizado, convocatoria, asistencia y acciones surgidas de accidentes, infracciones o actos inseguros.","Seguridad e Higiene"],
[40,"Factor humano","M/O 39 – Reporte interno de eventos","Reporte completo con fecha, descripción, causa raíz, contramedidas, cierre, Yokoten y actualización de riesgos.","Seguridad e Higiene"],
[41,"Factor humano","M/O 40 – Plan de capacitación","Plan anual por rol, fechas, horas, contenidos, vencimientos, asistencia y porcentaje de cumplimiento.","RR. HH."],
[42,"Factor humano","M/O 41 – Estrategias de capacitación","Evidencias de simuladores, simulacros, ludoprevención, casos reales y prácticas controladas de conducción segura.","Seguridad e Higiene"],
[43,"Factor humano","M/O 42 – Manejo de emociones","Temario sobre agresiones, tránsito, estrés y autocontrol; registros de asistencia y evaluación.","RR. HH."],
[44,"Factor humano","M/O 43 – Pausas activas","Directriz, ejercicios, frecuencia, material educativo, incorporación al viaje y control de cumplimiento.","RR. HH."],
[45,"Factor humano","M/O 44 – Hábitos saludables","Programa y material sobre descanso, alimentación, hidratación, sobrepeso, fatiga y somnolencia posprandial.","RR. HH."],
[46,"Factor humano","M/O 45 – Normas de manejo seguro","Plan, temario, material, asistencia y evaluaciones alineadas con el manual y los riesgos monitoreados.","Seguridad e Higiene"],
[47,"Factor humano","M/O 46 – Manejo defensivo","Temario, prácticas, registros y evaluación sobre anticipación, velocidad, clima, conducción nocturna y autocuidado.","Seguridad e Higiene"],
[48,"Factor humano","M/O 47 – Plataforma de comunicación","Demostración de intranet o aplicación, biblioteca de procedimientos, videos, alertas y acceso remoto de los conductores.","RR. HH."],
[49,"Factor humano","M/O 48 – Instructores especializados","CV, certificados, instituciones acreditantes, vigencias, recertificaciones y actualizaciones realizadas.","RR. HH."],
[50,"Factor humano","M/O 49 – Evaluación de capacitación","Exámenes posteriores, resultados por persona y tema, análisis de brechas y refuerzos aplicados.","Seguridad e Higiene"],
[51,"Factor humano","M/O 50 – Material posterior","Manuales, presentaciones, videos o fichas entregados; acceso posterior, control de versión y trazabilidad de entrega.","Seguridad e Higiene"],
[52,"Factor humano","M/O 51 – Evaluación previa y satisfacción","Pretest, postest, comparación de aprendizaje, encuestas de satisfacción y mejoras originadas en sugerencias.","Seguridad e Higiene"],
[53,"Entorno","E 52 – Riesgos físicos","Protocolos y mediciones de ruido, vibraciones, ventilación y otros agentes; resultados y acciones de mejora.","Seguridad e Higiene"],
[54,"Entorno","E 53 – Asistencia de viaje","Procedimiento y demostración del análisis de clima, tránsito, cortes, zonas hostiles, paradas seguras, alertas y desvíos.","Tráfico"],
[55,"Tecnología","T 54 – Cámaras internas y externas","Inventario de unidades, visualización en vivo, grabaciones, detección de desvíos, reportes y cobertura de flota.","Seguimiento"],
[56,"Tecnología","T 55 – Detección de somnolencia","Demostración del sensor, alerta en cabina y central, eventos registrados, escalamiento y acciones tomadas.","Seguimiento"],
[57,"Tecnología","T 56 – Rastreo de ubicación","Mapa en tiempo real con ubicación, encendido, velocidad, recorrido y tiempo de conducción.","Seguimiento"],
[58,"Tecnología","T 57 – Distancia segura","Prueba del sistema, advertencia al conductor, registro del evento, reportes y cobertura de flota.","Seguimiento"],
[59,"Tecnología","T 58 – Frenadas bruscas","Reportes con fecha, ubicación, intensidad, causa probable, conductor, investigación y contramedidas.","Seguimiento"],
[60,"Tecnología","T 59 – Central de monitoreo","Operación en vivo, horarios, dotación, tablero, alertas, protocolos de actuación y seguimiento de casos.","Seguimiento"],
[61,"Tecnología","T 60 – Precolisión y velocidad adaptativa","Inventario, ficha técnica, prueba o video, mantenimiento y registros de alertas o intervenciones.","Mantenimiento e Ingeniería de Flota"],
[62,"Tecnología","T 61 – Iluminación automática","Verificación física, listado de unidades equipadas y registros de inspección y mantenimiento.","Mantenimiento e Ingeniería de Flota"],
[63,"Tecnología","T 62 – Uso del cinturón","Alarma en cabina, registro remoto, reportes de incumplimientos, cobertura y acciones tomadas.","Seguridad e Higiene"],
[64,"Tecnología","T 63 – Alcohol y estupefacientes","Procedimiento previo al viaje, registros, equipo utilizado, calibración, intervención de terceros y bloqueo de marcha.","RR. HH."],
[65,"Tecnología","T 64 – Velocidad en zonas críticas","Geocercas, límites configurados, mapas, alertas, infracciones y medidas para prevenir vuelcos.","Seguridad e Higiene"],
[66,"Tecnología","T 65 – ABS y ESP","Inventario de flota, fichas técnicas, registros de mantenimiento y protocolo ante fallas.","Mantenimiento e Ingeniería de Flota"],
[67,"Tecnología","T 66 – Limitación de velocidad","Configuración por vehículo, alerta en cabina, reportes de excesos y mantenimiento del sistema.","Mantenimiento e Ingeniería de Flota"],
[68,"Tecnología","T 67 – Detención remota","Procedimiento autorizado, condiciones de aplicación, responsables, advertencia previa, prueba segura y registros de uso.","Seguridad Patrimonial"],
[69,"Tecnología","T 68 – Luz de frenada de emergencia","Demostración o video, listado de unidades y registros de chequeo preventivo.","Mantenimiento e Ingeniería de Flota"],
[70,"Tecnología","T 69 – Sensor de ángulo ciego","Inventario, demostración, alarmas, pruebas, mantenimiento y registros de calibración.","Mantenimiento e Ingeniería de Flota"],
[71,"Tecnología","T 70 – Velocidad con lluvia","Límites diferenciados, fuente meteorológica, configuración, telemetría y reportes de cumplimiento.","Tráfico"],
[72,"Tecnología","T 71 – Botón antipánico","Ubicación, prueba de activación, recepción de la alerta, geolocalización y protocolo de respuesta.","Seguridad Patrimonial"],
[73,"Tecnología","T 72 – Aviso automático de emergencia","Documentación del sistema, prueba, detección de colisión o vuelco, datos enviados y protocolo de asistencia.","Seguimiento"],
[74,"Tecnología","T 73 – Comunicación segura","Sistema manos libres, estandarización de flota, procedimientos de comunicación, pruebas y auditorías de uso.","Tráfico"],
[75,"Tecnología","T 74 – Pantalla GPS","Demostración de ubicación, interfaz, rutas, riesgos y paradas seguras; capacitación y auditoría de uso.","Seguimiento"],
[76,"Máquina","M 75 – Puesto de trabajo","Auditorías de cabina, cobertura de flota, hallazgos, contramedidas, fotografías e indicadores.","Seguridad e Higiene"],
[77,"Máquina","M 76 – Mantenimiento","Programa preventivo y correctivo, historial por unidad, componentes críticos, personal capacitado, KPI y protocolo de inmovilización.","Mantenimiento e Ingeniería de Flota"],
[78,"Máquina","M 77 – Inspección pre y post viaje","Checklist, registros por viaje, revisión de frenos, luces, neumáticos y fluidos, y tratamiento de fallas.","Tráfico"],
[79,"Máquina","M 78 – Fallas en sistemas de seguridad","Procedimiento para fallas de cámaras, GPS y sensores; criterios de detención, comunicación, reparación y plan alternativo.","Mantenimiento e Ingeniería de Flota"],
[80,"Máquina","M 79 – Calibración","Padrón con equipo, marca, modelo, serie, última y próxima calibración, proveedor, certificado, estado y alertas.","Mantenimiento e Ingeniería de Flota"],
[81,"Máquina","M 80 – Vida útil de vehículos","Política de vida útil, base de flota, antigüedad, condición, proyección y plan de renovación.","Tráfico"],
[82,"Máquina","M 81 – Estándar de adquisición o subcontratación","Especificación mínima, evaluación técnica, checklist de recepción, contratos, pruebas y seguimiento de proveedores.","Contrataciones"],
[83,"Máquina","M 82 – Visualización del entorno","Inventario y demostración de cámaras, espejos y sensores; mantenimiento, auditorías y cobertura de flota.","Mantenimiento e Ingeniería de Flota"],
];

const sourcePath = "/Users/leonardocastillo/Downloads/Auditoria en Seguridad del Transporte DADA 2026 AUTOEVALUACIÓN.XLSX";
const sourceWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(sourcePath));
const sourceRows = sourceWorkbook.worksheets.getItem("1° AUDITORIA").getRange("B6:D98").values;
const originalQuestions = sourceRows.filter((row) => row[0]).map((row) => row[2] ?? "");
if (originalQuestions.length !== rows.length) throw new Error(`Se esperaban ${rows.length} preguntas y se encontraron ${originalQuestions.length}`);
const detailRows = rows.map((row, index) => [row[0], row[1], row[2], originalQuestions[index], row[3], row[4]]);

const workbook = Workbook.create();
const detail = workbook.worksheets.add("Plan de auditoría");
const summary = workbook.worksheets.add("Resumen");

detail.showGridLines = false;
detail.getRange("A1:L1").merge();
detail.getRange("A1").values = [["AUDITORÍA DE SEGURIDAD DEL TRANSPORTE · DADA 2026"]];
detail.getRange("A2:L2").merge();
detail.getRange("A2").values = [["Tablero de evidencias, responsables y avance · 83 puntos de auditoría"]];
detail.getRange("A4:L4").values = [["N.º","Categoría","Punto de auditoría","Pregunta original (Question)","Documentación / evidencia a presentar","Departamento responsable","Responsable asignado","Estado","% cumplimiento","Fecha objetivo","Próximo paso","Observaciones"]];
detail.getRange("A5:F87").values = detailRows;
detail.getRange("G5:G87").values = Array.from({length:83},()=>[""]);
detail.getRange("H5:H87").values = Array.from({length:83},()=>["Pendiente"]);
detail.getRange("I5:I87").values = Array.from({length:83},()=>[0]);
detail.getRange("J5:L87").values = Array.from({length:83},()=>[null,"",""]);

detail.getRange("A1:L1").format = {fill:"#1F4E78",font:{bold:true,color:"#FFFFFF",size:18},horizontalAlignment:"left",verticalAlignment:"center"};
detail.getRange("A2:L2").format = {fill:"#D9EAF7",font:{color:"#1F4E78",italic:true,size:11},horizontalAlignment:"left",verticalAlignment:"center"};
detail.getRange("A4:L4").format = {fill:"#2F75B5",font:{bold:true,color:"#FFFFFF",size:10},horizontalAlignment:"center",verticalAlignment:"center",wrapText:true,borders:{bottom:{style:"medium",color:"#1F4E78"}}};
detail.getRange("A5:L87").format = {font:{color:"#222222",size:10},verticalAlignment:"top",wrapText:true,borders:{bottom:{style:"thin",color:"#D9E2F3"}}};
detail.getRange("A5:A87").format.horizontalAlignment = "center";
detail.getRange("B5:B87").format.font = {bold:true,color:"#44546A",size:10};
detail.getRange("C5:C87").format.font = {bold:true,color:"#1F1F1F",size:10};
detail.getRange("D5:D87").format = {fill:"#F4F8FC",font:{color:"#3F4E5E",size:10},verticalAlignment:"top",wrapText:true,borders:{bottom:{style:"thin",color:"#D9E2F3"}}};
detail.getRange("F5:F87").format = {fill:"#EAF2F8",font:{bold:true,color:"#1F4E78",size:10},verticalAlignment:"top",wrapText:true,borders:{bottom:{style:"thin",color:"#D9E2F3"}}};
detail.getRange("G5:G87").format = {fill:"#F6F8FA",font:{color:"#44546A",size:10},verticalAlignment:"center",wrapText:true,borders:{bottom:{style:"thin",color:"#D9E2F3"}}};
detail.getRange("H5:H87").format = {fill:"#FFF2CC",font:{bold:true,color:"#7F6000",size:10},horizontalAlignment:"center",verticalAlignment:"center",borders:{bottom:{style:"thin",color:"#D9E2F3"}}};
detail.getRange("I5:I87").format = {fill:"#F3F6F9",font:{bold:true,color:"#1F4E78",size:10},horizontalAlignment:"center",verticalAlignment:"center",borders:{bottom:{style:"thin",color:"#D9E2F3"}}};
detail.getRange("I5:I87").setNumberFormat("0%");
detail.getRange("J5:J87").setNumberFormat("dd/mm/yyyy");
detail.getRange("J5:J87").format.horizontalAlignment = "center";
detail.getRange("A1:L1").format.rowHeight = 32;
detail.getRange("A2:L2").format.rowHeight = 23;
detail.getRange("A4:L4").format.rowHeight = 38;
detail.getRange("A5:L87").format.rowHeight = 68;
detail.getRange("A:A").format.columnWidth = 6;
detail.getRange("B:B").format.columnWidth = 19;
detail.getRange("C:C").format.columnWidth = 34;
detail.getRange("D:D").format.columnWidth = 58;
detail.getRange("E:E").format.columnWidth = 58;
detail.getRange("F:F").format.columnWidth = 28;
detail.getRange("G:G").format.columnWidth = 24;
detail.getRange("H:H").format.columnWidth = 17;
detail.getRange("I:I").format.columnWidth = 16;
detail.getRange("J:J").format.columnWidth = 16;
detail.getRange("K:K").format.columnWidth = 32;
detail.getRange("L:L").format.columnWidth = 32;
detail.getRange("A5:L87").format.autofitRows();
detail.freezePanes.freezeRows(4);
detail.freezePanes.freezeColumns(2);
detail.getRange("H5:H87").dataValidation = {rule:{type:"list",values:["Pendiente","En curso","Bloqueado","Completo","No aplica"]}};
detail.getRange("I5:I87").dataValidation = {rule:{type:"decimal",operator:"between",formula1:0,formula2:1}};
detail.getRange("H5:H87").conditionalFormats.add("containsText",{text:"Completo",format:{fill:"#C6EFCE",font:{bold:true,color:"#006100"}}});
detail.getRange("H5:H87").conditionalFormats.add("containsText",{text:"En curso",format:{fill:"#DDEBF7",font:{bold:true,color:"#1F4E78"}}});
detail.getRange("H5:H87").conditionalFormats.add("containsText",{text:"Bloqueado",format:{fill:"#F4CCCC",font:{bold:true,color:"#9C0006"}}});
detail.getRange("H5:H87").conditionalFormats.add("containsText",{text:"No aplica",format:{fill:"#E7E6E6",font:{italic:true,color:"#666666"}}});
detail.getRange("I5:I87").conditionalFormats.add("dataBar",{color:"#5B9BD5",thresholds:[{type:"num",value:0},{type:"num",value:1}],gradient:true});
detail.tables.add("A4:L87", true, "TablaAuditoria");

summary.showGridLines = false;
summary.getRange("A1:E1").merge();
summary.getRange("A1").values = [["RESUMEN EJECUTIVO · RESPONSABLES DE AUDITORÍA"]];
summary.getRange("A3:B3").values = [["Indicador","Valor"]];
summary.getRange("A4:A9").values = [["Total de puntos"],["Departamentos"],["Completos"],["En curso"],["Bloqueados"],["Avance general"]];
summary.getRange("B4").formulas = [["=COUNTA('Plan de auditoría'!$A$5:$A$87)"]];
summary.getRange("B5").values = [[10]];
summary.getRange("B6").formulas = [["=COUNTIF('Plan de auditoría'!$H$5:$H$87,\"Completo\")"]];
summary.getRange("B7").formulas = [["=COUNTIF('Plan de auditoría'!$H$5:$H$87,\"En curso\")"]];
summary.getRange("B8").formulas = [["=COUNTIF('Plan de auditoría'!$H$5:$H$87,\"Bloqueado\")"]];
summary.getRange("B9").formulas = [["=AVERAGE('Plan de auditoría'!$I$5:$I$87)"]];
summary.getRange("B9").setNumberFormat("0%");

const owners = ["Seguridad e Higiene","RR. HH.","Tráfico","Mantenimiento e Ingeniería de Flota","Seguimiento","Calidad/Sistema de Gestión","Dirección/Gerencia General","Contrataciones","Legales","Seguridad Patrimonial"];
summary.getRange("A12:D12").values = [["Departamento responsable","Puntos","Avance promedio","Completos"]];
summary.getRange("A13:A22").values = owners.map(x=>[x]);
summary.getRange("B13:B22").formulas = owners.map((_,i)=>[`=COUNTIF('Plan de auditoría'!$F$5:$F$87,A${i+13})`]);
summary.getRange("C13:C22").formulas = owners.map((_,i)=>[`=IFERROR(AVERAGEIF('Plan de auditoría'!$F$5:$F$87,A${i+13},'Plan de auditoría'!$I$5:$I$87),0)`]);
summary.getRange("D13:D22").formulas = owners.map((_,i)=>[`=COUNTIFS('Plan de auditoría'!$F$5:$F$87,A${i+13},'Plan de auditoría'!$H$5:$H$87,\"Completo\")`]);
summary.getRange("C13:C22").setNumberFormat("0%");

summary.getRange("A1:E1").format = {fill:"#1F4E78",font:{bold:true,color:"#FFFFFF",size:17},verticalAlignment:"center"};
summary.getRange("A1:E1").format.rowHeight = 32;
summary.getRange("A3:B3").format = {fill:"#2F75B5",font:{bold:true,color:"#FFFFFF"},horizontalAlignment:"center",borders:{bottom:{style:"medium",color:"#1F4E78"}}};
summary.getRange("A4:B9").format = {fill:"#F3F6F9",font:{color:"#222222"},borders:{bottom:{style:"thin",color:"#D9E2F3"}}};
summary.getRange("A4:A9").format.font = {bold:true,color:"#44546A"};
summary.getRange("B4:B9").format = {font:{bold:true,color:"#1F4E78",size:14},horizontalAlignment:"center",borders:{bottom:{style:"thin",color:"#D9E2F3"}}};
summary.getRange("A12:D12").format = {fill:"#2F75B5",font:{bold:true,color:"#FFFFFF"},horizontalAlignment:"center",wrapText:true};
summary.getRange("A13:D22").format = {borders:{bottom:{style:"thin",color:"#D9E2F3"}},verticalAlignment:"center"};
summary.getRange("A13:A22").format.font = {bold:true,color:"#44546A"};
summary.getRange("B13:D22").format.horizontalAlignment = "center";
summary.getRange("C13:C22").conditionalFormats.add("dataBar",{color:"#70AD47",thresholds:[{type:"num",value:0},{type:"num",value:1}],gradient:true});
summary.getRange("A:A").format.columnWidth = 38;
summary.getRange("B:B").format.columnWidth = 16;
summary.getRange("C:C").format.columnWidth = 18;
summary.getRange("D:D").format.columnWidth = 15;
summary.freezePanes.freezeRows(1);

const deptChart = summary.charts.add("bar", summary.getRange("A12:B22"));
deptChart.title = "Distribución de puntos por departamento";
deptChart.hasLegend = false;
deptChart.xAxis = {axisType:"textAxis",textStyle:{fontSize:9}};
deptChart.yAxis = {numberFormatCode:"0"};
deptChart.setPosition("F3","M22");

const outputDir = "/Users/leonardocastillo/Desktop/APP/SGI respaldo 360/outputs/toyota-auditoria-2026";
await fs.mkdir(outputDir,{recursive:true});
const out = await SpreadsheetFile.exportXlsx(workbook);
await out.save(`${outputDir}/Plan_Auditoria_Transporte_DADA_2026.xlsx`);

const check = await workbook.inspect({kind:"table",range:"'Plan de auditoría'!A1:L12",include:"values,formulas",tableMaxRows:12,tableMaxCols:12,maxChars:16000});
console.log(check.ndjson);
const errors = await workbook.inspect({kind:"match",searchTerm:"#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",options:{useRegex:true,maxResults:100},summary:"formula errors",maxChars:3000});
console.log(errors.ndjson);
for (const [sheetName,range,file] of [["Plan de auditoría","A1:L14","detalle.png"],["Resumen","A1:M22","resumen.png"]]) {
  const image = await workbook.render({sheetName,range,scale:1.3,format:"png"});
  await fs.writeFile(`${outputDir}/${file}`,new Uint8Array(await image.arrayBuffer()));
}
console.log(`OUTPUT=${outputDir}/Plan_Auditoria_Transporte_DADA_2026.xlsx`);
