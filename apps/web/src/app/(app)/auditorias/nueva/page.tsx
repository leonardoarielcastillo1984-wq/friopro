'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus, AlertCircle } from 'lucide-react';

type AuditProgram = {
  id: string;
  year: number;
  name: string;
};

type Auditor = {
  id: string;
  name: string;
  email: string;
  type: 'INTERNAL' | 'EXTERNAL';
};

const ISO_STANDARDS = [
  { value: 'ISO_9001', label: 'ISO 9001 - Calidad' },
  { value: 'ISO_14001', label: 'ISO 14001 - Medio Ambiente' },
  { value: 'ISO_45001', label: 'ISO 45001 - Seguridad y Salud' },
  { value: 'ISO_39001', label: 'ISO 39001 - Seguridad Vial' },
  { value: 'IATF_16949', label: 'IATF 16949 - Automotriz' },
  { value: 'ISO_27001', label: 'ISO 27001 - Seguridad Información' },
  { value: 'ISO_50001', label: 'ISO 50001 - Energía' },
  { value: 'CUSTOM', label: 'Otra Norma' },
];

const AUDIT_TYPES = [
  { value: 'INTERNAL', label: 'Interna' },
  { value: 'EXTERNAL', label: 'Externa' },
  { value: 'SUPPLIER', label: 'Proveedor' },
  { value: 'CUSTOMER', label: 'Cliente' },
  { value: 'CERTIFICATION', label: 'Certificación' },
  { value: 'RECERTIFICATION', label: 'Recertificación' },
  { value: 'SURVEILLANCE', label: 'Vigilancia' },
];

export default function NuevaAuditoriaPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<AuditProgram[]>([]);
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    programId: '',
    code: '',
    title: '',
    description: '',
    type: 'INTERNAL',
    plannedStartDate: '',
    plannedEndDate: '',
    duration: '',
    leadAuditorId: '',
    area: '',
    process: '',
    isoStandard: [] as string[],
    scope: '',
    objective: '',
  });

  useEffect(() => {
    loadProgramsAndAuditors();
  }, []);

  async function loadProgramsAndAuditors() {
    try {
      const [programsRes, auditorsRes] = await Promise.all([
        apiFetch('/audit/programs') as Promise<{ programs: AuditProgram[] }>,
        apiFetch('/audit/auditors') as Promise<{ auditors: Auditor[] }>,
      ]);
      
      if (programsRes.programs) setPrograms(programsRes.programs);
      if (auditorsRes.auditors) setAuditors(auditorsRes.auditors);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const toIsoDateTime = (dateStr: string) => {
        if (!dateStr) return undefined;
        // date input gives YYYY-MM-DD; backend expects RFC3339 datetime
        return new Date(`${dateStr}T00:00:00.000Z`).toISOString();
      };

      const payload = {
        ...formData,
        description: formData.description?.trim() ? formData.description.trim() : undefined,
        plannedStartDate: toIsoDateTime(formData.plannedStartDate),
        plannedEndDate: toIsoDateTime(formData.plannedEndDate),
        duration: formData.duration ? parseInt(formData.duration) : undefined,
        process: formData.process?.trim() ? formData.process.trim() : undefined,
        scope: formData.scope?.trim() ? formData.scope.trim() : undefined,
        objective: formData.objective?.trim() ? formData.objective.trim() : undefined,
      };

      const res = await apiFetch('/audit/audits', {
        method: 'POST',
        json: payload,
      }) as { audit: { id: string } };
      
      if (res.audit) {
        router.push(`/auditorias/${res.audit.id}`);
      }
    } catch (err) {
      console.error('Error creating audit:', err);
      setError('Error al crear la auditoría');
    } finally {
      setLoading(false);
    }
  }

  function handleIsoStandardChange(value: string) {
    setFormData(prev => ({
      ...prev,
      isoStandard: prev.isoStandard.includes(value)
        ? prev.isoStandard.filter(s => s !== value)
        : [...prev.isoStandard, value],
    }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/auditorias"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nueva Auditoría</h1>
          <p className="text-gray-500">Crear una nueva auditoría en el sistema</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 space-y-6">
          {/* Programa */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Programa Anual <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.programId}
              onChange={(e) => setFormData({ ...formData, programId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Seleccionar programa...</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.year} - {program.name}
                </option>
              ))}
            </select>
          </div>

          {/* Código y Título */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Código <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="AUD-2026-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Título <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Auditoría interna de procesos críticos"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Tipo y Normas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Auditoría <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {AUDIT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Auditor Líder <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.leadAuditorId}
                onChange={(e) => setFormData({ ...formData, leadAuditorId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seleccionar auditor...</option>
                {auditors.map((auditor) => (
                  <option key={auditor.id} value={auditor.id}>
                    {auditor.name} ({auditor.type === 'INTERNAL' ? 'Interno' : 'Externo'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Fechas y Duración */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Inicio Planificada
              </label>
              <input
                type="date"
                value={formData.plannedStartDate}
                onChange={(e) => setFormData({ ...formData, plannedStartDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Fin Planificada
              </label>
              <input
                type="date"
                value={formData.plannedEndDate}
                onChange={(e) => setFormData({ ...formData, plannedEndDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duración (horas)
              </label>
              <input
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="8"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Área y Proceso */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Área Auditada <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                placeholder="Producción, Calidad, etc."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Proceso
              </label>
              <input
                type="text"
                value={formData.process}
                onChange={(e) => setFormData({ ...formData, process: e.target.value })}
                placeholder="Nombre del proceso específico"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Normas ISO */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Normas ISO Aplicables
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
              {ISO_STANDARDS.map((standard) => (
                <label key={standard.value} className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={formData.isoStandard.includes(standard.value)}
                    onChange={() => handleIsoStandardChange(standard.value)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm">{standard.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Alcance y Objetivo */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alcance de la Auditoría
              </label>
              <textarea
                value={formData.scope}
                onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                placeholder="Describir el alcance de esta auditoría..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Objetivo de la Auditoría
              </label>
              <textarea
                value={formData.objective}
                onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                placeholder="Describir el objetivo principal de esta auditoría..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <Link
            href="/auditorias"
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Creando...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Crear Auditoría
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
