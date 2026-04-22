'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  ChevronLeft, 
  Save, 
  FileText, 
  Download, 
  FileBarChart,
  FileDown,
  Edit3,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Users,
  Target,
  Shield,
  Settings,
  Sparkles,
  X,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { useCompany } from '@/lib/company-context';
import { exportToWord as exportToWordUtil } from '@/lib/exportToWordSimple';
import './print-styles.css';

type ManagementReview = {
  id: string;
  title: string;
  summary: string | null;
  periodStart: string;
  periodEnd: string;
  standards: string[];
  status: 'DRAFT' | 'FINAL';
  generatedAt: string;
  createdAt: string;
  sections: ManagementReviewSection[];
};

type ManagementReviewSection = {
  id: string;
  key: string;
  title: string;
  systemData: any;
  freeText: string | null;
  outputs: string | null;
  decisions: any;
  createdAt: string;
  updatedAt: string;
};

const ISO_STANDARD_LABELS: Record<string, string> = {
  'ISO_9001': 'ISO 9001',
  'ISO_14001': 'ISO 14001',
  'ISO_45001': 'ISO 45001',
  'ISO_27001': 'ISO 27001',
  'ISO_39001': 'ISO 39001',
  'IATF_16949': 'IATF 16949',
  'ISO_50001': 'ISO 50001',
  'CUSTOM': 'Personalizado',
};

const STATUS_LABELS: Record<string, string> = {
  'DRAFT': 'Borrador',
  'FINAL': 'Final',
};

const SECTION_ICONS: Record<string, any> = {
  audit_results: FileText,
  nonconformities: AlertTriangle,
  customer_feedback: Users,
  process_performance: TrendingUp,
  improvement_opportunities: Target,
  risk_management: Shield,
  environmental_aspects: Settings,
  legal_compliance: Shield,
  environmental_objectives: Target,
  emergency_preparedness: AlertTriangle,
  ohs_audit_results: FileText,
  incident_investigation: AlertTriangle,
  risk_assessment: Shield,
  ohs_objectives: Target,
  worker_participation: Users,
  risk_treatment: Shield,
  security_incidents: AlertTriangle,
  control_effectiveness: CheckCircle,
  compliance_evaluation: FileText,
  business_continuity: Settings,
};

export default function InformeDireccionDetailPage() {
  const params = useParams();
  const reviewId = params.id as string;
  const { settings: companySettings } = useCompany();

  const [review, setReview] = useState<ManagementReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');
  const [savingSummary, setSavingSummary] = useState(false);

  useEffect(() => {
    if (reviewId) {
      loadReview();
    }
  }, [reviewId]);

  async function loadReview() {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch(`/management-reviews/${reviewId}`) as { review: ManagementReview };
      if (res.review) setReview(res.review);
    } catch (err) {
      console.error('Error loading review:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar el informe');
    } finally {
      setLoading(false);
    }
  }

  async function generateDraft() {
    try {
      setGeneratingDraft(true);
      setError(null);
      const res = await apiFetch(`/management-reviews/${reviewId}/generate-draft`, {
        method: 'POST',
      }) as { review: ManagementReview };
      
      if (res.review) {
        setReview(res.review);
      }
    } catch (err) {
      console.error('Error generating draft:', err);
      setError(err instanceof Error ? err.message : 'Error al generar borrador');
    } finally {
      setGeneratingDraft(false);
    }
  }

  async function updateSection(sectionKey: string, data: { freeText?: string; outputs?: string; decisions?: any }) {
    try {
      setSaving(true);
      setError(null);
      const res = await apiFetch(`/management-reviews/${reviewId}/sections/${sectionKey}`, {
        method: 'PATCH',
        json: data,
      }) as { section: ManagementReviewSection };
      
      if (res.section && review) {
        setReview({
          ...review,
          sections: review.sections.map(s => s.key === sectionKey ? res.section : s)
        });
        setEditingSection(null);
      }
    } catch (err) {
      console.error('Error updating section:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar sección');
    } finally {
      setSaving(false);
    }
  }

  async function saveSummary() {
    if (!review) return;
    setSavingSummary(true);
    try {
      await apiFetch(`/management-reviews/${reviewId}`, {
        method: 'PATCH',
        json: { summary: summaryDraft },
      });
      setReview({ ...review, summary: summaryDraft });
      setEditingSummary(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar resumen');
    } finally {
      setSavingSummary(false);
    }
  }

  async function aiSuggestSection(sectionKey: string): Promise<string> {
    const res = await apiFetch(`/management-reviews/${reviewId}/ai-suggest/${sectionKey}`, {
      method: 'POST',
    }) as { suggestion: string; model: string };
    return res.suggestion;
  }

  function exportToPDF() {
    window.print();
  }

  async function exportToWord() {
    if (!review) return;
    
    try {
      await exportToWordUtil(review, companySettings || undefined);
    } catch (error) {
      console.error('Error exporting to Word:', error);
      alert('Error al exportar a Word. Por favor, intente nuevamente.');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!review) {
    return (
      <div className="space-y-6">
        <Link href="/revision-direccion" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800">
          <ChevronLeft className="w-4 h-4" />
          Volver a Informes
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Informe no encontrado
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between print:hidden">
        <div>
          <Link 
            href="/revision-direccion" 
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Volver a Informes
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{review.title}</h1>
          <p className="text-gray-600 mt-1">
            {new Date(review.periodStart).toLocaleDateString()} - {new Date(review.periodEnd).toLocaleDateString()}
          </p>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex flex-wrap gap-1">
              {review.standards.map((standard) => (
                <span
                  key={standard}
                  className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700"
                >
                  {ISO_STANDARD_LABELS[standard] || standard}
                </span>
              ))}
            </div>
            <span className={`px-2 py-1 text-xs rounded-full ${
              review.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
            }`}>
              {STATUS_LABELS[review.status]}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={generateDraft}
            disabled={generatingDraft || review.status === 'FINAL'}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <FileBarChart className="w-4 h-4" />
            {generatingDraft ? 'Generando...' : 'Generar Borrador'}
          </button>
          <button
            onClick={exportToPDF}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={exportToWord}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FileDown className="w-4 h-4" />
            Word
          </button>
        </div>
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 print:shadow-none print:border-none print:p-6">
        {/* Report Header */}
        <div className="border-b border-gray-200 pb-6 mb-6 print:border-b print:border-gray-200 print:pb-6 print:mb-6">
          <div className="text-center print:text-center">
            {companySettings?.logoUrl && (
              <div className="w-24 h-24 mx-auto mb-4 print:w-20 print:h-20 print:mx-auto print:mb-4">
                <img 
                  src={companySettings.logoUrl} 
                  alt={companySettings.companyName || 'Logo'} 
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            )}
            <p className="text-sm text-gray-500 uppercase tracking-wider print:text-sm print:text-gray-500 print:uppercase print:tracking-wider">
              {companySettings?.companyName || 'SGI 360'}
            </p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1 print:text-2xl print:font-bold print:text-gray-900 print:mt-1">INFORME PARA LA DIRECCIÓN</h1>
            {companySettings?.headerText && (
              <p className="text-sm text-gray-600 mt-2 italic print:text-sm print:text-gray-600 print:mt-2 print:italic">{companySettings.headerText}</p>
            )}
          </div>
          <div className="text-center mt-4 pt-4 border-t border-gray-100 print:text-center print:mt-4 print:pt-4 print:border-t print:border-gray-100">
            <p className="text-xl text-gray-700 font-medium print:text-xl print:text-gray-700 print:font-medium">{review.title}</p>
            <p className="text-lg text-gray-600 mt-1 print:text-lg print:text-gray-600 print:mt-1">
              Período: {new Date(review.periodStart).toLocaleDateString()} - {new Date(review.periodEnd).toLocaleDateString()}
            </p>
            <p className="text-sm text-gray-500 mt-1 print:text-sm print:text-gray-500 print:mt-1">
              Normas: {review.standards.map(s => ISO_STANDARD_LABELS[s] || s).join(', ')}
            </p>
          </div>
        </div>

        {/* Summary — siempre visible y editable */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-gray-900">Resumen Ejecutivo</h2>
            {review.status !== 'FINAL' && (
              <div className="flex gap-2 print:hidden">
                {!editingSummary ? (
                  <button
                    onClick={() => { setSummaryDraft(review.summary || ''); setEditingSummary(true); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Editar resumen
                  </button>
                ) : (
                  <>
                    <button
                      onClick={saveSummary}
                      disabled={savingSummary}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" /> {savingSummary ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button
                      onClick={() => setEditingSummary(false)}
                      className="px-3 py-1.5 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          {editingSummary ? (
            <textarea
              value={summaryDraft}
              onChange={(e) => setSummaryDraft(e.target.value)}
              rows={6}
              className="w-full px-4 py-3 border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 text-sm"
              placeholder="Escriba aquí el resumen ejecutivo del período revisado..."
            />
          ) : review.summary ? (
            <div className="bg-gray-50 border border-gray-100 p-5 rounded-xl">
              <p className="text-gray-700 whitespace-pre-line leading-relaxed">{review.summary}</p>
            </div>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-300 p-5 rounded-xl text-center text-gray-400 text-sm print:hidden">
              Sin resumen ejecutivo. Haga clic en "Editar resumen" para agregar uno.
            </div>
          )}
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {review.sections.map((section) => {
            const Icon = SECTION_ICONS[section.key] || FileText;
            return (
              <SectionEditor
                key={section.key}
                section={section}
                Icon={Icon}
                isEditing={editingSection === section.key}
                onEdit={() => setEditingSection(section.key)}
                onSave={(data) => updateSection(section.key, data)}
                onCancel={() => setEditingSection(null)}
                onAiSuggest={() => aiSuggestSection(section.key)}
                disabled={review.status === 'FINAL'}
                saving={saving}
              />
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 pt-6 mt-8">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <div>
              <p>Informe generado el {new Date(review.generatedAt).toLocaleDateString()}</p>
              {companySettings?.footerText && (
                <p className="text-gray-400 mt-1">{companySettings.footerText}</p>
              )}
            </div>
            <p>{companySettings?.companyName || 'SGI 360'} - Sistema de Gestión Integral</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Section Editor Component
function SectionEditor({
  section, Icon, isEditing, onEdit, onSave, onCancel, onAiSuggest, disabled, saving,
}: {
  section: ManagementReviewSection;
  Icon: any;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (data: any) => void;
  onCancel: () => void;
  onAiSuggest: () => Promise<string>;
  disabled: boolean;
  saving: boolean;
}) {
  const [formData, setFormData] = useState({
    freeText: section.freeText || '',
    outputs: section.outputs || '',
    decisions: section.decisions || '',
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showSystemData, setShowSystemData] = useState(false);

  // Sync when section changes externally (after save)
  useState(() => {
    setFormData({
      freeText: section.freeText || '',
      outputs: section.outputs || '',
      decisions: section.decisions || '',
    });
  });

  function handleSave() {
    const data: any = {};
    data.freeText = formData.freeText.trim() || null;
    data.outputs = formData.outputs.trim() || null;
    data.decisions = formData.decisions.trim() || null;
    onSave(data);
  }

  async function handleAiSuggest() {
    setAiLoading(true);
    setAiError(null);
    setAiSuggestion(null);
    try {
      const text = await onAiSuggest();
      setAiSuggestion(text);
    } catch (err: any) {
      setAiError(err?.message || 'Error al conectar con la IA');
    } finally {
      setAiLoading(false);
    }
  }

  function applyAiSuggestion() {
    if (!aiSuggestion) return;
    setFormData((prev) => ({
      ...prev,
      freeText: prev.freeText ? prev.freeText + '\n\n' + aiSuggestion : aiSuggestion,
    }));
    setAiSuggestion(null);
    if (!isEditing) onEdit();
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-500" />
          {section.title}
        </h2>
        <div className="flex items-center gap-2 print:hidden">
          {/* Botón IA */}
          {!disabled && (
            <button
              onClick={handleAiSuggest}
              disabled={aiLoading}
              title="Generar sugerencia con IA del servidor (Ollama)"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {aiLoading ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Consultando IA...</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" /> Sugerir con IA</>
              )}
            </button>
          )}
          {/* Editar / Guardar */}
          {!disabled && (
            <button
              onClick={isEditing ? handleSave : onEdit}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isEditing
                ? (saving ? 'Guardando...' : <><Save className="w-3.5 h-3.5" /> Guardar</>)
                : <><Edit3 className="w-3.5 h-3.5" /> Editar</>}
            </button>
          )}
          {isEditing && (
            <button onClick={onCancel} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Panel sugerencia IA */}
        {aiError && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{aiError}</span>
            <button onClick={() => setAiError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        {aiSuggestion && (
          <div className="border border-violet-200 bg-violet-50 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-violet-700">
                <Sparkles className="w-4 h-4" /> Sugerencia de la IA
              </span>
              <button onClick={() => setAiSuggestion(null)} className="text-violet-400 hover:text-violet-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{aiSuggestion}</p>
            <div className="flex gap-2">
              <button
                onClick={applyAiSuggestion}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700"
              >
                <Copy className="w-3.5 h-3.5" /> Aplicar al análisis
              </button>
              <button
                onClick={handleAiSuggest}
                disabled={aiLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-violet-300 text-violet-700 rounded-lg hover:bg-violet-100 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} /> Regenerar
              </button>
            </div>
          </div>
        )}

        {/* Datos del sistema — colapsable */}
        {section.systemData && (
          <div>
            <button
              onClick={() => setShowSystemData(!showSystemData)}
              className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 print:hidden"
            >
              <FileText className="w-3.5 h-3.5" />
              Datos del sistema (entradas automáticas)
              <span className="ml-1">{showSystemData ? '▲' : '▼'}</span>
            </button>
            {showSystemData && (
              <div className="mt-2 bg-gray-50 border border-gray-100 rounded-lg p-4 overflow-auto max-h-64">
                <SectionDataViewer data={section.systemData} />
              </div>
            )}
          </div>
        )}

        {/* Campos editables */}
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Análisis y Observaciones</label>
              <textarea
                value={formData.freeText}
                onChange={(e) => setFormData({ ...formData, freeText: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                rows={6}
                placeholder="Ingrese su análisis y observaciones sobre estos datos..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salida Requerida</label>
              <textarea
                value={formData.outputs}
                onChange={(e) => setFormData({ ...formData, outputs: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                rows={3}
                placeholder="Describa la salida requerida (recursos, mejoras, objetivos nuevos...)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Decisiones y Acciones</label>
              <textarea
                value={formData.decisions}
                onChange={(e) => setFormData({ ...formData, decisions: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                rows={3}
                placeholder="Decisiones tomadas, responsables y fechas límite..."
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {section.freeText ? (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Análisis y Observaciones</h3>
                <p className="text-gray-700 whitespace-pre-line leading-relaxed text-sm">{section.freeText}</p>
              </div>
            ) : !disabled && (
              <p className="text-sm text-gray-400 italic">Sin análisis. Haga clic en "Editar" o use "Sugerir con IA" para comenzar.</p>
            )}
            {section.outputs && (
              <div>
                <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Salida Requerida</h3>
                <div className="bg-blue-50 border border-blue-100 px-4 py-3 rounded-lg">
                  <p className="text-gray-700 whitespace-pre-line text-sm">{section.outputs}</p>
                </div>
              </div>
            )}
            {section.decisions && (
              <div>
                <h3 className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-2">Decisiones y Acciones</h3>
                <div className="bg-green-50 border border-green-100 px-4 py-3 rounded-lg">
                  <p className="text-gray-700 whitespace-pre-line text-sm">{section.decisions}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Renderizador amigable de los datos del sistema
function SectionDataViewer({ data }: { data: any }) {
  if (typeof data !== 'object' || data === null) {
    return <span className="text-sm text-gray-600">{String(data)}</span>;
  }
  return (
    <div className="space-y-1">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex gap-2 text-sm">
          <span className="font-medium text-gray-600 min-w-[160px] capitalize">{key.replace(/_/g, ' ')}:</span>
          <span className="text-gray-700">
            {typeof value === 'object' && value !== null
              ? Array.isArray(value)
                ? `${(value as any[]).length} elementos`
                : JSON.stringify(value).slice(0, 120)
              : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}
