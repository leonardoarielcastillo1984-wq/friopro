'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Trash2, GripVertical, Save, X, Eye,
  CheckCircle2, AlertCircle, Settings, Send, Copy, Star
} from 'lucide-react';

interface Survey {
  id: string;
  code: string;
  title: string;
  description?: string;
  type: string;
  isActive: boolean;
  isAnonymous: boolean;
  allowMultipleResponses: boolean;
  sendEmail: boolean;
  emailSubject?: string;
  emailBody?: string;
  questions: Question[];
  _count?: { responses: number };
}

interface Question {
  id: string;
  order: number;
  text: string;
  description?: string;
  type: 'RATING' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TEXT' | 'NPS' | 'YES_NO' | 'SCALE';
  isRequired: boolean;
  minValue?: number;
  maxValue?: number;
  scaleLabels?: { min: string; max: string };
  options: Option[];
}

interface Option {
  id: string;
  order: number;
  value: string;
  label: string;
}

const QUESTION_TYPES = [
  { value: 'RATING', label: 'Calificación (Estrellas)', icon: '⭐' },
  { value: 'NPS', label: 'NPS (0-10)', icon: '📊' },
  { value: 'SINGLE_CHOICE', label: 'Opción única', icon: '🔘' },
  { value: 'MULTIPLE_CHOICE', label: 'Opción múltiple', icon: '☑️' },
  { value: 'YES_NO', label: 'Sí / No', icon: '✓' },
  { value: 'SCALE', label: 'Escala numérica', icon: ' ruler' },
  { value: 'TEXT', label: 'Texto libre', icon: '📝' },
];

export default function SurveyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const surveyId = params.id as string;

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadSurvey();
  }, [surveyId]);

  const loadSurvey = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ survey: Survey }>(`/surveys/${surveyId}`);
      if (res?.survey) {
        setSurvey(res.survey);
      }
    } catch (err) {
      console.error('Error loading survey:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestion = async (type: string) => {
    const newQuestion = {
      text: type === 'NPS' ? '¿Qué tan probable es que recomiendes nuestra empresa a un amigo o colega?' :
            type === 'RATING' ? '¿Cómo calificarías nuestro servicio?' :
            'Nueva pregunta',
      type,
      isRequired: true,
      order: survey?.questions.length || 0,
      ...(type === 'RATING' && { minValue: 1, maxValue: 5 }),
      ...(type === 'SCALE' && { minValue: 1, maxValue: 10 }),
      ...(type === 'NPS' && { minValue: 0, maxValue: 10 }),
    };

    try {
      await apiFetch(`/surveys/${surveyId}/questions`, {
        method: 'POST',
        json: newQuestion,
      });
      await loadSurvey();
    } catch (err) {
      console.error('Error adding question:', err);
    }
  };

  const handleUpdateQuestion = async (questionId: string, updates: Partial<Question>) => {
    try {
      await apiFetch(`/surveys/${surveyId}/questions/${questionId}`, {
        method: 'PATCH',
        json: updates,
      });
      await loadSurvey();
      setEditingQuestion(null);
    } catch (err) {
      console.error('Error updating question:', err);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta pregunta?')) return;
    try {
      await apiFetch(`/surveys/${surveyId}/questions/${questionId}`, {
        method: 'DELETE',
      });
      await loadSurvey();
    } catch (err) {
      console.error('Error deleting question:', err);
    }
  };

  const handleToggleActive = async () => {
    try {
      await apiFetch(`/surveys/${surveyId}`, {
        method: 'PATCH',
        json: { isActive: !survey?.isActive },
      });
      await loadSurvey();
    } catch (err) {
      console.error('Error toggling survey:', err);
    }
  };

  const handleDuplicateQuestion = async (question: Question) => {
    const { id, options, ...rest } = question;
    try {
      await apiFetch(`/surveys/${surveyId}/questions`, {
        method: 'POST',
        json: {
          ...rest,
          text: `${rest.text} (copia)`,
          order: survey?.questions.length || 0,
        },
      });
      await loadSurvey();
    } catch (err) {
      console.error('Error duplicating question:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-600">Encuesta no encontrada</p>
          <Link
            href="/clientes"
            className="inline-flex items-center gap-2 mt-4 text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/clientes"
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{survey.title}</h1>
            <p className="text-gray-600">{survey.code} • {survey.questions.length} preguntas</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowPreview(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <Eye className="w-4 h-4" />
            Vista previa
          </button>
          <button
            onClick={handleToggleActive}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              survey.isActive
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-600 text-white hover:bg-gray-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {survey.isActive ? 'Activa' : 'Inactiva'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Questions Builder */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Preguntas</h2>
              <span className="text-sm text-gray-500">
                {survey.questions.length} preguntas
              </span>
            </div>

            {survey.questions.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                <p className="text-gray-600 mb-4">No hay preguntas aún</p>
                <p className="text-sm text-gray-500">Agrega tu primera pregunta desde el panel derecho</p>
              </div>
            ) : (
              <div className="space-y-4">
                {survey.questions.map((question, index) => (
                  <div
                    key={question.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    {editingQuestion === question.id ? (
                      <QuestionEditor
                        question={question}
                        onSave={(updates) => handleUpdateQuestion(question.id, updates)}
                        onCancel={() => setEditingQuestion(null)}
                      />
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className="pt-1">
                          <GripVertical className="w-5 h-5 text-gray-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-xs text-gray-500">Pregunta {index + 1}</span>
                              <h3 className="font-medium text-gray-900">{question.text}</h3>
                              {question.description && (
                                <p className="text-sm text-gray-500">{question.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                question.isRequired
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {question.isRequired ? 'Obligatoria' : 'Opcional'}
                              </span>
                            </div>
                          </div>

                          {/* Question Preview */}
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <QuestionPreview question={question} />
                          </div>

                          {/* Options if applicable */}
                          {question.options.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {question.options.map((opt) => (
                                <span
                                  key={opt.id}
                                  className="text-xs px-2 py-1 bg-white border border-gray-200 rounded"
                                >
                                  {opt.label}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-3">
                            <button
                              onClick={() => setEditingQuestion(question.id)}
                              className="text-sm text-blue-600 hover:text-blue-700"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDuplicateQuestion(question)}
                              className="text-sm text-gray-600 hover:text-gray-900"
                            >
                              Duplicar
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(question.id)}
                              className="text-sm text-red-600 hover:text-red-700"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Add Questions */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Agregar Pregunta</h2>
            <div className="space-y-2">
              {QUESTION_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => handleAddQuestion(type.value)}
                  className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="text-lg">{type.icon}</span>
                  <span className="text-gray-900">{type.label}</span>
                  <Plus className="w-4 h-4 ml-auto text-gray-400" />
                </button>
              ))}
            </div>
          </div>

          {/* Survey Settings */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuración</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Encuesta anónima</span>
                <button
                  onClick={async () => {
                    await apiFetch(`/surveys/${surveyId}`, {
                      method: 'PATCH',
                      json: { isAnonymous: !survey.isAnonymous },
                    });
                    await loadSurvey();
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    survey.isAnonymous ? 'bg-purple-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      survey.isAnonymous ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Múltiples respuestas</span>
                <button
                  onClick={async () => {
                    await apiFetch(`/surveys/${surveyId}`, {
                      method: 'PATCH',
                      json: { allowMultipleResponses: !survey.allowMultipleResponses },
                    });
                    await loadSurvey();
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    survey.allowMultipleResponses ? 'bg-purple-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      survey.allowMultipleResponses ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Responses Stats */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Estadísticas</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Respuestas</span>
                <span className="font-semibold text-gray-900">{survey._count?.responses || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Tasa de respuesta</span>
                <span className="font-semibold text-gray-900">--%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">NPS Promedio</span>
                <span className="font-semibold text-gray-900">--</span>
              </div>
            </div>
            <button
              onClick={() => router.push(`/clientes/encuestas/${surveyId}/respuestas`)}
              className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Ver respuestas
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Vista previa de encuesta</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900">{survey.title}</h1>
                {survey.description && (
                  <p className="text-gray-600 mt-2">{survey.description}</p>
                )}
              </div>
              {survey.questions.map((question, index) => (
                <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                  <p className="font-medium text-gray-900">
                    {index + 1}. {question.text}
                    {question.isRequired && <span className="text-red-500 ml-1">*</span>}
                  </p>
                  <div className="mt-3">
                    <QuestionPreview question={question} />
                  </div>
                </div>
              ))}
              <button className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium">
                Enviar respuestas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionEditor({
  question,
  onSave,
  onCancel,
}: {
  question: Question;
  onSave: (updates: Partial<Question>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    text: question.text,
    description: question.description || '',
    isRequired: question.isRequired,
    minValue: question.minValue,
    maxValue: question.maxValue,
    options: question.options,
  });

  const [newOption, setNewOption] = useState('');

  const handleAddOption = () => {
    if (!newOption.trim()) return;
    setForm({
      ...form,
      options: [
        ...form.options,
        { id: `temp-${Date.now()}`, order: form.options.length, value: newOption, label: newOption },
      ],
    });
    setNewOption('');
  };

  const handleRemoveOption = (index: number) => {
    setForm({
      ...form,
      options: form.options.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Pregunta</label>
        <input
          type="text"
          value={form.text}
          onChange={(e) => setForm({ ...form, text: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          placeholder="Agrega más contexto a la pregunta"
        />
      </div>

      {/* Options for choice questions */}
      {(question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Opciones</label>
          <div className="space-y-2">
            {form.options.map((opt, index) => (
              <div key={opt.id} className="flex items-center gap-2">
                <span className="text-gray-500">{index + 1}.</span>
                <span className="flex-1">{opt.label}</span>
                <button
                  onClick={() => handleRemoveOption(index)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddOption()}
              placeholder="Nueva opción"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            <button
              onClick={handleAddOption}
              className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Scale settings */}
      {(question.type === 'SCALE' || question.type === 'RATING' || question.type === 'NPS') && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor mínimo</label>
            <input
              type="number"
              value={form.minValue || 0}
              onChange={(e) => setForm({ ...form, minValue: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor máximo</label>
            <input
              type="number"
              value={form.maxValue || 5}
              onChange={(e) => setForm({ ...form, maxValue: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isRequired"
          checked={form.isRequired}
          onChange={(e) => setForm({ ...form, isRequired: e.target.checked })}
          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
        />
        <label htmlFor="isRequired" className="text-sm text-gray-700">
          Pregunta obligatoria
        </label>
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          Cancelar
        </button>
        <button
          onClick={() => onSave(form)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          <Save className="w-4 h-4 inline mr-2" />
          Guardar
        </button>
      </div>
    </div>
  );
}

function QuestionPreview({ question }: { question: Question }) {
  switch (question.type) {
    case 'RATING':
      return (
        <div className="flex gap-1">
          {Array.from({ length: question.maxValue || 5 }).map((_, i) => (
            <Star key={i} className="w-6 h-6 text-gray-300" />
          ))}
        </div>
      );
    case 'NPS':
      return (
        <div className="flex gap-1 flex-wrap">
          {Array.from({ length: (question.maxValue || 10) - (question.minValue || 0) + 1 }).map((_, i) => (
            <button
              key={i}
              className="w-8 h-8 text-xs border border-gray-300 rounded hover:bg-gray-100"
            >
              {(question.minValue || 0) + i}
            </button>
          ))}
        </div>
      );
    case 'YES_NO':
      return (
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input type="radio" name={`q-${question.id}`} className="w-4 h-4" />
            <span>Sí</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name={`q-${question.id}`} className="w-4 h-4" />
            <span>No</span>
          </label>
        </div>
      );
    case 'SINGLE_CHOICE':
      return (
        <div className="space-y-2">
          {question.options.map((opt) => (
            <label key={opt.id} className="flex items-center gap-2">
              <input type="radio" name={`q-${question.id}`} className="w-4 h-4" />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      );
    case 'MULTIPLE_CHOICE':
      return (
        <div className="space-y-2">
          {question.options.map((opt) => (
            <label key={opt.id} className="flex items-center gap-2">
              <input type="checkbox" className="w-4 h-4" />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      );
    case 'SCALE':
      return (
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{question.minValue || 1}</span>
          <input
            type="range"
            min={question.minValue || 1}
            max={question.maxValue || 10}
            className="flex-1"
          />
          <span className="text-sm text-gray-500">{question.maxValue || 10}</span>
        </div>
      );
    case 'TEXT':
    default:
      return (
        <textarea
          placeholder="Tu respuesta..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          rows={3}
        />
      );
  }
}
