'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getCsrfToken } from '@/lib/api';
import type { DocumentRow } from '@/lib/types';
import ComboSelect from '@/components/ComboSelect';
import {
  FileText, Upload, Trash2, Search, Filter, ChevronDown,
  FileSpreadsheet, FileType, File, Clock, CheckCircle2, AlertCircle,
  Plus, X, Download, Edit3, FileCheck, FileX, Files
} from 'lucide-react';

const DOC_TYPES = [
  { value: 'PROCEDURE', label: 'Procedimiento', icon: FileText },
  { value: 'MANUAL', label: 'Manual', icon: FileType },
  { value: 'POLICY', label: 'Política', icon: File },
  { value: 'RECORD', label: 'Registro', icon: FileSpreadsheet },
  { value: 'PLAN', label: 'Plan', icon: FileText },
  { value: 'OTHER', label: 'Otro', icon: File },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Borrador', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  EFFECTIVE: { label: 'Vigente', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  OBSOLETE: { label: 'Obsoleto', color: 'text-neutral-500', bg: 'bg-neutral-100 border-neutral-200' },
};

export default function DocumentsPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterNormative, setFilterNormative] = useState('ALL');
  const [filterDepartment, setFilterDepartment] = useState('ALL');

  // Upload form
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState('PROCEDURE');
  const [uploadDepartmentId, setUploadDepartmentId] = useState('');
  const [uploadNormativeId, setUploadNormativeId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [departments, setDepartments] = useState<{id: string; name: string}[]>([]);
  const [normatives, setNormatives] = useState<{id: string; name: string; code: string}[]>([]);

  // Estado para tipos de documento personalizados
  const [docTypeOptions, setDocTypeOptions] = useState([
    { value: 'PROCEDURE', label: 'Procedimiento' },
    { value: 'MANUAL', label: 'Manual' },
    { value: 'POLICY', label: 'Política' },
    { value: 'RECORD', label: 'Registro' },
    { value: 'PLAN', label: 'Plan' },
    { value: 'OTHER', label: 'Otro' }
  ]);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [docToDelete, setDocToDelete] = useState<DocumentRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sorted = useMemo(() => {
    let filtered = [...docs].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(d => d.title.toLowerCase().includes(q));
    }
    if (filterType !== 'ALL') {
      filtered = filtered.filter(d => d.type === filterType);
    }
    if (filterNormative !== 'ALL') {
      filtered = filtered.filter(d => d.normativeId === filterNormative);
    }
    if (filterDepartment !== 'ALL') {
      filtered = filtered.filter(d => d.departmentId === filterDepartment);
    }
    return filtered;
  }, [docs, searchTerm, filterType, filterNormative, filterDepartment]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const [res, deptsRes, normsRes, storageRes] = await Promise.all([
        apiFetch<{ documents: DocumentRow[] }>('/documents').catch(() => ({ documents: [] })),
        apiFetch<{ departments: {id: string; name: string}[] }>('/hr/departments').catch(() => ({ departments: [] })),
        apiFetch<{ normativos: {id: string; name: string; code: string}[] }>('/normativos').catch(() => ({ normativos: [] })),
        fetch('http://localhost:3001/documents/list').then(r => r.json()).catch(() => ({ documents: [] })),
      ]);

      // Combinar documentos de BD con documentos reales del almacenamiento
      const storageDocuments = (storageRes.documents || []).map((doc: any) => ({
        id: doc.name,
        title: doc.name,
        type: 'OTHER',
        status: 'EFFECTIVE',
        createdAt: new Date(doc.createdAt),
        updatedAt: new Date(doc.createdAt),
        departmentId: null,
        normativeId: null,
        filePath: doc.path,
        isStorageFile: true,
      }));

      setDocs([...(res.documents ?? []), ...storageDocuments]);
      setDepartments(deptsRes.departments ?? []);
      setNormatives(normsRes.normativos ?? []);
    } catch (err: any) {
      const msg = err?.message ?? 'Error al cargar documentos';
      setError(msg);
      if (err?.message === 'Unauthorized') router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file && !uploadTitle) {
      setUploadTitle(file.name.replace(/\.(pdf|docx|xlsx|xls)$/i, ''));
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      return;
    }
    
    // Verificar que el formulario esté completo
    if (!uploadTitle.trim()) {
      setError('Por favor proporciona un título para el documento');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', uploadTitle || selectedFile.name.replace(/\.(pdf|docx|xlsx|xls)$/i, ''));
      formData.append('departmentId', uploadDepartmentId);
      formData.append('normativeId', uploadNormativeId);

      const apiBase = process.env.NEXT_PUBLIC_API_URL;
      if (!apiBase) throw new Error('NEXT_PUBLIC_API_URL is not set');

      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      const csrf = getCsrfToken();
      if (csrf) headers['x-csrf-token'] = csrf;

      const res = await fetch(`${apiBase}/documents/upload`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      setSuccess(`Documento "${data.document.title}" subido correctamente — ${data.extractedChars.toLocaleString()} caracteres extraídos`);
      setShowUpload(false);
      setUploadTitle('');
      setUploadType('PROCEDURE');
      setUploadDepartmentId('');
      setUploadNormativeId('');
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Error al subir documento');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string) {
    try {
      setDeleting(true);
      await apiFetch(`/documents/${docId}`, { method: 'DELETE' });
      setDocs(docs.filter(d => d.id !== docId));
      setShowDeleteModal(false);
      setDocToDelete(null);
    } catch (err: any) {
      alert('Error al eliminar: ' + (err?.message || 'Error desconocido'));
    } finally {
      setDeleting(false);
    }
  }

  function openDeleteModal(doc: DocumentRow) {
    setDocToDelete(doc);
    setShowDeleteModal(true);
  }

  function getFileIcon(type: string) {
    const found = DOC_TYPES.find(t => t.value === type);
    const Icon = found?.icon ?? FileText;
    return <Icon className="h-5 w-5 text-brand-600" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Documentos</h1>
          <p className="mt-1 text-sm text-neutral-500">Gestión documental del sistema integrado</p>
        </div>
        <button
          onClick={() => { setShowUpload(!showUpload); setError(null); setSuccess(null); }}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
        >
          {showUpload ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showUpload ? 'Cancelar' : 'Subir documento'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2"><Files className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-sm text-neutral-500">Total Documentos</p>
              <p className="text-2xl font-bold text-neutral-900">{docs.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-50 p-2"><FileCheck className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="text-sm text-neutral-500">Vigentes</p>
              <p className="text-2xl font-bold text-neutral-900">{docs.filter(d => d.status === 'EFFECTIVE').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 p-2"><File className="h-5 w-5 text-amber-600" /></div>
            <div>
              <p className="text-sm text-neutral-500">Borradores</p>
              <p className="text-2xl font-bold text-neutral-900">{docs.filter(d => d.status === 'DRAFT').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-50 p-2"><FileX className="h-5 w-5 text-red-600" /></div>
            <div>
              <p className="text-sm text-neutral-500">Obsoletos</p>
              <p className="text-2xl font-bold text-neutral-900">{docs.filter(d => d.status === 'OBSOLETE').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Form */}
      {showUpload && (
        <form onSubmit={handleUpload} className="rounded-xl border border-brand-200 bg-brand-50/30 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-lg bg-brand-100 p-2"><Upload className="h-5 w-5 text-brand-600" /></div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Subir documento</h2>
              <p className="text-sm text-neutral-500">PDF, Word (.docx) o Excel (.xlsx) — se extrae el texto automáticamente</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Título</label>
              <input
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                placeholder="Se usa el nombre del archivo si está vacío"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
              />
            </div>
            <div>
              <ComboSelect
                label="Tipo de documento"
                options={docTypeOptions}
                value={uploadType}
                onChange={setUploadType}
                onAddCustom={(newOption) => {
                  const optionValue = typeof newOption === 'string' ? newOption : newOption.value;
                  const optionLabel = typeof newOption === 'string' ? newOption : newOption.label;
                  setDocTypeOptions([...docTypeOptions, { value: optionValue, label: optionLabel }]);
                  setUploadType(optionValue);
                }}
                allowCustom={true}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Departamento</label>
              <select
                value={uploadDepartmentId}
                onChange={(e) => setUploadDepartmentId(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              >
                <option value="">Sin departamento</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Normativa aplicable</label>
              <select
                value={uploadNormativeId}
                onChange={(e) => setUploadNormativeId(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              >
                <option value="">Sin normativa</option>
                {normatives.map((n) => (
                  <option key={n.id} value={n.id}>{n.code} - {n.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-neutral-700 mb-1">Archivo</label>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.xlsx,.xls" onChange={handleFileChange} className="block w-full text-sm text-neutral-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700 file:cursor-pointer" required />
          </div>
          <button
            type="submit"
            disabled={uploading || !selectedFile}
            className="mt-4 flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Subiendo y extrayendo texto...' : 'Subir documento'}
          </button>
        </form>
      )}

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar documentos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 bg-white pl-10 pr-4 py-2.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
          />
        </div>
        <select
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 outline-none"
        >
          <option value="ALL">Todos los deptos</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select
          value={filterNormative}
          onChange={(e) => setFilterNormative(e.target.value)}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 outline-none"
        >
          <option value="ALL">Todas las normas</option>
          {normatives.map((n) => (
            <option key={n.id} value={n.id}>{n.name}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 outline-none"
        >
          <option value="ALL">Todos los tipos</option>
          {DOC_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Document List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-neutral-200 bg-white p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-neutral-300" />
          <h3 className="mt-4 text-lg font-medium text-neutral-900">
            {docs.length === 0 ? 'Sin documentos' : 'Sin resultados'}
          </h3>
          <p className="mt-1 text-sm text-neutral-500">
            {docs.length === 0
              ? 'Subí un archivo PDF, Word o Excel para comenzar.'
              : 'Probá con otros filtros o términos de búsqueda.'}
          </p>
          {docs.length === 0 && (
            <button
              onClick={() => setShowUpload(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Upload className="h-4 w-4" /> Subir primer documento
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">Documento</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">Versión</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">Actualizado</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sorted.map((d) => {
                const status = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.DRAFT;
                const typeLabel = DOC_TYPES.find(t => t.value === d.type)?.label ?? d.type;
                return (
                  <tr key={d.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => router.push(`/documents/${d.id}`)}
                        className="flex items-center gap-3 hover:underline text-left"
                      >
                        {getFileIcon(d.type)}
                        <span className="font-medium text-sm text-neutral-900">{d.title}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{typeLabel}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.bg} ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{d.version || '1.0'}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(d.updatedAt).toLocaleDateString('es-AR')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => router.push(`/documents/${d.id}`)}
                          className="text-brand-600 hover:text-brand-700 text-sm font-medium p-1 rounded hover:bg-brand-50"
                          title="Ver detalle"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/documents/${d.id}`); }}
                          className="text-amber-600 hover:text-amber-700 text-sm font-medium p-1 rounded hover:bg-amber-50"
                          title="Editar"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openDeleteModal(d); }}
                          className="text-red-600 hover:text-red-700 text-sm font-medium p-1 rounded hover:bg-red-50"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-red-100 p-2">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900">¿Eliminar documento?</h3>
            </div>
            <p className="text-sm text-neutral-600 mb-6">
              Estás por eliminar <strong>"{docToDelete.title}"</strong>. Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setDocToDelete(null); }}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(docToDelete.id)}
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
