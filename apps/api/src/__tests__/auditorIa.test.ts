// Pruebas del módulo Auditor IA — funciones puras (sin DB).
// Correr: node --import tsx --test src/__tests__/auditorIa.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseModelJson,
  stripUrls,
  sanitizeEvaluation,
  invalidRefs,
  EvaluationOutputSchema,
  AnswerOutputSchema,
  ExtractionOutputSchema,
  normalizeEvaluationJson,
  truncateEvaluationJson,
} from '../services/auditor-ia/schemas.js';
import { suggestedConnectorKeys } from '../services/auditor-ia/connectors/seed-iso9001.js';
import { AuditorLLM } from '../services/auditor-ia/llm-adapter.js';
import type { LLMProvider } from '../services/llm/types.js';
import type { EvidenceItem } from '../services/auditor-ia/connectors/types.js';

// ── parseModelJson ─────────────────────────────────────────

test('parseModelJson: JSON limpio', () => {
  assert.deepEqual(parseModelJson('{"a":1}'), { a: 1 });
});

test('parseModelJson: tolera fences markdown', () => {
  const out = parseModelJson('Acá va:\n```json\n{"verdict":"NONE"}\n```\nlisto');
  assert.deepEqual(out, { verdict: 'NONE' });
});

test('parseModelJson: tolera texto extra fuera del objeto', () => {
  const out = parseModelJson('respuesta: {"ok":true} fin');
  assert.deepEqual(out, { ok: true });
});

test('parseModelJson: falla sin objeto JSON', () => {
  assert.throws(() => parseModelJson('sin json acá'), /sin objeto JSON/);
});

// ── stripUrls / sanitizeEvaluation ─────────────────────────

test('stripUrls: reemplaza URLs por marcador', () => {
  assert.equal(stripUrls('ver https://example.com/x), listo'), 'ver [enlace eliminado]), listo');
  assert.equal(stripUrls('sin urls'), 'sin urls');
});

const BASE_EVAL = {
  verdict: 'POSSIBLE_GAP' as const,
  explanation: 'La evidencia del proceso no cubre el período completo.',
  evidence: [
    { ref: 'E1', assessment: 'INCONCLUSIVE' as const, aspect: 'cobertura', note: 'ver https://x.com' },
  ],
  gaps: [{ description: 'Falta registro https://leak.io', relatedRefs: ['E1'] }],
  limitations: ['Adjunto no legible'],
  externalChecks: ['Verificar en sitio'],
  proposals: [{ action: 'Revisar https://otro.com', target: 'DOCUMENT' as const }],
  auditQuestions: ['¿Dónde está la versión https://f.com?'],
};

test('sanitizeEvaluation: quita URLs de todos los campos de texto', () => {
  const s = sanitizeEvaluation(EvaluationOutputSchema.parse(BASE_EVAL));
  assert.ok(!/https?:\/\//.test(s.explanation + s.evidence[0].note + s.gaps[0].description + s.proposals[0].action + s.auditQuestions[0]));
  assert.equal(s.evidence[0].note, 'ver [enlace eliminado]');
});

// ── invalidRefs ────────────────────────────────────────────

test('invalidRefs: detecta refs fuera del conjunto válido', () => {
  const out = EvaluationOutputSchema.parse({
    ...BASE_EVAL,
    evidence: [
      { ref: 'E1', assessment: 'SUPPORTS', aspect: 'a', note: 'n' },
      { ref: 'E9', assessment: 'SUPPORTS', aspect: 'a', note: 'n' },
    ],
    gaps: [{ description: 'g', relatedRefs: ['E2', 'E99'] }],
  });
  const bad = invalidRefs(out, new Set(['E1', 'E2']));
  assert.deepEqual(bad.sort(), ['E9', 'E99'].sort());
});

test('invalidRefs: cero inválidos cuando todos existen', () => {
  const out = AnswerOutputSchema.parse({ answer: 'ok', citations: [{ ref: 'R1' }], outOfScope: false });
  assert.deepEqual(invalidRefs(out, new Set(['R1'])), []);
});

// ── Schemas Zod ────────────────────────────────────────────

test('EvaluationOutputSchema: rechaza veredicto no válido', () => {
  const r = EvaluationOutputSchema.safeParse({ ...BASE_EVAL, verdict: 'CUMPLE' });
  assert.equal(r.success, false);
});

test('EvaluationOutputSchema: rechaza explicación muy corta', () => {
  const r = EvaluationOutputSchema.safeParse({ ...BASE_EVAL, explanation: 'corta' });
  assert.equal(r.success, false);
});

test('ExtractionOutputSchema: máximo 15 requisitos', () => {
  const req = {
    clauseNumber: '9.2', statement: 'La organización realiza auditorías internas.',
    verificationTypes: ['RECORD'], connectorKeys: ['internal_audits'], requiresDocumentedInfo: false,
  };
  const ok = ExtractionOutputSchema.safeParse({ requirements: Array(15).fill(req) });
  const fail = ExtractionOutputSchema.safeParse({ requirements: Array(16).fill(req) });
  assert.equal(ok.success, true);
  assert.equal(fail.success, false);
});

// ── suggestedConnectorKeys (seed ISO 9001) ──────────────────

test('suggestedConnectorKeys: coincidencia específica por prefijo', () => {
  assert.deepEqual(suggestedConnectorKeys('9.2'), ['internal_audits']);
  assert.deepEqual(suggestedConnectorKeys('9.3'), ['management_review']);
  assert.deepEqual(suggestedConnectorKeys('10.2'), ['ncr']);
});

test('suggestedConnectorKeys: cláusula más específica gana', () => {
  const keys = suggestedConnectorKeys('9.2.1');
  assert.ok(keys.includes('internal_audits'));
});

test('suggestedConnectorKeys: fallback a documents', () => {
  const keys = suggestedConnectorKeys('4.4.4.4');
  assert.ok(keys.length >= 1);
  assert.ok(keys.includes('documents'));
});

// ── normalize / truncate ────────────────────────────────────

const baseEval = {
  verdict: 'EVIDENCE_SUPPORTS',
  explanation: 'La política de calidad está documentada y vigente en el período.',
  evidence: [{ ref: 'E1', assessment: 'SUPPORTS', aspect: 'política', note: 'vigente' }],
  gaps: [],
  limitations: [],
  externalChecks: [],
  proposals: [],
  auditQuestions: [],
};

test('normalize: verdict alias SUPPORTS → EVIDENCE_SUPPORTS y nulls → []', () => {
  const raw = { ...baseEval, verdict: 'supports', limitations: null, gaps: null, auditQuestions: 'una pregunta' };
  const r = EvaluationOutputSchema.safeParse(normalizeEvaluationJson(raw));
  assert.equal(r.success, true);
  if (r.success) {
    assert.equal(r.data.verdict, 'EVIDENCE_SUPPORTS');
    assert.deepEqual(r.data.auditQuestions, ['una pregunta']);
  }
});

test('truncate: strings y arrays largos no rompen el schema', () => {
  const raw = {
    ...baseEval,
    explanation: 'x'.repeat(5000),
    proposals: Array(9).fill({ action: 'y'.repeat(900), target: 'ACTION_PLAN' }),
  };
  const r = EvaluationOutputSchema.safeParse(truncateEvaluationJson(normalizeEvaluationJson(raw)));
  assert.equal(r.success, true);
});

// ── AuditorLLM.evaluate con provider stub ───────────────────

function stub(responses: Array<string | Error>): LLMProvider & { calls: number } {
  const p = {
    calls: 0,
    async chat() {
      const r = responses[Math.min(p.calls, responses.length - 1)];
      p.calls++;
      if (r instanceof Error) throw r;
      return { text: r, tokensUsed: 10, model: 'stub' };
    },
  };
  return p;
}

const evItem: EvidenceItem = {
  entityType: 'Document',
  entityId: 'd1',
  title: 'Política de calidad',
  summary: 'Documento vigente',
  inPeriod: true,
  hash: 'h',
} as EvidenceItem;

const req = {
  id: 'r1',
  clauseNumber: '5.2',
  statement: 'La alta dirección debe establecer la política de calidad',
  verificationTypes: ['DOCUMENT'],
  connectorKeys: ['documents'],
  requiresDocumentedInfo: true,
};

test('evaluate: acepta verdict alias del modelo', async () => {
  const p = stub([JSON.stringify({ ...baseEval, verdict: 'SUPPORTS' })]);
  const r = await AuditorLLM.fromProvider(p, { backoffMs: [0, 0] }).evaluate({ requirement: req, evidence: [evItem] });
  assert.equal(r.ok, true);
  assert.equal(r.output?.verdict, 'EVIDENCE_SUPPORTS');
});

test('evaluate: refs inválidos persistentes se descartan en vez de fallar', async () => {
  const bad = JSON.stringify({
    ...baseEval,
    evidence: [...baseEval.evidence, { ref: 'E9', assessment: 'SUPPORTS', aspect: 'a', note: 'n' }],
  });
  const p = stub([bad, bad]);
  const r = await AuditorLLM.fromProvider(p, { backoffMs: [0, 0] }).evaluate({ requirement: req, evidence: [evItem] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.output?.evidence.map((e) => e.ref), ['E1']);
});

test('evaluate: 429 se reintenta y luego responde', async () => {
  const p = stub([new Error('429 Rate limit reached. Please try again in 0.01s'), JSON.stringify(baseEval)]);
  const r = await AuditorLLM.fromProvider(p, { backoffMs: [0, 0] }).evaluate({ requirement: req, evidence: [evItem] });
  assert.equal(r.ok, true);
  assert.equal(p.calls, 2);
});

test('evaluate: 429 persistente → transient (reintentable), no dictamen', async () => {
  const p = stub([new Error('429 Rate limit reached')]);
  const r = await AuditorLLM.fromProvider(p, { backoffMs: [0, 0] }).evaluate({ requirement: req, evidence: [evItem] });
  assert.equal(r.ok, false);
  assert.equal(r.transient, true);
});
