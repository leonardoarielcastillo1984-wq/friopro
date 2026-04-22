'use client';
import { UsersRound } from 'lucide-react';
import GenericCrudPage from '@/components/GenericCrudPage';

export default function PartesContent() {
  return (
    <GenericCrudPage
      title="Partes Interesadas"
      subtitle="Stakeholders del SGI (ISO 9001/14001/45001 §4.2)"
      endpoint="/stakeholders"
      icon={UsersRound}
      defaultValues={{ type: 'EXTERNAL', category: 'CUSTOMER', influence: 3, interest: 3 }}
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
        { key: 'influence', label: 'Influencia' },
        { key: 'interest', label: 'Interés' },
      ]}
      aiFields={[
        { targetKey: 'needs', buttonLabel: 'Sugerir necesidades', buildPrompt: (f) => `Eres un consultor ISO 9001/14001/45001. Para esta parte interesada:\nNombre: ${f.name || '—'}, Tipo: ${f.type || '—'}, Categoría: ${f.category || '—'}\n\nListá las 5 necesidades más típicas. Una por línea, sin introducción.` },
        { targetKey: 'expectations', buttonLabel: 'Sugerir expectativas', buildPrompt: (f) => `Para la parte interesada:\nNombre: ${f.name || '—'}, Categoría: ${f.category || '—'}\nNecesidades: ${f.needs || '—'}\n\nListá 4-5 expectativas concretas. Una por línea.` },
        { targetKey: 'requirements', buttonLabel: 'Requisitos aplicables', buildPrompt: (f) => `Para la parte interesada:\nNombre: ${f.name || '—'}, Categoría: ${f.category || '—'}\n\nIdentificá los requisitos legales, normativos o contractuales típicamente aplicables.` },
      ]}
    />
  );
}
