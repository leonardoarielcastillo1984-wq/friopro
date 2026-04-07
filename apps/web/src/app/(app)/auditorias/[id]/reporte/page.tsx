'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, FileText, Download, Printer, Share2, CheckCircle, AlertCircle, FileBarChart } from 'lucide-react';
import { useCompany } from '@/lib/company-context';

type Audit = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  area: string;
  isoStandard: string[];
  scope: string | null;
  objective: string | null;
  interviewees: string | null;
};

type Finding = {
  id: string;
  code: string;
  type: 'NON_CONFORMITY' | 'OBSERVATION' | 'OPPORTUNITY';
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'TRIVIAL';
  status: string;
  description: string;
  clause: string;
  area: string;
};

type ChecklistItem = {
  id: string;
  clause: string;
  requirement: string;
  response: 'COMPLIES' | 'DOES_NOT_COMPLY' | 'NOT_APPLICABLE' | null;
};

type AuditReport = {
  auditId: string;
  executiveSummary: string | null;
  objective: string | null;
  scope: string | null;
  processesAudited: string[];
  overallScore: number | null;
  totalItems: number;
  compliantItems: number;
  nonCompliantItems: number;
  totalFindings: number;
  openFindings: number;
  closedFindings: number;
  conclusion: string | null;
};

type DraftResponse = {
  draft: {
    executiveSummary: string;
    objective: string;
    scope: string;
    processesAudited: string[];
    overallScore: number | null;
    totalItems: number;
    compliantItems: number;
    nonCompliantItems: number;
    totalFindings: number;
    openFindings: number;
    closedFindings: number;
    conclusion: string;
  };
  report: AuditReport;
};

const TYPE_LABELS: Record<string, string> = {
  'INTERNAL': 'Interna',
  'EXTERNAL': 'Externa',
  'SUPPLIER': 'Proveedor',
  'CUSTOMER': 'Cliente',
  'CERTIFICATION': 'Certificación',
  'RECERTIFICATION': 'Recertificación',
  'SURVEILLANCE': 'Vigilancia',
};

const STATUS_LABELS: Record<string, string> = {
  'DRAFT': 'Borrador',
  'PLANNED': 'Planificada',
  'SCHEDULED': 'Programada',
  'IN_PROGRESS': 'En ejecución',
  'PENDING_REPORT': 'Pendiente informe',
  'COMPLETED': 'Finalizada',
  'CLOSED': 'Cerrada',
};

export default function ReportPage() {
  const params = useParams();
  const auditId = params.id as string;
  const { settings: companySettings } = useCompany();

  const [audit, setAudit] = useState<Audit | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [draftGenerating, setDraftGenerating] = useState(false);
  const [draft, setDraft] = useState<DraftResponse['draft'] | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auditId) {
      loadData();
    }
  }, [auditId]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [auditRes, findingsRes, checklistRes] = await Promise.all([
        apiFetch(`/audit/audits/${auditId}`) as Promise<{ audit: Audit }>,
        apiFetch(`/audit/audits/${auditId}/findings`) as Promise<{ findings: Finding[] }>,
        apiFetch(`/audit/audits/${auditId}/checklist`) as Promise<{ items: ChecklistItem[] }>,
      ]);

      if (auditRes.audit) setAudit(auditRes.audit);
      if (findingsRes.findings) setFindings(findingsRes.findings);
      if (checklistRes.items) setChecklist(checklistRes.items);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Error loading data');
    } finally {
      setLoading(false);
    }
  }

  async function generateDraft() {
    try {
      setDraftGenerating(true);
      setError(null);
      const res = await apiFetch(`/audit/audits/${auditId}/report/draft`, {
        method: 'POST',
        json: {},
      }) as DraftResponse;

      if (res?.draft) setDraft(res.draft);
      if (res?.report) setReport(res.report);
    } catch (err) {
      console.error('Error generating draft:', err);
      setError(err instanceof Error ? err.message : 'Error generating draft');
    } finally {
      setDraftGenerating(false);
    }
  }

  function generatePDF() {
    setGenerating(true);
    window.print();
    setTimeout(() => setGenerating(false), 1000);
  }

  function getComplianceStats() {
    const total = checklist.length;
    if (total === 0) return { compliant: 0, nonCompliant: 0, notApplicable: 0, percentage: 0 };
    
    const compliant = checklist.filter(i => i.response === 'COMPLIES').length;
    const nonCompliant = checklist.filter(i => i.response === 'DOES_NOT_COMPLY').length;
    const notApplicable = checklist.filter(i => i.response === 'NOT_APPLICABLE').length;
    const answered = checklist.filter(i => i.response !== null).length;
    const percentage = answered > 0 ? Math.round((compliant / (answered - notApplicable || 1)) * 100) : 0;
    
    return { compliant, nonCompliant, notApplicable, percentage };
  }

  function getSeverityCount(severity: string) {
    return findings.filter(f => f.severity === severity).length;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="space-y-6">
        <Link href="/auditorias" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800">
          <ChevronLeft className="w-4 h-4" />
          Volver
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Auditoría no encontrada
        </div>
      </div>
    );
  }

  const stats = getComplianceStats();

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between print:hidden">
        <div>
          <Link 
            href={`/auditorias/${auditId}`} 
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Volver a la auditoría
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Informe de Auditoría</h1>
          <p className="text-gray-600">{audit.code} - {audit.title}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={generateDraft}
            disabled={draftGenerating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <FileBarChart className="w-4 h-4" />
            {draftGenerating ? 'Generando...' : 'Generar borrador'}
          </button>
          <button
            onClick={generatePDF}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {generating ? 'Generando...' : 'Descargar PDF'}
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Share2 className="w-4 h-4" />
            Compartir
          </button>
        </div>
      </div>

      {/* Report Content - Print-friendly */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 print:shadow-none print:border-none">
        {/* Report Header with Logo */}
        <div className="border-b border-gray-200 pb-6 mb-6">
          <div className="flex items-center justify-between">
            {companySettings?.logoUrl && (
              <div className="w-24 h-24 flex-shrink-0">
                <img 
                  src={companySettings.logoUrl} 
                  alt={companySettings.companyName || 'Logo'} 
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            )}
            <div className={`text-center flex-1 ${!companySettings?.logoUrl ? '' : 'px-4'}`}>
              <p className="text-sm text-gray-500 uppercase tracking-wider">
                {companySettings?.companyName || 'SGI 360'}
              </p>
              <h1 className="text-2xl font-bold text-gray-900 mt-1">INFORME DE AUDITORÍA</h1>
              {companySettings?.headerText && (
                <p className="text-sm text-gray-600 mt-2 italic">{companySettings.headerText}</p>
              )}
            </div>
            <div className="w-24" /> {/* Spacer for balance */}
          </div>
          <div className="text-center mt-4 pt-4 border-t border-gray-100">
            <p className="text-xl text-gray-700 font-medium">{audit.code}</p>
            <p className="text-lg text-gray-600 mt-1">{audit.title}</p>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Resumen Ejecutivo
          </h2>
          {draft?.executiveSummary && (
            <div className="bg-gray-50 border border-gray-200 px-4 py-3 rounded-lg mb-6">
              <p className="text-gray-700 whitespace-pre-line">{draft.executiveSummary}</p>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <p className="text-3xl font-bold text-blue-600">{stats.percentage}%</p>
              <p className="text-sm text-blue-800">Cumplimiento</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <p className="text-3xl font-bold text-green-600">{stats.compliant}</p>
              <p className="text-sm text-green-800">Conformidades</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg text-center">
              <p className="text-3xl font-bold text-red-600">{findings.length}</p>
              <p className="text-sm text-red-800">Hallazgos</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg text-center">
              <p className="text-3xl font-bold text-yellow-600">{checklist.length}</p>
              <p className="text-sm text-yellow-800">Items Auditados</p>
            </div>
          </div>
        </div>

        {/* Audit Details */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Detalles de la Auditoría</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Tipo de Auditoría</p>
              <p className="font-medium">{TYPE_LABELS[audit.type] || audit.type}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Estado</p>
              <p className="font-medium">{STATUS_LABELS[audit.status] || audit.status}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Área Auditada</p>
              <p className="font-medium">{audit.area}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Normas Aplicables</p>
              <p className="font-medium">{audit.isoStandard.join(', ')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Fecha de Inicio</p>
              <p className="font-medium">
                {audit.actualStartDate 
                  ? new Date(audit.actualStartDate).toLocaleDateString() 
                  : 'No iniciada'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Fecha de Finalización</p>
              <p className="font-medium">
                {audit.actualEndDate 
                  ? new Date(audit.actualEndDate).toLocaleDateString() 
                  : 'En progreso'}
              </p>
            </div>
          </div>
          {audit.scope && (
            <div className="mt-4">
              <p className="text-sm text-gray-500">Alcance</p>
              <p className="font-medium">{audit.scope}</p>
            </div>
          )}
          {audit.objective && (
            <div className="mt-4">
              <p className="text-sm text-gray-500">Objetivo</p>
              <p className="font-medium">{audit.objective}</p>
            </div>
          )}

          {audit.interviewees && (
            <div className="mt-4">
              <p className="text-sm text-gray-500">Entrevistados</p>
              <p className="font-medium whitespace-pre-line">{audit.interviewees}</p>
            </div>
          )}
        </div>

        {/* Findings Summary */}
        {findings.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Resumen de Hallazgos
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-red-50 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-600">{getSeverityCount('CRITICAL')}</p>
                <p className="text-xs text-red-800">Críticas</p>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-orange-600">{getSeverityCount('MAJOR')}</p>
                <p className="text-xs text-orange-800">Mayores</p>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-yellow-600">{getSeverityCount('MINOR')}</p>
                <p className="text-xs text-yellow-800">Menores</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-600">{getSeverityCount('TRIVIAL')}</p>
                <p className="text-xs text-gray-800">Triviales</p>
              </div>
            </div>

            {/* Findings List */}
            <div className="space-y-4">
              {findings.map((finding, index) => (
                <div key={finding.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-sm font-medium">{finding.code}</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      finding.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                      finding.severity === 'MAJOR' ? 'bg-orange-100 text-orange-800' :
                      finding.severity === 'MINOR' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {finding.severity}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      finding.type === 'NON_CONFORMITY' ? 'bg-red-100 text-red-800' :
                      finding.type === 'OBSERVATION' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {finding.type.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-gray-900">{finding.description}</p>
                  <div className="flex gap-4 mt-2 text-sm text-gray-500">
                    <span>Cláusula: {finding.clause}</span>
                    <span>Área: {finding.area}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conclusion */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Conclusión
          </h2>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-gray-700 whitespace-pre-line">
              {(draft?.conclusion || report?.conclusion) ? (draft?.conclusion || report?.conclusion) : (
                `La auditoría ${audit.code} ha sido ${audit.status === 'COMPLETED' ? 'completada' : 'realizada'} ` +
                `con un nivel de cumplimiento del ${stats.percentage}%. ` +
                (findings.length > 0
                  ? `Se han identificado ${findings.length} hallazgos que requieren atención, de los cuales ${getSeverityCount('CRITICAL') + getSeverityCount('MAJOR')} son de severidad crítica o mayor.`
                  : 'No se han identificado hallazgos significativos.')
              )}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 pt-6 mt-8">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <div>
              <p>Informe generado el {new Date().toLocaleDateString()}</p>
              {companySettings?.footerText && (
                <p className="text-gray-400 mt-1">{companySettings.footerText}</p>
              )}
            </div>
            <p>{companySettings?.companyName || 'SGI 360'} - Sistema de Gestión Integral</p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .print\:hidden {
            display: none !important;
          }
          .print\:shadow-none {
            box-shadow: none !important;
          }
          .print\:border-none {
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
}
