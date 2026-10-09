export const fmtMoney = (n: number | null | undefined, moneda = 'ARS') =>
  n === null || n === undefined ? '—' : `${moneda} $${Math.round(n).toLocaleString('es-AR')}`;

export const fmtPct = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : `${n.toFixed(1)}%`;

export const fmtFecha = (d: string | null | undefined) =>
  !d ? '—' : new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const GRUPO_LABEL: Record<string, string> = {
  FACTURADO: 'Facturado', INGRESO_OPERATIVO: 'Ingresos operativos', COBRADO: 'Cobrado',
  COSTO_OP: 'Costos operativos', ESTRUCTURA: 'Estructura', GASTO_MANUAL: 'Gastos manuales',
};

export const ESTADO_FACTURA: Record<string, { label: string; color: string }> = {
  EMITIDA: { label: 'Emitida', color: 'bg-blue-50 text-blue-700' },
  PARCIALMENTE_COBRADA: { label: 'Parcial', color: 'bg-amber-50 text-amber-700' },
  COBRADA: { label: 'Cobrada', color: 'bg-green-50 text-green-700' },
  VENCIDA: { label: 'Vencida', color: 'bg-red-50 text-red-700' },
  ANULADA: { label: 'Anulada', color: 'bg-neutral-100 text-neutral-500' },
};

// Categorías de gasto manual. Cubren la operación completa — flota,
// predio (recepción / almacenamiento / distribución) y administración —
// no solo vehículos. Cada una se convierte en rubro del análisis.
export const CATEGORIA_GASTO: Record<string, string> = {
  FLETE: 'Fletes / subcontratados', SUELDOS: 'Sueldos', LEYES_SOCIALES: 'Leyes sociales / cargas',
  COMBUSTIBLE: 'Combustible', MANTENIMIENTO: 'Mantenimiento / repuestos', NEUMATICOS: 'Neumáticos',
  PEAJES: 'Peajes / estacionamiento', SEGUROS: 'Seguros', ALQUILER: 'Arriendo / alquiler',
  SERVICIOS: 'Servicios (luz, agua, internet)', HONORARIOS: 'Honorarios / contador', ADMINISTRACION: 'Administración',
  BANCARIOS: 'Gastos bancarios', IMPUESTOS: 'Impuestos / patentes',
  // Operación del predio / depósito (no-flota)
  DESPENSA: 'Despensa / víveres', LIMPIEZA: 'Limpieza del predio', VIGILANCIA: 'Seguridad / vigilancia',
  EPP: 'EPP / uniformes', EMBALAJE: 'Embalaje / film / pallets', HERRAMIENTAS: 'Herramientas / equipamiento',
  VIATICOS: 'Viáticos / comidas', TECNOLOGIA: 'Software / tecnología', MERMAS: 'Mermas / faltantes',
  COMERCIAL: 'Comercial / marketing',
  OTRO: 'Otro',
};

export const RUBRO_LABEL: Record<string, string> = {
  ...CATEGORIA_GASTO, MULTAS: 'Multas', FINANCIACION: 'Cuotas de unidades', REPUESTOS: 'Repuestos',
  GASTO: 'Facturas flota', SEGURO: 'Seguros',
};
export const labelRubro = (r: string) =>
  RUBRO_LABEL[r] || r.charAt(0) + r.slice(1).toLowerCase().replace(/_/g, ' ');

export const MONEDAS = ['CLP', 'ARS', 'USD'];

// Tasa de IVA sugerida por moneda (editable en cada formulario)
export const IVA_DEFAULT: Record<string, number> = { CLP: 19, ARS: 21, USD: 0 };

export const TIPO_COMPROBANTE: Record<string, string> = {
  FACTURA: 'Factura', NOTA_CREDITO: 'Nota de crédito', NOTA_DEBITO: 'Nota de débito', BOLETA: 'Boleta', OTRO: 'Otro',
};

export const toDateInput = (d: string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : '');

// Leyenda "última actualización" relativa: ahora / hace N min / hoy 08:32 / ayer / hace N días.
export const fmtActualizado = (d: string | null | undefined) => {
  if (!d) return 'sin datos';
  const dt = new Date(d);
  const ahora = new Date();
  const diffMin = Math.floor((ahora.getTime() - dt.getTime()) / 60000);
  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const hora = dt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  if (dt.toDateString() === ahora.toDateString()) return `hoy ${hora}`;
  if (dt.toDateString() === new Date(ahora.getTime() - 86400000).toDateString()) return `ayer ${hora}`;
  const dias = Math.floor(diffMin / 1440);
  if (dias < 30) return `hace ${dias} días`;
  return fmtFecha(d);
};
