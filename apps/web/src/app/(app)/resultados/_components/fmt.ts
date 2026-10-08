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

export const CATEGORIA_GASTO: Record<string, string> = {
  SUELDOS: 'Sueldos', ALQUILER: 'Alquiler', SEGUROS: 'Seguros', SERVICIOS: 'Servicios',
  ADMINISTRACION: 'Administración', IMPUESTOS: 'Impuestos', OTRO: 'Otro',
};
