// ──────────────────────────────────────────────────────────────────────────
// Biblioteca de cláusulas por norma — fuente de datos para crear una
// NormativeStandard "desde plantilla" (sin PDF). Los textos son RESÚMENES
// parafíseados con fines de orientación: NO reproducen el texto normativo
// oficial (propiedad de ISO/IRAM). Para auditoría formal, la organización
// debe adquirir la norma oficial.
//
// level: 0 = capítulo principal / sección de anexo · 1 = subcláusula/control
// La relación padre se infiere por prefijo numérico (4 → 4.1).
// ──────────────────────────────────────────────────────────────────────────

export interface ClauseSeed {
  number: string;
  title: string;
  content: string;
  level: number;
  keywords?: string[];
}

// ── Estructura de Alto Nivel (HLS / Annex SL) compartida: caps. 4-7, 9-10 ──
const HLS_COMMON: ClauseSeed[] = [
  { number: '4', title: 'Contexto de la organización', content: 'Determinar cuestiones internas/externas, partes interesadas, alcance del sistema y sus procesos.', level: 0, keywords: ['contexto', 'alcance'] },
  { number: '4.1', title: 'Comprensión de la organización y de su contexto', content: 'Determinar las cuestiones externas e internas pertinentes al propósito del sistema de gestión.', level: 1 },
  { number: '4.2', title: 'Comprensión de las necesidades y expectativas de las partes interesadas', content: 'Identificar las partes interesadas relevantes y sus requisitos pertinentes.', level: 1 },
  { number: '4.3', title: 'Determinación del alcance del sistema de gestión', content: 'Establecer los límites y la aplicabilidad del sistema de gestión.', level: 1 },
  { number: '4.4', title: 'Sistema de gestión y sus procesos', content: 'Establecer, implementar, mantener y mejorar continuamente el sistema y sus procesos.', level: 1 },
  { number: '5', title: 'Liderazgo', content: 'Liderazgo y compromiso de la alta dirección, política, roles y responsabilidades.', level: 0, keywords: ['liderazgo', 'política', 'roles'] },
  { number: '5.1', title: 'Liderazgo y compromiso', content: 'La alta dirección debe demostrar liderazgo y compromiso con el sistema de gestión.', level: 1 },
  { number: '5.2', title: 'Política', content: 'Establecer, implementar y mantener una política apropiada al propósito de la organización.', level: 1 },
  { number: '5.3', title: 'Roles, responsabilidades y autoridades en la organización', content: 'Asegurar la asignación, comunicación y comprensión de roles y responsabilidades.', level: 1 },
  { number: '6', title: 'Planificación', content: 'Acciones frente a riesgos y oportunidades, objetivos y planificación de cambios.', level: 0, keywords: ['planificación', 'riesgos', 'objetivos'] },
  { number: '6.1', title: 'Acciones para abordar riesgos y oportunidades', content: 'Determinar riesgos y oportunidades y planificar acciones para abordarlos.', level: 1 },
  { number: '6.2', title: 'Objetivos y planificación para lograrlos', content: 'Establecer objetivos medibles y planificar cómo alcanzarlos.', level: 1 },
  { number: '6.3', title: 'Planificación de cambios', content: 'Los cambios al sistema deben realizarse de manera planificada.', level: 1 },
  { number: '7', title: 'Soporte', content: 'Recursos, competencia, toma de conciencia, comunicación e información documentada.', level: 0, keywords: ['soporte', 'competencia', 'documentos'] },
  { number: '7.1', title: 'Recursos', content: 'Determinar y proporcionar los recursos necesarios para el sistema.', level: 1 },
  { number: '7.2', title: 'Competencia', content: 'Asegurar que el personal sea competente sobre la base de educación, formación o experiencia.', level: 1 },
  { number: '7.3', title: 'Toma de conciencia', content: 'Asegurar que el personal conozca la política, su contribución y las implicaciones del incumplimiento.', level: 1 },
  { number: '7.4', title: 'Comunicación', content: 'Determinar las comunicaciones internas y externas pertinentes al sistema.', level: 1 },
  { number: '7.5', title: 'Información documentada', content: 'Controlar la creación, actualización y gestión de la información documentada.', level: 1 },
  { number: '9', title: 'Evaluación del desempeño', content: 'Seguimiento, medición, análisis, auditoría interna y revisión por la dirección.', level: 0, keywords: ['auditoría', 'medición', 'revisión'] },
  { number: '9.1', title: 'Seguimiento, medición, análisis y evaluación', content: 'Determinar qué se monitorea y mide, métodos, y cuándo se analizan los resultados.', level: 1 },
  { number: '9.2', title: 'Auditoría interna', content: 'Realizar auditorías internas a intervalos planificados para verificar la conformidad y eficacia.', level: 1 },
  { number: '9.3', title: 'Revisión por la dirección', content: 'La alta dirección debe revisar el sistema para asegurar su idoneidad, adecuación y eficacia.', level: 1 },
  { number: '10', title: 'Mejora', content: 'Mejora continua, gestión de no conformidades y acciones correctivas.', level: 0, keywords: ['mejora', 'no conformidad', 'acción correctiva'] },
  { number: '10.1', title: 'Mejora continua', content: 'Mejorar continuamente la idoneidad, adecuación y eficacia del sistema de gestión.', level: 1 },
  { number: '10.2', title: 'No conformidad y acción correctiva', content: 'Reaccionar ante no conformidades, evaluar la necesidad de acciones y revisar su eficacia.', level: 1 },
];

const ch8 = (items: ClauseSeed[]): ClauseSeed[] => items;

// ── ISO 9001:2015 ───────────────────────────────────────────────────────────
const ISO9001: ClauseSeed[] = [
  ...HLS_COMMON.filter(c => !c.number.startsWith('9') && !c.number.startsWith('10')),
  { number: '8', title: 'Operación', content: 'Planificación y control operacional, requisitos, diseño, proveedores, producción y liberación.', level: 0, keywords: ['operación', 'producción', 'proveedores'] },
  { number: '8.1', title: 'Planificación y control operacional', content: 'Planificar, implementar y controlar los procesos necesarios para la provisión del producto/servicio.', level: 1 },
  { number: '8.2', title: 'Requisitos de los productos y servicios', content: 'Determinar, revisar y comunicar los requisitos de productos y servicios, incluidos los del cliente.', level: 1 },
  { number: '8.3', title: 'Diseño y desarrollo de productos y servicios', content: 'Establecer, implementar y mantener un proceso de diseño y desarrollo.', level: 1 },
  { number: '8.4', title: 'Control de procesos, productos y servicios suministrados externamente', content: 'Asegurar que lo provisto externamente cumpla los requisitos; evaluar y seleccionar proveedores.', level: 1 },
  { number: '8.5', title: 'Producción y provisión del servicio', content: 'Implementar la producción y la provisión del servicio bajo condiciones controladas.', level: 1 },
  { number: '8.6', title: 'Liberación de productos y servicios', content: 'Verificar la conformidad antes de la liberación al cliente.', level: 1 },
  { number: '8.7', title: 'Control de las salidas no conformes', content: 'Identificar y controlar las salidas no conformes para prevenir su uso o entrega no intencionados.', level: 1 },
  ...HLS_COMMON.filter(c => c.number.startsWith('9') || c.number.startsWith('10')),
];

// ── IATF 16949 (misma estructura ISO 9001 + requisitos automotrices) ─────────
const IATF16949: ClauseSeed[] = ISO9001.map(c => ({ ...c }));

// ── ISO 14001:2015 ──────────────────────────────────────────────────────────
const ISO14001: ClauseSeed[] = [
  ...HLS_COMMON.filter(c => !c.number.startsWith('9') && !c.number.startsWith('10')),
  { number: '6.1.1', title: 'General — aspectos ambientales y obligaciones de cumplimiento', content: 'Determinar aspectos ambientales significativos y obligaciones de cumplimiento.', level: 1 },
  { number: '8', title: 'Operación', content: 'Planificación y control operacional ambiental y preparación ante emergencias.', level: 0, keywords: ['operación', 'emergencias'] },
  { number: '8.1', title: 'Planificación y control operacional', content: 'Establecer controles operacionales para los aspectos ambientales significativos.', level: 1 },
  { number: '8.2', title: 'Preparación y respuesta ante emergencias', content: 'Prepararse y responder ante situaciones de emergencia ambientales potenciales.', level: 1 },
  ...HLS_COMMON.filter(c => c.number.startsWith('9') || c.number.startsWith('10')),
];

// ── ISO 45001:2018 ──────────────────────────────────────────────────────────
const ISO45001: ClauseSeed[] = [
  ...HLS_COMMON.filter(c => !c.number.startsWith('9') && !c.number.startsWith('10')),
  { number: '5.4', title: 'Consulta y participación de los trabajadores', content: 'Asegurar la consulta y participación de los trabajadores en el sistema de SST.', level: 1 },
  { number: '6.1.2', title: 'Identificación de peligros y evaluación de riesgos y oportunidades', content: 'Identificar peligros y evaluar riesgos para la seguridad y salud en el trabajo.', level: 1 },
  { number: '8', title: 'Operación', content: 'Planificación y control operacional, gestión de cambios, compras y emergencias.', level: 0, keywords: ['operación', 'controles', 'emergencias'] },
  { number: '8.1', title: 'Planificación y control operacional', content: 'Aplicar la jerarquía de controles, gestionar cambios y controlar compras/contratistas.', level: 1 },
  { number: '8.2', title: 'Preparación y respuesta ante emergencias', content: 'Establecer planes de respuesta a emergencias, probarlos y revisarlos.', level: 1 },
  ...HLS_COMMON.filter(c => c.number.startsWith('9') || c.number.startsWith('10')),
];

// ── ISO 27001:2022 — cláusulas 4-10 + Anexo A (93 controles) ────────────────
const ISO27001_BASE: ClauseSeed[] = [
  ...HLS_COMMON.filter(c => !c.number.startsWith('9') && !c.number.startsWith('10')),
  { number: '6.1.2', title: 'Evaluación de riesgos de seguridad de la información', content: 'Definir y aplicar el proceso de evaluación de riesgos sobre confidencialidad, integridad y disponibilidad.', level: 1 },
  { number: '6.1.3', title: 'Tratamiento de riesgos de seguridad de la información', content: 'Seleccionar opciones de tratamiento, controles del Anexo A y elaborar la Declaración de Aplicabilidad.', level: 1 },
  { number: '8', title: 'Operación', content: 'Planificación y control operacional del SGSI: evaluación y tratamiento de riesgos.', level: 0, keywords: ['operación', 'riesgos'] },
  { number: '8.1', title: 'Planificación y control operacional', content: 'Planificar, implementar y controlar los procesos del SGSI.', level: 1 },
  { number: '8.2', title: 'Evaluación de riesgos de seguridad de la información', content: 'Realizar evaluaciones de riesgos a intervalos planificados o ante cambios significativos.', level: 1 },
  { number: '8.3', title: 'Tratamiento de riesgos de seguridad de la información', content: 'Implementar el plan de tratamiento de riesgos y conservar evidencia de los resultados.', level: 1 },
  ...HLS_COMMON.filter(c => c.number.startsWith('9') || c.number.startsWith('10')),
];

const A5: ClauseSeed[] = [
  { number: 'A.5', title: 'Controles organizacionales', content: 'Controles del Anexo A de carácter organizacional (37).', level: 0, keywords: ['anexo a', 'organizacionales'] },
  { number: 'A.5.1', title: 'Políticas de seguridad de la información', content: 'Definir, aprobar, publicar y revisar políticas de seguridad.', level: 1 },
  { number: 'A.5.2', title: 'Roles y responsabilidades de seguridad', content: 'Definir y asignar roles y responsabilidades de seguridad de la información.', level: 1 },
  { number: 'A.5.3', title: 'Segregación de funciones', content: 'Segregar funciones y responsabilidades en conflicto.', level: 1 },
  { number: 'A.5.4', title: 'Responsabilidades de la dirección', content: 'Requerir que la dirección aplique las políticas y procedimientos de seguridad.', level: 1 },
  { number: 'A.5.5', title: 'Contacto con autoridades', content: 'Mantener contacto con las autoridades pertinentes.', level: 1 },
  { number: 'A.5.6', title: 'Contacto con grupos de interés especial', content: 'Mantener contacto con grupos o foros de seguridad pertinentes.', level: 1 },
  { number: 'A.5.7', title: 'Inteligencia de amenazas', content: 'Recolectar y analizar información sobre amenazas a la seguridad.', level: 1 },
  { number: 'A.5.8', title: 'Seguridad en la gestión de proyectos', content: 'Integrar la seguridad de la información en la gestión de proyectos.', level: 1 },
  { number: 'A.5.9', title: 'Inventario de información y otros activos asociados', content: 'Desarrollar y mantener un inventario de activos de información.', level: 1 },
  { number: 'A.5.10', title: 'Uso aceptable de la información y activos', content: 'Establecer y comunicar reglas de uso aceptable.', level: 1 },
  { number: 'A.5.11', title: 'Devolución de activos', content: 'Asegurar la devolución de activos al finalizar la relación laboral o contractual.', level: 1 },
  { number: 'A.5.12', title: 'Clasificación de la información', content: 'Clasificar la información según sus necesidades de protección.', level: 1 },
  { number: 'A.5.13', title: 'Etiquetado de la información', content: 'Etiquetar la información conforme a su clasificación.', level: 1 },
  { number: 'A.5.14', title: 'Transferencia de información', content: 'Definir reglas y controles para la transferencia de información.', level: 1 },
  { number: 'A.5.15', title: 'Control de acceso', content: 'Establecer reglas de control de acceso físico y lógico.', level: 1 },
  { number: 'A.5.16', title: 'Gestión de identidades', content: 'Gestionar el ciclo de vida completo de las identidades.', level: 1 },
  { number: 'A.5.17', title: 'Información de autenticación', content: 'Controlar la asignación y gestión de la información de autenticación.', level: 1 },
  { number: 'A.5.18', title: 'Derechos de acceso', content: 'Provisionar, revisar y revocar derechos de acceso.', level: 1 },
  { number: 'A.5.19', title: 'Seguridad en relaciones con proveedores', content: 'Definir procesos para gestionar los riesgos de seguridad de proveedores.', level: 1 },
  { number: 'A.5.20', title: 'Seguridad en acuerdos con proveedores', content: 'Incluir requisitos de seguridad en los acuerdos con proveedores.', level: 1 },
  { number: 'A.5.21', title: 'Seguridad en la cadena de suministro TIC', content: 'Gestionar los riesgos de seguridad de la cadena de suministro TIC.', level: 1 },
  { number: 'A.5.22', title: 'Monitoreo y revisión de servicios de proveedores', content: 'Monitorear, revisar y auditar la gestión de seguridad de proveedores.', level: 1 },
  { number: 'A.5.23', title: 'Seguridad en el uso de servicios en la nube', content: 'Especificar la gestión de seguridad en la adquisición y uso de servicios cloud.', level: 1 },
  { number: 'A.5.24', title: 'Planificación de la gestión de incidentes', content: 'Planificar y preparar la gestión de incidentes de seguridad.', level: 1 },
  { number: 'A.5.25', title: 'Evaluación de eventos de seguridad', content: 'Evaluar y clasificar eventos de seguridad.', level: 1 },
  { number: 'A.5.26', title: 'Respuesta a incidentes de seguridad', content: 'Responder a incidentes según los procedimientos establecidos.', level: 1 },
  { number: 'A.5.27', title: 'Aprendizaje de incidentes', content: 'Usar el conocimiento de incidentes para fortalecer los controles.', level: 1 },
  { number: 'A.5.28', title: 'Recolección de evidencias', content: 'Establecer procedimientos para identificar, recolectar y preservar evidencias.', level: 1 },
  { number: 'A.5.29', title: 'Seguridad durante disrupciones', content: 'Planificar la continuidad de la seguridad de la información ante disrupciones.', level: 1 },
  { number: 'A.5.30', title: 'Preparación TIC para la continuidad del negocio', content: 'Planificar, mantener y probar la disponibilidad TIC para la continuidad.', level: 1 },
  { number: 'A.5.31', title: 'Requisitos legales, reglamentarios y contractuales', content: 'Identificar y cumplir los requisitos legales y contractuales aplicables.', level: 1 },
  { number: 'A.5.32', title: 'Derechos de propiedad intelectual', content: 'Proteger los derechos de propiedad intelectual.', level: 1 },
  { number: 'A.5.33', title: 'Protección de registros', content: 'Proteger los registros contra pérdida, destrucción y acceso no autorizado.', level: 1 },
  { number: 'A.5.34', title: 'Privacidad y protección de datos personales', content: 'Preservar la privacidad y proteger los datos personales (PII).', level: 1 },
  { number: 'A.5.35', title: 'Revisión independiente de la seguridad', content: 'Revisar independientemente la gestión de seguridad a intervalos planificados.', level: 1 },
  { number: 'A.5.36', title: 'Cumplimiento de políticas y normas', content: 'Revisar periódicamente el cumplimiento de políticas, reglas y normas.', level: 1 },
  { number: 'A.5.37', title: 'Procedimientos operativos documentados', content: 'Documentar y poner a disposición los procedimientos operativos.', level: 1 },
];

const A6: ClauseSeed[] = [
  { number: 'A.6', title: 'Controles de personas', content: 'Controles del Anexo A relativos al personal (8).', level: 0, keywords: ['anexo a', 'personas', 'rrhh'] },
  { number: 'A.6.1', title: 'Verificación de antecedentes', content: 'Verificar antecedentes del personal conforme a la ley y la sensibilidad del rol.', level: 1 },
  { number: 'A.6.2', title: 'Términos y condiciones de empleo', content: 'Incluir responsabilidades de seguridad en los contratos de empleo.', level: 1 },
  { number: 'A.6.3', title: 'Concientización, educación y formación', content: 'Brindar concientización y formación en seguridad al personal.', level: 1 },
  { number: 'A.6.4', title: 'Proceso disciplinario', content: 'Formalizar un proceso disciplinario por violaciones de seguridad.', level: 1 },
  { number: 'A.6.5', title: 'Responsabilidades post-empleo', content: 'Definir y comunicar las responsabilidades de seguridad tras la finalización del empleo.', level: 1 },
  { number: 'A.6.6', title: 'Acuerdos de confidencialidad', content: 'Firmar y revisar acuerdos de confidencialidad (NDA).', level: 1 },
  { number: 'A.6.7', title: 'Trabajo remoto', content: 'Implementar medidas de seguridad para el trabajo remoto.', level: 1 },
  { number: 'A.6.8', title: 'Reporte de eventos de seguridad', content: 'Proveer canales para reportar eventos de seguridad observados.', level: 1 },
];

const A7: ClauseSeed[] = [
  { number: 'A.7', title: 'Controles físicos', content: 'Controles del Anexo A de seguridad física y ambiental (14).', level: 0, keywords: ['anexo a', 'física'] },
  { number: 'A.7.1', title: 'Perímetros de seguridad física', content: 'Definir perímetros para proteger las áreas con información.', level: 1 },
  { number: 'A.7.2', title: 'Controles de entrada física', content: 'Controlar el acceso físico a áreas seguras.', level: 1 },
  { number: 'A.7.3', title: 'Protección de oficinas, salas e instalaciones', content: 'Proteger instalaciones frente a accesos no autorizados y amenazas ambientales.', level: 1 },
  { number: 'A.7.4', title: 'Monitoreo de seguridad física', content: 'Monitorear las instalaciones para detectar accesos físicos no autorizados.', level: 1 },
  { number: 'A.7.5', title: 'Protección ante amenazas físicas y ambientales', content: 'Proteger contra desastres naturales y amenazas ambientales.', level: 1 },
  { number: 'A.7.6', title: 'Trabajo en áreas seguras', content: 'Definir medidas para trabajar en áreas seguras.', level: 1 },
  { number: 'A.7.7', title: 'Escritorio limpio y pantalla limpia', content: 'Aplicar reglas de escritorio y pantalla limpia.', level: 1 },
  { number: 'A.7.8', title: 'Ubicación y protección de equipos', content: 'Ubicar y proteger los equipos adecuadamente.', level: 1 },
  { number: 'A.7.9', title: 'Seguridad de activos fuera de las instalaciones', content: 'Proteger los activos usados fuera de las instalaciones.', level: 1 },
  { number: 'A.7.10', title: 'Medios de almacenamiento', content: 'Gestionar los medios de almacenamiento durante todo su ciclo de vida.', level: 1 },
  { number: 'A.7.11', title: 'Servicios de soporte', content: 'Proteger frente a fallas de energía y otros servicios de soporte.', level: 1 },
  { number: 'A.7.12', title: 'Seguridad del cableado', content: 'Proteger el cableado de energía y comunicaciones.', level: 1 },
  { number: 'A.7.13', title: 'Mantenimiento de equipos', content: 'Mantener correctamente los equipos para asegurar disponibilidad e integridad.', level: 1 },
  { number: 'A.7.14', title: 'Eliminación segura o reutilización de equipos', content: 'Eliminar o reutilizar equipos de forma segura.', level: 1 },
];

const A8: ClauseSeed[] = [
  { number: 'A.8', title: 'Controles tecnológicos', content: 'Controles del Anexo A de seguridad tecnológica (34).', level: 0, keywords: ['anexo a', 'tecnológicos', 'tic'] },
  { number: 'A.8.1', title: 'Dispositivos de usuario final', content: 'Proteger la información en dispositivos de usuario final.', level: 1 },
  { number: 'A.8.2', title: 'Derechos de acceso privilegiado', content: 'Restringir y gestionar los accesos privilegiados.', level: 1 },
  { number: 'A.8.3', title: 'Restricción de acceso a la información', content: 'Restringir el acceso a la información según necesidad de conocer.', level: 1 },
  { number: 'A.8.4', title: 'Acceso al código fuente', content: 'Controlar el acceso de lectura y escritura al código fuente.', level: 1 },
  { number: 'A.8.5', title: 'Autenticación segura', content: 'Implementar tecnologías y procedimientos de autenticación segura.', level: 1 },
  { number: 'A.8.6', title: 'Gestión de la capacidad', content: 'Monitorear y ajustar la capacidad de los recursos.', level: 1 },
  { number: 'A.8.7', title: 'Protección contra malware', content: 'Implementar protección contra malware con concientización al usuario.', level: 1 },
  { number: 'A.8.8', title: 'Gestión de vulnerabilidades técnicas', content: 'Evaluar, priorizar y remediar vulnerabilidades técnicas.', level: 1 },
  { number: 'A.8.9', title: 'Gestión de configuraciones', content: 'Establecer, documentar y gestionar configuraciones de seguridad.', level: 1 },
  { number: 'A.8.10', title: 'Borrado de información', content: 'Eliminar información cuando ya no se requiera.', level: 1 },
  { number: 'A.8.11', title: 'Enmascaramiento de datos', content: 'Enmascarar datos según necesidades de negocio y regulaciones.', level: 1 },
  { number: 'A.8.12', title: 'Prevención de fuga de datos', content: 'Aplicar medidas de prevención de fuga de datos.', level: 1 },
  { number: 'A.8.13', title: 'Copia de seguridad de la información', content: 'Realizar, proteger y probar copias de seguridad.', level: 1 },
  { number: 'A.8.14', title: 'Redundancia de instalaciones de procesamiento', content: 'Asegurar redundancia suficiente en las instalaciones de procesamiento.', level: 1 },
  { number: 'A.8.15', title: 'Registro de eventos (logging)', content: 'Producir, almacenar y analizar registros de actividad y excepciones.', level: 1 },
  { number: 'A.8.16', title: 'Monitoreo de actividades', content: 'Monitorear sistemas para detectar comportamientos anómalos.', level: 1 },
  { number: 'A.8.17', title: 'Sincronización de relojes', content: 'Sincronizar los relojes de los sistemas con una fuente confiable.', level: 1 },
  { number: 'A.8.18', title: 'Uso de programas de utilidad privilegiados', content: 'Restringir el uso de utilidades con privilegios elevados.', level: 1 },
  { number: 'A.8.19', title: 'Instalación de software en sistemas operativos', content: 'Controlar la instalación de software en los sistemas.', level: 1 },
  { number: 'A.8.20', title: 'Seguridad de redes', content: 'Proteger redes y dispositivos de red.', level: 1 },
  { number: 'A.8.21', title: 'Seguridad de servicios de red', content: 'Identificar y proteger los servicios de red.', level: 1 },
  { number: 'A.8.22', title: 'Segregación de redes', content: 'Segregar grupos de servicios, usuarios y sistemas en las redes.', level: 1 },
  { number: 'A.8.23', title: 'Filtrado web', content: 'Gestionar el acceso a sitios web externos.', level: 1 },
  { number: 'A.8.24', title: 'Uso de criptografía', content: 'Definir reglas para el uso efectivo de la criptografía.', level: 1 },
  { number: 'A.8.25', title: 'Ciclo de vida de desarrollo seguro', content: 'Aplicar reglas de desarrollo seguro de software y sistemas.', level: 1 },
  { number: 'A.8.26', title: 'Requisitos de seguridad en aplicaciones', content: 'Identificar e implementar requisitos de seguridad en aplicaciones.', level: 1 },
  { number: 'A.8.27', title: 'Arquitectura segura de sistemas', content: 'Aplicar principios de arquitectura segura.', level: 1 },
  { number: 'A.8.28', title: 'Codificación segura', content: 'Aplicar estándares de codificación segura en el desarrollo.', level: 1 },
  { number: 'A.8.29', title: 'Pruebas de seguridad', content: 'Definir y realizar pruebas de seguridad en el ciclo de vida.', level: 1 },
  { number: 'A.8.30', title: 'Desarrollo externalizado', content: 'Supervisar la seguridad en actividades de desarrollo externalizado.', level: 1 },
  { number: 'A.8.31', title: 'Separación de entornos', content: 'Separar entornos de desarrollo, pruebas y producción.', level: 1 },
  { number: 'A.8.32', title: 'Gestión de cambios', content: 'Controlar los cambios en instalaciones de procesamiento.', level: 1 },
  { number: 'A.8.33', title: 'Protección de la información en pruebas', content: 'Proteger la información usada en pruebas.', level: 1 },
  { number: 'A.8.34', title: 'Protección de sistemas durante auditorías', content: 'Minimizar el impacto de las auditorías sobre los sistemas operativos.', level: 1 },
];

const ISO27001: ClauseSeed[] = [...ISO27001_BASE, ...A5, ...A6, ...A7, ...A8];

// ── ISO 22301:2019 ──────────────────────────────────────────────────────────
const ISO22301: ClauseSeed[] = [
  ...HLS_COMMON.filter(c => !c.number.startsWith('9') && !c.number.startsWith('10')),
  { number: '8', title: 'Operación', content: 'Priorización de actividades, estrategias de continuidad, planes, ejercicios y evaluación post-disrupción.', level: 0, keywords: ['operación', 'bia', 'continuidad'] },
  { number: '8.1', title: 'Planificación y control operacional', content: 'Planificar, implementar y controlar los procesos del BCMS.', level: 1 },
  { number: '8.2', title: 'Análisis de impacto al negocio y evaluación de riesgos', content: 'Priorizar actividades, determinar RTO/RPO/MTPD y evaluar riesgos de disrupción.', level: 1 },
  { number: '8.3', title: 'Estrategias y soluciones de continuidad', content: 'Seleccionar e implementar estrategias para proteger y recuperar actividades priorizadas.', level: 1 },
  { number: '8.4', title: 'Planes de continuidad del negocio', content: 'Establecer estructura de respuesta, planes, advertencia/comunicación y procedimientos de recuperación.', level: 1 },
  { number: '8.5', title: 'Programa de ejercicios', content: 'Ejercitar y probar los procedimientos y capacidades de continuidad.', level: 1 },
  { number: '8.6', title: 'Evaluación de la documentación de continuidad tras una disrupción', content: 'Evaluar la eficacia de las respuestas ante disrupciones reales o ejercicios.', level: 1 },
  ...HLS_COMMON.filter(c => c.number.startsWith('9') || c.number.startsWith('10')),
];

// ── ISO 28000:2022 ──────────────────────────────────────────────────────────
const ISO28000: ClauseSeed[] = [
  ...HLS_COMMON.filter(c => !c.number.startsWith('9') && !c.number.startsWith('10')),
  { number: '8', title: 'Operación', content: 'Planificación y control de la seguridad de la cadena de suministro y gestión de riesgos.', level: 0, keywords: ['operación', 'seguridad', 'cadena de suministro'] },
  { number: '8.1', title: 'Planificación y control operacional', content: 'Planificar, implementar y controlar los procesos de gestión de seguridad.', level: 1 },
  { number: '8.2', title: 'Gestión de riesgos y controles de seguridad', content: 'Evaluar riesgos de seguridad en la cadena e implementar controles operacionales.', level: 1 },
  { number: '8.3', title: 'Estrategias, planes y procedimientos de seguridad', content: 'Desarrollar estrategias, planes y procedimientos para mantener la seguridad de la cadena.', level: 1 },
  { number: '8.4', title: 'Gestión de incidentes y continuidad', content: 'Preparar la respuesta a incidentes de seguridad y la continuidad de la cadena.', level: 1 },
  ...HLS_COMMON.filter(c => c.number.startsWith('9') || c.number.startsWith('10')),
];

// ── ISO 9004:2018 (estructura propia — norma guía, no certificable) ──────────
const ISO9004: ClauseSeed[] = [
  { number: '4', title: 'Contexto de la organización', content: 'Cuestiones internas y externas que afectan la capacidad de la organización de lograr el éxito sostenido.', level: 0, keywords: ['contexto'] },
  { number: '4.1', title: 'Contexto de la organización', content: 'Determinar los factores internos y externos pertinentes al éxito sostenido.', level: 1 },
  { number: '4.2', title: 'Partes interesadas', content: 'Determinar las partes interesadas relevantes y sus necesidades y expectativas.', level: 1 },
  { number: '5', title: 'Identidad de una organización', content: 'Misión, visión, valores y cultura como base del éxito sostenido.', level: 0, keywords: ['identidad', 'misión', 'valores', 'cultura'] },
  { number: '5.1', title: 'Generalidades', content: 'La identidad de una organización deriva de su misión, visión, valores y cultura.', level: 1 },
  { number: '5.2', title: 'Misión', content: 'El propósito de la existencia de la organización: para qué existe.', level: 1 },
  { number: '5.3', title: 'Visión', content: 'La aspiración de lo que la organización quiere ser.', level: 1 },
  { number: '5.4', title: 'Valores', content: 'Los principios que guían el comportamiento organizacional.', level: 1 },
  { number: '5.5', title: 'Cultura', content: 'Creencias, historia, ética y comportamientos observados coherentes con la identidad.', level: 1 },
  { number: '6', title: 'Liderazgo', content: 'Rol de los líderes, política y objetivos, estrategia y comunicación.', level: 0, keywords: ['liderazgo', 'estrategia'] },
  { number: '6.1', title: 'Generalidades', content: 'Los líderes promueven el compromiso y el alineamiento de personas y procesos.', level: 1 },
  { number: '6.2', title: 'Rol de los líderes', content: 'Comportamientos esperados de los líderes en todos los niveles.', level: 1 },
  { number: '6.3', title: 'Política y objetivos', content: 'La política y los objetivos como orientación para las acciones de las personas.', level: 1 },
  { number: '6.4', title: 'Estrategia', content: 'Formular, implementar y revisar la estrategia organizacional.', level: 1 },
  { number: '6.5', title: 'Comunicación', content: 'Comunicar política, estrategia, objetivos y procesos en toda la organización.', level: 1 },
  { number: '7', title: 'Gestión de procesos', content: 'Determinación y gestión de los procesos y sus responsables.', level: 0, keywords: ['procesos'] },
  { number: '7.1', title: 'Gestión de procesos — Generalidades', content: 'Gestionar procesos de manera coordinada con roles y autoridad definidos.', level: 1 },
  { number: '7.2', title: 'Determinación de los procesos', content: 'Determinar los procesos necesarios para lograr los resultados deseados.', level: 1 },
  { number: '7.3', title: 'Autoridad de los procesos', content: 'Asignar autoridad y responsabilidad sobre cada proceso.', level: 1 },
  { number: '8', title: 'Gestión de recursos', content: 'Personas, conocimiento, infraestructura, entorno y recursos naturales.', level: 0, keywords: ['recursos', 'personas', 'conocimiento'] },
  { number: '8.1', title: 'Generalidades', content: 'Determinar y gestionar los recursos con enfoque de mediano y largo plazo.', level: 1 },
  { number: '8.2', title: 'Personas', content: 'Compromiso, competencia, empoderamiento y reconocimiento del personal.', level: 1 },
  { number: '8.3', title: 'Conocimiento de la organización', content: 'Mantener, proteger y difundir el conocimiento organizacional.', level: 1 },
  { number: '8.4', title: 'Infraestructura', content: 'Gestionar la infraestructura necesaria para la operación.', level: 1 },
  { number: '8.5', title: 'Entorno para la operación de procesos', content: 'Proveer un entorno de trabajo adecuado, incluyendo factores físicos, sociales y psicológicos.', level: 1 },
  { number: '8.6', title: 'Recursos naturales', content: 'Considerar el uso eficiente de recursos naturales en el contexto del negocio.', level: 1 },
  { number: '9', title: 'Análisis y evaluación del desempeño', content: 'Medición, evaluación del desempeño, auditoría interna, autoevaluación y revisión.', level: 0, keywords: ['desempeño', 'autoevaluación'] },
  { number: '9.1', title: 'Generalidades', content: 'Usar el análisis del desempeño como base para decisiones de mejora.', level: 1 },
  { number: '9.2', title: 'Medición de parámetros', content: 'Definir qué medir y con qué metodología.', level: 1 },
  { number: '9.3', title: 'Evaluación del desempeño', content: 'Evaluar resultados frente a objetivos y planes.', level: 1 },
  { number: '9.4', title: 'Indicadores de desempeño', content: 'Seleccionar indicadores relevantes para el seguimiento del éxito sostenido.', level: 1 },
  { number: '9.5', title: 'Auditoría interna', content: 'Realizar auditorías internas para obtener información objetiva.', level: 1 },
  { number: '9.6', title: 'Autoevaluación', content: 'Realizar autoevaluaciones periódicas del nivel de madurez de la organización.', level: 1 },
  { number: '9.7', title: 'Revisión', content: 'Revisar periódicamente el desempeño y la dirección de la organización.', level: 1 },
  { number: '10', title: 'Mejora, aprendizaje e innovación', content: 'Cultura de mejora continua, aprendizaje organizacional e innovación.', level: 0, keywords: ['mejora', 'aprendizaje', 'innovación'] },
  { number: '10.1', title: 'Generalidades', content: 'La mejora, el aprendizaje y la innovación se apoyan mutuamente para el éxito sostenido.', level: 1 },
  { number: '10.2', title: 'Mejora', content: 'Gestionar la mejora como actividad permanente a todos los niveles.', level: 1 },
  { number: '10.3', title: 'Aprendizaje', content: 'Fomentar el aprendizaje individual y organizacional.', level: 1 },
  { number: '10.4', title: 'Innovación', content: 'Establecer un entorno que favorezca la innovación.', level: 1 },
];

// ── Registro por código de norma ────────────────────────────────────────────
export interface NormTemplateMeta {
  code: string;        // código usado en ProcessTemplate catalog y en NormativeStandard.code
  name: string;
  version: string;
  description: string;
}

export const NORM_TEMPLATES: Record<string, { meta: NormTemplateMeta; clauses: ClauseSeed[] }> = {
  ISO9001: { meta: { code: 'ISO9001', name: 'ISO 9001 - Sistema de Gestión de Calidad', version: '2015', description: 'Requisitos del sistema de gestión de la calidad (resumen orientativo).' }, clauses: ISO9001 },
  IATF16949: { meta: { code: 'IATF16949', name: 'IATF 16949 - Calidad Automotriz', version: '2016', description: 'Requisitos de calidad para la industria automotriz (resumen orientativo).' }, clauses: IATF16949 },
  ISO14001: { meta: { code: 'ISO14001', name: 'ISO 14001 - Gestión Ambiental', version: '2015', description: 'Requisitos del sistema de gestión ambiental (resumen orientativo).' }, clauses: ISO14001 },
  ISO45001: { meta: { code: 'ISO45001', name: 'ISO 45001 - Seguridad y Salud en el Trabajo', version: '2018', description: 'Requisitos del sistema de gestión de SST (resumen orientativo).' }, clauses: ISO45001 },
  ISO27001: { meta: { code: 'ISO27001', name: 'ISO 27001 - Seguridad de la Información', version: '2022', description: 'Requisitos del SGSI + 93 controles del Anexo A (resumen orientativo).' }, clauses: ISO27001 },
  ISO22301: { meta: { code: 'ISO22301', name: 'ISO 22301 - Continuidad del Negocio', version: '2019', description: 'Requisitos del sistema de gestión de continuidad (resumen orientativo).' }, clauses: ISO22301 },
  ISO28000: { meta: { code: 'ISO28000', name: 'ISO 28000 - Seguridad Cadena de Suministro', version: '2022', description: 'Requisitos del sistema de gestión de seguridad de la cadena de suministro (resumen orientativo).' }, clauses: ISO28000 },
  ISO9004: { meta: { code: 'ISO9004', name: 'ISO 9004 - Excelencia y Éxito Sostenido', version: '2018', description: 'Guía para la gestión de la calidad y el éxito sostenido (norma guía, no certificable).' }, clauses: ISO9004 },
};

// Resuelve el parentClauseId por prefijo numérico: '4.1' → '4', 'A.5.12' → 'A.5'.
export function parentNumberOf(clauseNumber: string, allNumbers: Set<string>): string | null {
  const dot = clauseNumber.lastIndexOf('.');
  if (dot <= 0) return null;
  const parent = clauseNumber.slice(0, dot);
  return allNumbers.has(parent) ? parent : null;
}
