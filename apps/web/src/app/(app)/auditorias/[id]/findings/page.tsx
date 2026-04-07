'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Plus, AlertCircle, Save, X } from 'lucide-react';

type Finding = {
  id: string;
  code: string;
  type: 'NON_CONFORMITY' | 'OBSERVATION' | 'OPPORTUNITY';
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'TRIVIAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  description: string;
  evidence: string | null;
  clause: string;
  area: string;
  responsibleId: string;
  createdAt: string;
};

type Audit = {
  id: string;
  code: string;
  title: string;
  isoStandard: string[];
};

const TYPE_OPTIONS = [
  { value: 'NON_CONFORMITY', label: 'No Conformidad', color: 'bg-red-100 text-red-800' },
  { value: 'OBSERVATION', label: 'Observación', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'OPPORTUNITY', label: 'Oportunidad de Mejora', color: 'bg-blue-100 text-blue-800' },
];

const SEVERITY_OPTIONS = [
  { value: 'CRITICAL', label: 'Crítica', color: 'bg-red-100 text-red-800' },
  { value: 'MAJOR', label: 'Mayor', color: 'bg-orange-100 text-orange-800' },
  { value: 'MINOR', label: 'Menor', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'TRIVIAL', label: 'Trivial', color: 'bg-gray-100 text-gray-800' },
];

export default function FindingsPage() {
  const params = useParams();
  const router = useRouter();
  const auditId = params.id as string;

  const [audit, setAudit] = useState<Audit | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newFinding, setNewFinding] = useState({
    code: '',
    type: 'NON_CONFORMITY',
    severity: 'MAJOR',
    description: '',
    evidence: '',
    clause: '',
    area: '',
    responsibleId: '',
  });

  useEffect(() => {
    if (auditId) {
      loadData();
    }
  }, [auditId]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [auditRes, findingsRes] = await Promise.all([
        apiFetch(`/audit/audits/${auditId}`) as Promise<{ audit: Audit }>,
        apiFetch(`/audit/audits/${auditId}/findings`) as Promise<{ findings: Finding[] }>,
      ]);

      if (auditRes.audit) setAudit(auditRes.audit);
      if (findingsRes.findings) setFindings(findingsRes.findings);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Error loading data');
    } finally {
      setLoading(false);
    }
  }

  async function createFinding(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const payload = {
        ...newFinding,
        evidence: newFinding.evidence?.trim() ? newFinding.evidence.trim() : undefined,
        area: newFinding.area?.trim() ? newFinding.area.trim() : undefined,
        responsibleId: newFinding.responsibleId?.trim() ? newFinding.responsibleId.trim() : undefined,
        requirement: newFinding.description,
      };
      const res = await apiFetch(`/audit/audits/${auditId}/findings`, {
        method: 'POST',
        json: payload,
      }) as { finding: Finding };

      if (res.finding) {
        setFindings([...findings, res.finding]);
        setShowCreateModal(false);
        setNewFinding({
          code: '',
          type: 'NON_CONFORMITY',
          severity: 'MAJOR',
          description: '',
          evidence: '',
          clause: '',
          area: '',
          responsibleId: '',
        });
      }
    } catch (err) {
      console.error('Error creating finding:', err);
      setError(err instanceof Error ? err.message : 'Error creating finding');
    } finally {
      setSaving(false);
    }
  }

  function getTypeLabel(type: string) {
    return TYPE_OPTIONS.find(t => t.value === type)?.label || type;
  }

  function getTypeColor(type: string) {
    return TYPE_OPTIONS.find(t => t.value === type)?.color || 'bg-gray-100 text-gray-800';
  }

  function getSeverityLabel(severity: string) {
    return SEVERITY_OPTIONS.find(s => s.value === severity)?.label || severity;
  }

  function getSeverityColor(severity: string) {
    return SEVERITY_OPTIONS.find(s => s.value === severity)?.color || 'bg-gray-100 text-gray-800';
  }

  const checklistFindings = findings.filter(f => (f.code || '').startsWith('NC-'));
  const manualFindings = findings.filter(f => !(f.code || '').startsWith('NC-'));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
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
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/auditorias/${auditId}`} className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-2">
            <ChevronLeft className="w-4 h-4" />
            Volver a la auditoría
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Hallazgos - {audit?.code}</h1>
          <p className="text-gray-600">{audit?.title}</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Hallazgo
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {SEVERITY_OPTIONS.map((sev) => {
          const count = findings.filter(f => f.severity === sev.value).length;
          return (
            <div key={sev.value} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <div className={`inline-flex px-2 py-1 rounded-full text-xs ${sev.color} mb-2`}>
                {sev.label}
              </div>
              <p className="text-2xl font-bold text-gray-900">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Findings List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Hallazgos Registrados ({findings.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-200">
          {findings.length > 0 ? (
            <>
              {checklistFindings.length > 0 && (
                <div className="p-6 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-900">Hallazgos del checklist (No cumple)</h3>
                  <p className="text-xs text-gray-500 mt-1">Se generan automáticamente al marcar un ítem como "No Cumple".</p>
                </div>
              )}

              {checklistFindings.map((finding) => (
                <div key={finding.id} className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-gray-900">{finding.code}</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(finding.type)}`}>
                        {getTypeLabel(finding.type)}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${getSeverityColor(finding.severity)}`}>
                        {getSeverityLabel(finding.severity)}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(finding.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-900 mb-2">{finding.description}</p>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                    <span><strong>Cláusula:</strong> {finding.clause}</span>
                    <span><strong>Área:</strong> {finding.area}</span>
                    {finding.evidence && (
                      <span><strong>Evidencia:</strong> {finding.evidence}</span>
                    )}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Link
                      href={`/auditorias/${auditId}/findings/${finding.id}`}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Ver detalle →
                    </Link>
                    <span className="text-gray-300">|</span>
                    <Link
                      href={`/auditorias/${auditId}/findings/${finding.id}/actions`}
                      className="text-sm text-green-600 hover:text-green-800"
                    >
                      Acciones correctivas →
                    </Link>
                  </div>
                </div>
              ))}

              <div className="p-6 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-900">Otros hallazgos (manuales)</h3>
                <p className="text-xs text-gray-500 mt-1">Podés agregarlos con el botón "Nuevo Hallazgo".</p>
              </div>

              {manualFindings.length > 0 ? (
                manualFindings.map((finding) => (
                  <div key={finding.id} className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-gray-900">{finding.code}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(finding.type)}`}>
                          {getTypeLabel(finding.type)}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${getSeverityColor(finding.severity)}`}>
                          {getSeverityLabel(finding.severity)}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(finding.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-gray-900 mb-2">{finding.description}</p>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                      <span><strong>Cláusula:</strong> {finding.clause}</span>
                      <span><strong>Área:</strong> {finding.area}</span>
                      {finding.evidence && (
                        <span><strong>Evidencia:</strong> {finding.evidence}</span>
                      )}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Link
                        href={`/auditorias/${auditId}/findings/${finding.id}`}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Ver detalle →
                      </Link>
                      <span className="text-gray-300">|</span>
                      <Link
                        href={`/auditorias/${auditId}/findings/${finding.id}/actions`}
                        className="text-sm text-green-600 hover:text-green-800"
                      >
                        Acciones correctivas →
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-gray-500">
                  <p>No hay hallazgos manuales</p>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No hay hallazgos registrados</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="text-red-600 hover:text-red-800 text-sm mt-2"
              >
                + Registrar primer hallazgo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Crear Hallazgo */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 my-8">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Nuevo Hallazgo</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={createFinding} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newFinding.code}
                    onChange={(e) => setNewFinding({ ...newFinding, code: e.target.value })}
                    placeholder="H-001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cláusula <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newFinding.clause}
                    onChange={(e) => setNewFinding({ ...newFinding, clause: e.target.value })}
                    placeholder="8.5.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo <span className="text-red-500">*</span></label>
                  <select
                    value={newFinding.type}
                    onChange={(e) => setNewFinding({ ...newFinding, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Severidad <span className="text-red-500">*</span></label>
                  <select
                    value={newFinding.severity}
                    onChange={(e) => setNewFinding({ ...newFinding, severity: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {SEVERITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción <span className="text-red-500">*</span></label>
                <textarea
                  value={newFinding.description}
                  onChange={(e) => setNewFinding({ ...newFinding, description: e.target.value })}
                  placeholder="Describa el hallazgo identificado..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Área</label>
                  <input
                    type="text"
                    value={newFinding.area}
                    onChange={(e) => setNewFinding({ ...newFinding, area: e.target.value })}
                    placeholder="Área afectada"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Evidencia</label>
                  <input
                    type="text"
                    value={newFinding.evidence}
                    onChange={(e) => setNewFinding({ ...newFinding, evidence: e.target.value })}
                    placeholder="URL o referencia"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Guardar Hallazgo
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
