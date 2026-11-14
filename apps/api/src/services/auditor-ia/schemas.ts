// ──────────────────────────────────────────────────────────────
// Auditor IA — esquemas Zod de E/S del modelo (spec §9)
//
// Validación posterior:
//  - Todo `ref` de evidence/citations debe pertenecer al conjunto
//    entregado; si no, se descarta y reintenta (ver llm-adapter).
//  - Segundo intento fallido → CANNOT_EVALUATE con limitation.
//  - Se eliminan URLs del texto generado (anti-prompt-injection).
//  - No existe dictamen por defecto.
// ──────────────────────────────────────────────────────────────

import { z } from 'zod';

export const VERIFICATION_TYPES = ['DOCUMENT', 'RECORD', 'OBSERVATION', 'INTERVIEW'] as const;
export type VerificationType = (typeof VERIFICATION_TYPES)[number];

// ── Extracción (propuesta de requisitos por cláusula) ─────────

export const ExtractionRequirementSchema = z.object({
  clauseNumber: z.string().max(30),
  statement: z.string().min(10).max(300),
  verificationTypes: z.array(z.enum(VERIFICATION_TYPES)).min(1).max(4),
  connectorKeys: z.array(z.string().max(60)).max(10),
  requiresDocumentedInfo: z.boolean(),
  pageHint: z.number().int().min(1).optional(),
});

export const ExtractionOutputSchema = z.object({
  requirements: z.array(ExtractionRequirementSchema).max(15),
});
export type ExtractionOutput = z.infer<typeof ExtractionOutputSchema>;

// ── Evaluación ───────────────────────────────────────────────

export const AI_VERDICTS = [
  'EVIDENCE_SUPPORTS',
  'POSSIBLE_GAP',
  'REQUIRES_EXTERNAL_VERIFICATION',
  'INSUFFICIENT_EVIDENCE',
] as const;
export type AIVerdict = (typeof AI_VERDICTS)[number];

export const EvaluationOutputSchema = z.object({
  verdict: z.enum(AI_VERDICTS),
  explanation: z.string().min(20).max(1200),
  evidence: z
    .array(
      z.object({
        ref: z.string().max(80),
        assessment: z.enum(['SUPPORTS', 'NOT_SUPPORTS', 'INCONCLUSIVE']),
        aspect: z.string().max(200),
        note: z.string().max(300),
      }),
    )
    .max(15),
  gaps: z
    .array(
      z.object({
        description: z.string().max(400),
        relatedRefs: z.array(z.string().max(80)).max(10),
      }),
    )
    .max(10),
  limitations: z.array(z.string().max(300)).max(10),
  externalChecks: z.array(z.string().max(300)).max(10),
  proposals: z
    .array(
      z.object({
        action: z.string().max(400),
        target: z.enum(['NCR', 'ACTION_PLAN', 'DOCUMENT', 'OTHER']),
      }),
    )
    .max(5),
  auditQuestions: z.array(z.string().max(300)).max(5),
});
export type EvaluationOutput = z.infer<typeof EvaluationOutputSchema>;

/**
 * Normaliza errores típicos de modelos locales antes de validar:
 *  - campos array en null/undefined → []
 *  - campos array-de-string como string suelto → [string]
 *  - items no-objeto en arrays de objetos → filtrados
 *  - gaps[].relatedRefs null → []
 * Evita que `"limitations": null` tumbe toda la evaluación.
 */
export function normalizeEvaluationJson(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const o = { ...(raw as Record<string, unknown>) };

  for (const f of ['limitations', 'externalChecks', 'auditQuestions']) {
    if (o[f] == null) o[f] = [];
    else if (typeof o[f] === 'string') o[f] = [o[f]];
  }
  for (const f of ['evidence', 'gaps', 'proposals']) {
    if (o[f] == null) o[f] = [];
    else if (Array.isArray(o[f])) o[f] = (o[f] as unknown[]).filter(
      (i) => i && typeof i === 'object' && !Array.isArray(i),
    );
  }
  if (Array.isArray(o.gaps)) {
    o.gaps = (o.gaps as Record<string, unknown>[]).map((g) =>
      g && typeof g === 'object' && g.relatedRefs == null ? { ...g, relatedRefs: [] } : g,
    );
  }
  return o;
}

// ── Consulta conversacional ──────────────────────────────────

export const AnswerOutputSchema = z.object({
  answer: z.string().min(1).max(1500),
  citations: z.array(z.object({ ref: z.string().max(80) })).max(10),
  outOfScope: z.boolean(),
});
export type AnswerOutput = z.infer<typeof AnswerOutputSchema>;

// ── Post-validación y sanitización ───────────────────────────

const URL_RE = /https?:\/\/[^\s)\]]+/gi;

/** Quita URLs del texto generado por el modelo. */
export function stripUrls(text: string): string {
  return text.replace(URL_RE, '[enlace eliminado]');
}

export function sanitizeEvaluation(out: EvaluationOutput): EvaluationOutput {
  return {
    ...out,
    explanation: stripUrls(out.explanation),
    evidence: out.evidence.map((e) => ({ ...e, note: stripUrls(e.note) })),
    gaps: out.gaps.map((g) => ({ ...g, description: stripUrls(g.description) })),
    limitations: out.limitations.map(stripUrls),
    externalChecks: out.externalChecks.map(stripUrls),
    proposals: out.proposals.map((p) => ({ ...p, action: stripUrls(p.action) })),
    auditQuestions: out.auditQuestions.map(stripUrls),
  };
}

/**
 * Verifica que todos los `ref` citados existan en el conjunto
 * entregado al modelo. Devuelve los refs inválidos (vacío = OK).
 */
export function invalidRefs(output: EvaluationOutput | AnswerOutput, validRefs: Set<string>): string[] {
  const refs: string[] = [];
  if ('evidence' in output) {
    for (const e of output.evidence) refs.push(e.ref);
    for (const g of output.gaps) refs.push(...g.relatedRefs);
  }
  if ('citations' in output) {
    for (const c of output.citations) refs.push(c.ref);
  }
  return [...new Set(refs.filter((r) => !validRefs.has(r)))];
}

/**
 * ZodError → texto legible 'campo: mensaje' para persistir en
 * limitations. El dump JSON crudo de e.message llega hasta la UI
 * y es ilegible (aparece como '{"code":"invalid_type",...').
 */
export function zodSummary(e: unknown): string {
  if (e instanceof z.ZodError) {
    return e.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.') || 'raíz'}: ${i.message}`)
      .join('; ');
  }
  return (e as Error).message ?? 'error desconocido';
}

/** Parsea texto a JSON tolerando fences markdown. */
export function parseModelJson(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('salida del modelo sin objeto JSON');
  }
  return JSON.parse(t.slice(start, end + 1));
}
