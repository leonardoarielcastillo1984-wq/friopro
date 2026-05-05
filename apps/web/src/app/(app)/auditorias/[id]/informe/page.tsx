'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft, FileText, CheckCircle, XCircle, AlertTriangle,
  Users, Calendar, Shield, TrendingUp, Download, Printer,
  Award, Target, ClipboardCheck, PenTool, Zap,
} from 'lucide-react';

type Audit = {
  id: string;
  code: string;
  title: string;
  status: string;
  area: string;
  process: string | null;
  isoStandard: string[];
  scope: string | null;
  objective: string | null;
  auditCriteria: any;
  structuredScope: any;
  auditTeamDetails: any;
  auditorOpinion: string | null;
  maturityLevel: string | null;
  certificationRecommendation: string | null;
  mainRisks: string | null;
  reportVersion: number;
};

type ChecklistItem = {
  id: string;
  clause: string;
  requirement: string;
  response: 'COMPLIES' | 'DOES_NOT_COMPLY' | 'NOT_APPLICABLE' | null;
  comment: string | null;
};

type Finding = {
  id: string;
  code: string;
  type: string;
  severity: string;
  description: string;
  clause: string | null;
  requirement: string | null;
  risk: string | null;
  status: string;
};

export default function AuditReportPage() {
  const params = useParams();
  const auditId = params.id as string;
  const [audit, setAudit] = useState<Audit | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await apiFetch(`/audit/audits/${auditId}/full`) as any;
        if (res.audit) {
          setAudit(res.audit);
          setChecklist(res.audit.checklist || []);
          setFindings(res.audit.findings || []);
        }
      } catch (err) {
        setError('Error al cargar el informe');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [auditId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="space-y-6">
        <Link href={`/auditorias/${auditId}`} className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800">
          <ChevronLeft className="w-4 h-4" /> Volver a auditoría
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error || 'Auditoría no encontrada'}</div>
      </div>
    );
  }

  const compliantCount = checklist.filter(i => i.response === 'COMPLIES').length;
  const nonCompliantCount = checklist.filter(i => i.response === 'DOES_NOT_COMPLY').length;
  const complianceRate = checklist.length > 0 ? ((compliantCount / checklist.length) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/auditorias/${auditId}`} className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-2">
            <ChevronLeft className="w-4 h-4" /> Volver a auditoría
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Informe de Auditoría Profesional</h1>
          <p className="text-gray-600">{audit.code} - {audit.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
            <Download className="w-4 h-4" /> Exportar PDF
          </button>
        </div>
      </div>

      {/* Overview Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Cumplimiento</p>
              <p className="text-2xl font-bold text-gray-900">{complianceRate}%</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 rounded-lg">
              <ClipboardCheck className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Ítems Check</p>
              <p className="text-2xl font-bold text-gray-900">{checklist.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-50 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Hallazgos</p>
              <p className="text-2xl font-bold text-gray-900">{findings.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 rounded-lg">
              <Award className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Madurez</p>
              <p className="text-2xl font-bold text-gray-900">{audit.maturityLevel || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Criterios de Auditoría */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">1. Criterios de Auditoría</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Normas Aplicables</label>
            <div className="flex flex-wrap gap-2">
              {audit.isoStandard.map((std, idx) => (
                <span key={idx} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                  {std}
                </span>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Procedimientos Internos</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Agregar procedimientos internos..."
              defaultValue={audit.auditCriteria?.procedures || ''}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Requisitos Legales</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Agregar requisitos legales..."
              defaultValue={audit.auditCriteria?.legalRequirements || ''}
            />
          </div>
        </div>
      </div>

      {/* 2. Alcance Estructurado */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">2. Alcance Estructurado</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Procesos Incluidos</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Listar procesos..."
              defaultValue={audit.structuredScope?.processes || audit.process || ''}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ubicaciones</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Listar ubicaciones..."
              defaultValue={audit.structuredScope?.locations || audit.area || ''}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Exclusiones</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Listar exclusiones..."
              defaultValue={audit.structuredScope?.exclusions || ''}
            />
          </div>
        </div>
      </div>

      {/* 3. Equipo Auditor */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">3. Equipo Auditor</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Auditor Líder</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Nombre del auditor líder"
              defaultValue={audit.auditTeamDetails?.leader || ''}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Auditores Participantes</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Listar auditores participantes..."
              defaultValue={audit.auditTeamDetails?.participants || ''}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Auditados</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Listar auditados..."
              defaultValue={audit.auditTeamDetails?.auditees || ''}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Observadores</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Listar observadores..."
              defaultValue={audit.auditTeamDetails?.observers || ''}
            />
          </div>
        </div>
      </div>

      {/* 4. Matriz de Cumplimiento */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardCheck className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">4. Matriz de Cumplimiento por Cláusula</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left font-medium text-gray-700">Cláusula</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Requisito</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Estado</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Comentarios</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {checklist.map((item, idx) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{item.clause}</td>
                  <td className="px-4 py-2">{item.requirement}</td>
                  <td className="px-4 py-2">
                    {item.response === 'COMPLIES' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                        <CheckCircle className="w-3 h-3" /> Cumple
                      </span>
                    )}
                    {item.response === 'DOES_NOT_COMPLY' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                        <XCircle className="w-3 h-3" /> No cumple
                      </span>
                    )}
                    {item.response === 'NOT_APPLICABLE' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                        N/A
                      </span>
                    )}
                    {!item.response && (
                      <span className="text-gray-400">Pendiente</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{item.comment || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Hallazgos Mejorados */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">5. Hallazgos</h2>
        </div>
        {findings.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay hallazgos registrados</p>
        ) : (
          <div className="space-y-4">
            {findings.map((finding) => (
              <div key={finding.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                      {finding.code}
                    </span>
                    <span className="ml-2 inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">
                      {finding.severity}
                    </span>
                  </div>
                  <button className="text-blue-600 hover:text-blue-800 text-sm">
                    Crear CAPA
                  </button>
                </div>
                <h4 className="font-medium text-gray-900 mb-1">{finding.description}</h4>
                {finding.clause && (
                  <p className="text-sm text-gray-600">Cláusula: {finding.clause}</p>
                )}
                {finding.requirement && (
                  <p className="text-sm text-gray-600">Requisito: {finding.requirement}</p>
                )}
                {finding.risk && (
                  <p className="text-sm text-red-600 mt-2">Riesgo: {finding.risk}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. Conclusión Avanzada */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">6. Conclusión y Recomendaciones</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Opinión del Auditor</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              defaultValue={audit.auditorOpinion || ''}
            >
              <option value="">Seleccionar...</option>
              <option value="CONFORME">Conforme</option>
              <option value="NO_CONFORME">No conforme</option>
              <option value="PARCIALMENTE_CONFORME">Parcialmente conforme</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nivel de Madurez</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              defaultValue={audit.maturityLevel || ''}
            >
              <option value="">Seleccionar...</option>
              <option value="BAJO">Bajo</option>
              <option value="MEDIO">Medio</option>
              <option value="ALTO">Alto</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Recomendación de Certificación</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Recomendación..."
              defaultValue={audit.certificationRecommendation || ''}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Riesgos Principales</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Describir riesgos principales..."
              defaultValue={audit.mainRisks || ''}
            />
          </div>
        </div>
      </div>

      {/* 7. Trazabilidad y Firma */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <PenTool className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">7. Trazabilidad y Firma</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Firma Auditor</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Nombre del auditor"
            />
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 mt-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Firma Auditado</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Nombre del auditado"
            />
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 mt-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Versión del Informe</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
              value={`v${audit.reportVersion}`}
              readOnly
            />
          </div>
        </div>
      </div>

      {/* 8. Indicadores Visuales */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">8. Indicadores de Cumplimiento</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-700">% Cumplimiento General</span>
              <span className="text-sm font-bold text-gray-900">{complianceRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-green-600 h-4 rounded-full transition-all"
                style={{ width: `${complianceRate}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{compliantCount}</p>
              <p className="text-xs text-gray-600">Conformes</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{nonCompliantCount}</p>
              <p className="text-xs text-gray-600">No conformes</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-600">{checklist.length - compliantCount - nonCompliantCount}</p>
              <p className="text-xs text-gray-600">Pendientes</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
