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
  const auditDate = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

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

      {/* Portada Profesional */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl shadow-lg p-8 text-white">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="text-sm opacity-80 mb-2">INFORME DE AUDITORÍA</div>
            <h1 className="text-3xl font-bold mb-2">{audit.title}</h1>
            <div className="text-xl font-semibold mb-4">{audit.code}</div>
            <div className="space-y-2 text-sm opacity-90">
              <div><span className="font-medium">Área:</span> {audit.area}</div>
              <div><span className="font-medium">Proceso:</span> {audit.process || 'N/A'}</div>
              <div><span className="font-medium">Fecha:</span> {auditDate}</div>
              <div><span className="font-medium">Normas:</span> {audit.isoStandard.join(', ')}</div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-sm opacity-80">Estado de Cumplimiento</div>
              <div className="text-4xl font-bold">{complianceRate}%</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-xs opacity-80">Ítems</div>
                <div className="text-2xl font-bold">{checklist.length}</div>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <div className="text-xs opacity-80">Hallazgos</div>
                <div className="text-2xl font-bold">{findings.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resumen Ejecutivo */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Resumen Ejecutivo</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Objetivo de la Auditoría</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Describir el objetivo principal de la auditoría..."
              defaultValue={audit.objective || ''}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Alcance</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Describir el alcance de la auditoría..."
              defaultValue={audit.scope || ''}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Conclusiones Generales</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Resumen de las principales conclusiones de la auditoría..."
              defaultValue={audit.auditorOpinion || ''}
            />
          </div>
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

      {/* 5. Hallazgos Mejorados con Evidencia */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">5. Hallazgos Detallados con Evidencia</h2>
        </div>
        {findings.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay hallazgos registrados</p>
        ) : (
          <div className="space-y-6">
            {findings.map((finding) => (
              <div key={finding.id} className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-medium">
                      {finding.code}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded text-sm font-medium ${
                      finding.severity === 'ALTO' ? 'bg-red-100 text-red-700' :
                      finding.severity === 'MEDIO' ? 'bg-orange-100 text-orange-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {finding.severity}
                    </span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                      {finding.status}
                    </span>
                  </div>
                  <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                    Crear CAPA
                  </button>
                </div>
                
                <h4 className="text-lg font-semibold text-gray-900 mb-2">{finding.description}</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {finding.clause && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Cláusula</label>
                      <p className="text-sm text-gray-900">{finding.clause}</p>
                    </div>
                  )}
                  {finding.requirement && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Requisito</label>
                      <p className="text-sm text-gray-900">{finding.requirement}</p>
                    </div>
                  )}
                </div>
                
                {finding.risk && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                    <label className="block text-sm font-medium text-red-700 mb-1">Riesgo Identificado</label>
                    <p className="text-sm text-red-900">{finding.risk}</p>
                  </div>
                )}
                
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Evidencia del Hallazgo</label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="Describir la evidencia que sustenta el hallazgo..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Acción Inmediata Tomada</label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="Describir acciones inmediatas..."
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. Recomendaciones de Mejora */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">6. Recomendaciones de Mejora</h2>
        </div>
        <div className="space-y-6">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Nivel de Madurez del Sistema</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              defaultValue={audit.maturityLevel || ''}
            >
              <option value="">Seleccionar...</option>
              <option value="BAJO">Bajo - Sistema en desarrollo inicial</option>
              <option value="MEDIO">Medio - Sistema implementado pero con mejoras necesarias</option>
              <option value="ALTO">Alto - Sistema maduro y efectivo</option>
            </select>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-blue-900 mb-3">Recomendaciones Específicas por Hallazgo</label>
            {findings.length === 0 ? (
              <p className="text-sm text-blue-700">No hay hallazgos para generar recomendaciones</p>
            ) : (
              <div className="space-y-3">
                {findings.map((finding, idx) => (
                  <div key={finding.id} className="bg-white rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-gray-500">Rec. {idx + 1}:</span>
                      <span className="text-sm font-semibold text-gray-900">{finding.code}</span>
                    </div>
                    <textarea
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="Describir recomendación específica para este hallazgo..."
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Recomendaciones Generales</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Recomendaciones generales de mejora para el sistema de gestión..."
              defaultValue={audit.certificationRecommendation || ''}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Riesgos Principales Identificados</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Describir riesgos principales que podrían afectar el sistema..."
              defaultValue={audit.mainRisks || ''}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Plazo Sugerido para Implementación</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
              <option value="">Seleccionar...</option>
              <option value="INMEDIATO">Inmediato (0-30 días)</option>
              <option value="CORTO">Corto plazo (1-3 meses)</option>
              <option value="MEDIO">Medio plazo (3-6 meses)</option>
              <option value="LARGO">Largo plazo (6-12 meses)</option>
            </select>
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
