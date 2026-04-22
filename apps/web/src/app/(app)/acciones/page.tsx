'use client';
import { useState } from 'react';
import { CheckSquare, GitBranch } from 'lucide-react';
import GenericCrudPage from '@/components/GenericCrudPage';
import GestionCambiosTab from '../gestion-cambios/page';

const TABS = [
  { id: 'capa', label: 'Acciones CAPA', icon: CheckSquare },
  { id: 'cambios', label: 'Gestión de Cambios', icon: GitBranch },
];

export default function AccionesPage() {
  const [activeTab, setActiveTab] = useState('capa');

  return (
    <div className="flex flex-col h-full">
      {/* Tabs header */}
      <div className="border-b border-gray-200 bg-white px-6 pt-6">
        <div className="flex items-end gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
                activeTab === tab.id
                  ? 'bg-white border-gray-200 text-blue-600 -mb-px'
                  : 'bg-gray-50 border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'capa' && (
          <GenericCrudPage
            title="Acciones"
            subtitle="Plan de acciones correctivas, preventivas y de mejora (CAPA)"
            endpoint="/actions"
            icon={CheckSquare}
            defaultValues={{ type: 'CORRECTIVE', priority: 'MEDIUM', sourceType: 'MANUAL', status: 'OPEN' }}
            fields={[
              { key: 'title', label: 'Título', type: 'text', required: true, fullWidth: true },
              { key: 'description', label: 'Descripción', type: 'textarea', required: true },
              { key: 'type', label: 'Tipo', type: 'select', required: true, options: [
                { value: 'CORRECTIVE', label: 'Correctiva' },
                { value: 'PREVENTIVE', label: 'Preventiva' },
                { value: 'IMPROVEMENT', label: 'Mejora' },
              ]},
              { key: 'priority', label: 'Prioridad', type: 'select', options: [
                { value: 'LOW', label: 'Baja' },
                { value: 'MEDIUM', label: 'Media' },
                { value: 'HIGH', label: 'Alta' },
                { value: 'CRITICAL', label: 'Crítica' },
              ]},
              { key: 'sourceType', label: 'Origen', type: 'select', required: true, options: [
                { value: 'MANUAL', label: 'Manual' },
                { value: 'AUDIT', label: 'Auditoría' },
                { value: 'NCR', label: 'No Conformidad' },
                { value: 'INDICATOR', label: 'Indicador' },
                { value: 'REVIEW', label: 'Revisión Dirección' },
                { value: 'RISK', label: 'Riesgo' },
                { value: 'INCIDENT', label: 'Incidente' },
                { value: 'SUGGESTION', label: 'Sugerencia' },
              ]},
              { key: 'status', label: 'Estado', type: 'select', options: [
                { value: 'OPEN', label: 'Abierta' },
                { value: 'IN_PROGRESS', label: 'En progreso' },
                { value: 'VERIFICATION', label: 'Verificación' },
                { value: 'CLOSED', label: 'Cerrada' },
                { value: 'CANCELLED', label: 'Cancelada' },
              ]},
              { key: 'dueDate', label: 'Fecha vencimiento', type: 'date' },
              { key: 'effectivenessCheck', label: 'Verificación de eficacia', type: 'textarea' },
              { key: 'notes', label: 'Notas', type: 'textarea' },
            ]}
            columns={[
              { key: 'code', label: 'Código' },
              { key: 'title', label: 'Título' },
              { key: 'type', label: 'Tipo' },
              { key: 'priority', label: 'Prioridad' },
              { key: 'status', label: 'Estado' },
              { key: 'dueDate', label: 'Vence', render: (i) => i.dueDate ? new Date(i.dueDate).toLocaleDateString() : '—' },
            ]}
            aiFields={[
              {
                targetKey: 'description',
                buttonLabel: 'Describir acción',
                buildPrompt: (f) => `Eres un consultor ISO experto en mejora continua. Para esta acción CAPA:\nTítulo: ${f.title || '—'}\nTipo: ${f.type || '—'}, Prioridad: ${f.priority || '—'}, Origen: ${f.sourceType || '—'}\n\nRedactá una descripción clara y completa de la acción que incluya: contexto del problema, objetivo de la acción y alcance. Máximo 3 párrafos.`,
              },
              {
                targetKey: 'effectivenessCheck',
                buttonLabel: 'Criterios de eficacia',
                buildPrompt: (f) => `Eres un auditor ISO. Para esta acción CAPA:\nTítulo: ${f.title || '—'}\nDescripción: ${f.description || '—'}\n\nDefiní 3 criterios de verificación de eficacia concretos y medibles que permitan confirmar que la acción fue efectiva y el problema no se repitió.`,
              },
              {
                targetKey: 'notes',
                buttonLabel: 'Pasos de implementación',
                buildPrompt: (f) => `Eres un consultor de sistemas de gestión. Para esta acción:\nTítulo: ${f.title || '—'}, Tipo: ${f.type || '—'}\nDescripción: ${f.description || '—'}\n\nDetallá los pasos concretos de implementación en formato numerado. Incluí responsables sugeridos y tiempos estimados por paso.`,
              },
            ]}
          />
        )}
        {activeTab === 'cambios' && <GestionCambiosTab />}
      </div>
    </div>
  );
}
