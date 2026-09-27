/**
 * Fix global de timezone para fechas "solo fecha" (date-only).
 *
 * Problema: los inputs <input type="date"> producen strings 'YYYY-MM-DD' que el
 * backend guarda como medianoche UTC (ej: '2026-09-27T00:00:00.000Z'). Al mostrar
 * esa fecha con toLocaleDateString() en Argentina (UTC-3) se ve el día ANTERIOR
 * (26/9), porque 00:00 UTC = 21:00 del día anterior en local.
 *
 * Solución: un patch de Date.prototype que detecta fechas exactamente a medianoche
 * UTC (la convención de "date-only" en toda la BD) y las formatea con timeZone:'UTC',
 * salvo que el llamador haya pasado un timeZone explícito. Como se aplica a los
 * métodos de formateo, corrige la visualización en TODA la app (incluidos datos
 * ya existentes) sin tocar los ~300 call sites ni la BD.
 *
 * NO se tocan getDate()/getDay()/comparaciones para no alterar lógica temporal.
 */

const PATCH_FLAG = '__sgiUtcDateOnlyPatched';

function isUtcMidnight(d: Date): boolean {
  const t = d.getTime();
  return (
    !isNaN(t) &&
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  );
}

function hasExplicitTimeZone(options?: Intl.DateTimeFormatOptions): boolean {
  return !!options && options.timeZone !== undefined;
}

export function installUtcDateOnlyPatch(): void {
  const proto = Date.prototype as any;
  if (proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const origToLocaleDateString = proto.toLocaleDateString;
  const origToLocaleString = proto.toLocaleString;
  const origToLocaleTimeString = proto.toLocaleTimeString;
  const origToDateString = proto.toDateString;

  proto.toLocaleDateString = function (
    this: Date,
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions
  ): string {
    if (isUtcMidnight(this) && !hasExplicitTimeZone(options)) {
      return origToLocaleDateString.call(this, locales, { ...options, timeZone: 'UTC' });
    }
    return origToLocaleDateString.call(this, locales, options);
  };

  proto.toLocaleString = function (
    this: Date,
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions
  ): string {
    if (isUtcMidnight(this) && !hasExplicitTimeZone(options)) {
      return origToLocaleString.call(this, locales, { ...options, timeZone: 'UTC' });
    }
    return origToLocaleString.call(this, locales, options);
  };

  proto.toLocaleTimeString = function (
    this: Date,
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions
  ): string {
    if (isUtcMidnight(this) && !hasExplicitTimeZone(options)) {
      return origToLocaleTimeString.call(this, locales, { ...options, timeZone: 'UTC' });
    }
    return origToLocaleTimeString.call(this, locales, options);
  };

  // toDateString no acepta opciones: reproduce el formato local pero con getters UTC
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  proto.toDateString = function (this: Date): string {
    if (isUtcMidnight(this)) {
      const dd = String(this.getUTCDate()).padStart(2, '0');
      return `${WD[this.getUTCDay()]} ${MO[this.getUTCMonth()]} ${dd} ${this.getUTCFullYear()}`;
    }
    return origToDateString.call(this);
  };
}

/** Parsea 'YYYY-MM-DD' como fecha local (sin shift de timezone). */
export function parseDateOnly(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value ?? '').trim());
  if (!m) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Formatea cualquier fecha/timestamp respetando la corrección date-only. */
export function formatDate(value: Date | string | number | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (value === null || value === undefined || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-AR', options);
}

/** Convierte un ISO/timestamp a 'YYYY-MM-DD' para value de <input type="date">. */
export function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  if (isUtcMidnight(d)) return d.toISOString().slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Instalación automática al importar el módulo (cliente y SSR Node).
installUtcDateOnlyPatch();
