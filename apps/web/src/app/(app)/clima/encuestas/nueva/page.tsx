'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, ChevronDown, Wand2, Save, ClipboardList } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const CATEGORIES = [
  { value: 'CLIMA_LABORAL', label: 'Clima Laboral' },
  { value: 'SATISFACCION', label: 'Satisfacción del Empleado' },
  { value: 'LIDERAZGO', label: 'Percepción de Liderazgo' },
  { value: 'BIENESTAR', label: 'Bienestar y Salud Laboral' },
  { value: 'BURNOUT', label: 'Riesgo de Burnout' },
  { value: 'ONBOARDING', label: 'Onboarding' },
  { value: 'RIESGOS_PSICOSOCIALES', label: 'Riesgos Psicosociales' },
  { value: 'COMUNICACION_INTERNA', label: 'Comunicación Interna' },
  { value: 'CULTURA_SEGURIDAD', label: 'Cultura de Seguridad' },
  { value: 'PERSONALIZADA', label: 'Personalizada' },
];

const QUESTION_TYPES = [
  { value: 'RATING_5', label: 'Escala 1-5' },
  { value: 'RATING_10', label: 'Escala 1-10' },
  { value: 'STARS', label: 'Estrellas (1-5)' },
  { value: 'YES_NO', label: 'Sí / No' },
  { value: 'SINGLE_CHOICE', label: 'Opción única' },
  { value: 'MULTIPLE_CHOICE', label: 'Opción múltiple' },
  { value: 'TEXT', label: 'Respuesta abierta' },
  { value: 'EMOJI', label: 'Emojis (1-5)' },
];

const PERIODICIDAD = [
  { value: 'UNICA', label: 'Única vez' },
  { value: 'MENSUAL', label: 'Mensual' },
  { value: 'TRIMESTRAL', label: 'Trimestral' },
  { value: 'SEMESTRAL', label: 'Semestral' },
  { value: 'ANUAL', label: 'Anual' },
];

interface Question {
  text: string;
  type: string;
  isRequired: boolean;
  options: { value: string; label: string }[];
}

export default function NuevaEncuestaPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'CLIMA_LABORAL',
    isAnonymous: true,
    periodicidad: 'UNICA',
    estimatedMinutes: 5,
    startDate: '',
    endDate: '',
  });

  const [questions, setQuestions] = useState<Question[]>([
    { text: '', type: 'RATING_5', isRequired: true, options: [] }
  ]);

  useEffect(() => {
    apiFetch('/clima/plantillas').then((d: any) => setTemplates(d.templates || [])).catch(() => {});
  }, []);

  function addQuestion() {
    setQuestions(prev => [...prev, { text: '', type: 'RATING_5', isRequired: true, options: [] }]);
  }

  function removeQuestion(idx: number) {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  }

  function updateQuestion(idx: number, field: keyof Question, value: any) {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  }

  function addOption(qIdx: number) {
    setQuestions(prev => prev.map((q, i) => i === qIdx
      ? { ...q, options: [...q.options, { value: String(q.options.length + 1), label: '' }] }
      : q
    ));
  }

  function updateOption(qIdx: number, oIdx: number, label: string) {
    setQuestions(prev => prev.map((q, i) => i === qIdx
      ? { ...q, options: q.options.map((o, j) => j === oIdx ? { ...o, label, value: String(j + 1) } : o) }
      : q
    ));
  }

  function removeOption(qIdx: number, oIdx: number) {
    setQuestions(prev => prev.map((q, i) => i === qIdx
      ? { ...q, options: q.options.filter((_, j) => j !== oIdx) }
      : q
    ));
  }

  async function applyTemplate(key: string) {
    try {
      const tpl = templates.find(tp => tp.key === key);
      const title = form.title.trim() || tpl?.title || 'Nueva encuesta';
      const surveyData = await apiFetch('/clima/encuestas', {
        method: 'POST',
        json: { title, description: tpl?.description || '', category: key, isAnonymous: form.isAnonymous, periodicidad: form.periodicidad, estimatedMinutes: form.estimatedMinutes, useTemplate: key },
      }) as any;
      if (surveyData.survey?.id) {
        router.push(`/clima/encuestas/${surveyData.survey.id}`);
      }
    } catch (e) {
      alert('Error aplicando plantilla');
    }
    setShowTemplates(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return alert('El título es requerido');
    if (questions.some(q => !q.text.trim())) return alert('Todas las preguntas deben tener texto');

    setSaving(true);
    try {
      const data = await apiFetch('/clima/encuestas', {
        method: 'POST',
        json: { ...form, questions },
      }) as any;
      router.push(`/clima/encuestas/${data.survey.id}`);
    } catch (e) {
      alert('Error al crear la encuesta');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nueva Encuesta de Clima</h1>
          <p className="text-sm text-gray-500">Completá los datos y agregá las preguntas</p>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 border border-teal-200 hover:border-teal-400 px-3 py-2 rounded-xl transition-colors"
          >
            <Wand2 className="w-4 h-4" />
            Usar plantilla
          </button>
        </div>
      </div>

      {/* Templates dropdown */}
      {showTemplates && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Plantillas disponibles</p>
          {templates.map(t => (
            <button
              key={t.key}
              onClick={() => applyTemplate(t.key)}
              className="w-full text-left flex items-center gap-3 p-3 hover:bg-teal-50 rounded-xl transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                <ClipboardList className="w-4 h-4 text-teal-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800 group-hover:text-teal-700">{t.title}</p>
                <p className="text-xs text-gray-500">{t.questionsCount} preguntas · {t.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos básicos */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Datos de la encuesta</h2>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Título *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="ej: Encuesta de Clima Q1 2025"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Descripción</label>
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={2}
              placeholder="Descripción opcional..."
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Categoría</label>
              <select
                value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 bg-white transition-all"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Periodicidad</label>
              <select
                value={form.periodicidad}
                onChange={e => setForm(p => ({ ...p, periodicidad: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 bg-white transition-all"
              >
                {PERIODICIDAD.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Tiempo estimado (min)</label>
              <input
                type="number"
                min={1}
                max={60}
                value={form.estimatedMinutes}
                onChange={e => setForm(p => ({ ...p, estimatedMinutes: Number(e.target.value) }))}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Inicio</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Vencimiento</label>
              <input
                type="date"
                value={form.endDate}
                onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setForm(p => ({ ...p, isAnonymous: !p.isAnonymous }))}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.isAnonymous ? 'bg-teal-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isAnonymous ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
            <span className="text-sm text-gray-700">Encuesta anónima</span>
          </label>
        </div>

        {/* Preguntas */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Preguntas ({questions.length})</h2>
            <button type="button" onClick={addQuestion} className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-800 font-medium">
              <Plus className="w-3.5 h-3.5" />Agregar pregunta
            </button>
          </div>

          {questions.map((q, idx) => (
            <div key={idx} className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="mt-2.5 text-xs font-bold text-gray-400 w-5 text-center">{idx + 1}</span>
                <div className="flex-1 space-y-3">
                  <input
                    type="text"
                    value={q.text}
                    onChange={e => updateQuestion(idx, 'text', e.target.value)}
                    placeholder="Texto de la pregunta..."
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all"
                  />
                  <div className="flex items-center gap-3">
                    <select
                      value={q.type}
                      onChange={e => updateQuestion(idx, 'type', e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none bg-white focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all"
                    >
                      {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={q.isRequired}
                        onChange={e => updateQuestion(idx, 'isRequired', e.target.checked)}
                        className="rounded text-teal-500"
                      />
                      Requerida
                    </label>
                  </div>

                  {/* Options for choice types */}
                  {(q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') && (
                    <div className="space-y-2 pl-1">
                      {q.options.map((o, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-5">{oIdx + 1}.</span>
                          <input
                            type="text"
                            value={o.label}
                            onChange={e => updateOption(idx, oIdx, e.target.value)}
                            placeholder={`Opción ${oIdx + 1}`}
                            className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all"
                          />
                          <button type="button" onClick={() => removeOption(idx, oIdx)} className="text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => addOption(idx)} className="text-xs text-teal-600 hover:text-teal-800 font-medium">
                        + Agregar opción
                      </button>
                    </div>
                  )}
                </div>
                {questions.length > 1 && (
                  <button type="button" onClick={() => removeQuestion(idx)} className="mt-2 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Submit */}
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => router.back()} className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2.5 rounded-xl shadow transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Crear encuesta'}
          </button>
        </div>
      </form>
    </div>
  );
}
