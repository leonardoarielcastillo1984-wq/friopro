'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch, getCsrfToken, tryRefreshToken } from '@/lib/api';
import type { DocumentRow, DocumentClauseMapping, NormativeClause } from '@/lib/types';
import ComboSelect from '@/components/ComboSelect';
import {
  FileText, ArrowLeft, Download, Edit3, CheckCircle2,
  Clock, AlertCircle, Link2, Trash2, Shield, Cpu, History, Upload,
  Plus, X, Search,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Borrador', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  EFFECTIVE: { label: 'Vigente', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  OBSOLETE: { label: 'Obsoleto', color: 'text-neutral-500', bg: 'bg-neutral-100 border-neutral-200' },
};

type DocumentDetail = DocumentRow & {
  content?: string | null;
  filePath?: string | null;
  fileUrl?: string | null;
  originalFileName?: string | null;
  fileSize?: number | null;
  standardTags?: string[] | null;
  aiSummary?: string | null;
  createdBy?: { id: string; email: string } | null;
  updatedBy?: { id: string; email: string } | null;
  department?: { id: string; name: string } | null;
  normatives?: { id: string; name: string; code: string }[] | null;
  normative?: { id: string; name: string; code: string } | null; // Mantener para compatibilidad
};

type AvailableClause = NormativeClause & { alreadyLinked?: boolean };

export default function DocumentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [mappings, setMappings] = useState<DocumentClauseMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editType, setEditType] = useState('');
  const [editDepartmentId, setEditDepartmentId] = useState('');
  const [editNormativeIds, setEditNormativeIds] = useState<string[]>([]);
  const [editNormativeId, setEditNormativeId] = useState(''); // Mantener para compatibilidad
  const [departments, setDepartments] = useState<{id: string; name: string}[]>([]);
  const [normatives, setNormatives] = useState<{id: string; name: string; code: string}[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [showNewVersion, setShowNewVersion] = useState(false);
  const [uploadingVersion, setUploadingVersion] = useState(false);
  const [aiSummary, setAiSummary] = useState<{summary: string; keyPoints: string[]; topics: string[]} | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [loadingClauses, setLoadingClauses] = useState(false);
  const [availableClauses, setAvailableClauses] = useState<AvailableClause[]>([]);
  const [searchClause, setSearchClause] = useState('');
  const [selectedClauses, setSelectedClauses] = useState<NormativeClause[]>([]);
  const [complianceType, setComplianceType] = useState<'CUMPLE' | 'REFERENCIA' | 'IMPLEMENTA' | 'NO_APLICA'>('CUMPLE');
  const [linkingNotes, setLinkingNotes] = useState('');
  const [linking, setLinking] = useState(false);

  const docTypeOptions = [
    { value: 'POLICY', label: 'Política' },
    { value: 'PROCEDURE', label: 'Procedimiento' },
    { value: 'INSTRUCTION', label: 'Instrucción' },
    { value: 'FORM', label: 'Formulario' },
    { value: 'RECORD', label: 'Registro' },
    { value: 'MANUAL', label: 'Manual' },
    { value: 'GUIDE', label: 'Guía' },
    { value: 'STANDARD', label: 'Estándar' },
    { value: 'REGULATION', label: 'Regulación' },
    { value: 'SPECIFICATION', label: 'Especificación' },
    { value: 'REPORT', label: 'Informe' },
    { value: 'PLAN', label: 'Plan' },
    { value: 'CONTRACT', label: 'Contrato' },
    { value: 'OTHER', label: 'Otro' }
  ];

  useEffect(() => {
    loadDocument();
  }, [id]);

  useEffect(() => {
    if (doc?.content && doc.content.length > 100) {
      loadAiSummary();
    }
  }, [doc?.id]);

  async function loadDocument() {
    setLoading(true);
    setError(null);
    try {
      const [docRes, mappingsRes] = await Promise.all([
        apiFetch<{ document: DocumentDetail; mappings?: DocumentClauseMapping[] }>(`/documents/${id}`),
        apiFetch<{ mappings: DocumentClauseMapping[] }>(`/documents/${id}/clause-mappings`).catch(() => ({ mappings: [] })),
      ]);
      setDoc(docRes.document);
      // Use mappings from the document response if available, otherwise use the separate call
      setMappings(docRes.mappings || mappingsRes.mappings || []);
      setEditTitle(docRes.document.title);
      setEditStatus(docRes.document.status);
      setEditType(docRes.document.type || '');
      setEditDepartmentId(docRes.document.department?.id || '');
      
      // Manejar múltiples normativas
      if (docRes.document.normatives && docRes.document.normatives.length > 0) {
        setEditNormativeIds(docRes.document.normatives.map(n => n.id));
        setEditNormativeId(docRes.document.normatives[0].id); // Para compatibilidad
      } else if (docRes.document.normative) {
        setEditNormativeIds([docRes.document.normative.id]);
        setEditNormativeId(docRes.document.normative.id);
      } else {
        setEditNormativeIds([]);
        setEditNormativeId('');
      }
      
      // Load departments and normatives for editing
      await loadDepartmentsAndNormatives();
    } catch (err: any) {
      setError(err?.message ?? 'Error al cargar documento');
      if (err?.message === 'Unauthorized') router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  async function loadAiSummary() {
    if (!doc?.content) return;
    setLoadingSummary(true);
    try {
      const res = await apiFetch<{summary: string; keyPoints: string[]; topics: string[]}>(`/documents/${id}/summary`);
      setAiSummary(res);
    } catch (err) {
      // Silently fail - summary is optional
    } finally {
      setLoadingSummary(false);
    }
  }

  async function loadDepartmentsAndNormatives() {
    try {
      const [deptsRes, normsRes] = await Promise.all([
        apiFetch<{ departments: {id: string; name: string}[] }>('/hr/departments').catch(() => ({ departments: [] })),
        apiFetch<{ normativos: {id: string; name: string; code: string}[] }>('/normativos').catch(() => ({ normativos: [] })),
      ]);
      setDepartments(deptsRes.departments);
      setNormatives(normsRes.normativos);
    } catch (err) {
      console.error('Error loading departments and normatives:', err);
    }
  }

  async function handleSave() {
    if (!editTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<{ document: DocumentDetail }>(`/documents/${id}`, {
        method: 'PATCH',
        json: { 
          title: editTitle.trim(), 
          status: editStatus,
          type: editType || doc?.type || 'PROCEDURE',
          departmentId: editDepartmentId || null,
          normativeIds: editNormativeIds.length > 0 ? editNormativeIds : null,
          normativeId: editNormativeIds.length > 0 ? editNormativeIds[0] : null, // Para compatibilidad
        },
      });
      setDoc(res.document);
      setEditing(false);
    } catch (err: any) {
      setError(err?.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload() {
    if (!doc) return;
    
    // Verificar si el documento tiene archivo
    if (!doc.filePath && !doc.fileUrl) {
      setError('Este documento no tiene archivo adjunto. Subí una nueva versión primero.');
      return;
    }
    
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiBase}/documents/${doc.id}/download`, {
        credentials: 'include',
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Get filename from Content-Disposition header or fallback
      const contentDisposition = res.headers.get('content-disposition');
      let filename = doc.originalFileName || `${doc.title}`;
      
      // If we have the original file path, use its extension
      if (doc.filePath) {
        const originalExt = doc.filePath.split('.').pop()?.toLowerCase();
        if (originalExt && ['docx', 'doc', 'xlsx', 'xls', 'pdf'].includes(originalExt)) {
          const baseName = doc.title.replace(/[^a-zA-Z0-9._-]/g, '_');
          filename = `${baseName}.${originalExt}`;
        }
      }
      
      // Fallback to Content-Disposition if available
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      setError('Error al descargar documento: ' + error.message);
    }
  }

  async function handleDelete() {
    if (!confirm('¿Estás seguro de eliminar este documento?')) return;
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = {};
      if (csrfToken) headers['x-csrf-token'] = csrfToken;
      
      const res = await fetch(`${apiBase}/documents/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.push('/documents');
    } catch (err: any) {
      setError(err?.message ?? 'Error al eliminar');
    }
  }

  async function loadVersions() {
    try {
      const res = await apiFetch<{ versions: any[] }>(`/documents/${id}/versions`);
      setVersions(res.versions);
      setShowVersions(true);
    } catch (err: any) {
      setError(err?.message ?? 'Error al cargar versiones');
    }
  }

  async function handleNewVersion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get('file') as File;
    
    if (!file) {
      setError('Por favor selecciona un archivo');
      return;
    }

    setUploadingVersion(true);
    setError(null);
    
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = {};
      if (csrfToken) headers['x-csrf-token'] = csrfToken;
      
      const res = await fetch(`${apiBase}/documents/${id}/versions`, {
        method: 'POST',
        body: uploadFormData,
        credentials: 'include',
        headers,
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText);
      }
      
      const result = await res.json();
      
      // Reload versions
      await loadVersions();
      
      // Update document info
      await loadDocument();
      
      setShowNewVersion(false);
      setUploadingVersion(false);
      
      // Reset form safely
      const formElement = event.currentTarget;
      if (formElement && formElement.reset) {
        formElement.reset();
      }
      
    } catch (err: any) {
      setError('Error al subir nueva versión: ' + err.message);
      setUploadingVersion(false);
    }
  }

  async function loadAvailableClauses() {
    setLoadingClauses(true);
    try {
      // Check if document has associated normatives (new format) or normative (old format)
      const normatives = doc?.normatives || [];
      const normative = doc?.normative;
      
      if ((!normatives || normatives.length === 0) && !normative) {
        console.log('❌ No normative associated with document');
        setAvailableClauses([]);
        return;
      }
      
      // Get all normative IDs (from new array format or old single format)
      const normativeIds = normatives.length > 0 
        ? normatives.map(n => n.id)
        : normative ? [normative.id] : [];
      
      console.log('📋 Loading clauses for normatives:', normativeIds);
      
      // Load clauses from all normatives
      const allClauses = [];
      for (const normativeId of normativeIds) {
        try {
          const res = await apiFetch<{ clauses: any[] }>(`/normativos/${normativeId}/clauses`);
          const currentNormative = normatives.find(n => n.id === normativeId) || normative;
          
          // Add normative info to each clause
          const clausesWithNormative = res.clauses.map(clause => ({
            ...clause,
            normative: currentNormative
          }));
          
          allClauses.push(...clausesWithNormative);
        } catch (error) {
          console.error(`Error loading clauses for normative ${normativeId}:`, error);
        }
      }
      
      console.log(`📋 Total clauses loaded: ${allClauses.length}`);
      
      // Show ALL clauses, including already mapped ones (marked as alreadyLinked)
      const mappedClauseIds = new Set(mappings.map(m => m.clause.id));
      const allClausesWithStatus = allClauses.map((clause: any) => ({
        ...clause,
        alreadyLinked: mappedClauseIds.has(clause.id)
      }));
      
      setAvailableClauses(allClausesWithStatus);
    } catch (err: any) {
      setError(err?.message ?? 'Error al cargar cláusulas');
    } finally {
      setLoadingClauses(false);
    }
  }

  async function handleLinkClauses() {
    if (selectedClauses.length === 0) {
      setError('Por favor selecciona al menos una cláusula');
      return;
    }
    
    setLinking(true);
    setError(null);
    
    try {
      console.log('🔗 Starting clause linking process');
      console.log('🔗 Document ID:', id);
      console.log('🔗 Selected clauses:', selectedClauses.length);
      console.log('🔗 Compliance type:', complianceType);
      
      // Try simplified fetch without authentication layer
      const linkPromises = selectedClauses.map(async (clause, index) => {
        const payload = {
          clauseId: clause.id,
          complianceType,
          notes: linkingNotes || null,
        };
        
        console.log(`🔗 Linking clause ${index + 1}/${selectedClauses.length}:`, clause.id);
        console.log(`🔗 Payload:`, payload);
        
        try {
          // Use apiFetch with credentials
          const result = await apiFetch<{ mapping: any }>(`/documents/${id}/clause-mappings`, {
            method: 'POST',
            json: payload,
          });
          
          console.log(`✅ Clause ${index + 1} linked successfully:`, result);
          return result;
        } catch (error: any) {
          console.error(`❌ Error linking clause ${index + 1}:`, error);
          throw error;
        }
      });
      
      const results = await Promise.all(linkPromises);
      console.log('✅ All clauses linked successfully:', results);
      
      // Refresh mappings
      await loadDocument();
      
      // Reset modal
      setShowLinkModal(false);
      setSelectedClauses([]);
      setComplianceType('CUMPLE');
      setLinkingNotes('');
      setSearchClause('');
    } catch (err: any) {
      console.error('❌ Error linking clause:', err);
      setError('Error al vincular cláusula: ' + err.message);
    } finally {
      setLinking(false);
    }
  }

  // Helper function to toggle clause selection
  function toggleClauseSelection(clause: NormativeClause) {
    setSelectedClauses(prev => {
      const isSelected = prev.some(c => c.id === clause.id);
      if (isSelected) {
        return prev.filter(c => c.id !== clause.id);
      } else {
        return [...prev, clause];
      }
    });
  }

  async function handleUnlinkClause(mappingId: string) {
    if (!confirm('¿Estás seguro de desvincular esta cláusula?')) return;
    
    try {
      console.log('🗑️ Unlinking clause mapping:', mappingId);
      
      // Direct fetch without apiFetch layer
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/documents/${id}/clause-mappings/${mappingId}`, {
        method: 'DELETE',
        headers: {
          'Origin': 'http://localhost:3000'
        }
      });
      
      console.log('🗑️ Delete response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('✅ Clause unlinked successfully:', result);
      
      // Refresh mappings
      await loadDocument();
    } catch (err: any) {
      console.error('❌ Error unlinking clause:', err);
      setError('Error al desvincular cláusula: ' + err.message);
    }
  }

  async function downloadVersion(versionId: string, fileName: string) {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiBase}/documents/${id}/versions/${versionId}/download`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Get filename from Content-Disposition header or fallback
      const contentDisposition = res.headers.get('content-disposition');
      let filename = fileName || `version-${versionId}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      setError('Error al descargar versión: ' + error.message);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error || 'Documento no encontrado'}</p>
        <button onClick={() => router.push('/documents')} className="mt-2 text-blue-600 text-sm hover:underline">
          ← Volver a documentos
        </button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.DRAFT;

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/documents')}
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Documentos
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            <Download className="h-4 w-4" /> Descargar
          </button>
          <button
            onClick={() => setEditing(!editing)}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            <Edit3 className="h-4 w-4" /> Editar
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" /> Eliminar
          </button>
          <button
            onClick={loadVersions}
            className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm text-purple-600 hover:bg-purple-50"
          >
            <History className="h-4 w-4" /> Versiones
          </button>
          <button
            onClick={() => setShowNewVersion(true)}
            className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-white px-3 py-2 text-sm text-green-600 hover:bg-green-50"
          >
            <Upload className="h-4 w-4" /> Nueva Versión
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-blue-50 p-3">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-4">
                <input
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-lg font-semibold focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Tipo de documento</label>
                    <ComboSelect
                      options={docTypeOptions}
                      value={editType}
                      onChange={setEditType}
                      placeholder="Seleccionar tipo..."
                      allowCustom={true}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Estado</label>
                    <select
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                    >
                      <option value="DRAFT">Borrador</option>
                      <option value="EFFECTIVE">Vigente</option>
                      <option value="OBSOLETE">Obsoleto</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Departamento</label>
                    <select
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                      value={editDepartmentId}
                      onChange={(e) => setEditDepartmentId(e.target.value)}
                    >
                      <option value="">Sin departamento</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Normativas aplicables</label>
                    <div className="space-y-2">
                      <div className="border border-neutral-300 rounded-lg p-3 max-h-40 overflow-y-auto">
                        {normatives.map((norm) => (
                          <label key={norm.id} className="flex items-center gap-2 cursor-pointer hover:bg-neutral-50 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={editNormativeIds.includes(norm.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditNormativeIds([...editNormativeIds, norm.id]);
                                } else {
                                  setEditNormativeIds(editNormativeIds.filter(id => id !== norm.id));
                                }
                                // Update compatibility field
                                if (e.target.checked && editNormativeIds.length === 0) {
                                  setEditNormativeId(norm.id);
                                } else if (!e.target.checked && editNormativeIds.includes(norm.id) && editNormativeIds.length === 1) {
                                  setEditNormativeId('');
                                }
                              }}
                              className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-neutral-700">{norm.code} - {norm.name}</span>
                          </label>
                        ))}
                        {normatives.length === 0 && (
                          <p className="text-sm text-neutral-500">No hay normativas disponibles</p>
                        )}
                      </div>
                      {editNormativeIds.length > 0 && (
                        <p className="text-xs text-neutral-500">
                          {editNormativeIds.length} {editNormativeIds.length === 1 ? 'normativa seleccionada' : 'normativas seleccionadas'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button onClick={() => setEditing(false)} className="text-sm text-neutral-500 hover:text-neutral-700">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-semibold text-neutral-900">{doc.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                    {doc.status === 'EFFECTIVE' && <CheckCircle2 className="h-3 w-3" />}
                    {doc.status === 'DRAFT' && <Clock className="h-3 w-3" />}
                    {statusCfg.label}
                  </span>
                  <span className="text-neutral-400">|</span>
                  <span className="text-neutral-500">Tipo: {doc.type}</span>
                  <span className="text-neutral-400">|</span>
                  <span className="text-neutral-500">Versión {doc.version}</span>
                  {doc.department && (
                    <>
                      <span className="text-neutral-400">|</span>
                      <span className="text-neutral-500">Dept: {doc.department.name}</span>
                    </>
                  )}
                  {doc.normative && (
                    <>
                      <span className="text-neutral-400">|</span>
                      <span className="text-neutral-500">Norma: {doc.normative.name}</span>
                    </>
                  )}
                  {doc.originalFileName && (
                    <>
                      <span className="text-neutral-400">|</span>
                      <span className="text-neutral-500 truncate max-w-[200px]">{doc.originalFileName}</span>
                    </>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-neutral-400">
                  <span>Creado: {new Date(doc.createdAt).toLocaleDateString('es-AR')}</span>
                  <span>Actualizado: {new Date(doc.updatedAt).toLocaleDateString('es-AR')}</span>
                  {doc.createdBy && <span>Por: {doc.createdBy.email}</span>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content and Mappings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Summary */}
          {(aiSummary || loadingSummary) && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="rounded-lg bg-blue-100 p-2">
                  <Cpu className="h-4 w-4 text-blue-600" />
                </div>
                <h2 className="font-semibold text-blue-900">Resumen con IA</h2>
                {loadingSummary && <span className="text-xs text-blue-500">(Generando...)</span>}
              </div>
              {aiSummary && (
                <>
                  <p className="text-sm text-blue-800 mb-3">{aiSummary.summary}</p>
                  {aiSummary.keyPoints?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-blue-700 mb-1">Puntos clave:</p>
                      <ul className="list-disc list-inside text-xs text-blue-600 space-y-0.5">
                        {aiSummary.keyPoints.map((point, i) => (
                          <li key={i}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiSummary.topics?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {aiSummary.topics.map((topic, i) => (
                        <span key={i} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Full Content */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-neutral-900">Contenido Completo</h2>
              {/* Direct File Link */}
              {doc.fileUrl && (
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Abrir documento
                </button>
              )}
            </div>
            {doc.content ? (
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 max-h-[500px] overflow-y-auto">
                {doc.content}
              </div>
            ) : (
              <div className="rounded-lg bg-neutral-50 p-8 text-center">
                <FileText className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                <p className="text-sm text-neutral-500">Sin contenido extraído</p>
                <p className="text-xs text-neutral-400 mt-1">
                  Subí un archivo PDF, DOCX o XLSX para extraer contenido automáticamente
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Clause Mappings */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-neutral-900 flex items-center gap-2">
              <Shield className="h-4 w-4 text-indigo-500" />
              Cláusulas vinculadas
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowLinkModal(true);
                  loadAvailableClauses();
                }}
                className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50"
              >
                <Plus className="h-3 w-3" /> Vincular
              </button>
              <span className="text-xs text-neutral-400">{mappings?.length || 0}</span>
            </div>
          </div>
          {mappings && mappings.length > 0 ? (
            <div className="space-y-2 max-h-[450px] overflow-y-auto">
              {mappings.map((m) => (
                <div key={m.id} className="rounded-lg border border-neutral-100 p-3 hover:bg-neutral-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                      <span className="font-mono text-xs text-neutral-500">{m.clause.clauseNumber}</span>
                      <span className="text-sm text-neutral-700 truncate">{m.clause.title}</span>
                    </div>
                    <button
                      onClick={() => handleUnlinkClause(m.id)}
                      className="text-neutral-400 hover:text-red-600 transition-colors"
                      title="Desvincular cláusula"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-indigo-600">{m.clause.normative.code} - {m.clause.normative.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      m.complianceType === 'CUMPLE' ? 'bg-green-100 text-green-700' :
                      m.complianceType === 'IMPLEMENTA' ? 'bg-blue-100 text-blue-700' :
                      m.complianceType === 'REFERENCIA' ? 'bg-purple-100 text-purple-700' :
                      'bg-neutral-100 text-neutral-500'
                    }`}>
                      {m.complianceType}
                    </span>
                  </div>
                  {m.notes && <p className="mt-1 text-xs text-neutral-400">{m.notes}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-neutral-50 p-6 text-center">
              <Link2 className="h-6 w-6 text-neutral-300 mx-auto mb-2" />
              <p className="text-sm text-neutral-500">Sin vínculos normativos</p>
              <p className="text-xs text-neutral-400 mt-1">
                Los vínculos se crean desde la vista de cláusulas normativas
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Versions Modal */}
      {showVersions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-neutral-200 p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">Historial de Versiones</h3>
              <button
                onClick={() => setShowVersions(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                ✕
              </button>
            </div>
            
            {versions && versions.length === 0 ? (
              <div className="text-center py-8">
                <History className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
                <p className="text-neutral-500">No hay versiones anteriores</p>
              </div>
            ) : (
              <div className="space-y-3">
                {versions.map((version) => (
                  <div key={version.id} className="border border-neutral-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-neutral-900">Versión {version.version}</h4>
                        <p className="text-sm text-neutral-500">{version.originalName}</p>
                        <p className="text-xs text-neutral-400">
                          Creada: {new Date(version.createdAt).toLocaleDateString('es-ES')}
                        </p>
                        <p className="text-xs text-neutral-400">
                          Por: {version.createdBy}
                        </p>
                      </div>
                      <button
                        onClick={() => downloadVersion(version.id, version.originalName)}
                        className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
                      >
                        <Download className="h-4 w-4" /> Descargar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Version Modal */}
      {showNewVersion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-neutral-200 p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">Nueva Versión</h3>
              <button
                onClick={() => setShowNewVersion(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleNewVersion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Archivo de la nueva versión
                </label>
                <input
                  type="file"
                  name="file"
                  accept=".pdf,.docx,.xlsx,.xls,.doc"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewVersion(false)}
                  className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploadingVersion}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploadingVersion ? 'Subiendo...' : 'Subir Versión'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Clause Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-neutral-200 p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">Vincular Cláusula Normativa</h3>
              <button
                onClick={() => setShowLinkModal(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Info Message */}
            {doc?.normative ? (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-blue-800">
                  <Shield className="h-4 w-4" />
                  <span>
                    Mostrando cláusulas de <strong>{doc.normative.code} - {doc.normative.name}</strong>
                  </span>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  Selecciona las cláusulas que cumple este documento
                </p>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-amber-800">
                  <AlertCircle className="h-4 w-4" />
                  <span>Este documento no tiene una norma asociada</span>
                </div>
                <p className="text-xs text-amber-600 mt-1">
                  Para vincular cláusulas, primero edita el documento y asígnale una norma normativa
                </p>
              </div>
            )}
            
            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Buscar cláusula por número o título..."
                  value={searchClause}
                  onChange={(e) => setSearchClause(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Clauses List */}
            <div className="mb-4 max-h-60 overflow-y-auto">
              {loadingClauses ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
                </div>
              ) : availableClauses && availableClauses.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
                  <p className="text-neutral-500">No hay cláusulas disponibles</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    No existen cláusulas para esta norma
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableClauses
                    .filter(c => 
                      c.clauseNumber.toLowerCase().includes(searchClause.toLowerCase()) ||
                      c.title.toLowerCase().includes(searchClause.toLowerCase()) ||
                      doc?.normative?.code?.toLowerCase().includes(searchClause.toLowerCase())
                    )
                    .map((clause) => {
                      const isSelected = selectedClauses.some(sc => sc.id === clause.id);
                      return (
                        <div
                          key={clause.id}
                          onClick={() => toggleClauseSelection(clause)}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-neutral-200 hover:bg-neutral-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-neutral-300 rounded"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="font-mono text-xs text-neutral-500">{clause.clauseNumber}</span>
                              <span className="text-sm text-neutral-700">{clause.title}</span>
                            </div>
                            {clause.alreadyLinked ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                Ya vinculada
                              </span>
                            ) : doc?.normative && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                Norma del documento
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-indigo-600">{doc?.normative?.code} - {doc?.normative?.name}</div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Compliance Type */}
            {selectedClauses && selectedClauses.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Tipo de cumplimiento
                </label>
                <select
                  value={complianceType}
                  onChange={(e) => setComplianceType(e.target.value as 'CUMPLE' | 'REFERENCIA' | 'IMPLEMENTA' | 'NO_APLICA')}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="CUMPLE">Cumple completamente</option>
                  <option value="IMPLEMENTA">Implementa parcialmente</option>
                  <option value="REFERENCIA">Referencia</option>
                </select>
              </div>
            )}

            {/* Notes */}
            {selectedClauses && selectedClauses.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Notas (opcional)
                </label>
                <textarea
                  value={linkingNotes}
                  onChange={(e) => setLinkingNotes(e.target.value)}
                  placeholder="Añade notas sobre cómo este documento cumple con las cláusulas seleccionadas..."
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                />
              </div>
            )}
            
            {/* Selected Count */}
            {selectedClauses && selectedClauses.length > 0 && (
              <div className="mb-4 p-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                <p className="text-sm text-indigo-700">
                  {selectedClauses.length} cláusula{selectedClauses.length > 1 ? 's' : ''} seleccionada{selectedClauses.length > 1 ? 's' : ''}
                </p>
              </div>
            )}
            
            {/* Actions */}
            <div className="flex items-center gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleLinkClauses}
                disabled={!selectedClauses || selectedClauses.length === 0 || linking}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {linking ? 'Vinculando...' : `Vincular ${selectedClauses?.length || 0} cláusula${selectedClauses?.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
