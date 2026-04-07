'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface Survey {
  id: string;
  title: string;
  description: string | null;
  type: string;
  questions: SurveyQuestion[];
}

interface SurveyQuestion {
  id: string;
  text: string;
  description: string | null;
  type: string;
  isRequired: boolean;
  minValue: number | null;
  maxValue: number | null;
  options: SurveyOption[];
}

interface SurveyOption {
  id: string;
  value: string;
  label: string;
}

interface CustomerSurvey {
  id: string;
  token: string;
  status: string;
  customer: {
    name: string;
    email: string;
  };
  survey: Survey;
}

export default function SurveyResponsePage() {
  const params = useParams();
  const token = params.token as string;
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [customerSurvey, setCustomerSurvey] = useState<CustomerSurvey | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadSurvey();
  }, [token]);

  const loadSurvey = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<CustomerSurvey>(`/survey/${token}`);
      if (res) {
        setCustomerSurvey(res);
      }
    } catch (err) {
      setError('Encuesta no encontrada o ya completada');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      
      // Validate required questions
      const requiredQuestions = customerSurvey?.survey.questions.filter(q => q.isRequired) || [];
      for (const q of requiredQuestions) {
        if (!answers[q.id]) {
          setError(`Por favor responde: ${q.text}`);
          setSubmitting(false);
          return;
        }
      }

      await apiFetch(`/survey/${token}/respond`, {
        method: 'POST',
        json: {
          answers,
          isComplete: true,
        },
      });

      setSuccess(true);
    } catch (err) {
      setError('Error al enviar la encuesta');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando encuesta...</p>
        </div>
      </div>
    );
  }

  if (error && !customerSurvey) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <div className="text-green-500 text-5xl mb-4">✓</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">¡Gracias!</h2>
          <p className="text-gray-600">Tu respuesta ha sido guardada correctamente.</p>
        </div>
      </div>
    );
  }

  if (!customerSurvey) return null;

  const { survey } = customerSurvey;

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{survey.title}</h1>
          {survey.description && (
            <p className="text-gray-600">{survey.description}</p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {survey.questions.map((question, index) => (
            <div key={question.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start gap-2 mb-4">
                <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">
                    {question.text}
                    {question.isRequired && <span className="text-red-500 ml-1">*</span>}
                  </h3>
                  {question.description && (
                    <p className="text-sm text-gray-500 mt-1">{question.description}</p>
                  )}
                </div>
              </div>

              {question.type === 'TEXT' && (
                <textarea
                  value={answers[question.id] || ''}
                  onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  placeholder="Escribe tu respuesta..."
                />
              )}

              {question.type === 'RATING' && (
                <div className="flex gap-2">
                  {Array.from({ length: (question.maxValue || 5) - (question.minValue || 1) + 1 }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setAnswers({ ...answers, [question.id]: (question.minValue || 1) + i })}
                      className={`w-12 h-12 rounded-lg font-medium transition-colors ${
                        answers[question.id] === (question.minValue || 1) + i
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {(question.minValue || 1) + i}
                    </button>
                  ))}
                </div>
              )}

              {question.type === 'SINGLE_CHOICE' && question.options && (
                <div className="space-y-2">
                  {question.options.map((option) => (
                    <label key={option.id} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name={question.id}
                        value={option.id}
                        checked={answers[question.id] === option.id}
                        onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              )}

              {question.type === 'YES_NO' && (
                <div className="flex gap-4">
                  <button
                    onClick={() => setAnswers({ ...answers, [question.id]: 'YES' })}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                      answers[question.id] === 'YES'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Sí
                  </button>
                  <button
                    onClick={() => setAnswers({ ...answers, [question.id]: 'NO' })}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                      answers[question.id] === 'NO'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    No
                  </button>
                </div>
              )}

              {question.type === 'NPS' && (
                <div className="flex gap-1 flex-wrap">
                  {Array.from({ length: 11 }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setAnswers({ ...answers, [question.id]: i })}
                      className={`w-10 h-10 rounded font-medium transition-colors ${
                        answers[question.id] === i
                          ? 'bg-blue-600 text-white'
                          : i <= 6
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : i <= 8
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Enviando...' : 'Enviar Encuesta'}
          </button>
        </div>
      </div>
    </div>
  );
}
