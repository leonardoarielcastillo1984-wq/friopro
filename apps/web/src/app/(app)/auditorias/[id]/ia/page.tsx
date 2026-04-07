'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, Brain, Lightbulb, AlertTriangle, CheckCircle, RefreshCw, Sparkles } from 'lucide-react';

type AISuggestion = {
  id: string;
  type: 'FINDING' | 'IMPROVEMENT' | 'INCONSISTENCY' | 'RISK';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  clause: string;
  confidence: number;
  rationale: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
};

type Audit = {
  id: string;
  code: string;
  title: string;
};

const TYPE_CONFIG = {
  FINDING: { label: 'Hallazgo Potencial', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
  IMPROVEMENT: { label: 'Oportunidad', color: 'bg-blue-100 text-blue-800', icon: Lightbulb },
  INCONSISTENCY: { label: 'Inconsistencia', color: 'bg-yellow-100 text-yellow-800', icon: RefreshCw },
  RISK: { label: 'Riesgo Detectado', color: 'bg-orange-100 text-orange-800', icon: AlertTriangle },
};

export default function AIAssistantPage() {
  const params = useParams();
  const auditId = params.id as string;

  const [audit, setAudit] = useState<Audit | null>(null);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AISuggestion | null>(null);

  useEffect(() => {
    if (auditId) {
      loadData();
    }
  }, [auditId]);

  async function loadData() {
    try {
      setLoading(true);
      const [auditRes, suggestionsRes] = await Promise.all([
        apiFetch(`/audit/audits/${auditId}`) as Promise<{ audit: Audit }>,
        apiFetch(`/audit/audits/${auditId}/ai-suggestions`) as Promise<{ suggestions: AISuggestion[] }>,
      ]);

      if (auditRes.audit) setAudit(auditRes.audit);
      if (suggestionsRes.suggestions) setSuggestions(suggestionsRes.suggestions);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function analyzeAudit() {
    try {
      setAnalyzing(true);
      const res = await apiFetch(`/audit/audits/${auditId}/ai-analyze`, {
        method: 'POST',
      }) as { suggestions: AISuggestion[] };

      if (res.suggestions) {
        setSuggestions([...res.suggestions, ...suggestions]);
      }
    } catch (err) {
      console.error('Error analyzing audit:', err);
    } finally {
      setAnalyzing(false);
    }
  }

  async function updateSuggestion(id: string, status: 'ACCEPTED' | 'REJECTED') {
    try {
      const res = await apiFetch(`/audit/ai-suggestions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }) as { suggestion: AISuggestion };

      if (res.suggestion) {
        setSuggestions(suggestions.map(s => s.id === id ? { ...s, status } : s));
      }
    } catch (err) {
      console.error('Error updating suggestion:', err);
    }
  }

  const pendingSuggestions = suggestions.filter(s => s.status === 'PENDING');
  const acceptedSuggestions = suggestions.filter(s => s.status === 'ACCEPTED');
  const rejectedSuggestions = suggestions.filter(s => s.status === 'REJECTED');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/auditorias/${auditId}`} className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-2">
            <ChevronLeft className="w-4 h-4" />
            Volver a la auditoría
          </Link>
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 text-purple-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Asistente IA</h1>
              <p className="text-gray-600">{audit?.code} - Análisis inteligente</p>
            </div>
          </div>
        </div>
        <button
          onClick={analyzeAudit}
          disabled={analyzing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          {analyzing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Analizando...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Analizar con IA
            </>
          )}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
          <p className="text-sm text-purple-600">Sugerencias Pendientes</p>
          <p className="text-2xl font-bold text-purple-900">{pendingSuggestions.length}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-xl border border-green-100">
          <p className="text-sm text-green-600">Aceptadas</p>
          <p className="text-2xl font-bold text-green-900">{acceptedSuggestions.length}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
          <p className="text-sm text-red-600">Rechazadas</p>
          <p className="text-2xl font-bold text-red-900">{rejectedSuggestions.length}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <p className="text-sm text-blue-600">Precisión Media</p>
          <p className="text-2xl font-bold text-blue-900">
            {suggestions.length > 0 
              ? Math.round(suggestions.reduce((acc, s) => acc + s.confidence, 0) / suggestions.length)
              : 0}%
          </p>
        </div>
      </div>

      {/* Suggestions List */}
      <div className="space-y-4">
        {pendingSuggestions.length === 0 && !analyzing && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <Brain className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No hay sugerencias pendientes</p>
            <p className="text-sm text-gray-400 mt-1">
              Haz clic en "Analizar con IA" para obtener sugerencias inteligentes
            </p>
          </div>
        )}

        {pendingSuggestions.map((suggestion) => {
          const config = TYPE_CONFIG[suggestion.type];
          const Icon = config.icon;
          
          return (
            <div key={suggestion.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${config.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${config.color}`}>
                      {config.label}
                    </span>
                    <span className="text-sm text-gray-500">
                      Confianza: {suggestion.confidence}%
                    </span>
                    <span className="text-sm text-gray-400">
                      {new Date(suggestion.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{suggestion.title}</h3>
                  <p className="text-gray-600 mb-3">{suggestion.description}</p>
                  
                  <div className="bg-gray-50 p-3 rounded-lg mb-4">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Razonamiento IA:</span> {suggestion.rationale}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      <span className="font-medium">Cláusula relacionada:</span> {suggestion.clause}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => updateSuggestion(suggestion.id, 'ACCEPTED')}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Aceptar y Crear Hallazgo
                    </button>
                    <button
                      onClick={() => updateSuggestion(suggestion.id, 'REJECTED')}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Accepted Suggestions */}
      {acceptedSuggestions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Sugerencias Aceptadas ({acceptedSuggestions.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {acceptedSuggestions.map((suggestion) => {
              const config = TYPE_CONFIG[suggestion.type];
              return (
                <div key={suggestion.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="font-medium text-gray-900">{suggestion.title}</p>
                      <p className="text-sm text-gray-500">{config.label} • {suggestion.clause}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                    Convertido a hallazgo
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
