'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { ChevronLeft, FileText, AlertCircle } from 'lucide-react';

type Audit = {
  id: string;
  code: string;
  title: string;
  type: string;
  status: string;
  plannedStartDate: string | null;
  area: string;
  isoStandard: string[];
};

function getStatusColor(status: string) {
  switch (status) {
    case 'DRAFT':
      return 'bg-gray-100 text-gray-800';
    case 'PLANNED':
      return 'bg-blue-100 text-blue-800';
    case 'SCHEDULED':
      return 'bg-purple-100 text-purple-800';
    case 'IN_PROGRESS':
      return 'bg-yellow-100 text-yellow-800';
    case 'PENDING_REPORT':
      return 'bg-orange-100 text-orange-800';
    case 'COMPLETED':
      return 'bg-green-100 text-green-800';
    case 'CLOSED':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: 'Borrador',
    PLANNED: 'Planificada',
    SCHEDULED: 'Programada',
    IN_PROGRESS: 'En ejecución',
    PENDING_REPORT: 'Pendiente informe',
    COMPLETED: 'Finalizada',
    CLOSED: 'Cerrada',
  };
  return labels[status] || status;
}

function getTypeLabel(type: string) {
  const labels: Record<string, string> = {
    INTERNAL: 'Interna',
    EXTERNAL: 'Externa',
    SUPPLIER: 'Proveedor',
    CUSTOMER: 'Cliente',
    CERTIFICATION: 'Certificación',
    RECERTIFICATION: 'Recertificación',
    SURVEILLANCE: 'Vigilancia',
  };
  return labels[type] || type;
}

export default function AuditoriasListaPage() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = (await apiFetch('/audit/audits')) as { audits: Audit[] };
      setAudits(res.audits || []);
    } catch (err) {
      console.error('Error loading audits:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar auditorías');
    } finally {
      setLoading(false);
    }
  }

  const sorted = useMemo(() => {
    return [...audits].sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }, [audits]);

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
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <Link href="/auditorias" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-2">
            <ChevronLeft className="w-4 h-4" />
            Volver
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Todas las Auditorías</h1>
          <p className="text-gray-600">Listado completo</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Auditorías ({sorted.length})</h2>
        </div>

        <div className="divide-y divide-gray-200">
          {sorted.length > 0 ? (
            sorted.map((audit) => (
              <Link
                key={audit.id}
                href={`/auditorias/${audit.id}`}
                className="block px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-medium text-gray-900">{audit.code}</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(audit.status)}`}>
                        {getStatusLabel(audit.status)}
                      </span>
                      <span className="text-xs text-gray-500">{getTypeLabel(audit.type)}</span>
                    </div>
                    <h3 className="text-base font-medium text-gray-900">{audit.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Área: {audit.area} • Normas: {audit.isoStandard?.join(', ') || 'N/A'}
                    </p>
                  </div>
                  <FileText className="w-5 h-5 text-gray-400" />
                </div>
              </Link>
            ))
          ) : (
            <div className="px-6 py-8 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No hay auditorías registradas</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
