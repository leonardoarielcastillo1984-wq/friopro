'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, AlertCircle } from 'lucide-react';

type Finding = {
  id: string;
  code: string;
  type: 'NON_CONFORMITY' | 'OBSERVATION' | 'OPPORTUNITY';
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'TRIVIAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  description: string;
  evidence: string | null;
  clause: string;
  requirement: string;
  area: string;
  process: string | null;
  responsibleId: string;
  createdAt: string;
};

const TYPE_OPTIONS = [
  { value: 'NON_CONFORMITY', label: 'No Conformidad', color: 'bg-red-100 text-red-800' },
  { value: 'OBSERVATION', label: 'Observación', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'OPPORTUNITY', label: 'Oportunidad de Mejora', color: 'bg-blue-100 text-blue-800' },
] as const;

const SEVERITY_OPTIONS = [
  { value: 'CRITICAL', label: 'Crítica', color: 'bg-red-100 text-red-800' },
  { value: 'MAJOR', label: 'Mayor', color: 'bg-orange-100 text-orange-800' },
  { value: 'MINOR', label: 'Menor', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'TRIVIAL', label: 'Trivial', color: 'bg-gray-100 text-gray-800' },
] as const;

export default function FindingDetailPage() {
  const params = useParams();
  const findingId = params.findingId as string;
  const auditId = params.id as string;

  const [finding, setFinding] = useState<Finding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (findingId) {
      load();
    }
  }, [findingId]);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch(`/audit/iso-findings/${findingId}`) as { finding: Finding };
      setFinding(res.finding);
    } catch (err) {
      console.error('Error loading finding:', err);
      setError(err instanceof Error ? err.message : 'Error loading finding');
    } finally {
      setLoading(false);
    }
  }

  function getTypeMeta(type: Finding['type']) {
    return TYPE_OPTIONS.find(t => t.value === type);
  }

  function getSeverityMeta(severity: Finding['severity']) {
    return SEVERITY_OPTIONS.find(s => s.value === severity);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!finding) {
    return (
      <div className="space-y-4">
        <Link
          href={`/auditorias/${auditId}/findings`}
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
        >
          <ChevronLeft className="w-4 h-4" />
          Volver a hallazgos
        </Link>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No se encontró el hallazgo</p>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>
      </div>
    );
  }

  const typeMeta = getTypeMeta(finding.type);
  const severityMeta = getSeverityMeta(finding.severity);

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <Link
            href={`/auditorias/${auditId}/findings`}
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Volver a hallazgos
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{finding.code}</h1>
          <div className="flex items-center gap-2 mt-2">
            {typeMeta && (
              <span className={`px-2 py-1 text-xs rounded-full ${typeMeta.color}`}>
                {typeMeta.label}
              </span>
            )}
            {severityMeta && (
              <span className={`px-2 py-1 text-xs rounded-full ${severityMeta.color}`}>
                {severityMeta.label}
              </span>
            )}
            <span className="text-sm text-gray-500">{new Date(finding.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <Link
          href={`/auditorias/${auditId}/findings/${finding.id}/actions`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Acciones correctivas
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Descripción</h2>
          <p className="text-gray-700 mt-1">{finding.description}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-gray-500">Cláusula</p>
            <p className="text-gray-900 font-medium">{finding.clause}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-gray-500">Área</p>
            <p className="text-gray-900 font-medium">{finding.area}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-gray-500">Requisito</p>
            <p className="text-gray-900 font-medium">{finding.requirement}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-gray-500">Proceso</p>
            <p className="text-gray-900 font-medium">{finding.process || '—'}</p>
          </div>
        </div>

        {finding.evidence && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Evidencia</h2>
            <p className="text-gray-700 mt-1">{finding.evidence}</p>
          </div>
        )}
      </div>
    </div>
  );
}
