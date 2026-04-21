'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Inbox, User, Mail, Calendar } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Survey {
  id: string;
  code: string;
  title: string;
  description?: string;
  questions: Array<{
    id: string;
    order: number;
    text: string;
    type: string;
  }>;
}

interface Answer {
  id: string;
  questionId: string;
  valueText?: string | null;
  valueNumber?: number | null;
  valueOptionId?: string | null;
}

interface SurveyResponse {
  id: string;
  createdAt: string;
  customer?: { id: string; name: string; email?: string | null } | null;
  answers: Answer[];
}

export default function SurveyResponsesPage() {
  const router = useRouter();
  const params = useParams();
  const surveyId = params.id as string;

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [surveyRes, responsesRes] = await Promise.all([
          apiFetch<{ survey: Survey }>(`/surveys/${surveyId}`),
          apiFetch<{ responses: SurveyResponse[] }>(`/surveys/${surveyId}/responses`),
        ]);
        if (cancelled) return;
        setSurvey(surveyRes?.survey ?? null);
        setResponses(responsesRes?.responses ?? []);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Error al cargar las respuestas');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [surveyId]);

  const questionById = new Map((survey?.questions || []).map((q) => [q.id, q]));

  const renderAnswerValue = (a: Answer) => {
    if (a.valueText) return a.valueText;
    if (a.valueNumber !== null && a.valueNumber !== undefined) return String(a.valueNumber);
    if (a.valueOptionId) return `Opción: ${a.valueOptionId}`;
    return '—';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
          <Link
            href={`/clientes/encuestas/${surveyId}`}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a la encuesta
          </Link>
          <div className="ml-4">
            <h1 className="text-xl font-semibold text-gray-900">
              Respuestas{survey?.title ? ` · ${survey.title}` : ''}
            </h1>
            <p className="text-sm text-gray-500">
              {loading ? 'Cargando…' : `${responses.length} respuesta(s)`}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && responses.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <Inbox className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">Sin respuestas todavía</h3>
            <p className="text-sm text-gray-500 mt-1">
              Cuando los clientes completen la encuesta, sus respuestas aparecerán acá.
            </p>
            <button
              onClick={() => router.push(`/clientes/encuestas/${surveyId}`)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Volver a la encuesta
            </button>
          </div>
        )}

        <div className="space-y-4">
          {responses.map((r) => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {r.customer?.name || 'Anónimo'}
                    </div>
                    {r.customer?.email && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {r.customer.email}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(r.createdAt).toLocaleString()}
                </div>
              </div>

              <div className="space-y-3">
                {r.answers
                  .slice()
                  .sort((a, b) => {
                    const qa = questionById.get(a.questionId);
                    const qb = questionById.get(b.questionId);
                    return (qa?.order ?? 0) - (qb?.order ?? 0);
                  })
                  .map((a) => {
                    const q = questionById.get(a.questionId);
                    return (
                      <div key={a.id} className="border border-gray-100 rounded-lg p-3">
                        <div className="text-sm font-medium text-gray-800">
                          {q?.text || 'Pregunta'}
                        </div>
                        <div className="mt-1 text-sm text-gray-700">
                          {renderAnswerValue(a)}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
