'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { GraduationCap, CheckCircle2, XCircle, AlertCircle, Loader2, Send } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_BASE || '/api';

type Question = { id: string; question: string; options: string[] };
type QuizData = {
  training: { title: string; code: string };
  attendeeName: string | null;
  minScore: number;
  questions: Question[];
  alreadyCompleted: boolean;
  result: { score: number; passed: boolean; completedAt: string } | null;
};

export default function CapacitacionQuizPage() {
  const { token } = useParams() as { token: string };
  const [data, setData] = useState<QuizData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; passed: boolean; alreadyCompleted?: boolean } | null>(null);

  useEffect(() => {
    fetch(`${API}/trainings/public/quiz/${token}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'No se pudo cargar');
        setData(d);
        if (d.result) setResult(d.result);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async () => {
    if (!data) return;
    if (Object.keys(answers).length < data.questions.length) {
      setError(`Respondé las ${data.questions.length} preguntas (${Object.keys(answers).length}/${data.questions.length})`);
      return;
    }
    setSubmitting(true); setError('');
    try {
      const r = await fetch(`${API}/trainings/public/quiz/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: data.questions.map((_, i) => answers[i]) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo enviar');
      setResult(d);
      window.scrollTo(0, 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const S: Record<string, React.CSSProperties> = {
    page: { minHeight: '100vh', background: '#F3F4F6', padding: '16px 12px', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" },
    card: { background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', maxWidth: 560, margin: '0 auto' },
    muted: { color: '#6B7280', fontSize: 13 },
    btn: { border: 'none', color: '#fff', fontWeight: 600, fontSize: 15, padding: '13px 20px', borderRadius: 12, cursor: 'pointer', width: '100%' },
  };

  if (loading) return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={36} color="#2563EB" className="animate-spin" />
    </div>
  );

  if (error && !data) return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ ...S.card, textAlign: 'center' }}>
        <AlertCircle size={48} color="#DC2626" style={{ margin: '0 auto' }} />
        <h2 style={{ margin: '12px 0 4px' }}>Evaluación no disponible</h2>
        <p style={S.muted}>{error}</p>
      </div>
    </div>
  );

  if (!data) return null;

  // Resultado final (enviado ahora o ya completado antes)
  if (result) {
    const passed = result.passed;
    return (
      <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...S.card, textAlign: 'center' }}>
          {passed ? <CheckCircle2 size={56} color="#16A34A" style={{ margin: '0 auto' }} /> : <XCircle size={56} color="#DC2626" style={{ margin: '0 auto' }} />}
          <h2 style={{ margin: '14px 0 6px', color: '#111827' }}>{passed ? 'Evaluación aprobada' : 'Evaluación no aprobada'}</h2>
          <p style={{ fontSize: 32, fontWeight: 800, margin: '8px 0', color: passed ? '#16A34A' : '#DC2626' }}>{result.score}%</p>
          <p style={S.muted}>Mínimo requerido: {data.minScore}% — {data.training.title}</p>
          <p style={{ ...S.muted, fontSize: 11, marginTop: 16 }}>
            Resultado registrado como evidencia de competencia (IATF 16949 §7.2.2 / ISO 9001 §7.2) · SGI 360
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GraduationCap size={22} color="#D97706" />
          </div>
          <div>
            <p style={{ ...S.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Evaluación de aprendizaje</p>
            <h1 style={{ fontSize: 17, margin: 0, color: '#111827' }}>{data.training.title}</h1>
          </div>
        </div>
        {data.attendeeName && <p style={{ ...S.muted, marginBottom: 4 }}>Asignada a: <strong>{data.attendeeName}</strong></p>}
        <p style={{ ...S.muted, marginBottom: 16 }}>Aprobás con {data.minScore}% o más. Respondé todas las preguntas.</p>

        <div style={{ display: 'grid', gap: 14 }}>
          {data.questions.map((q, qi) => (
            <div key={q.id} style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: 14 }}>
              <p style={{ fontWeight: 600, fontSize: 14, color: '#111827', margin: '0 0 10px' }}>{qi + 1}. {q.question}</p>
              <div style={{ display: 'grid', gap: 8 }}>
                {q.options.map((opt, oi) => (
                  <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 10px', borderRadius: 8, border: answers[qi] === oi ? '2px solid #2563EB' : '1px solid #E5E7EB', background: answers[qi] === oi ? '#EFF6FF' : '#fff' }}>
                    <input type="radio" name={`q${qi}`} checked={answers[qi] === oi} onChange={() => setAnswers({ ...answers, [qi]: oi })} style={{ accentColor: '#2563EB' }} />
                    <span style={{ fontSize: 13, color: '#374151' }}>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {error && <p style={{ color: '#DC2626', fontSize: 13, marginTop: 12 }}>{error}</p>}

        <button onClick={submit} disabled={submitting} style={{ ...S.btn, background: '#D97706', marginTop: 16, opacity: submitting ? 0.7 : 1 }}>
          <Send size={15} style={{ marginRight: 8, verticalAlign: -2 }} />
          {submitting ? 'Enviando…' : `Enviar evaluación (${Object.keys(answers).length}/${data.questions.length})`}
        </button>

        <p style={{ ...S.muted, fontSize: 11, marginTop: 14, textAlign: 'center' }}>
          Tu resultado queda registrado como evidencia · SGI 360
        </p>
      </div>
    </div>
  );
}
