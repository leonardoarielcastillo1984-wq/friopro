'use client';
import { CheckSquare } from 'lucide-react';
import GenericCrudPage from '@/components/GenericCrudPage';

export default function AccionesPage() {
  return (
          <GenericCrudPage
            title="Acciones"
            subtitle="Plan de acciones correctivas, preventivas y de mejora (CAPA) - Formato Matriz de Riesgos"
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
              ]},
              { key: 'type', label: 'Tipo', type: 'select', required: true, options: [
                { value: 'CORRECTIVE', label: 'Correctiva' },
                { value: 'PREVENTIVE', label: 'Preventiva' },
                { value: 'IMPROVEMENT', label: 'Mejora' },
              ]},
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
              { key: 'title', label: 'Descripción / Problema' },
              { key: 'sourceType', label: 'Categoría' },
              { key: 'type', label: 'Tipo' },
              { key: 'initialProbability', label: 'Prob. In.' },
              { key: 'initialImpact', label: 'Imp. In.' },
              { key: 'initialRiskLevel', label: 'Nivel In.' },
              { key: 'residualProbability', label: 'Prob. Res.' },
              { key: 'residualImpact', label: 'Imp. Res.' },
              { key: 'residualRiskLevel', label: 'Nivel Res.' },
              { key: 'riskReduction', label: '%', render: (i) => i.riskReduction ? `${i.riskReduction}%` : '—' },
              { key: 'status', label: 'Estado' },
              { key: 'assignedToId', label: 'Responsable' },
              { key: 'dueDate', label: 'Revisión', render: (i) => i.dueDate ? new Date(i.dueDate).toLocaleDateString() : '—' },
              { key: 'completedAt', label: 'Cierre', render: (i) => i.completedAt ? new Date(i.completedAt).toLocaleDateString() : '—' },
            ]}
            aiFields={[
              {
                targetKey: 'description',
                buttonLabel: 'Plan de acción',
                buildPrompt: (f) => `Eres un consultor ISO experto en mejora continua. Para esta acción CAPA:\nTítulo: ${f.title || '—'}\nTipo: ${f.type || '—'}, Prioridad: ${f.priority || '—'}, Origen: ${f.sourceType || '—'}\n\nRedactá un plan de acción claro y completo que incluya: contexto del problema, objetivo de la acción, alcance y controles específicos. Máximo 3 párrafos.`,
              },
            ]}
          />
  );
}
