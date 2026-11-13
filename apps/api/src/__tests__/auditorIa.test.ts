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
} from '../services/auditor-ia/schemas.js';
import { suggestedConnectorKeys } from '../services/auditor-ia/connectors/seed-iso9001.js';

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
