// ═══════════════════════════════════════════════════════════════
// FLOTA 360 — Catálogo semilla de referencias técnicas por componente
//
// Reglas del enunciado:
//  - Los intervalos preexistentes del sistema se preservan como
//    INTERNA_APROBADA rotulados "intervalo de servicio" — NO vida útil.
//  - La hipótesis de embrague 200.000–300.000 km del usuario se carga
//    como PROVISIONAL "hipótesis ilustrativa, pendiente de validación".
//  - Componentes sin fuente verificable quedan FALTANTE: visibles con
//    sus datos conocidos pero sin porcentajes inventados.
//  - Las fuentes primarias (Eaton, DTNA) se registran con su URL y
//    estado FALTANTE hasta verificar alcance/versión/tabla aplicable.
// ═══════════════════════════════════════════════════════════════

export const FLEET_COMPONENT_REFS_SEED: any[] = [
  // ── Intervalos de servicio preexistentes (constantes del sistema,
  //    preservadas como configuración interna, NO vida útil) ──
  {
    componentKey: 'aceite_motor', componentLabel: 'Aceite de motor', sistema: 'MOTOR',
    tipoMetrica: 'INTERVALO_MANTENIMIENTO', tarea: 'Cambio de aceite y filtro de motor',
    intervaloKm: 10000, unidad: 'km',
    fuente: 'Configuración interna preexistente del sistema', documentoSeccion: 'Constante PROGRAMA original',
    estado: 'INTERNA_APROBADA', matchRegex: 'aceite(?!.*(caja|transmisi|hidr))|cambio de aceite|service',
    notas: 'Intervalo de servicio heredado de la configuración anterior. Verificar contra manual del motor y especificación del lubricante.',
  },
  {
    componentKey: 'filtro_aceite', componentLabel: 'Filtro de aceite', sistema: 'MOTOR',
    tipoMetrica: 'INTERVALO_MANTENIMIENTO', tarea: 'Cambio de filtro de aceite (junto con aceite)',
    intervaloKm: 10000, unidad: 'km',
    fuente: 'Configuración interna preexistente del sistema', documentoSeccion: 'Constante PROGRAMA original',
    estado: 'INTERNA_APROBADA', matchRegex: 'filtro.*aceite|aceite.*filtro',
    notas: 'Vinculado al cambio de aceite cuando el plan lo indique. Intervalo propio solo si el fabricante lo define.',
  },
  {
    componentKey: 'filtro_aire', componentLabel: 'Filtro de aire', sistema: 'MOTOR',
    tipoMetrica: 'INTERVALO_MANTENIMIENTO', tarea: 'Inspección/reemplazo de filtro de aire',
    intervaloKm: 20000, unidad: 'km',
    fuente: 'Configuración interna preexistente del sistema', documentoSeccion: 'Constante PROGRAMA original',
    estado: 'INTERNA_APROBADA', matchRegex: 'filtro.*aire|aire.*filtro',
    notas: 'El polvo no se deduce de kilómetros: priorizar restricción medida cuando exista.',
  },
  {
    componentKey: 'filtro_combustible', componentLabel: 'Filtro de combustible', sistema: 'MOTOR',
    tipoMetrica: 'INTERVALO_MANTENIMIENTO', tarea: 'Cambio de filtro de combustible',
    intervaloKm: 20000, unidad: 'km',
    fuente: 'Configuración interna preexistente del sistema', documentoSeccion: 'Constante PROGRAMA original',
    estado: 'INTERNA_APROBADA', matchRegex: 'filtro.*combustible|combustible.*filtro',
    notas: 'Separado del filtro de aire: reglas e intervalos propios.',
  },
  {
    componentKey: 'refrigerante', componentLabel: 'Refrigerante / anticongelante', sistema: 'REFRIGERACION',
    tipoMetrica: 'INTERVALO_MANTENIMIENTO', tarea: 'Renovación de refrigerante',
    intervaloKm: 40000, unidad: 'km',
    fuente: 'Configuración interna preexistente del sistema', documentoSeccion: 'Constante PROGRAMA original',
    estado: 'INTERNA_APROBADA', matchRegex: 'refrigerante|anticongelante|coolant',
    notas: 'Separar inspección, renovación y aditivos. El tipo de refrigerante define el intervalo real.',
  },
  {
    componentKey: 'fluido_hidraulico', componentLabel: 'Fluido hidráulico', sistema: 'CHASIS',
    tipoMetrica: 'INTERVALO_MANTENIMIENTO', tarea: 'Renovación de fluido hidráulico',
    intervaloKm: 40000, unidad: 'km',
    fuente: 'Configuración interna preexistente del sistema', documentoSeccion: 'Constante PROGRAMA original',
    estado: 'INTERNA_APROBADA', matchRegex: 'hidr[aá]ulic',
    notas: 'Identificar circuito y especificación: no hay una única vida útil para todos los fluidos.',
  },
  {
    componentKey: 'aceite_transmision', componentLabel: 'Aceite de caja / transmisión', sistema: 'TRANSMISION',
    tipoMetrica: 'INTERVALO_MANTENIMIENTO', tarea: 'Cambio de aceite de transmisión',
    intervaloKm: 60000, unidad: 'km',
    fuente: 'Configuración interna preexistente del sistema', documentoSeccion: 'Constante PROGRAMA original',
    estado: 'INTERNA_APROBADA', matchRegex: 'aceite.*(caja|transmisi)|(caja|transmisi).*aceite',
    notas: 'Un cambio de aceite de caja NO es la vida de la caja. Verificar tipo/modelo de caja y lubricante (Eaton/DTNA según aplique).',
  },
  {
    componentKey: 'mangueras', componentLabel: 'Mangueras y flexibles', sistema: 'CHASIS',
    tipoMetrica: 'INTERVALO_MANTENIMIENTO', tarea: 'Inspección de mangueras y flexibles',
    intervaloKm: 80000, unidad: 'km',
    fuente: 'Configuración interna preexistente del sistema', documentoSeccion: 'Constante PROGRAMA original',
    estado: 'INTERNA_APROBADA', matchRegex: 'manguera|flexible',
    notas: 'No inferir desgaste lineal solo por km: antigüedad, inspección, fugas y daños mandan.',
  },
  {
    componentKey: 'diferencial', componentLabel: 'Aceite de diferencial', sistema: 'TRANSMISION',
    tipoMetrica: 'INTERVALO_MANTENIMIENTO', tarea: 'Cambio de aceite de diferencial',
    intervaloKm: 60000, unidad: 'km',
    fuente: 'Configuración interna preexistente del sistema', documentoSeccion: 'Constante PROGRAMA original',
    estado: 'INTERNA_APROBADA', matchRegex: 'diferencial',
    notas: 'Tarea separada de cardán/crucetas (inspección/lubricación propia).',
  },
  {
    componentKey: 'cardan_crucetas', componentLabel: 'Cardán / crucetas', sistema: 'TRANSMISION',
    tipoMetrica: 'INTERVALO_MANTENIMIENTO', tarea: 'Inspección/lubricación de cardán y crucetas',
    intervaloKm: 40000, unidad: 'km',
    fuente: 'Configuración interna preexistente del sistema', documentoSeccion: 'Constante PROGRAMA original',
    estado: 'INTERNA_APROBADA', matchRegex: 'card[aá]n|cruceta',
    notas: 'Inspección y lubricación por componente; antecedentes propios.',
  },
  {
    componentKey: 'refrigeracion_mecanica', componentLabel: 'Refrigeración mecánica (bomba/radiador/correas)', sistema: 'REFRIGERACION',
    tipoMetrica: 'INTERVALO_MANTENIMIENTO', tarea: 'Inspección de bomba, radiador, correas y tensores',
    intervaloKm: 80000, unidad: 'km',
    fuente: 'Configuración interna preexistente del sistema', documentoSeccion: 'Constante PROGRAMA original',
    estado: 'INTERNA_APROBADA', matchRegex: 'radiador|bomba.*agua|termostato|correa|tensor',
    notas: 'Inspección y tareas documentadas; sin vida universal obligatoria.',
  },

  // ── Referencia orientativa de vida en servicio — hipótesis del usuario ──
  {
    componentKey: 'embrague', componentLabel: 'Embrague', sistema: 'TRANSMISION',
    tipoMetrica: 'VIDA_SERVICIO_REF',
    rangoMinKm: 200000, rangoMaxKm: 300000, unidad: 'km',
    fuente: 'Hipótesis ilustrativa del usuario', documentoSeccion: 'Escenario de demostración',
    estado: 'PROVISIONAL', matchRegex: 'embrague|clutch',
    notas: 'Rango 200.000–300.000 km propuesto por el usuario como EJEMPLO. NO es una cifra técnica verificada. Alcanzarlo dispara revisión/evaluación de condición, no reemplazo obligatorio. Pendiente de validación con manual Eaton del modelo de embrague aplicable.',
  },

  // ── Fuentes primarias registradas, pendientes de verificación de alcance ──
  {
    componentKey: 'embrague', componentLabel: 'Embrague — lubricación (Eaton)', sistema: 'TRANSMISION',
    tipoMetrica: 'INTERVALO_MANTENIMIENTO', tarea: 'Lubricación de embrague según manual Eaton',
    unidad: 'km',
    fuente: 'Eaton — Heavy-Duty Clutch Service Manual', documentoSeccion: 'Installation Instructions',
    fuenteUrl: 'https://www.eaton.com/content/dam/eaton/products/clutches-brakes/commercial-vehicle/eaton-heavy-duty-clutch-service-manual-installation-instructions-en.pdf',
    estado: 'FALTANTE', matchRegex: 'embrague|clutch',
    notas: 'Fuente primaria registrada. Un intervalo de lubricación del embrague NO es su vida útil. Verificar alcance, versión y tabla aplicable antes de extraer cifras.',
  },
  {
    componentKey: 'aceite_transmision', componentLabel: 'Aceite de transmisión — especificación Eaton', sistema: 'TRANSMISION',
    tipoMetrica: 'INTERVALO_MANTENIMIENTO', tarea: 'Cambio de aceite de transmisión según especificación',
    unidad: 'km',
    fuente: 'Eaton — Transmission and Clutch Lubrication Specifications', documentoSeccion: 'Lubrication specifications',
    fuenteUrl: 'https://www.eaton.com/ae/en-gb/products/transmissions/lubricants/eaton-transmission-and-clutch-lubrication-specifications.html',
    estado: 'FALTANTE', matchRegex: 'aceite.*(caja|transmisi)|(caja|transmisi).*aceite',
    notas: 'Fuente primaria registrada. El intervalo depende del modelo de caja y lubricante aprobado. Verificar tabla aplicable antes de extraer cifras.',
  },
  {
    componentKey: 'aceite_transmision', componentLabel: 'Fluido de transmisión — DTNA', sistema: 'TRANSMISION',
    tipoMetrica: 'INTERVALO_MANTENIMIENTO', tarea: 'Servicio de fluido de transmisión según DTNA',
    unidad: 'km',
    fuente: 'DTNA — Transmission Fluid Service Information', documentoSeccion: '0000050569',
    fuenteUrl: 'https://www.dtnatechlit.com/portal-public/0000050569-transmission-fluid-service-information/0000050569.xml/%24/v4860655',
    estado: 'FALTANTE', matchRegex: 'aceite.*(caja|transmisi)|(caja|transmisi).*aceite',
    notas: 'Fuente primaria registrada. Aplicable solo a transmisiones DTNA/Detroit según modelo. Verificar alcance antes de extraer cifras.',
  },

  // ── Componentes sin referencia validada: visibles, sin % inventado ──
  { componentKey: 'frenos', componentLabel: 'Frenos (pastillas/zapatas)', sistema: 'FRENOS', tipoMetrica: 'CONDICION_MEDIDA', unidad: 'mm', estado: 'FALTANTE', matchRegex: 'freno|brake|pastilla|zapata', notas: 'Espesor/condición e inspecciones. No tratar cambio de pastillas como renovación completa del sistema.' },
  { componentKey: 'caja_cambios', componentLabel: 'Caja de cambios (inspección)', sistema: 'TRANSMISION', tipoMetrica: 'VIDA_SERVICIO_REF', unidad: 'km', estado: 'FALTANTE', matchRegex: 'caja|cambios|transmisi(?!.*aceite)', notas: 'Historial, inspecciones y condición. Independiente del aceite. Sin vida universal obligatoria.' },
  { componentKey: 'direccion_suspension', componentLabel: 'Dirección y suspensión', sistema: 'DIRECCION_SUSPENSION', tipoMetrica: 'CONDICION_MEDIDA', unidad: 'mm', estado: 'FALTANTE', matchRegex: 'direcci[oó]n|suspensi[oó]n|amortiguador', notas: 'Inspecciones/mediciones y reparaciones. Sin porcentaje arbitrario por odómetro.' },
  { componentKey: 'burro_arranque', componentLabel: 'Burro de arranque', sistema: 'ELECTRICO', tipoMetrica: 'VIDA_SERVICIO_REF', unidad: 'km', estado: 'FALTANTE', matchRegex: 'burro|arranque|starter', notas: 'Historial, antigüedad y pruebas. Incorporar recurrencias si el proyecto las registra.' },
  { componentKey: 'alternador', componentLabel: 'Alternador', sistema: 'ELECTRICO', tipoMetrica: 'VIDA_SERVICIO_REF', unidad: 'km', estado: 'FALTANTE', matchRegex: 'alternador', notas: 'Historial, antigüedad y pruebas de carga.' },
  { componentKey: 'bateria', componentLabel: 'Batería', sistema: 'ELECTRICO', tipoMetrica: 'VIDA_SERVICIO_REF', unidad: 'meses', estado: 'FALTANTE', matchRegex: 'bater[ií]a', notas: 'Antigüedad y pruebas de carga/estado.' },
];
