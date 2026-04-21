'use client';
import { CheckSquare } from 'lucide-react';
import GenericCrudPage from '@/components/GenericCrudPage';

export default function AccionesPage() {
  return (
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
    />
  );
}
