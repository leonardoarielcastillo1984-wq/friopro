'use client';
import { UsersRound } from 'lucide-react';
import GenericCrudPage from '@/components/GenericCrudPage';

export default function PartesInteresadasPage() {
  return (
    <GenericCrudPage
      title="Partes Interesadas"
      subtitle="Stakeholders del SGI (ISO 9001/14001/45001 §4.2) con Evaluación de Cumplimiento"
      endpoint="/stakeholders"
      icon={UsersRound}
      defaultValues={{ type: 'EXTERNAL', category: 'CUSTOMER', influence: 3, interest: 3, complianceStatus: 'COMPLIES', complianceLevel: 100, requiresAction: false }}
      fields={[
        { key: 'name', label: 'Nombre', type: 'text', required: true, fullWidth: true },
        { key: 'type', label: 'Tipo', type: 'select', required: true, options: [
          { value: 'INTERNAL', label: 'Interna' },
          { value: 'EXTERNAL', label: 'Externa' },
        ]},
        { key: 'category', label: 'Categoría', type: 'select', required: true, options: [
          { value: 'EMPLOYEE', label: 'Empleado' },
          { value: 'CUSTOMER', label: 'Cliente' },
          { value: 'SUPPLIER', label: 'Proveedor' },
          { value: 'COMMUNITY', label: 'Comunidad' },
          { value: 'REGULATOR', label: 'Regulador/Autoridad' },
          { value: 'SHAREHOLDER', label: 'Accionista/Propietario' },
          { value: 'OTHER', label: 'Otro' },
        ]},
        { key: 'needs', label: 'Necesidades', type: 'textarea' },
        { key: 'expectations', label: 'Expectativas', type: 'textarea' },
        { key: 'requirements', label: 'Requisitos aplicables', type: 'textarea' },
        { key: 'complianceStatus', label: 'Estado de cumplimiento', type: 'select', options: [
          { value: 'COMPLIES', label: 'Cumple' },
          { value: 'PARTIAL', label: 'Parcial' },
          { value: 'NON_COMPLIANT', label: 'No cumple' },
        ]},
        { key: 'complianceLevel', label: 'Nivel de cumplimiento (%)', type: 'number' },
        { key: 'lastEvaluationDate', label: 'Fecha última evaluación', type: 'date' },
        { key: 'complianceEvidence', label: 'Evidencia', type: 'textarea' },
        { key: 'indicatorId', label: 'Indicador asociado (opcional)', type: 'text' },
        { key: 'requiresAction', label: '¿Requiere acción?', type: 'checkbox' },
        { key: 'influence', label: 'Influencia (1-5)', type: 'number' },
        { key: 'interest', label: 'Interés (1-5)', type: 'number' },
        { key: 'contactName', label: 'Contacto', type: 'text' },
        { key: 'contactEmail', label: 'Email contacto', type: 'text' },
        { key: 'notes', label: 'Notas', type: 'textarea' },
      ]}
      columns={[
        { key: 'name', label: 'Nombre' },
        { key: 'type', label: 'Tipo' },
        { key: 'category', label: 'Categoría' },
        { key: 'complianceStatus', label: 'Estado Cumplimiento', render: (i) => {
          const statusMap = { COMPLIES: '✅ Cumple', PARTIAL: '⚠️ Parcial', NON_COMPLIANT: '❌ No cumple' };
          return statusMap[i.complianceStatus] || '—';
        }},
        { key: 'complianceLevel', label: 'Nivel (%)', render: (i) => i.complianceLevel ? `${i.complianceLevel}%` : '—' },
        { key: 'influence', label: 'Influencia' },
        { key: 'interest', label: 'Interés' },
      ]}
      aiFields={[
        {
          targetKey: 'needs',
          buttonLabel: 'Sugerir necesidades',
          buildPrompt: (f) => `Eres un consultor ISO 9001/14001/45001. Para esta parte interesada:\nNombre: ${f.name || '—'}, Tipo: ${f.type || '—'}, Categoría: ${f.category || '—'}\n\nListá las 5 necesidades más típicas que tiene este tipo de parte interesada respecto a un Sistema de Gestión ISO. Una por línea, sin introducción.`,
        },
        {
          targetKey: 'expectations',
          buttonLabel: 'Sugerir expectativas',
          buildPrompt: (f) => `Eres un consultor ISO. Para la parte interesada:\nNombre: ${f.name || '—'}, Tipo: ${f.type || '—'}, Categoría: ${f.category || '—'}\nNecesidades: ${f.needs || '—'}\n\nListá 4-5 expectativas concretas que esta parte interesada tiene sobre la organización y su SGI. Una por línea.`,
        },
        {
          targetKey: 'requirements',
          buttonLabel: 'Requisitos aplicables',
          buildPrompt: (f) => `Eres un experto en normativa ISO. Para la parte interesada:\nNombre: ${f.name || '—'}, Categoría: ${f.category || '—'}\n\nIdentificá los requisitos legales, normativos o contractuales típicamente aplicables para este tipo de parte interesada en el contexto de un SGI ISO. Listálos concretamente.`,
        },
      ]}
    />
  );
}
