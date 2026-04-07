'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { Plus, Calendar, FileText, AlertCircle, CheckCircle, Clock, Users } from 'lucide-react';

// Tipos
type AuditProgram = {
  id: string;
  year: number;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
};

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

type Stats = {
  totalPrograms: number;
  totalAudits: number;
  auditsByStatus: Record<string, number>;
  totalFindings: number;
  findingsBySeverity: Record<string, number>;
};

export default function AuditoriasPage() {
  const [programs, setPrograms] = useState<AuditProgram[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [programsRes, auditsRes, statsRes] = await Promise.all([
        apiFetch('/audit/programs') as Promise<{ programs: AuditProgram[] }>,
        apiFetch('/audit/audits') as Promise<{ audits: Audit[] }>,
        apiFetch('/audit/stats') as Promise<{ stats: Stats }>,
      ]);

      if (programsRes.programs) setPrograms(programsRes.programs);
      if (auditsRes.audits) setAudits(auditsRes.audits);
      if (statsRes.stats) setStats(statsRes.stats);
    } catch (err) {
      setError('Error al cargar datos de auditorías');
    } finally {
      setLoading(false);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'PLANNED': return 'bg-blue-100 text-blue-800';
      case 'SCHEDULED': return 'bg-purple-100 text-purple-800';
      case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800';
      case 'PENDING_REPORT': return 'bg-orange-100 text-orange-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'CLOSED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getStatusLabel(status: string) {
    const labels: Record<string, string> = {
      'DRAFT': 'Borrador',
      'PLANNED': 'Planificada',
      'SCHEDULED': 'Programada',
      'IN_PROGRESS': 'En ejecución',
      'PENDING_REPORT': 'Pendiente informe',
      'COMPLETED': 'Finalizada',
      'CLOSED': 'Cerrada',
    };
    return labels[status] || status;
  }

  function getTypeLabel(type: string) {
    const labels: Record<string, string> = {
      'INTERNAL': 'Interna',
      'EXTERNAL': 'Externa',
      'SUPPLIER': 'Proveedor',
      'CUSTOMER': 'Cliente',
      'CERTIFICATION': 'Certificación',
      'RECERTIFICATION': 'Recertificación',
      'SURVEILLANCE': 'Vigilancia',
    };
    return labels[type] || type;
  }

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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Módulo de Auditorías ISO</h1>
          <p className="text-gray-500">Gestión integral de programas y auditorías de calidad</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/auditorias/auditores"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
          >
            <Users className="w-4 h-4" />
            Auditores
          </Link>
          <Link
            href="/auditorias/programa"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Programa Anual
          </Link>
          <Link
            href="/auditorias/nueva"
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva Auditoría
          </Link>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Programas Activos</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPrograms}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-50 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Auditorías en Curso</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.auditsByStatus?.IN_PROGRESS || 0}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Auditorías Completadas</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.auditsByStatus?.COMPLETED || 0}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-50 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Hallazgos Críticos</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.findingsBySeverity?.CRITICAL || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Auditorías Recientes</h2>
          <Link
            href="/auditorias/lista"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Ver todas →
          </Link>
        </div>
        
        <div className="divide-y divide-gray-200">
          {audits.slice(0, 5).map((audit) => (
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
                    <span className="text-xs text-gray-500">
                      {getTypeLabel(audit.type)}
                    </span>
                  </div>
                  <h3 className="text-base font-medium text-gray-900">{audit.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Área: {audit.area} • Normas: {audit.isoStandard?.join(', ') || 'N/A'}
                  </p>
                </div>
                <FileText className="w-5 h-5 text-gray-400" />
              </div>
            </Link>
          ))}
          
          {audits.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No hay auditorías registradas</p>
              <Link
                href="/auditorias/nueva"
                className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block"
              >
                Crear primera auditoría →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
