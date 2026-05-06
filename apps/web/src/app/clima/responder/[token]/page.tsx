'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Wind, CheckCircle, AlertCircle, ChevronRight, Loader2, Star } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function publicFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

interface Survey {
  id: string;
  title: string;
  description?: string;
  category: string;
  isAnonymous: boolean;
  estimatedMinutes: number;
  endDate?: string;
  questions: Question[];
}

interface Question {
  id: string;
  text: string;
  description?: string;
  type: string;
  isRequired: boolean;
  minValue?: number;
  maxValue?: number;
  options?: { id: string; value: string; label: string }[];
}

type Answers = Record<string, any>;

function RatingScale({ questionId, max, answers, setAnswers }: { questionId: string; max: number; answers: Answers; setAnswers: (a: Answers) => void }) {
  const current = answers[questionId];
  return (
    <div className="flex gap-2 flex-wrap">
      {Array.from({ length: max }, (_, i) => i + 1).map(v => (
        <button
          key={v}
          type="button"
          onClick={() => setAnswers({ ...answers, [questionId]: v })}
          className={`w-10 h-10 rounded-xl font-bold text-sm transition-all border ${current === v ? 'bg-teal-600 text-white border-teal-600 shadow-md scale-105' : 'bg-white text-gray-700 border-gray-200 hover:border-teal-400 hover:bg-teal-50'}`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function EmojiScale({ questionId, answers, setAnswers }: { questionId: string; answers: Answers; setAnswers: (a: Answers) => void }) {
  const emojis = ['😢', '😕', '😐', '🙂', '😄'];
  const current = answers[questionId];
  return (
    <div className="flex gap-3">
      {emojis.map((e, i) => (
        <button
          key={i}
          type="button"
          onClick={() => setAnswers({ ...answers, [questionId]: i + 1 })}
          className={`text-3xl p-2 rounded-xl transition-all ${current === i + 1 ? 'scale-125 bg-teal-50 ring-2 ring-teal-400' : 'opacity-60 hover:opacity-100 hover:scale-110'}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

function StarScale({ questionId, answers, setAnswers }: { questionId: string; answers: Answers; setAnswers: (a: Answers) => void }) {
  const current = answers[questionId] || 0;
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(v => (
        <button
          key={v}
          type="button"
          onClick={() => setAnswers({ ...answers, [questionId]: v })}
          className="transition-transform hover:scale-110"
        >
          <Star className={`w-8 h-8 ${v <= current ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
        </button>
      ))}
    </div>
  );
}

export default function ResponderEncuestaPage() {
  const { token } = useParams() as { token: string };
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Answers>({});
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [recipientName, setRecipientName] = useState<string | null>(null);

  useEffect(() => {
    publicFetch(`/clima/responder/${token}`)
      .then(data => {
        setSurvey(data.survey);
        setRecipientName(data.recipientName);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit() {
    if (!survey) return;
    const required = survey.questions.filter(q => q.isRequired);
    const missing = required.filter(q => answers[q.id] === undefined || answers[q.id] === '');
    if (missing.length > 0) {
      alert(`Falta responder ${missing.length} pregunta(s) requerida(s)`);
      const firstMissing = survey.questions.findIndex(q => q.id === missing[0].id);
      setCurrentStep(firstMissing);
      return;
    }

    setSubmitting(true);
    try {
      await publicFetch(`/clima/responder/${token}`, {
        method: 'POST',
        body: JSON.stringify({ answers, comments }),
      });
      setSubmitted(true);
    } catch (e: any) {
      alert(e.message || 'Error al enviar respuesta');
    } finally {
      setSubmitting(false);
    }
  }

  function renderQuestion(q: Question) {
    const value = answers[q.id];

    switch (q.type) {
      case 'RATING_5':
        return <RatingScale questionId={q.id} max={5} answers={answers} setAnswers={setAnswers} />;
      case 'RATING_10':
        return <RatingScale questionId={q.id} max={10} answers={answers} setAnswers={setAnswers} />;
      case 'STARS':
        return <StarScale questionId={q.id} answers={answers} setAnswers={setAnswers} />;
      case 'EMOJI':
        return <EmojiScale questionId={q.id} answers={answers} setAnswers={setAnswers} />;
      case 'YES_NO':
        return (
          <div className="flex gap-3">
            {[{ v: 'SI', label: 'Sí' }, { v: 'NO', label: 'No' }].map(({ v, label }) => (
              <button key={v} type="button" onClick={() => setAnswers({ ...answers, [q.id]: v })}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all border ${value === v ? 'bg-teal-600 text-white border-teal-600 shadow-md' : 'bg-white text-gray-700 border-gray-200 hover:border-teal-400 hover:bg-teal-50'}`}>
                {label}
              </button>
            ))}
          </div>
        );
      case 'SINGLE_CHOICE':
        return (
          <div className="space-y-2">
            {q.options?.map(o => (
              <button key={o.id} type="button" onClick={() => setAnswers({ ...answers, [q.id]: o.value })}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${value === o.value ? 'bg-teal-50 border-teal-400 text-teal-800 font-medium' : 'bg-white border-gray-200 text-gray-700 hover:border-teal-300 hover:bg-teal-50/50'}`}>
                {o.label}
              </button>
            ))}
          </div>
        );
      case 'MULTIPLE_CHOICE':
        return (
          <div className="space-y-2">
            {q.options?.map(o => {
              const selected: string[] = value || [];
              const isSelected = selected.includes(o.value);
              return (
                <button key={o.id} type="button" onClick={() => {
                  const next = isSelected ? selected.filter(v => v !== o.value) : [...selected, o.value];
                  setAnswers({ ...answers, [q.id]: next });
                }}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${isSelected ? 'bg-teal-50 border-teal-400 text-teal-800 font-medium' : 'bg-white border-gray-200 text-gray-700 hover:border-teal-300 hover:bg-teal-50/50'}`}>
                  {o.label}
                </button>
              );
            })}
          </div>
        );
      case 'TEXT':
        return (
          <textarea value={value || ''} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
            rows={4} placeholder="Escribí tu respuesta..."
            className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 resize-none transition-all" />
        );
      default:
        return <input type="text" value={value || ''} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
          className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />;
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 text-teal-500 animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Cargando encuesta...</p>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <AlertCircle className="w-14 h-14 text-red-400 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">Encuesta no disponible</h2>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  // ── Submitted ────────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">¡Gracias por tu respuesta!</h2>
          <p className="text-sm text-gray-500">Tu opinión es valiosa para mejorar el ambiente de trabajo.</p>
          {survey?.isAnonymous && (
            <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-2">Tus respuestas son completamente anónimas</p>
          )}
        </div>
      </div>
    );
  }

  if (!survey) return null;

  const questions = survey.questions;
  const totalSteps = questions.length;
  const progress = totalSteps > 0 ? Math.round(((currentStep + 1) / totalSteps) * 100) : 0;
  const isLast = currentStep === totalSteps - 1;
  const currentQ = questions[currentStep];
  const hasAnswer = answers[currentQ?.id] !== undefined && answers[currentQ?.id] !== '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
              <Wind className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{survey.title}</p>
              <p className="text-xs text-gray-500">{survey.isAnonymous ? 'Encuesta anónima' : `Hola, ${recipientName}`} · ~{survey.estimatedMinutes} min</p>
            </div>
            <span className="text-xs text-gray-500 font-medium">{currentStep + 1}/{totalSteps}</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-teal-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="max-w-xl mx-auto px-6 py-8">
        {currentQ && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{currentStep + 1}</span>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 leading-snug">{currentQ.text}</h2>
                  {currentQ.description && <p className="text-sm text-gray-500 mt-1">{currentQ.description}</p>}
                  {currentQ.isRequired && <span className="text-xs text-red-500 mt-1 block">* Requerida</span>}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              {renderQuestion(currentQ)}
            </div>

            {/* Navigation */}
            <div className="flex gap-3">
              {currentStep > 0 && (
                <button onClick={() => setCurrentStep(s => s - 1)}
                  className="flex-1 text-sm text-gray-600 border border-gray-200 py-3 rounded-xl hover:bg-gray-50 transition-colors">
                  Anterior
                </button>
              )}
              {!isLast ? (
                <button
                  onClick={() => {
                    if (currentQ.isRequired && !hasAnswer) {
                      alert('Esta pregunta es requerida');
                      return;
                    }
                    setCurrentStep(s => s + 1);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium py-3 rounded-xl shadow transition-colors"
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="flex-1 space-y-3">
                  <textarea value={comments} onChange={e => setComments(e.target.value)}
                    rows={2} placeholder="Comentarios adicionales (opcional)..."
                    className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-500/30 resize-none" />
                  <button onClick={handleSubmit} disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium py-3 rounded-xl shadow transition-colors">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    {submitting ? 'Enviando...' : 'Enviar respuestas'}
                  </button>
                </div>
              )}
            </div>

            {/* Dot navigation */}
            <div className="flex justify-center gap-1.5">
              {questions.map((_, idx) => (
                <button key={idx} onClick={() => setCurrentStep(idx)}
                  className={`rounded-full transition-all ${idx === currentStep ? 'w-5 h-2 bg-teal-500' : answers[questions[idx].id] !== undefined ? 'w-2 h-2 bg-teal-300' : 'w-2 h-2 bg-gray-200 hover:bg-gray-300'}`} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
