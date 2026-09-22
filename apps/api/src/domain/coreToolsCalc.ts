// ════════════════════════════════════════════════════════════════════════════
// Core Tools — motor de cálculo MSA + SPC (IATF 16949 / AIAG MSA-4, SPC-2)
// ════════════════════════════════════════════════════════════════════════════

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0);
const range = (xs: number[]) => (xs.length ? Math.max(...xs) - Math.min(...xs) : 0);
const stddev = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1));
};

// Constantes MSA/SPC (AIAG)
const K1: Record<number, number> = { 2: 0.8862, 3: 0.5908 }; // por nº de ensayos
const K2: Record<number, number> = { 2: 0.7071, 3: 0.5231 }; // por nº de operadores
const K3: Record<number, number> = {
  2: 0.7071, 3: 0.5231, 4: 0.4467, 5: 0.4030, 6: 0.3742,
  7: 0.3534, 8: 0.3375, 9: 0.3249, 10: 0.3146,
};
const SPC_CONST: Record<number, { A2: number; A3: number; D3: number; D4: number; B3: number; B4: number; d2: number }> = {
  2:  { A2: 1.880, A3: 2.659, D3: 0,     D4: 3.267, B3: 0,     B4: 3.267, d2: 1.128 },
  3:  { A2: 1.023, A3: 1.954, D3: 0,     D4: 2.574, B3: 0,     B4: 2.568, d2: 1.693 },
  4:  { A2: 0.729, A3: 1.628, D3: 0,     D4: 2.282, B3: 0,     B4: 2.266, d2: 2.059 },
  5:  { A2: 0.577, A3: 1.427, D3: 0,     D4: 2.114, B3: 0,     B4: 2.089, d2: 2.326 },
  6:  { A2: 0.483, A3: 1.287, D3: 0,     D4: 2.004, B3: 0.030, B4: 1.970, d2: 2.534 },
  7:  { A2: 0.419, A3: 1.182, D3: 0.076, D4: 1.924, B3: 0.118, B4: 1.882, d2: 2.704 },
  8:  { A2: 0.373, A3: 1.099, D3: 0.136, D4: 1.864, B3: 0.185, B4: 1.815, d2: 2.847 },
  9:  { A2: 0.337, A3: 1.032, D3: 0.184, D4: 1.816, B3: 0.239, B4: 1.761, d2: 2.970 },
  10: { A2: 0.308, A3: 0.975, D3: 0.223, D4: 1.777, B3: 0.284, B4: 1.716, d2: 3.078 },
};

const r2 = (v: number) => Math.round(v * 100) / 100;
const r4 = (v: number) => Math.round(v * 10000) / 10000;

// ── Gage R&R cruzado — método promedio y rango ───────────────────────────────
// readings: [{ part: number|string, operator: number|string, trial: number, value: number }]
export function computeGrrCrossed(readings: any[], tolerance?: number | null) {
  const parts = [...new Set(readings.map((r) => String(r.part)))];
  const ops = [...new Set(readings.map((r) => String(r.operator)))];
  const p = parts.length;
  const o = ops.length;
  const t = Math.max(...readings.map((r) => Number(r.trial) || 1));

  if (p < 2 || o < 2 || t < 2) {
    return { error: 'Se requieren al menos 2 piezas, 2 operadores y 2 ensayos.' };
  }

  const cell = (part: string, op: string) =>
    readings.filter((r) => String(r.part) === part && String(r.operator) === op).map((r) => Number(r.value));

  // R̄ por operador (promedio de rangos de cada celda pieza×operador)
  const opRanges = ops.map((op) => mean(parts.map((pt) => range(cell(pt, op)))));
  const Rbar = mean(opRanges);

  // Promedio por operador → X̄diff
  const opMeans = ops.map((op) =>
    mean(readings.filter((r) => String(r.operator) === op).map((r) => Number(r.value)))
  );
  const Xdiff = range(opMeans);

  // Promedio por pieza → Rp
  const partMeans = parts.map((pt) =>
    mean(readings.filter((r) => String(r.part) === pt).map((r) => Number(r.value)))
  );
  const Rp = range(partMeans);

  const k1 = K1[t] ?? K1[3];
  const k2 = K2[o] ?? K2[3];
  const k3 = K3[p] ?? K3[10];

  const EV = Rbar * k1;
  const avSq = (Xdiff * k2) ** 2 - EV ** 2 / (p * t);
  const AV = avSq > 0 ? Math.sqrt(avSq) : 0;
  const PV = Rp * k3;
  const GRR = Math.sqrt(EV ** 2 + AV ** 2);
  const TV = Math.sqrt(GRR ** 2 + PV ** 2);

  const pctGRR = TV > 0 ? (GRR / TV) * 100 : 0;
  const ndc = GRR > 0 ? Math.floor(1.41 * (PV / GRR)) : 0;
  const pctTol = tolerance && tolerance > 0 ? (GRR / tolerance) * 100 : null;

  let verdict: string;
  if (pctGRR < 10) verdict = 'ACEPTABLE';
  else if (pctGRR <= 30) verdict = 'CONDICIONAL';
  else verdict = 'NO ACEPTABLE';

  return {
    method: 'Promedio y Rango (cruzado)',
    parts: p, operators: o, trials: t,
    Rbar: r4(Rbar), Xdiff: r4(Xdiff), Rp: r4(Rp),
    EV: r4(EV), AV: r4(AV), GRR: r4(GRR), PV: r4(PV), TV: r4(TV),
    pctEV: r2(TV > 0 ? (EV / TV) * 100 : 0),
    pctAV: r2(TV > 0 ? (AV / TV) * 100 : 0),
    pctGRR: r2(pctGRR),
    pctPV: r2(TV > 0 ? (PV / TV) * 100 : 0),
    pctTolerance: pctTol !== null ? r2(pctTol) : null,
    ndc,
    verdict,
    verdictNote:
      verdict === 'ACEPTABLE'
        ? 'Sistema de medición aceptable (%GRR < 10%).'
        : verdict === 'CONDICIONAL'
          ? 'Sistema condicionalmente aceptable (10–30%): evaluar según criticidad y costo de mejora.'
          : 'Sistema de medición NO aceptable (%GRR > 30%): requiere acción de mejora.',
    ndcNote: ndc >= 5 ? `ndc = ${ndc} ≥ 5: resolución adecuada.` : `ndc = ${ndc} < 5: resolución insuficiente.`,
  };
}

// ── Sesgo (bias) ─────────────────────────────────────────────────────────────
// referenceValues: [{ ref: number, readings: number[] }]
export function computeBias(referenceValues: any[], tolerance?: number | null) {
  const rows = referenceValues
    .filter((rv) => rv.ref != null && Array.isArray(rv.readings) && rv.readings.length > 0)
    .map((rv) => {
      const vals = rv.readings.map(Number);
      const m = mean(vals);
      return { ref: Number(rv.ref), n: vals.length, mean: r4(m), bias: r4(m - Number(rv.ref)), stddev: r4(stddev(vals)) };
    });
  if (rows.length === 0) return { error: 'Se requiere al menos un valor de referencia con lecturas.' };
  const avgBias = mean(rows.map((r) => r.bias));
  const pctTol = tolerance && tolerance > 0 ? (Math.abs(avgBias) / tolerance) * 100 : null;
  return {
    rows,
    avgBias: r4(avgBias),
    pctTolerance: pctTol !== null ? r2(pctTol) : null,
    verdict: pctTol !== null ? (pctTol <= 10 ? 'ACEPTABLE' : 'REVISAR') : 'INFORMATIVO',
    verdictNote:
      pctTol !== null
        ? pctTol <= 10
          ? 'Sesgo dentro del 10% de la tolerancia: aceptable.'
          : 'Sesgo supera el 10% de la tolerancia: revisar calibración del equipo.'
        : 'Sin tolerancia definida: resultado informativo.',
  };
}

// ── Linealidad ───────────────────────────────────────────────────────────────
export function computeLinearity(referenceValues: any[], tolerance?: number | null) {
  const pts = referenceValues
    .filter((rv) => rv.ref != null && Array.isArray(rv.readings) && rv.readings.length > 0)
    .map((rv) => ({ x: Number(rv.ref), y: mean(rv.readings.map(Number)) - Number(rv.ref) }));
  if (pts.length < 2) return { error: 'Se requieren al menos 2 referencias con lecturas.' };

  const xm = mean(pts.map((p) => p.x));
  const ym = mean(pts.map((p) => p.y));
  const sxy = pts.reduce((s, p) => s + (p.x - xm) * (p.y - ym), 0);
  const sxx = pts.reduce((s, p) => s + (p.x - xm) ** 2, 0);
  const slope = sxx > 0 ? sxy / sxx : 0;
  const intercept = ym - slope * xm;
  const ssTot = pts.reduce((s, p) => s + (p.y - ym) ** 2, 0);
  const ssRes = pts.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0);
  const rSq = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  const refRange = range(pts.map((p) => p.x));
  const linearity = Math.abs(slope) * refRange;
  const pctTol = tolerance && tolerance > 0 ? (linearity / tolerance) * 100 : null;

  return {
    points: pts.map((p) => ({ ref: p.x, bias: r4(p.y) })),
    slope: r4(slope),
    intercept: r4(intercept),
    rSquared: r4(rSq),
    linearity: r4(linearity),
    pctTolerance: pctTol !== null ? r2(pctTol) : null,
    verdict: pctTol !== null ? (pctTol <= 10 ? 'ACEPTABLE' : 'REVISAR') : rSq >= 0.95 ? 'ACEPTABLE' : 'REVISAR',
    verdictNote: 'Linealidad = |pendiente| × rango de referencias. R² cercano a 1 indica sesgo consistente en el rango.',
  };
}

// ── Estabilidad ──────────────────────────────────────────────────────────────
export function computeStability(referenceValues: any[]) {
  const all = referenceValues.flatMap((rv) => (Array.isArray(rv.readings) ? rv.readings.map(Number) : []));
  if (all.length < 3) return { error: 'Se requieren al menos 3 lecturas en el tiempo.' };
  const m = mean(all);
  const sd = stddev(all);
  const half = Math.ceil(all.length / 2);
  const drift = mean(all.slice(half)) - mean(all.slice(0, half));
  const outOfLimits = all.filter((v) => Math.abs(v - m) > 3 * sd).length;
  return {
    n: all.length,
    mean: r4(m),
    stddev: r4(sd),
    drift: r4(drift),
    outOfLimits,
    verdict: outOfLimits === 0 && Math.abs(drift) <= sd ? 'ESTABLE' : 'REVISAR',
    verdictNote: 'Estable si no hay puntos fuera de ±3σ y la deriva entre mitades es menor a 1σ.',
  };
}

// ── Atributos (acuerdo) ──────────────────────────────────────────────────────
// readings: [{ part, operator, trial, result: 'OK'|'NOK'|0|1, ref? }]
export function computeAttributeAgreement(readings: any[]) {
  const norm = (v: any) => (v === 1 || v === '1' || v === 'OK' || v === 'ok' || v === true ? 1 : 0);
  const parts = [...new Set(readings.map((r) => String(r.part)))];
  const ops = [...new Set(readings.map((r) => String(r.operator)))];

  // Repetibilidad: % de piezas donde el operador dio el mismo resultado en todos los ensayos
  const perOp = ops.map((op) => {
    const consistent = parts.filter((pt) => {
      const vals = readings.filter((r) => String(r.part) === pt && String(r.operator) === op).map((r) => norm(r.result));
      return vals.length > 0 && new Set(vals).size === 1;
    }).length;
    return { operator: op, consistent, total: parts.length, pct: r2((consistent / parts.length) * 100) };
  });

  // Reproducibilidad: % de piezas donde todos los operadores coinciden
  const allAgree = parts.filter((pt) => {
    const vals = readings.filter((r) => String(r.part) === pt).map((r) => norm(r.result));
    return vals.length > 0 && new Set(vals).size === 1;
  }).length;

  // Vs referencia (si hay ref)
  const withRef = readings.filter((r) => r.ref !== undefined && r.ref !== null);
  let vsRef: any = null;
  if (withRef.length > 0) {
    const correct = withRef.filter((r) => norm(r.result) === norm(r.ref)).length;
    vsRef = { total: withRef.length, correct, pct: r2((correct / withRef.length) * 100) };
  }

  const repeatability = r2(mean(perOp.map((o) => o.pct)));
  const reproducibility = r2((allAgree / parts.length) * 100);
  const overall = vsRef ? vsRef.pct : reproducibility;

  return {
    parts: parts.length,
    operators: ops.length,
    perOperator: perOp,
    repeatabilityPct: repeatability,
    reproducibilityPct: reproducibility,
    vsReference: vsRef,
    verdict: overall >= 90 ? 'ACEPTABLE' : overall >= 75 ? 'CONDICIONAL' : 'NO ACEPTABLE',
    verdictNote: 'Criterio AIAG: ≥90% de acuerdo aceptable, 75–90% condicional, <75% no aceptable.',
  };
}

// ── SPC — límites de control + capabilidad + reglas Western Electric ─────────
export function computeSpc(chartType: string, subgroups: any, opts: { usl?: number | null; lsl?: number | null; subgroupSize?: number }) {
  const { usl, lsl } = opts;

  if (chartType === 'XBAR_R' || chartType === 'XBAR_S') {
    const groups: number[][] = (subgroups || []).map((g: any) => (Array.isArray(g) ? g.map(Number) : []));
    if (groups.length < 2) return { error: 'Se requieren al menos 2 subgrupos.' };
    const n = groups[0].length;
    const c = SPC_CONST[n] || SPC_CONST[5];
    const means = groups.map(mean);
    const ranges = groups.map(range);
    const sds = groups.map(stddev);
    const Xbarbar = mean(means);
    const Rbar = mean(ranges);
    const Sbar = mean(sds);

    const isR = chartType === 'XBAR_R';
    const spread = isR ? Rbar : Sbar;
    const A = isR ? c.A2 : c.A3;
    const limits = {
      cl: r4(Xbarbar),
      ucl: r4(Xbarbar + A * spread),
      lcl: r4(Xbarbar - A * spread),
      clS: r4(spread),
      uclS: r4((isR ? c.D4 : c.B4) * spread),
      lclS: r4((isR ? c.D3 : c.B3) * spread),
      spreadLabel: isR ? 'R' : 'S',
    };

    const sigma = spread / c.d2;
    const allVals = groups.flat();
    const sigmaOverall = stddev(allVals);
    const capability = computeCapability(Xbarbar, sigma, sigmaOverall, usl, lsl);
    const alarms = westernElectric(means, Xbarbar, (limits.ucl - Xbarbar) / 3 || sigma);
    return { limits, capability, alarms, points: means.map(r4), spreadPoints: (isR ? ranges : sds).map(r4), sigma: r4(sigma) };
  }

  if (chartType === 'I_MR') {
    const vals: number[] = (subgroups || []).map(Number).filter((v: number) => !isNaN(v));
    if (vals.length < 3) return { error: 'Se requieren al menos 3 valores individuales.' };
    const mrs = vals.slice(1).map((v, i) => Math.abs(v - vals[i]));
    const xbar = mean(vals);
    const mrbar = mean(mrs);
    const limits = {
      cl: r4(xbar),
      ucl: r4(xbar + 2.66 * mrbar),
      lcl: r4(xbar - 2.66 * mrbar),
      clS: r4(mrbar),
      uclS: r4(3.267 * mrbar),
      lclS: 0,
      spreadLabel: 'MR',
    };
    const sigma = mrbar / 1.128;
    const sigmaOverall = stddev(vals);
    const capability = computeCapability(xbar, sigma, sigmaOverall, usl, lsl);
    const alarms = westernElectric(vals, xbar, (limits.ucl - xbar) / 3 || sigma);
    return { limits, capability, alarms, points: vals.map(r4), spreadPoints: mrs.map(r4), sigma: r4(sigma) };
  }

  // Atributos: P, NP, C, U — subgroups: [{ n, defectives } | { n, defects }]
  const rows: any[] = subgroups || [];
  if (rows.length < 2) return { error: 'Se requieren al menos 2 subgrupos.' };

  if (chartType === 'P' || chartType === 'NP') {
    const ns = rows.map((r) => Number(r.n) || 0);
    const defs = rows.map((r) => Number(r.defectives ?? r.defects) || 0);
    const pbar = defs.reduce((s, v) => s + v, 0) / ns.reduce((s, v) => s + v, 0);
    const isP = chartType === 'P';
    const points = defs.map((d, i) => (isP ? d / (ns[i] || 1) : d));
    const cl = isP ? pbar : pbar * mean(ns);
    const limits = {
      cl: r4(cl),
      // límites variables por subgrupo para P; constantes para NP
      ucl: isP ? null : r4(cl + 3 * Math.sqrt(cl * (1 - pbar))),
      lcl: isP ? null : r4(Math.max(0, cl - 3 * Math.sqrt(cl * (1 - pbar)))),
      perPoint: points.map((_, i) => {
        const nn = ns[i] || 1;
        const c = isP ? pbar : pbar * nn;
        const sd = isP ? Math.sqrt((pbar * (1 - pbar)) / nn) : Math.sqrt(nn * pbar * (1 - pbar));
        return { ucl: r4(c + 3 * sd), lcl: r4(Math.max(0, c - 3 * sd)) };
      }),
    };
    const alarms = westernElectric(points, cl, isP ? Math.sqrt((pbar * (1 - pbar)) / mean(ns)) : Math.sqrt(cl * (1 - pbar)));
    return { limits, alarms, points: points.map(r4), pbar: r4(pbar), capability: null };
  }

  if (chartType === 'C' || chartType === 'U') {
    const ns = rows.map((r) => Number(r.n) || 1);
    const defs = rows.map((r) => Number(r.defects ?? r.defectives) || 0);
    const isC = chartType === 'C';
    const cbar = defs.reduce((s, v) => s + v, 0) / (isC ? rows.length : ns.reduce((s, v) => s + v, 0));
    const points = defs.map((d, i) => (isC ? d : d / (ns[i] || 1)));
    const cl = cbar;
    const limits = {
      cl: r4(cl),
      ucl: isC ? r4(cl + 3 * Math.sqrt(cl)) : null,
      lcl: isC ? r4(Math.max(0, cl - 3 * Math.sqrt(cl))) : null,
      perPoint: isC
        ? null
        : points.map((_, i) => {
            const sd = Math.sqrt(cbar / (ns[i] || 1));
            return { ucl: r4(cl + 3 * sd), lcl: r4(Math.max(0, cl - 3 * sd)) };
          }),
    };
    const alarms = westernElectric(points, cl, Math.sqrt(isC ? cl : cl / mean(ns)));
    return { limits, alarms, points: points.map(r4), cbar: r4(cbar), capability: null };
  }

  return { error: `Tipo de carta no soportado: ${chartType}` };
}

function computeCapability(xbar: number, sigmaWithin: number, sigmaOverall: number, usl?: number | null, lsl?: number | null) {
  if (usl == null && lsl == null) return null;
  const cap: any = { sigmaWithin: r4(sigmaWithin), sigmaOverall: r4(sigmaOverall) };
  if (usl != null && lsl != null && sigmaWithin > 0) {
    cap.cp = r2((usl - lsl) / (6 * sigmaWithin));
    cap.cpk = r2(Math.min((usl - xbar) / (3 * sigmaWithin), (xbar - lsl) / (3 * sigmaWithin)));
  } else if (usl != null && sigmaWithin > 0) {
    cap.cpk = r2((usl - xbar) / (3 * sigmaWithin));
  } else if (lsl != null && sigmaWithin > 0) {
    cap.cpk = r2((xbar - lsl) / (3 * sigmaWithin));
  }
  if (usl != null && lsl != null && sigmaOverall > 0) {
    cap.pp = r2((usl - lsl) / (6 * sigmaOverall));
    cap.ppk = r2(Math.min((usl - xbar) / (3 * sigmaOverall), (xbar - lsl) / (3 * sigmaOverall)));
  }
  cap.verdict =
    cap.cpk != null ? (cap.cpk >= 1.67 ? 'EXCELENTE' : cap.cpk >= 1.33 ? 'CAPAZ' : cap.cpk >= 1.0 ? 'MARGINAL' : 'NO CAPAZ') : null;
  return cap;
}

// Reglas Western Electric sobre la carta principal
function westernElectric(points: number[], cl: number, sigma: number) {
  if (!sigma || sigma <= 0) return [];
  const alarms: Array<{ index: number; rule: string; description: string }> = [];
  const z = (v: number) => (v - cl) / sigma;

  points.forEach((v, i) => {
    if (Math.abs(z(v)) > 3) alarms.push({ index: i, rule: 'R1', description: 'Punto fuera de límites de control (±3σ)' });
  });
  for (let i = 2; i < points.length; i++) {
    const w = points.slice(i - 2, i + 1).map(z);
    if (w.filter((x) => x > 2).length >= 2 || w.filter((x) => x < -2).length >= 2) {
      alarms.push({ index: i, rule: 'R2', description: '2 de 3 puntos consecutivos fuera de ±2σ (mismo lado)' });
    }
  }
  for (let i = 4; i < points.length; i++) {
    const w = points.slice(i - 4, i + 1).map(z);
    if (w.filter((x) => x > 1).length >= 4 || w.filter((x) => x < -1).length >= 4) {
      alarms.push({ index: i, rule: 'R3', description: '4 de 5 puntos consecutivos fuera de ±1σ (mismo lado)' });
    }
  }
  for (let i = 7; i < points.length; i++) {
    const w = points.slice(i - 7, i + 1).map(z);
    if (w.every((x) => x > 0) || w.every((x) => x < 0)) {
      alarms.push({ index: i, rule: 'R4', description: '8 puntos consecutivos del mismo lado de la línea central' });
    }
  }
  for (let i = 5; i < points.length; i++) {
    const w = points.slice(i - 5, i + 1);
    const inc = w.every((v, j) => j === 0 || v > w[j - 1]);
    const dec = w.every((v, j) => j === 0 || v < w[j - 1]);
    if (inc || dec) alarms.push({ index: i, rule: 'R5', description: '6 puntos consecutivos en tendencia' });
  }
  // dedup por index+rule
  const seen = new Set<string>();
  return alarms.filter((a) => {
    const k = `${a.index}-${a.rule}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── FMEA AIAG-VDA — Action Priority ──────────────────────────────────────────
export function computeActionPriority(s: number, o: number, d: number): 'ALTA' | 'MEDIA' | 'BAJA' {
  // Tabla simplificada AIAG-VDA AP
  if (s >= 9) {
    if (o >= 4) return d >= 2 ? 'ALTA' : 'ALTA';
    if (o >= 2) return d >= 5 ? 'ALTA' : 'MEDIA';
    return d >= 7 ? 'MEDIA' : 'BAJA';
  }
  if (s >= 7) {
    if (o >= 6) return 'ALTA';
    if (o >= 4) return d >= 5 ? 'ALTA' : 'MEDIA';
    if (o >= 2) return d >= 7 ? 'MEDIA' : 'BAJA';
    return 'BAJA';
  }
  if (s >= 4) {
    if (o >= 7) return d >= 4 ? 'ALTA' : 'MEDIA';
    if (o >= 4) return d >= 7 ? 'MEDIA' : 'BAJA';
    return 'BAJA';
  }
  return 'BAJA';
}

// ── Plantillas por defecto ───────────────────────────────────────────────────
export const APQP_PHASES = [
  { phase: 1, name: 'Planificación y definición', deliverables: [
    'Voz del cliente', 'Plan de negocio / estrategia', 'Lista de características especiales (preliminar)',
    'Objetivos de diseño / confiabilidad / calidad', 'Plan de proyecto APQP'] },
  { phase: 2, name: 'Diseño y desarrollo del producto', deliverables: [
    'DFMEA', 'Diseño para manufactura (DFM)', 'Plan de control prototipo',
    'Dibujos y especificaciones', 'Requisitos de materiales'] },
  { phase: 3, name: 'Diseño y desarrollo del proceso', deliverables: [
    'Diagrama de flujo del proceso', 'PFMEA', 'Plan de control pre-lanzamiento',
    'Instrucciones de trabajo', 'Plan de MSA', 'Plan de capacidad inicial'] },
  { phase: 4, name: 'Validación de producto y proceso', deliverables: [
    'Corrida de producción significativa (Run@Rate)', 'Estudios MSA', 'Estudio de capacidad inicial (Ppk)',
    'PPAP', 'Validación de empaque', 'Plan de control de producción'] },
  { phase: 5, name: 'Retroalimentación y mejora continua', deliverables: [
    'Reducción de variación', 'Satisfacción del cliente', 'Lecciones aprendidas', 'Cierre del proyecto'] },
];

export const PPAP_ELEMENTS = [
  'Registro de diseño (dibujo)', 'Documentos de cambio de ingeniería', 'Aprobación de ingeniería del cliente',
  'DFMEA', 'Diagrama de flujo del proceso', 'PFMEA', 'Plan de control',
  'Estudios MSA', 'Resultados dimensionales', 'Registros de ensayos de material/desempeño',
  'Estudios de capacidad inicial', 'Documentación de laboratorio', 'Informe de apariencia (AAR)',
  'Piezas de muestra', 'Muestra patrón (master sample)', 'Ayudas de verificación',
  'Requisitos específicos del cliente', 'PSW — Part Submission Warrant',
];
