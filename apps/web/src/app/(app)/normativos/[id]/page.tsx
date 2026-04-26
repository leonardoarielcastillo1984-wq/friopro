'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { NormativeStandard, NormativeClause } from '@/lib/types';
import { Sparkles, Lightbulb, FileCheck, AlertCircle, CheckCircle, X, Plus, Trash2, Shield, BarChart3, Truck, Users, User, AlertTriangle, ClipboardList } from 'lucide-react';

export default function NormativoDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [normativo, setNormativo] = useState<NormativeStandard | null>(null);
  const [clauses, setClauses] = useState<NormativeClause[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedClause, setSelectedClause] = useState<(NormativeClause & { content: string }) | null>(null);
  const [loadingClause, setLoadingClause] = useState(false);

  // Estados para evidencias y cumplimiento
  const [clauseCompliance, setClauseCompliance] = useState<Record<string, { percentage: number; status: string }>>({});
  const [evidences, setEvidences] = useState<any[]>([]);
  const [loadingEvidences, setLoadingEvidences] = useState(false);
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [evidenceType, setEvidenceType] = useState<'MODULE' | 'INDICATOR' | 'ACTION'>('MODULE');
  const [evidenceReferenceType, setEvidenceReferenceType] = useState('suppliers');
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [modules, setModules] = useState<any[]>([]);

  // Estados para sugerencias de IA
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsData, setSuggestionsData] = useState<any>(null);

  async function loadNormativo() {
    try {
      const res = await apiFetch<{ normativo: NormativeStandard }>(`/normativos/${id}`);
      setNormativo(res.normativo);
    } catch (err: any) {
      setError(err?.message ?? 'Error al cargar');
      if (err?.message === 'Unauthorized') router.push('/login');
    }
  }

  async function loadClauses(searchTerm?: string) {
    try {
      const query = new URLSearchParams();
      if (searchTerm) query.set('search', searchTerm);

      const res = await apiFetch<{ clauses: NormativeClause[] }>(
        `/normativos/${id}/clauses?${query.toString()}`,
      );
      setClauses(res.clauses);
    } catch (err: any) {
      setError(err?.message ?? 'Error al cargar cláusulas');
    }
  }

  async function loadClauseDetail(clauseId: string) {
    setLoadingClause(true);
    try {
      const [detailRes, complianceRes, evidencesRes] = await Promise.all([
        apiFetch<{ clause: NormativeClause & { content: string; childClauses: NormativeClause[] } }>(`/normativos/${id}/clauses/${clauseId}`),
        apiFetch<{ compliance: { percentage: number; status: string } }>(`/normativos/${id}/clauses/${clauseId}/compliance`).catch(() => null),
        apiFetch<{ evidences: any[] }>(`/normativos/clauses/${clauseId}/evidences`).catch(() => null),
      ]);
      setSelectedClause(detailRes.clause);
      if (complianceRes?.compliance) {
        setClauseCompliance(prev => ({ ...prev, [clauseId]: complianceRes.compliance }));
      }
      if (evidencesRes?.evidences) {
        setEvidences(evidencesRes.evidences);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error al cargar cláusula');
    } finally {
      setLoadingClause(false);
    }
  }

  async function loadModules() {
    try {
      const res = await apiFetch<{ modules: any[] }>('/normativos/compliance/modules');
      setModules(res.modules || []);
    } catch { /* ignore */ }
  }

  async function addEvidence(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClause) return;
    try {
      const res = await apiFetch<{ evidence: any }>(`/normativos/clauses/${selectedClause.id}/evidences`, {
        method: 'POST',
        body: JSON.stringify({
          type: evidenceType,
          referenceType: evidenceReferenceType,
          description: evidenceDescription || null,
        }),
      });
      setEvidences(prev => [res.evidence, ...prev]);
      setShowAddEvidence(false);
      setEvidenceDescription('');
      // Reload compliance
      const compRes = await apiFetch<{ compliance: { percentage: number; status: string } }>(`/normativos/${id}/clauses/${selectedClause.id}/compliance`);
      if (compRes?.compliance) {
        setClauseCompliance(prev => ({ ...prev, [selectedClause.id]: compRes.compliance }));
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error al agregar evidencia');
    }
  }

  async function deleteEvidence(evidenceId: string) {
    if (!selectedClause) return;
    if (!confirm('¿Eliminar esta evidencia?')) return;
    try {
      await apiFetch(`/normativos/clauses/${selectedClause.id}/evidences/${evidenceId}`, { method: 'DELETE' });
      setEvidences(prev => prev.filter(e => e.id !== evidenceId));
      const compRes = await apiFetch<{ compliance: { percentage: number; status: string } }>(`/normativos/${id}/clauses/${selectedClause.id}/compliance`);
      if (compRes?.compliance) {
        setClauseCompliance(prev => ({ ...prev, [selectedClause.id]: compRes.compliance }));
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error al eliminar evidencia');
    }
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadNormativo();
      await loadClauses();
      await loadModules();
      setLoading(false);
    }
    void init();
  }, [id]);

  async function loadSuggestions() {
    setSuggestionsLoading(true);
    try {
      const res = await apiFetch<any>(`/normativos/${id}/clause-suggestions`);
      setSuggestionsData(res);
    } catch (err: any) {
      console.error('Error cargando sugerencias:', err);
      // Fallback local
      const pendingClauses = clauses.filter(c => !c._count?.documentMappings);
      const localSuggestions = pendingClauses.slice(0, 5).map(clause => ({
        clauseId: clause.id,
        clauseNumber: clause.clauseNumber,
        clauseTitle: clause.title,
        suggestion: {
          documentTypes: ['Documento de soporte', 'Evidencia de implementación'],
          examples: ['Registro de evidencia', 'Documentación del sistema'],
          priority: 'MEDIUM' as const,
          suggestedFileName: `${normativo?.code}_${clause.clauseNumber}_doc`
        }
      }));
      setSuggestionsData({
        normative: normativo,
        totalPendingClauses: pendingClauses.length,
        suggestions: localSuggestions
      });
    } finally {
      setSuggestionsLoading(false);
      setShowSuggestions(true);
    }
  }

  function getPriorityColor(priority: string) {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-700';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-700';
      case 'LOW': return 'bg-green-100 text-green-700';
      default: return 'bg-neutral-100 text-neutral-700';
    }
  }

  function getPriorityLabel(priority: string) {
    switch (priority) {
      case 'HIGH': return 'Alta';
      case 'MEDIUM': return 'Media';
      case 'LOW': return 'Baja';
      default: return 'Media';
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    void loadClauses(search || undefined);
  }

  // Construir árbol jerárquico a partir de lista plana
  function buildTree(items: NormativeClause[]): (NormativeClause & { children: NormativeClause[] })[] {
    const map = new Map<string, NormativeClause & { children: NormativeClause[] }>();
    const roots: (NormativeClause & { children: NormativeClause[] })[] = [];

    for (const item of items) {
      map.set(item.id, { ...item, children: [] });
    }

    for (const item of items) {
      const node = map.get(item.id)!;
      if (item.parentClauseId && map.has(item.parentClauseId)) {
        map.get(item.parentClauseId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  function ClauseNode({ clause, depth }: { clause: NormativeClause & { children: NormativeClause[] }; depth: number }) {
    const [expanded, setExpanded] = useState(depth < 1);
    const hasChildren = clause.children && clause.children.length > 0;
    const compliance = clauseCompliance[clause.id];

    function getComplianceBadge(status?: string) {
      if (!status || status === 'NON_COMPLIANT') return <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">🔴</span>;
      if (status === 'PARTIAL') return <span className="ml-1 rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] text-yellow-700">🟡</span>;
      return <span className="ml-1 rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700">🟢</span>;
    }

    return (
      <div>
        <div
          className={`flex cursor-pointer items-center gap-2 border-b border-neutral-100 py-2 hover:bg-neutral-50 ${
            selectedClause?.id === clause.id ? 'bg-blue-50' : ''
          }`}
          style={{ paddingLeft: `${depth * 20 + 12}px` }}
          onClick={() => loadClauseDetail(clause.id)}
        >
          {hasChildren && (
            <button
              className="text-xs text-neutral-400"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? '▼' : '▶'}
            </button>
          )}
          {!hasChildren && <span className="w-3" />}
          <span className="font-mono text-xs text-neutral-500">{clause.clauseNumber}</span>
          <span className="text-sm">{clause.title}</span>
          <span className="ml-auto flex items-center gap-2 mr-3">
            {compliance && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                compliance.status === 'COMPLIANT' ? 'bg-green-100 text-green-700' :
                compliance.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {compliance.percentage}%
              </span>
            )}
            {clause._count?.documentMappings ? (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                {clause._count.documentMappings} docs
              </span>
            ) : null}
          </span>
        </div>
        {expanded && hasChildren && (
          <div>
            {clause.children.map((child: any) => (
              <ClauseNode key={child.id} clause={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (loading) return <p className="mt-4 text-sm text-neutral-600">Cargando…</p>;

  if (!normativo) {
    return (
      <div className="mt-4">
        <p className="text-red-600">Normativo no encontrado</p>
        <button className="mt-2 text-sm text-blue-600" onClick={() => router.push('/normativos')}>
          Volver
        </button>
      </div>
    );
  }

  const tree = buildTree(clauses);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            className="text-sm text-neutral-500 hover:text-neutral-800"
            onClick={() => router.push('/normativos')}
          >
            ← Normativos
          </button>
          <h1 className="mt-1 text-2xl font-semibold">{normativo.name}</h1>
          <p className="text-sm text-neutral-500">
            {normativo.code} · v{normativo.version} · {normativo.totalClauses} cláusulas
          </p>
          {normativo.description && (
            <p className="mt-1 text-sm text-neutral-600">{normativo.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadSuggestions()}
            disabled={suggestionsLoading}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-purple-700 hover:to-blue-700 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {suggestionsLoading ? 'Cargando...' : '🤖 Ver sugerencias'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Buscador */}
      <form onSubmit={handleSearch} className="mt-4 flex gap-2">
        <input
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          placeholder="Buscar por número o texto de cláusula…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="rounded bg-black px-4 py-2 text-sm text-white" type="submit">
          Buscar
        </button>
        {search && (
          <button
            type="button"
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
            onClick={() => {
              setSearch('');
              void loadClauses();
            }}
          >
            Limpiar
          </button>
        )}
      </form>

      {/* Contenido: árbol + detalle */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Árbol de cláusulas */}
        <div className="max-h-[600px] overflow-y-auto rounded border border-neutral-200 bg-white">
          {tree.length === 0 ? (
            <div className="p-4 text-sm text-neutral-600">No se encontraron cláusulas.</div>
          ) : (
            tree.map((clause) => (
              <ClauseNode key={clause.id} clause={clause} depth={0} />
            ))
          )}
        </div>

        {/* Detalle de cláusula seleccionada */}
        <div className="max-h-[600px] overflow-y-auto rounded border border-neutral-200 bg-white p-4">
          {loadingClause && <p className="text-sm text-neutral-500">Cargando…</p>}
          {!loadingClause && !selectedClause && (
            <p className="text-sm text-neutral-500">
              Seleccioná una cláusula del árbol para ver su contenido.
            </p>
          )}
          {!loadingClause && selectedClause && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-neutral-700">
                  {selectedClause.clauseNumber}
                </span>
                <h2 className="text-lg font-medium">{selectedClause.title}</h2>
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                {selectedClause.content}
              </div>
              {selectedClause.keywords && (selectedClause.keywords as string[]).length > 0 && (
                <div className="mt-4">
                  <p className="mb-1 text-xs font-medium text-neutral-500">Palabras clave:</p>
                  <div className="flex flex-wrap gap-1">
                    {(selectedClause.keywords as string[]).map((kw, i) => (
                      <span
                        key={i}
                        className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Estado de cumplimiento */}
              {clauseCompliance[selectedClause.id] && (
                <div className="mt-4 rounded border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-neutral-800">Cumplimiento</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      clauseCompliance[selectedClause.id].status === 'COMPLIANT' ? 'bg-green-100 text-green-700' :
                      clauseCompliance[selectedClause.id].status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {clauseCompliance[selectedClause.id].percentage}%
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500">
                    {clauseCompliance[selectedClause.id].status === 'COMPLIANT' ? 'Cumple' :
                     clauseCompliance[selectedClause.id].status === 'PARTIAL' ? 'Cumplimiento parcial' :
                     'No cumple'}
                  </div>
                </div>
              )}

              {/* Sección Evidencias */}
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-neutral-800">Evidencias del sistema</h3>
                  <button
                    onClick={() => setShowAddEvidence(true)}
                    className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                  >
                    <Plus className="h-3 w-3" /> Agregar
                  </button>
                </div>

                {evidences.length === 0 ? (
                  <p className="text-xs text-neutral-500">Sin evidencias vinculadas.</p>
                ) : (
                  <div className="space-y-2">
                    {evidences.map((ev) => (
                      <div key={ev.id} className="flex items-center justify-between rounded border p-2 text-xs">
                        <div className="flex items-center gap-2">
                          {ev.type === 'MODULE' && <Shield className="h-3.5 w-3.5 text-blue-500" />}
                          {ev.type === 'INDICATOR' && <BarChart3 className="h-3.5 w-3.5 text-green-500" />}
                          {ev.type === 'ACTION' && <AlertCircle className="h-3.5 w-3.5 text-amber-500" />}
                          <div>
                            <span className="font-medium text-neutral-700">
                              {ev.type === 'MODULE' ? 'Módulo' : ev.type === 'INDICATOR' ? 'Indicador' : 'Acción'}: {ev.referenceType}
                            </span>
                            {ev.moduleStats?.score === 'empty' && (
                              <span className="ml-2 text-red-500">⚠ Sin uso real</span>
                            )}
                            {ev.moduleStats?.score === 'active' && (
                              <span className="ml-2 text-green-600">✓ Activo</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => deleteEvidence(ev.id)}
                          className="text-neutral-400 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Documentos vinculados */}
              {(selectedClause as any).documentMappings && (selectedClause as any).documentMappings.length > 0 && (
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-semibold text-neutral-800">Documentos</h3>
                  <div className="space-y-2">
                    {(selectedClause as any).documentMappings.map((dm: any) => (
                      <div key={dm.id} className="flex items-center gap-2 rounded border p-2 text-xs">
                        <FileCheck className="h-3.5 w-3.5 text-blue-500" />
                        <span className="text-neutral-700">{dm.document?.title || 'Documento'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Modal agregar evidencia */}
          {showAddEvidence && selectedClause && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
                <h3 className="mb-4 text-lg font-semibold">Vincular evidencia</h3>
                <form onSubmit={addEvidence} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm text-neutral-600">Tipo</label>
                    <select
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                      value={evidenceType}
                      onChange={(e) => setEvidenceType(e.target.value as 'MODULE' | 'INDICATOR' | 'ACTION')}
                    >
                      <option value="MODULE">Módulo del sistema</option>
                      <option value="INDICATOR">Indicador</option>
                      <option value="ACTION">Acción (CAPA / NC)</option>
                    </select>
                  </div>
                  {evidenceType === 'MODULE' && (
                    <div>
                      <label className="mb-1 block text-sm text-neutral-600">Módulo</label>
                      <select
                        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                        value={evidenceReferenceType}
                        onChange={(e) => setEvidenceReferenceType(e.target.value)}
                      >
                        {modules.map((m) => (
                          <option key={m.key} value={m.key}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-sm text-neutral-600">Descripción (opcional)</label>
                    <input
                      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                      value={evidenceDescription}
                      onChange={(e) => setEvidenceDescription(e.target.value)}
                      placeholder="Ej: Evaluaciones de proveedores"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddEvidence(false)}
                      className="rounded border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                    >
                      Guardar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Modal de sugerencias de IA */}
      {showSuggestions && suggestionsData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl">
            {/* Header del modal */}
            <div className="flex items-center justify-between border-b border-neutral-200 bg-gradient-to-r from-purple-50 to-blue-50 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-blue-600">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">
                    Sugerencias de IA para {suggestionsData.normative?.name}
                  </h2>
                  <p className="text-sm text-neutral-600">
                    {suggestionsData.totalPendingClauses} cláusulas pendientes de documentación
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSuggestions(false)}
                className="rounded-full p-2 hover:bg-neutral-200"
              >
                <X className="h-5 w-5 text-neutral-600" />
              </button>
            </div>

            {/* Contenido */}
            <div className="max-h-[60vh] overflow-y-auto p-6">
              {suggestionsData.suggestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="mb-4 h-16 w-16 text-green-500" />
                  <h3 className="text-lg font-medium text-neutral-900">¡Excelente!</h3>
                  <p className="text-center text-neutral-600">
                    Todas las cláusulas tienen documentación asociada.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {suggestionsData.suggestions.map((suggestion: any, index: number) => (
                    <div
                      key={suggestion.clauseId}
                      className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-medium text-purple-700">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="mb-2 flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-neutral-700">
                              {suggestion.clauseNumber}
                            </span>
                            <span className="text-sm font-medium text-neutral-900">
                              {suggestion.clauseTitle}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getPriorityColor(suggestion.suggestion.priority)}`}>
                              {getPriorityLabel(suggestion.suggestion.priority)} prioridad
                            </span>
                          </div>

                          <div className="mb-3 grid gap-2 md:grid-cols-2">
                            <div className="rounded bg-blue-50 p-3">
                              <div className="mb-1 flex items-center gap-1 text-sm font-medium text-blue-800">
                                <FileCheck className="h-4 w-4" />
                                Tipos de documentos sugeridos:
                              </div>
                              <ul className="space-y-1">
                                {suggestion.suggestion.documentTypes.map((type: string, i: number) => (
                                  <li key={i} className="text-sm text-blue-700">• {type}</li>
                                ))}
                              </ul>
                            </div>

                            <div className="rounded bg-amber-50 p-3">
                              <div className="mb-1 flex items-center gap-1 text-sm font-medium text-amber-800">
                                <Lightbulb className="h-4 w-4" />
                                Ejemplos:
                              </div>
                              <ul className="space-y-1">
                                {suggestion.suggestion.examples.map((example: string, i: number) => (
                                  <li key={i} className="text-sm text-amber-700">• {example}</li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-neutral-500">
                            <AlertCircle className="h-3 w-3" />
                            Archivo sugerido: {suggestion.suggestion.suggestedFileName}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-neutral-200 bg-neutral-50 px-6 py-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-neutral-600">
                  Estas sugerencias son generadas automáticamente por IA basándose en el contenido de cada cláusula.
                </p>
                <button
                  onClick={() => setShowSuggestions(false)}
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
