'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { ChevronLeft, Plus, Users, Award, Mail, Phone, Building2, Save, X } from 'lucide-react';

type Auditor = {
  id: string;
  type: 'INTERNAL' | 'EXTERNAL';
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  normativeCompetencies: string[];
  isActive: boolean;
  employeeId: string | null;
  createdAt: string;
  documents?: AuditorDocument[];
};

type AuditorDocument = {
  id: string;
  title: string;
  description?: string;
  filePath: string;
  fileSize?: number;
  issueDate?: string;
  expiryDate?: string;
  issuer?: string;
  createdAt: string;
};

const COMPETENCY_OPTIONS = [
  { value: 'ISO_9001', label: 'ISO 9001', color: 'bg-blue-100 text-blue-800' },
  { value: 'ISO_14001', label: 'ISO 14001', color: 'bg-green-100 text-green-800' },
  { value: 'ISO_45001', label: 'ISO 45001', color: 'bg-orange-100 text-orange-800' },
  { value: 'ISO_39001', label: 'ISO 39001', color: 'bg-purple-100 text-purple-800' },
  { value: 'IATF_16949', label: 'IATF 16949', color: 'bg-red-100 text-red-800' },
  { value: 'ISO_27001', label: 'ISO 27001', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'ISO_50001', label: 'ISO 50001', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'CUSTOM', label: 'Otras', color: 'bg-gray-100 text-gray-800' },
];

export default function AuditorsPage() {
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAuditor, setEditingAuditor] = useState<Auditor | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyAuditor, setHistoryAuditor] = useState<Auditor | null>(null);
  const [auditorDocuments, setAuditorDocuments] = useState<AuditorDocument[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'INTERNAL' | 'EXTERNAL'>('ALL');

  const [newAuditor, setNewAuditor] = useState({
    type: 'INTERNAL',
    name: '',
    email: '',
    phone: '',
    company: '',
    employeeId: '',
    normativeCompetencies: [] as string[],
  });

  useEffect(() => {
    loadAuditors();
  }, []);

  async function loadAuditors() {
    try {
      setLoading(true);
      const res = await apiFetch('/audit/auditors') as { auditors: Auditor[] };
      if (res.auditors) {
        setAuditors(res.auditors);
      }
    } catch (err) {
      console.error('Error loading auditors:', err);
    } finally {
      setLoading(false);
    }
  }

  async function createAuditor(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);

      const payload = {
        ...newAuditor,
        phone: newAuditor.phone?.trim() ? newAuditor.phone.trim() : undefined,
        company: newAuditor.company?.trim() ? newAuditor.company.trim() : undefined,
        employeeId: newAuditor.employeeId?.trim() ? newAuditor.employeeId.trim() : undefined,
      };

      const res = await apiFetch('/audit/auditors', {
        method: 'POST',
        json: payload,
      }) as { auditor: Auditor };

      if (res.auditor) {
        setAuditors([...auditors, res.auditor]);
        setShowCreateModal(false);
        setNewAuditor({
          type: 'INTERNAL',
          name: '',
          email: '',
          phone: '',
          company: '',
          employeeId: '',
          normativeCompetencies: [],
        });
      }
    } catch (err) {
      console.error('Error creating auditor:', err);
    } finally {
      setSaving(false);
    }
  }

  function toggleCompetency(value: string) {
    setNewAuditor(prev => ({
      ...prev,
      normativeCompetencies: prev.normativeCompetencies.includes(value)
        ? prev.normativeCompetencies.filter(c => c !== value)
        : [...prev.normativeCompetencies, value],
    }));
  }

  function toggleEditCompetency(value: string) {
    if (!editingAuditor) return;
    setEditingAuditor(prev => ({
      ...prev!,
      normativeCompetencies: prev!.normativeCompetencies.includes(value)
        ? prev!.normativeCompetencies.filter(c => c !== value)
        : [...prev!.normativeCompetencies, value],
    }));
  }

  function openEditModal(auditor: Auditor) {
    setEditingAuditor({ ...auditor });
    setShowEditModal(true);
  }

  async function updateAuditor(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAuditor) return;
    
    try {
      setSaving(true);
      const payload = {
        name: editingAuditor.name,
        email: editingAuditor.email,
        phone: editingAuditor.phone?.trim() || null,
        company: editingAuditor.company?.trim() || null,
        type: editingAuditor.type,
        isActive: editingAuditor.isActive,
        employeeId: editingAuditor.employeeId?.trim() || null,
        normativeCompetencies: editingAuditor.normativeCompetencies,
      };

      const res = await apiFetch(`/audit/auditors/${editingAuditor.id}`, {
        method: 'PATCH',
        json: payload,
      }) as { auditor: Auditor };

      if (res.auditor) {
        setAuditors(auditors.map(a => a.id === res.auditor.id ? res.auditor : a));
        setShowEditModal(false);
        setEditingAuditor(null);
      }
    } catch (err) {
      console.error('Error updating auditor:', err);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAuditor(id: string) {
    if (!confirm('¿Estás seguro de eliminar este auditor?')) return;
    try {
      await apiFetch(`/audit/auditors/${id}`, { method: 'DELETE' });
      setAuditors(auditors.filter(a => a.id !== id));
    } catch (err) {
      console.error('Error deleting auditor:', err);
    }
  }

  async function loadAuditorDocuments(auditorId: string) {
    try {
      const res = await apiFetch(`/audit/auditors/${auditorId}/documents`) as { documents: AuditorDocument[] };
      setAuditorDocuments(res.documents || []);
    } catch (err) {
      console.error('Error loading documents:', err);
    }
  }

  async function showHistory(auditor: Auditor) {
    setHistoryAuditor(auditor);
    await loadAuditorDocuments(auditor.id);
    setShowHistoryModal(true);
  }

  async function deleteAuditorDocument(docId: string) {
    if (!confirm('¿Eliminar este certificado?')) return;
    try {
      await apiFetch(`/audit/auditors/documents/${docId}`, { method: 'DELETE' });
      setAuditorDocuments(auditorDocuments.filter(d => d.id !== docId));
      if (editingAuditor) {
        setEditingAuditor({
          ...editingAuditor,
          documents: (editingAuditor.documents || []).filter(d => d.id !== docId)
        });
      }
    } catch (err) {
      console.error('Error deleting document:', err);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editingAuditor) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('El archivo es demasiado grande. Máximo 10MB.');
      return;
    }

    if (file.type !== 'application/pdf') {
      alert('Solo se permiten archivos PDF.');
      return;
    }

    try {
      setUploadingFile(true);
      
      // Crear FormData para subir archivo
      const formData = new FormData();
      formData.append('file', file);
      
      // Subir archivo al servidor (usando proxy de Next.js)
      const uploadRes = await fetch(`/api/audit/auditors/${editingAuditor.id}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json().catch(() => ({ error: 'Error uploading file' }));
        throw new Error(errorData.error || 'Error uploading file');
      }

      const { filePath } = await uploadRes.json();

      // Crear registro del documento
      const docRes = await apiFetch(`/audit/auditors/${editingAuditor.id}/documents`, {
        method: 'POST',
        json: {
          title: file.name.replace('.pdf', ''),
          filePath,
          fileSize: file.size,
          mimeType: 'application/pdf',
        },
      }) as { document: AuditorDocument };

      if (docRes.document) {
        const newDocs = [...(editingAuditor.documents || []), docRes.document];
        setEditingAuditor({ ...editingAuditor, documents: newDocs });
        setAuditorDocuments([...auditorDocuments, docRes.document]);
      }
    } catch (err: any) {
      console.error('Error uploading file:', err);
      alert(err.message || 'Error al subir el archivo. Intente nuevamente.');
    } finally {
      setUploadingFile(false);
      // Limpiar input
      e.target.value = '';
    }
  }

  function getCompetencyLabel(value: string) {
    return COMPETENCY_OPTIONS.find(c => c.value === value)?.label || value;
  }

  function getCompetencyColor(value: string) {
    return COMPETENCY_OPTIONS.find(c => c.value === value)?.color || 'bg-gray-100 text-gray-800';
  }

  const filteredAuditors = auditors.filter(a => {
    if (filter === 'ALL') return true;
    return a.type === filter;
  });

  const internalCount = auditors.filter(a => a.type === 'INTERNAL').length;
  const externalCount = auditors.filter(a => a.type === 'EXTERNAL').length;

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/auditorias" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Auditores</h1>
            <p className="text-gray-500">Auditores internos y externos con competencias</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Auditor
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Auditores</p>
              <p className="text-2xl font-bold text-gray-900">{auditors.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 rounded-lg">
              <Award className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Auditores Internos</p>
              <p className="text-2xl font-bold text-gray-900">{internalCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 rounded-lg">
              <Building2 className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Auditores Externos</p>
              <p className="text-2xl font-bold text-gray-900">{externalCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'ALL', label: 'Todos' },
          { key: 'INTERNAL', label: 'Internos' },
          { key: 'EXTERNAL', label: 'Externos' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Auditors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAuditors.map((auditor) => (
          <div key={auditor.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium ${
                  auditor.type === 'INTERNAL' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                }`}>
                  {auditor.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{auditor.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    auditor.type === 'INTERNAL' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                  }`}>
                    {auditor.type === 'INTERNAL' ? 'Interno' : 'Externo'}
                  </span>
                </div>
              </div>
              <span className={`w-2 h-2 rounded-full ${auditor.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
            </div>

            <div className="space-y-2 text-sm text-gray-600 mb-4">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                {auditor.email}
              </div>
              {auditor.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {auditor.phone}
                </div>
              )}
              {auditor.company && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  {auditor.company}
                </div>
              )}
            </div>

            {/* Competencies */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">Competencias:</p>
              <div className="flex flex-wrap gap-1">
                {auditor.normativeCompetencies.map((comp) => (
                  <span key={comp} className={`px-2 py-1 text-xs rounded ${getCompetencyColor(comp)}`}>
                    {getCompetencyLabel(comp)}
                  </span>
                ))}
                {auditor.normativeCompetencies.length === 0 && (
                  <span className="text-xs text-gray-400">Sin competencias registradas</span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => openEditModal(auditor)}
                className="flex-1 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                Editar
              </button>
              <button 
                onClick={() => showHistory(auditor)}
                className="flex-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Historial
              </button>
              <button 
                onClick={() => deleteAuditor(auditor.id)}
                className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Eliminar"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredAuditors.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">No hay auditores registrados</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-blue-600 hover:text-blue-800 text-sm mt-2"
          >
            + Registrar primer auditor
          </button>
        </div>
      )}

      {/* Modal Crear Auditor */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 my-8">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Nuevo Auditor</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={createAuditor} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={newAuditor.type}
                  onChange={(e) => setNewAuditor({ ...newAuditor, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="INTERNAL">Auditor Interno</option>
                  <option value="EXTERNAL">Auditor Externo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newAuditor.name}
                  onChange={(e) => setNewAuditor({ ...newAuditor, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={newAuditor.email}
                    onChange={(e) => setNewAuditor({ ...newAuditor, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={newAuditor.phone}
                    onChange={(e) => setNewAuditor({ ...newAuditor, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {newAuditor.type === 'EXTERNAL' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
                  <input
                    type="text"
                    value={newAuditor.company}
                    onChange={(e) => setNewAuditor({ ...newAuditor, company: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre de la empresa consultora"
                  />
                </div>
              )}

              {newAuditor.type === 'INTERNAL' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID Empleado</label>
                  <input
                    type="text"
                    value={newAuditor.employeeId}
                    onChange={(e) => setNewAuditor({ ...newAuditor, employeeId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="UUID del empleado (opcional)"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Competencias Normativas</label>
                <div className="grid grid-cols-2 gap-2">
                  {COMPETENCY_OPTIONS.map((comp) => (
                    <label key={comp.value} className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={newAuditor.normativeCompetencies.includes(comp.value)}
                        onChange={() => toggleCompetency(comp.value)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm">{comp.label}</span>
                    </label>
                  ))}
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
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Guardar Auditor
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Auditor */}
      {showEditModal && editingAuditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 my-8">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Editar Auditor</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={updateAuditor} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={editingAuditor.type}
                  onChange={(e) => setEditingAuditor({ ...editingAuditor, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="INTERNAL">Auditor Interno</option>
                  <option value="EXTERNAL">Auditor Externo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editingAuditor.name}
                  onChange={(e) => setEditingAuditor({ ...editingAuditor, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={editingAuditor.email}
                    onChange={(e) => setEditingAuditor({ ...editingAuditor, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={editingAuditor.phone || ''}
                    onChange={(e) => setEditingAuditor({ ...editingAuditor, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {editingAuditor.type === 'EXTERNAL' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
                  <input
                    type="text"
                    value={editingAuditor.company || ''}
                    onChange={(e) => setEditingAuditor({ ...editingAuditor, company: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre de la empresa consultora"
                  />
                </div>
              )}

              {editingAuditor.type === 'INTERNAL' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID Empleado</label>
                  <input
                    type="text"
                    value={editingAuditor.employeeId || ''}
                    onChange={(e) => setEditingAuditor({ ...editingAuditor, employeeId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="UUID del empleado (opcional)"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Competencias Normativas</label>
                <div className="grid grid-cols-2 gap-2">
                  {COMPETENCY_OPTIONS.map((comp) => (
                    <label key={comp.value} className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={editingAuditor.normativeCompetencies.includes(comp.value)}
                        onChange={() => toggleEditCompetency(comp.value)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm">{comp.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Certificados PDF */}
              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Certificados y Diplomas (PDF)</label>
                
                {/* Lista de documentos existentes */}
                {editingAuditor.documents && editingAuditor.documents.length > 0 && (
                  <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                    {editingAuditor.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center">
                            <span className="text-red-600 font-bold text-xs">PDF</span>
                          </div>
                          <span className="text-sm text-gray-700 truncate max-w-[200px]">{doc.title}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteAuditorDocument(doc.id)}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          Eliminar
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Input para subir nuevo PDF */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    disabled={uploadingFile}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center">
                    <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mb-2">
                      {uploadingFile ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                      ) : (
                        <span className="text-blue-600 text-xl">+</span>
                      )}
                    </div>
                    <span className="text-sm text-gray-600 text-center">
                      {uploadingFile ? 'Subiendo...' : 'Click para subir certificado PDF'}
                    </span>
                    <span className="text-xs text-gray-400 mt-1">Máx. 10MB</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editingAuditor.isActive}
                  onChange={(e) => setEditingAuditor({ ...editingAuditor, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">Auditor activo</label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Guardar Cambios
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Historial */}
      {showHistoryModal && historyAuditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 my-8">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Historial: {historyAuditor.name}
              </h3>
              <button onClick={() => setShowHistoryModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Info General */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500">Tipo</p>
                  <p className="font-medium">{historyAuditor.type === 'INTERNAL' ? 'Auditor Interno' : 'Auditor Externo'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Estado</p>
                  <span className={`inline-flex px-2 py-1 text-xs rounded-full ${historyAuditor.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {historyAuditor.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{historyAuditor.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fecha de registro</p>
                  <p className="font-medium">{new Date(historyAuditor.createdAt).toLocaleDateString('es-AR')}</p>
                </div>
              </div>

              {/* Competencias */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Competencias Normativas</h4>
                <div className="flex flex-wrap gap-2">
                  {historyAuditor.normativeCompetencies.map((comp) => (
                    <span key={comp} className={`px-3 py-1 text-sm rounded-full ${getCompetencyColor(comp)}`}>
                      {getCompetencyLabel(comp)}
                    </span>
                  ))}
                  {historyAuditor.normativeCompetencies.length === 0 && (
                    <span className="text-sm text-gray-400">Sin competencias registradas</span>
                  )}
                </div>
              </div>

              {/* Certificados */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Certificados y Diplomas ({auditorDocuments.length})</h4>
                {auditorDocuments.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {auditorDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                            <span className="text-red-600 font-bold text-xs">PDF</span>
                          </div>
                          <div>
                            <p className="font-medium text-sm text-gray-900">{doc.title}</p>
                            {doc.issuer && <p className="text-xs text-gray-500">Emitido por: {doc.issuer}</p>}
                            {doc.expiryDate && (
                              <p className={`text-xs ${new Date(doc.expiryDate) < new Date() ? 'text-red-500' : 'text-green-600'}`}>
                                Vence: {new Date(doc.expiryDate).toLocaleDateString('es-AR')}
                              </p>
                            )}
                          </div>
                        </div>
                        <a 
                          href={doc.filePath} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Ver
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No hay certificados registrados</p>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
