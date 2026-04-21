'use client';
import { Truck } from 'lucide-react';
import GenericCrudPage from '@/components/GenericCrudPage';

export default function ProveedoresPage() {
  return (
    <GenericCrudPage
      title="Proveedores"
      subtitle="Gestión y evaluación de proveedores (ISO 9001 §8.4)"
      endpoint="/suppliers"
      icon={Truck}
      defaultValues={{ status: 'PENDING', isCritical: false }}
      fields={[
        { key: 'name', label: 'Nombre', type: 'text', required: true },
        { key: 'legalName', label: 'Razón social', type: 'text' },
        { key: 'taxId', label: 'CUIT / RUT', type: 'text' },
        { key: 'category', label: 'Categoría', type: 'text', placeholder: 'Insumos, servicios, etc.' },
        { key: 'email', label: 'Email', type: 'text' },
        { key: 'phone', label: 'Teléfono', type: 'text' },
        { key: 'address', label: 'Dirección', type: 'text' },
        { key: 'contactName', label: 'Persona de contacto', type: 'text' },
        { key: 'contactPosition', label: 'Cargo', type: 'text' },
        { key: 'status', label: 'Estado', type: 'select', options: [
          { value: 'PENDING', label: 'Pendiente' },
          { value: 'APPROVED', label: 'Aprobado' },
          { value: 'CONDITIONAL', label: 'Condicional' },
          { value: 'REJECTED', label: 'Rechazado' },
          { value: 'SUSPENDED', label: 'Suspendido' },
        ]},
        { key: 'isCritical', label: 'Proveedor crítico', type: 'checkbox' },
        { key: 'evaluationScore', label: 'Puntaje última evaluación', type: 'number' },
        { key: 'lastEvaluationDate', label: 'Última evaluación', type: 'date' },
        { key: 'nextEvaluationDate', label: 'Próxima evaluación', type: 'date' },
        { key: 'notes', label: 'Notas', type: 'textarea' },
      ]}
      columns={[
        { key: 'code', label: 'Código' },
        { key: 'name', label: 'Nombre' },
        { key: 'category', label: 'Categoría' },
        { key: 'status', label: 'Estado' },
        { key: 'isCritical', label: 'Crítico', render: (i) => i.isCritical ? 'Sí' : 'No' },
        { key: 'evaluationScore', label: 'Score' },
        { key: 'nextEvaluationDate', label: 'Próx. eval.', render: (i) => i.nextEvaluationDate ? new Date(i.nextEvaluationDate).toLocaleDateString() : '—' },
      ]}
    />
  );
}
