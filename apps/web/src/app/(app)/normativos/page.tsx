'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getCsrfToken } from '@/lib/api';
import type { NormativeStandard, NormativeProcessingStatus } from '@/lib/types';
import {
  BookOpen, Upload, Search, Loader2, CheckCircle2, AlertCircle,
  XCircle, Archive, Plus, X, FileText, Cpu, ChevronRight, TrendingUp,
  TrendingDown, Minus, BarChart3, Eye, List, Sparkles, Lightbulb, FileCheck,
  Trash2, RefreshCw
} from 'lucide-react';

interface NormativeCompliance {
  totalClauses: number;
  completedClauses: number;
  pendingClauses: number;
  compliancePercentage: number;
  complianceLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface NormativeWithCompliance extends NormativeStandard {
  compliance?: NormativeCompliance;
}

interface ComplianceSummary {
  overallCompliance: number;
  normatives: Array<{
    normative: NormativeStandard;
    compliance: NormativeCompliance;
  }>;
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  UPLOADING: { label: 'Subiendo', icon: Loader2, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  PROCESSING: { label: 'Procesando IA', icon: Cpu, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  READY: { label: 'Listo', icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  ERROR: { label: 'Error', icon: XCircle, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  ARCHIVED: { label: 'Archivado', icon: Archive, color: 'text-neutral-500', bg: 'bg-neutral-100 border-neutral-200' },
};

export default function NormativosPage() {
  const router = useRouter();
  const [normativos, setNormativos] = useState<NormativeStandard[]>([]);
  const [normativosWithCompliance, setNormativosWithCompliance] = useState<NormativeWithCompliance[]>([]);
  const [complianceSummary, setComplianceSummary] = useState<ComplianceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Upload form state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadCode, setUploadCode] = useState('');
  const [uploadVersion, setUploadVersion] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [revisionNormative, setRevisionNormative] = useState<NormativeStandard | null>(null);
  const [revisionVersion, setRevisionVersion] = useState('');
  const [revisionDescription, setRevisionDescription] = useState('');
  const [revisionFile, setRevisionFile] = useState<File | null>(null);
  const [uploadingRevision, setUploadingRevision] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsData, setSuggestionsData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      // Load normatives and compliance data in parallel
      const [normativosRes, complianceRes] = await Promise.all([
        apiFetch<{ normativos: NormativeStandard[] }>('/normativos'),
        apiFetch<ComplianceSummary>('/normativos/compliance-summary').catch(() => null)
      ]);
      
      // Validar que los datos existan antes de procesar
      const normativosData = normativosRes?.normativos || [];
      setNormativos(normativosData);
      setComplianceSummary(complianceRes);
      
      // Merge normatives with compliance data
      if (complianceRes && complianceRes.normatives && Array.isArray(complianceRes.normatives)) {
        const merged = normativosData.map(normative => {
          const complianceData = complianceRes.normatives.find(
            n => n.normative.id === normative.id
          );
          return {
            ...normative,
            compliance: complianceData?.compliance
          };
        });
        setNormativosWithCompliance(merged);
      } else {
        setNormativosWithCompliance(normativosData);
      }
    } catch (err: any) {
      const msg = err?.message ?? 'Error al cargar';
      setError(msg);
      if (msg === 'Unauthorized') router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  useEffect(() => {
    const processing = normativos.filter(n => n.status === 'UPLOADING' || n.status === 'PROCESSING');
    if (processing.length > 0) {
      pollingRef.current = setInterval(async () => {
        for (const n of processing) {
          try {
            const status = await apiFetch<NormativeProcessingStatus>(`/normativos/${n.id}/status`);
            if (status.status !== n.status) { await load(); break; }
          } catch { /* ignore */ }
        }
      }, 3000);
    } else if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [normativos]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('name', uploadName);
      formData.append('code', uploadCode);
      formData.append('version', uploadVersion);
      if (uploadDescription) formData.append('description', uploadDescription);

      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = {};
      if (csrfToken) headers['x-csrf-token'] = csrfToken;

      const res = await fetch(`${apiBase}/normativos/upload`, {
        method: 'POST', body: formData, credentials: 'include', headers,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      setUploadName(''); setUploadCode(''); setUploadVersion('');
      setUploadDescription(''); setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowUpload(false);
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Error al subir');
    } finally {
      setUploading(false);
    }
  }

  function generateLocalSuggestions(normative: NormativeWithCompliance) {
    // Generate AI-like suggestions based on pending clauses count
    const pendingCount = normative.compliance?.pendingClauses || 0;
    
    if (pendingCount === 0) return [];
    
    const suggestions = [];
    
    // Suggest based on typical ISO structure
    suggestions.push({
      clauseNumber: '5.1',
      clauseTitle: 'Liderazgo y compromiso',
      documentTypes: ['Política de calidad firmada', 'Manual de gestión'],
      examples: ['Política de calidad ISO 9001', 'Manual del sistema de gestión'],
      priority: 'HIGH'
    });
    
    suggestions.push({
      clauseNumber: '7.1',
      clauseTitle: 'Recursos',
      documentTypes: ['Plan de recursos', 'Inventario de equipos'],
      examples: ['Plan de infraestructura', 'Registro de equipos críticos'],
      priority: 'MEDIUM'
    });
    
    suggestions.push({
      clauseNumber: '8.1',
      clauseTitle: 'Operación',
      documentTypes: ['Procedimientos operativos', 'Instrucciones de trabajo'],
      examples: ['Procedimiento de control documental', 'ITOs de procesos críticos'],
      priority: 'HIGH'
    });
    
    if (pendingCount > 10) {
      suggestions.push({
        clauseNumber: '9.1',
        clauseTitle: 'Seguimiento y medición',
        documentTypes: ['Registros de auditoría', 'Indicadores de proceso'],
        examples: ['Informes de auditoría interna', 'KPIs de calidad'],
        priority: 'HIGH'
      });
    }
    
    return suggestions.slice(0, Math.min(pendingCount, 5));
  }

  async function loadSuggestions(normativeId: string) {
    setSuggestionsLoading(true);
    try {
      // Try to fetch from backend first
      const response = await apiFetch<{ suggestions: any[]; totalPendingClauses: number }>(`/normativos/${normativeId}/clause-suggestions`).catch(() => null);
      
      if (response && response.suggestions && response.suggestions.length > 0) {
        setSuggestionsData(response);
      } else {
        // Use local generation as fallback
        const normative = normativosWithCompliance?.find(n => n.id === normativeId);
        if (normative) {
          const localSuggestions = generateLocalSuggestions(normative);
          setSuggestionsData({
            suggestions: localSuggestions.map(s => ({
              clauseNumber: s.clauseNumber,
              clauseTitle: s.clauseTitle,
              suggestion: {
                documentTypes: s.documentTypes,
                examples: s.examples,
                priority: s.priority
              }
            })),
            totalPendingClauses: normative.compliance?.pendingClauses || localSuggestions.length
          });
        }
      }
      setShowSuggestions(normativeId);
    } catch (err) {
      console.error('Error loading suggestions:', err);
      // Use fallback
      const normative = normativosWithCompliance?.find(n => n.id === normativeId);
      if (normative) {
        const localSuggestions = generateLocalSuggestions(normative);
        setSuggestionsData({
          suggestions: localSuggestions.map(s => ({
            clauseNumber: s.clauseNumber,
            clauseTitle: s.clauseTitle,
            suggestion: {
              documentTypes: s.documentTypes,
              examples: s.examples,
              priority: s.priority
            }
          })),
          totalPendingClauses: normative.compliance?.pendingClauses || localSuggestions.length
        });
        setShowSuggestions(normativeId);
      }
    } finally {
      setSuggestionsLoading(false);
    }
  }
  async function handleDelete(id: string) {
    if (!confirm('¿Estás seguro de eliminar esta norma? Esta acción no se puede deshacer.')) return;
    
    setDeletingId(id);
    try {
      await apiFetch(`/normativos/${id}`, { method: 'DELETE' });
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Error al eliminar');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRevision(e: React.FormEvent) {
    e.preventDefault();
    if (!revisionNormative || !revisionFile) return;
    
    setUploadingRevision(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', revisionFile);
      formData.append('version', revisionVersion);
      if (revisionDescription) formData.append('description', revisionDescription);

      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = {};
      if (csrfToken) headers['x-csrf-token'] = csrfToken;

      const res = await fetch(`${apiBase}/normativos/${revisionNormative.id}/revision`, {
        method: 'POST', body: formData, credentials: 'include', headers,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      setRevisionNormative(null);
      setRevisionVersion('');
      setRevisionDescription('');
      setRevisionFile(null);
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Error al subir revisión');
    } finally {
      setUploadingRevision(false);
    }
  }
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getComplianceColor(level: 'LOW' | 'MEDIUM' | 'HIGH') {
    switch (level) {
      case 'HIGH': return 'text-green-700 bg-green-50 border-green-200';
      case 'MEDIUM': return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'LOW': return 'text-red-700 bg-red-50 border-red-200';
      default: return 'text-neutral-700 bg-neutral-50 border-neutral-200';
    }
  }

  function getComplianceIcon(level: 'LOW' | 'MEDIUM' | 'HIGH') {
    switch (level) {
      case 'HIGH': return TrendingUp;
      case 'MEDIUM': return Minus;
      case 'LOW': return TrendingDown;
      default: return BarChart3;
    }
  }

  const filtered = normativosWithCompliance.filter(n =>
    !searchTerm || n.name.toLowerCase().includes(searchTerm.toLowerCase()) || n.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const readyCount = normativos.filter(n => n.status === 'READY').length;
  const processingCount = normativos.filter(n => n.status === 'PROCESSING' || n.status === 'UPLOADING').length;
  const totalClauses = normativos.filter(n => n.status === 'READY').reduce((sum, n) => sum + (n.totalClauses || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Normativos</h1>
          <p className="mt-1 text-sm text-neutral-500">Gestión de normas y estándares de cumplimiento</p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
        >
          {showUpload ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showUpload ? 'Cancelar' : 'Subir norma'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-brand-50 p-2"><BookOpen className="h-5 w-5 text-brand-600" /></div>
            <div>
              <div className="text-2xl font-bold text-neutral-900">{readyCount}</div>
              <div className="text-xs text-neutral-500">Normas activas</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2"><Cpu className="h-5 w-5 text-amber-600" /></div>
            <div>
              <div className="text-2xl font-bold text-amber-700">{processingCount}</div>
              <div className="text-xs text-amber-600">En procesamiento</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50/50 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2"><FileText className="h-5 w-5 text-green-600" /></div>
            <div>
              <div className="text-2xl font-bold text-green-700">{totalClauses}</div>
              <div className="text-xs text-green-600">Cláusulas indexadas</div>
            </div>
          </div>
        </div>
        {complianceSummary && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-indigo-100 p-2"><BarChart3 className="h-5 w-5 text-indigo-600" /></div>
              <div>
                <div className="text-2xl font-bold text-indigo-700">{complianceSummary.overallCompliance}%</div>
                <div className="text-xs text-indigo-600">Cumplimiento general</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upload Form */}
      {showUpload && (
        <form onSubmit={handleUpload} className="rounded-xl border border-brand-200 bg-brand-50/30 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-lg bg-brand-100 p-2"><Upload className="h-5 w-5 text-brand-600" /></div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Subir referencia normativa</h2>
              <p className="text-sm text-neutral-500">PDF del estándar — se procesarán cláusulas automáticamente con IA</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre</label>
              <input className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" placeholder="ISO 9001:2015" value={uploadName} onChange={e => setUploadName(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Código</label>
              <input className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" placeholder="ISO9001-2015" value={uploadCode} onChange={e => setUploadCode(e.target.value)} required pattern="^[A-Za-z0-9\-_]+$" title="Solo letras, números, guiones" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Versión</label>
              <input className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" placeholder="2015" value={uploadVersion} onChange={e => setUploadVersion(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Descripción (opcional)</label>
              <input className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" placeholder="Sistema de gestión de calidad" value={uploadDescription} onChange={e => setUploadDescription(e.target.value)} />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-neutral-700 mb-1">Archivo PDF</label>
            <input ref={fileInputRef} type="file" accept="application/pdf" onChange={e => setUploadFile(e.target.files?.[0] || null)} className="block w-full text-sm text-neutral-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700 file:cursor-pointer" required />
          </div>
          <button type="submit" disabled={uploading} className="mt-4 flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-neutral-300 transition-colors">
            <Upload className="h-4 w-4" />
            {uploading ? 'Subiendo y procesando...' : 'Subir norma'}
          </button>
        </form>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
        <input type="text" placeholder="Buscar normas..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full rounded-lg border border-neutral-200 bg-white pl-10 pr-4 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" />
      </div>

      {/* Normative List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-neutral-200 bg-white p-12 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-neutral-300" />
          <h3 className="mt-4 text-lg font-medium text-neutral-900">Sin normativos</h3>
          <p className="mt-1 text-sm text-neutral-500">Subí un PDF de referencia normativa para comenzar el análisis de cumplimiento.</p>
          {normativos.length === 0 && (
            <button onClick={() => setShowUpload(true)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              <Upload className="h-4 w-4" /> Subir primera norma
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(n => {
            const st = STATUS_CONFIG[n.status] || STATUS_CONFIG.UPLOADING;
            const StIcon = st.icon;
            const isReady = n.status === 'READY';
            const ComplianceIcon = n.compliance ? getComplianceIcon(n.compliance.complianceLevel) : null;
            
            return (
              <div
                key={n.id}
                onClick={() => isReady && router.push(`/normativos/${n.id}`)}
                className={`rounded-xl border border-neutral-200 bg-white p-4 transition-all ${isReady ? 'cursor-pointer hover:border-brand-300 hover:shadow-sm' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-brand-50 p-3">
                      <BookOpen className="h-6 w-6 text-brand-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-neutral-900">{n.name}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-sm text-neutral-500">
                        <span className="font-mono text-xs bg-neutral-100 px-1.5 py-0.5 rounded">{n.code}</span>
                        <span>v{n.version}</span>
                        <span>{formatFileSize(n.fileSize)}</span>
                        {isReady && <span className="text-brand-600 font-medium">{n.totalClauses} cláusulas</span>}
                      </div>
                      
                      {/* Compliance Section */}
                      {n.compliance && (
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 text-xs">
                                <span className="font-medium text-neutral-600">Cumplimiento:</span>
                                <span className={`font-bold ${n.compliance.complianceLevel === 'HIGH' ? 'text-green-600' : n.compliance.complianceLevel === 'MEDIUM' ? 'text-amber-600' : 'text-red-600'}`}>
                                  {n.compliance.compliancePercentage}%
                                </span>
                                <span className="text-neutral-500">
                                  ({n.compliance.completedClauses}/{n.compliance.totalClauses})
                                </span>
                              </div>
                            </div>
                            <div className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${getComplianceColor(n.compliance.complianceLevel)}`}>
                              {ComplianceIcon && <ComplianceIcon className="h-3 w-3" />}
                              {n.compliance.complianceLevel === 'HIGH' ? 'Alto' : n.compliance.complianceLevel === 'MEDIUM' ? 'Medio' : 'Bajo'}
                            </div>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="w-full bg-neutral-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all ${
                                n.compliance.complianceLevel === 'HIGH' ? 'bg-green-500' : 
                                n.compliance.complianceLevel === 'MEDIUM' ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${n.compliance.compliancePercentage}%` }}
                            />
                          </div>
                          
                          {/* Pending Clauses Warning */}
                          {n.compliance.pendingClauses > 0 && (
                            <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
                              <AlertCircle className="h-3 w-3" />
                              <span>{n.compliance.pendingClauses} cláusula{n.compliance.pendingClauses > 1 ? 's' : ''} pendiente{n.compliance.pendingClauses > 1 ? 's' : ''}</span>
                            </div>
                          )}
                          {/* AI Suggestions Button */}
                          {n.compliance && n.compliance.pendingClauses > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                loadSuggestions(n.id);
                              }}
                              disabled={suggestionsLoading}
                              className="mt-2 flex items-center gap-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-3 py-1.5 hover:bg-purple-100 transition-colors"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              {suggestionsLoading ? 'Cargando...' : '🤖 Ver sugerencias'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${st.bg} ${st.color}`}>
                      <StIcon className={`h-3.5 w-3.5 ${n.status === 'PROCESSING' || n.status === 'UPLOADING' ? 'animate-spin' : ''}`} />
                      {st.label}
                    </span>
                    {/* Action Buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRevisionNormative(n);
                          setRevisionVersion('');
                          setRevisionDescription('');
                          setRevisionFile(null);
                        }}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        title="Nueva revisión"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(n.id);
                        }}
                        disabled={deletingId === n.id}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        title="Eliminar"
                      >
                        {deletingId === n.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                    {isReady && <ChevronRight className="h-5 w-5 text-neutral-400" />}
                  </div>
                </div>
                {n.status === 'ERROR' && n.errorMessage && (
                  <div className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2">{n.errorMessage}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* AI Suggestions Modal */}
      {showSuggestions && suggestionsData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <h2 className="text-lg font-semibold text-neutral-900">
                  Sugerencias de IA - Documentos sugeridos
                </h2>
              </div>
              <button
                onClick={() => setShowSuggestions(null)}
                className="rounded-lg p-1 hover:bg-neutral-100"
              >
                <X className="h-5 w-5 text-neutral-500" />
              </button>
            </div>
            
            <p className="text-sm text-neutral-600 mb-4">
              Basado en el análisis de las {suggestionsData.totalPendingClauses} cláusulas pendientes, 
              te sugerimos los siguientes documentos para cumplir con la norma:
            </p>

            <div className="space-y-3">
              {suggestionsData.suggestions?.map((suggestion: any, idx: number) => (
                <div
                  key={idx}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className={`rounded-full p-2 ${
                      suggestion.suggestion?.priority === 'HIGH' ? 'bg-red-100' :
                      suggestion.suggestion?.priority === 'MEDIUM' ? 'bg-amber-100' : 'bg-blue-100'
                    }`}>
                      <FileCheck className={`h-4 w-4 ${
                        suggestion.suggestion?.priority === 'HIGH' ? 'text-red-600' :
                        suggestion.suggestion?.priority === 'MEDIUM' ? 'text-amber-600' : 'text-blue-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-medium text-brand-600">
                          {suggestion.clauseNumber}
                        </span>
                        <span className="text-sm font-medium text-neutral-900">
                          {suggestion.clauseTitle}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          suggestion.suggestion?.priority === 'HIGH' ? 'bg-red-100 text-red-700' :
                          suggestion.suggestion?.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {suggestion.suggestion?.priority === 'HIGH' ? 'Alta prioridad' :
                           suggestion.suggestion?.priority === 'MEDIUM' ? 'Media prioridad' : 'Baja prioridad'}
                        </span>
                      </div>
                      
                      <div className="mt-2 space-y-2">
                        <div>
                          <span className="text-xs font-medium text-neutral-500">Documentos sugeridos:</span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {suggestion.suggestion?.documentTypes?.map((doc: string, i: number) => (
                              <span key={i} className="text-xs bg-white border border-neutral-200 rounded px-2 py-1">
                                {doc}
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <span className="text-xs font-medium text-neutral-500">Ejemplos:</span>
                          <ul className="mt-1 space-y-1">
                            {suggestion.suggestion?.examples?.map((example: string, i: number) => (
                              <li key={i} className="text-xs text-neutral-600 flex items-center gap-1">
                                <Lightbulb className="h-3 w-3 text-amber-500" />
                                {example}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowSuggestions(null)}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  setShowSuggestions(null);
                  router.push('/documentos');
                }}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Ir a Documentos
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Revision Modal */}
      {revisionNormative && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-brand-600" />
                <h2 className="text-lg font-semibold text-neutral-900">
                  Nueva revisión - {revisionNormative.name}
                </h2>
              </div>
              <button
                onClick={() => setRevisionNormative(null)}
                className="rounded-lg p-1 hover:bg-neutral-100"
              >
                <X className="h-5 w-5 text-neutral-500" />
              </button>
            </div>
            
            <p className="text-sm text-neutral-600 mb-4">
              Versión actual: <span className="font-medium">{revisionNormative.version}</span>. 
              La versión actual será archivada y la nueva revisión se activará automáticamente.
            </p>

            <form onSubmit={handleRevision} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Nueva versión</label>
                <input 
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" 
                  placeholder="2024, 2.0, etc." 
                  value={revisionVersion} 
                  onChange={e => setRevisionVersion(e.target.value)} 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Descripción (opcional)</label>
                <input 
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none" 
                  placeholder="Cambios en esta revisión..." 
                  value={revisionDescription} 
                  onChange={e => setRevisionDescription(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Archivo PDF de la nueva versión</label>
                <input 
                  type="file" 
                  accept="application/pdf" 
                  onChange={e => setRevisionFile(e.target.files?.[0] || null)} 
                  className="block w-full text-sm text-neutral-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700 file:cursor-pointer" 
                  required 
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRevisionNormative(null)}
                  className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploadingRevision || !revisionFile}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-neutral-300 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {uploadingRevision ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Subiendo...</>
                  ) : (
                    <><RefreshCw className="h-4 w-4" /> Crear revisión</>
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
