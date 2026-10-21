// ============================================================
// Corredores logísticos Mercosur — waypoints [lon, lat] reales
// por ciudades de paso. Las unidades simuladas recorren estos
// corredores; cuando se conecte telemetría real, cada unidad
// informa posición y el mapa solo la dibuja.
// ============================================================

export interface Corridor {
  id: string;
  nombre: string;           // etiqueta visible
  origen: string;           // ciudad origen (popup "Origen → Destino")
  destino: string;
  pts: [number, number][];  // [lon, lat]
}

export const CORRIDORS: Corridor[] = [
  {
    id: 'ba-ros-cba',
    nombre: 'RN9 — Rosario → Córdoba',
    origen: 'Buenos Aires', destino: 'Córdoba',
    pts: [
      [-58.43, -34.60], [-58.95, -34.35], [-59.40, -33.90], [-60.15, -33.30],
      [-60.65, -32.94], [-61.80, -32.30], [-63.00, -31.85], [-64.18, -31.42],
    ],
  },
  {
    id: 'ba-mza-scl',
    nombre: 'RN7 — Mendoza → Santiago',
    origen: 'Buenos Aires', destino: 'Santiago de Chile',
    pts: [
      [-58.43, -34.60], [-59.70, -34.10], [-61.20, -33.85], [-63.00, -33.50],
      [-65.10, -33.20], [-66.34, -33.30], [-68.00, -33.05], [-68.84, -32.89],
      [-69.10, -32.80], [-69.30, -32.83], [-69.60, -32.90], [-70.20, -33.30], [-70.66, -33.45],
    ],
  },
  {
    id: 'ba-mvd',
    nombre: 'Colonia → Montevideo',
    origen: 'Buenos Aires', destino: 'Montevideo',
    pts: [
      [-58.43, -34.60], [-57.90, -34.65], [-57.84, -34.47], [-57.60, -34.55],
      [-57.20, -34.75], [-56.60, -34.85], [-56.16, -34.90],
    ],
  },
  {
    id: 'ros-psl-spo',
    nombre: 'BR — Uruguaiana → São Paulo',
    origen: 'Rosario', destino: 'São Paulo',
    pts: [
      [-60.65, -32.94], [-60.10, -31.60], [-59.40, -30.60], [-58.50, -29.90],
      [-57.08, -29.71], [-56.50, -29.60], [-55.30, -29.60], [-53.90, -29.80],
      [-52.60, -30.20], [-51.60, -29.90], [-51.23, -30.03], [-50.80, -29.30],
      [-50.30, -28.60], [-49.60, -27.60], [-49.27, -25.42], [-48.60, -24.60],
      [-47.60, -23.80], [-46.63, -23.55],
    ],
  },
  {
    id: 'cba-asu',
    nombre: 'RN11 — Resistencia → Asunción',
    origen: 'Córdoba', destino: 'Asunción',
    pts: [
      [-64.18, -31.42], [-63.50, -30.60], [-62.60, -29.80], [-60.80, -29.40],
      [-59.60, -28.70], [-58.98, -27.45], [-58.80, -27.30], [-58.40, -26.50],
      [-57.90, -25.80], [-57.57, -25.26],
    ],
  },
  {
    id: 'ba-neu',
    nombre: 'RN22 — Santa Rosa → Neuquén',
    origen: 'Buenos Aires', destino: 'Neuquén',
    pts: [
      [-58.43, -34.60], [-59.60, -35.00], [-61.50, -35.40], [-63.50, -36.00],
      [-64.29, -36.62], [-64.80, -37.20], [-65.90, -37.80], [-67.30, -38.30],
      [-68.06, -38.95],
    ],
  },
  {
    id: 'sal-cba',
    nombre: 'RN34/9 — Salta → Tucumán',
    origen: 'Salta', destino: 'Córdoba',
    pts: [
      [-65.41, -24.78], [-65.20, -25.40], [-65.22, -26.80], [-65.20, -27.80],
      [-64.90, -29.10], [-64.40, -30.30], [-64.18, -31.42],
    ],
  },
  {
    id: 'ba-mdp',
    nombre: 'RN226 — Mar del Plata',
    origen: 'Buenos Aires', destino: 'Mar del Plata',
    pts: [
      [-58.43, -34.60], [-58.10, -35.20], [-58.20, -36.20], [-57.80, -37.20],
      [-57.55, -38.00],
    ],
  },
  {
    id: 'mza-pyj',
    nombre: 'RC — Mendoza → Ciudad del Este',
    origen: 'Mendoza', destino: 'Ciudad del Este',
    pts: [
      [-68.84, -32.89], [-66.50, -31.60], [-64.00, -30.80], [-62.50, -29.60],
      [-60.80, -28.40], [-59.60, -27.60], [-58.20, -26.80], [-56.80, -26.30],
      [-55.40, -25.80], [-54.61, -25.52],
    ],
  },
];

// Ciudades / puntos de referencia — etiquetas según zoom.
export const CITIES: { nombre: string; lon: number; lat: number; major?: boolean }[] = [
  { nombre: 'Buenos Aires', lon: -58.43, lat: -34.60, major: true },
  { nombre: 'Rosario', lon: -60.65, lat: -32.94, major: true },
  { nombre: 'Córdoba', lon: -64.18, lat: -31.42, major: true },
  { nombre: 'Mendoza', lon: -68.84, lat: -32.89, major: true },
  { nombre: 'Salta', lon: -65.41, lat: -24.78 },
  { nombre: 'Tucumán', lon: -65.22, lat: -26.80 },
  { nombre: 'Neuquén', lon: -68.06, lat: -38.95 },
  { nombre: 'Santa Rosa', lon: -64.29, lat: -36.62 },
  { nombre: 'Mar del Plata', lon: -57.55, lat: -38.00 },
  { nombre: 'Resistencia', lon: -58.98, lat: -27.45 },
  { nombre: 'Posadas', lon: -55.90, lat: -27.37 },
  { nombre: 'Santiago', lon: -70.66, lat: -33.45, major: true },
  { nombre: 'Montevideo', lon: -56.16, lat: -34.90, major: true },
  { nombre: 'Colonia', lon: -57.84, lat: -34.47 },
  { nombre: 'Asunción', lon: -57.57, lat: -25.26, major: true },
  { nombre: 'Ciudad del Este', lon: -54.61, lat: -25.52 },
  { nombre: 'São Paulo', lon: -46.63, lat: -23.55, major: true },
  { nombre: 'Curitiba', lon: -49.27, lat: -25.42 },
  { nombre: 'Porto Alegre', lon: -51.23, lat: -30.03, major: true },
  { nombre: 'Florianópolis', lon: -48.55, lat: -27.59 },
  { nombre: 'Rio de Janeiro', lon: -43.20, lat: -22.90 },
  { nombre: 'Santa Cruz', lon: -63.18, lat: -17.78 },
  { nombre: 'La Paz', lon: -68.15, lat: -16.50 },
];

// Pasos de frontera (geocercas Mercosur) — se marcan con un diamante.
export const BORDERS: { nombre: string; lon: number; lat: number }[] = [
  { nombre: 'Cristo Redentor', lon: -69.62, lat: -32.83 },
  { nombre: 'Paso de los Libres', lon: -57.08, lat: -29.71 },
  { nombre: 'Fray Bentos', lon: -58.26, lat: -33.08 },
  { nombre: 'Encarnación', lon: -55.87, lat: -27.34 },
  { nombre: 'Foz / C. del Este', lon: -54.58, lat: -25.51 },
  { nombre: 'Clorinda', lon: -57.93, lat: -25.28 },
];

// ── Utilidades sobre polilíneas de corredor ──────────────────
const EARTH_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;

export function segKm(a: [number, number], b: [number, number]): number {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

export function corridorKm(c: Corridor): number {
  let s = 0;
  for (let i = 1; i < c.pts.length; i++) s += segKm(c.pts[i - 1], c.pts[i]);
  return s;
}

/** Punto interpolado en el corredor: t ∈ [0,1] → [lon, lat] */
export function pointAt(c: Corridor, t: number): [number, number] {
  const total = corridorKm(c);
  let target = Math.min(1, Math.max(0, t)) * total;
  for (let i = 1; i < c.pts.length; i++) {
    const d = segKm(c.pts[i - 1], c.pts[i]);
    if (target <= d || i === c.pts.length - 1) {
      const f = d > 0 ? Math.min(1, target / d) : 0;
      return [
        c.pts[i - 1][0] + (c.pts[i][0] - c.pts[i - 1][0]) * f,
        c.pts[i - 1][1] + (c.pts[i][1] - c.pts[i - 1][1]) * f,
      ];
    }
    target -= d;
  }
  return c.pts[c.pts.length - 1];
}

/** Rumbo (grados, 0=N) en el punto t — para orientar el ícono. */
export function headingAt(c: Corridor, t: number): number {
  const a = pointAt(c, Math.max(0, t - 0.005));
  const b = pointAt(c, Math.min(1, t + 0.005));
  const dLon = toRad(b[0] - a[0]);
  const y = Math.sin(dLon) * Math.cos(toRad(b[1]));
  const x = Math.cos(toRad(a[1])) * Math.sin(toRad(b[1])) - Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180) / Math.PI + 0;
}

/** Fracción del corredor (0..1) en el vértice i — para definir viajes parciales. */
export function fracAtVertex(c: Corridor, i: number): number {
  const idx = Math.max(0, Math.min(c.pts.length - 1, i));
  let acc = 0;
  for (let k = 1; k <= idx; k++) acc += segKm(c.pts[k - 1], c.pts[k]);
  const total = corridorKm(c);
  return total > 0 ? acc / total : 0;
}
