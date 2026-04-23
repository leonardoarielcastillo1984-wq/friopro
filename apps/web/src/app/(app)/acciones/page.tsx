'use client';
import { CheckSquare, ArrowRight } from 'lucide-react';
import GenericCrudPage from '@/components/GenericCrudPage';

const sourceTypeMap: Record<string, string> = {
  MANUAL: 'Manual', AUDIT: 'Auditoría', NCR: 'No Conformidad',
  INDICATOR: 'Indicador', REVIEW: 'Revisión Dirección', RISK: 'Riesgo',
  FODA: 'FODA', DAFO: 'DAFO', STAKEHOLDER: 'Parte Interesada',
};
const typeMap: Record<string, string> = {
  CORRECTIVE: 'Correctiva', PREVENTIVE: 'Preventiva', IMPROVEMENT: 'Mejora',
};
const statusMap: Record<string, string> = {
  OPEN: 'Abierta', IN_PROGRESS: 'En progreso', VERIFICATION: 'Verificación',
  CLOSED: 'Cerrada', CANCELLED: 'Cancelada',
};
const originMap: Record<string, string> = {
  AUDIT: 'Auditoría', CLIENT: 'Cliente', PROCESS: 'Proceso',
  STAKEHOLDER: 'Parte Interesada', MANUAL: 'Manual',
};
const priorityMap: Record<string, string> = {
  LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica',
};

function sourceTypeLabel(v?: string) { return sourceTypeMap[v || ''] || v || '—'; }
function typeLabel(v?: string) { return typeMap[v || ''] || v || '—'; }
function statusLabel(v?: string) { return statusMap[v || ''] || v || '—'; }
function originLabel(v?: string) { return originMap[v || ''] || v || '—'; }
function priorityLabel(v?: string) { return priorityMap[v || ''] || v || '—'; }

export default function AccionesPage() {
  return (
          <GenericCrudPage
            title="Acciones CAPA"
            subtitle="Gestión de No Conformidades - 8D Simplificado (Identificación → Cierre)"
            endpoint="/actions"
            icon={CheckSquare}
            defaultValues={{ type: 'CORRECTIVE', priority: 'MEDIUM', sourceType: 'MANUAL', status: 'OPEN', openDate: new Date().toISOString().split('T')[0], initialProbability: 1, initialImpact: 1, residualProbability: 1, residualImpact: 1 }}
            fields={[
              { key: 'code', label: 'Código', type: 'text' },
              { key: 'openDate', label: 'Fecha Ident.', type: 'date', required: true },
              { key: 'title', label: 'Descripción / Problema', type: 'textarea', required: true, fullWidth: true },
              { key: 'sourceType', label: 'Categoría', type: 'select', required: true, options: [
                { value: 'MANUAL', label: 'Manual' },
                { value: 'AUDIT', label: 'Auditoría' },
                { value: 'NCR', label: 'No Conformidad' },
                { value: 'INDICATOR', label: 'Indicador' },
                { value: 'REVIEW', label: 'Revisión Dirección' },
                { value: 'RISK', label: 'Riesgo' },
                { value: 'FODA', label: 'FODA' },
                { value: 'DAFO', label: 'DAFO' },
                { value: 'STAKEHOLDER', label: 'Parte Interesada' },
              ]},
              { key: 'type', label: 'Tipo', type: 'select', required: true, options: [
                { value: 'CORRECTIVE', label: 'Correctiva' },
                { value: 'PREVENTIVE', label: 'Preventiva' },
                { value: 'IMPROVEMENT', label: 'Mejora' },
              ]},
              { key: 'origin', label: 'Origen', type: 'select', options: [
                { value: 'AUDIT', label: 'Auditoría' },
                { value: 'CLIENT', label: 'Cliente' },
                { value: 'PROCESS', label: 'Proceso' },
                { value: 'STAKEHOLDER', label: 'Parte Interesada' },
                { value: 'MANUAL', label: 'Manual' },
              ]},
              { key: 'affectedArea', label: 'Área Afectada', type: 'text' },
              { key: 'detectedBy', label: 'Detectado por', type: 'text' },
              { key: 'initialProbability', label: 'Prob. Inicial (1-5)', type: 'number' },
              { key: 'initialImpact', label: 'Imp. Inicial (1-5)', type: 'number' },
              { key: 'initialRiskLevel', label: 'Nivel Inicial', type: 'select', options: [
                { value: 'LOW', label: 'Bajo' },
                { value: 'MEDIUM', label: 'Medio' },
                { value: 'HIGH', label: 'Alto' },
                { value: 'CRITICAL', label: 'Crítico' },
              ]},
              { key: 'description', label: 'Plan / Controles', type: 'textarea', required: true, fullWidth: true },
              { key: 'residualProbability', label: 'Prob. Residual (1-5)', type: 'number' },
              { key: 'residualImpact', label: 'Imp. Residual (1-5)', type: 'number' },
              { key: 'residualRiskLevel', label: 'Nivel Residual', type: 'select', options: [
                { value: 'LOW', label: 'Bajo' },
                { value: 'MEDIUM', label: 'Medio' },
                { value: 'HIGH', label: 'Alto' },
                { value: 'CRITICAL', label: 'Crítico' },
              ]},
              { key: 'riskReduction', label: '% Reducción', type: 'number' },
              { key: 'status', label: 'Estado', type: 'select', options: [
                { value: 'OPEN', label: 'Abierta' },
                { value: 'IN_PROGRESS', label: 'En progreso' },
                { value: 'VERIFICATION', label: 'Verificación' },
                { value: 'CLOSED', label: 'Cerrada' },
                { value: 'CANCELLED', label: 'Cancelada' },
              ]},
              { key: 'assignedToId', label: 'Responsable', type: 'text' },
              { key: 'dueDate', label: 'Revisión', type: 'date' },
              { key: 'completedAt', label: 'Cierre', type: 'date' },
              { key: 'notes', label: 'Notas', type: 'textarea' },
            ]}
            columns={[
              { key: 'code', label: 'Código' },
              { key: 'openDate', label: 'Fecha Ident.', render: (i) => i.openDate ? new Date(i.openDate).toLocaleDateString() : '—' },
              { key: 'title', label: 'Descripción / Problema', render: (i) => (
                <a href={`/acciones/${i.id}`} className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
                  {i.title}
                </a>
              )},
              { key: 'sourceType', label: 'Categoría', render: (i) => sourceTypeLabel(i.sourceType) },
              { key: 'type', label: 'Tipo', render: (i) => typeLabel(i.type) },
              { key: 'progress', label: 'Progreso', render: (i) => {
                const pct = i.progress ?? 0;
                let color = 'bg-red-500';
                if (pct >= 80) color = 'bg-green-500';
                else if (pct >= 50) color = 'bg-yellow-500';
                else if (pct >= 20) color = 'bg-orange-500';
                return (
                  <div className="w-24">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-600">{pct}%</span>
                    </div>
                  </div>
                );
              }},
              { key: 'status', label: 'Estado', render: (i) => statusLabel(i.status) },
              { key: 'assignedToId', label: 'Responsable' },
              { key: 'dueDate', label: 'Revisión', render: (i) => i.dueDate ? new Date(i.dueDate).toLocaleDateString() : '—' },
            ]}
            aiFields={[
              {
                targetKey: 'description',
                buttonLabel: 'Plan de acción',
                buildPrompt: (f) => `Eres un consultor ISO experto en mejora continua. Para esta acción CAPA:\nTítulo: ${f.title || '—'}\nTipo: ${f.type || '—'}, Prioridad: ${f.priority || '—'}, Origen: ${f.sourceType || '—'}\n\nRedactá un plan de acción claro y completo que incluya: contexto del problema, objetivo de la acción, alcance y controles específicos. Máximo 3 párrafos.`,
              },
            ]}
            filterFields={[
              { key: 'status', label: 'Estado', type: 'select', options: [
                { value: 'OPEN', label: 'Abierta' }, { value: 'IN_PROGRESS', label: 'En progreso' },
                { value: 'VERIFICATION', label: 'Verificación' }, { value: 'CLOSED', label: 'Cerrada' },
                { value: 'CANCELLED', label: 'Cancelada' },
              ]},
              { key: 'type', label: 'Tipo', type: 'select', options: [
                { value: 'CORRECTIVE', label: 'Correctiva' }, { value: 'PREVENTIVE', label: 'Preventiva' },
                { value: 'IMPROVEMENT', label: 'Mejora' },
              ]},
              { key: 'sourceType', label: 'Categoría', type: 'select', options: [
                { value: 'MANUAL', label: 'Manual' }, { value: 'AUDIT', label: 'Auditoría' },
                { value: 'NCR', label: 'No Conformidad' }, { value: 'INDICATOR', label: 'Indicador' },
                { value: 'REVIEW', label: 'Revisión' }, { value: 'RISK', label: 'Riesgo' },
                { value: 'STAKEHOLDER', label: 'Parte Interesada' },
              ]},
              { key: 'origin', label: 'Origen', type: 'select', options: [
                { value: 'AUDIT', label: 'Auditoría' }, { value: 'CLIENT', label: 'Cliente' },
                { value: 'PROCESS', label: 'Proceso' }, { value: 'STAKEHOLDER', label: 'Parte Interesada' },
                { value: 'MANUAL', label: 'Manual' },
              ]},
              { key: 'priority', label: 'Prioridad', type: 'select', options: [
                { value: 'LOW', label: 'Baja' }, { value: 'MEDIUM', label: 'Media' },
                { value: 'HIGH', label: 'Alta' }, { value: 'CRITICAL', label: 'Crítica' },
              ]},
            ]}
            showExport
          />
  );
}
