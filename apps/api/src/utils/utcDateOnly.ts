/**
 * Fix de timezone para fechas "solo fecha" (date-only) en el backend.
 *
 * Los inputs <input type="date"> del frontend producen 'YYYY-MM-DD' que se
 * persisten como medianoche UTC. Cuando el backend formatea esas fechas para
 * emails/PDFs con toLocaleDateString(), el día visible depende del TZ del
 * proceso (TZ del contenedor) y puede quedar desfasado un día.
 *
 * Este patch fuerza timeZone:'UTC' al formatear fechas exactamente a medianoche
 * UTC (convención date-only), salvo que se pase un timeZone explícito.
 * Mismo criterio que apps/web/src/lib/dates.ts (frontend).
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

installUtcDateOnlyPatch();
