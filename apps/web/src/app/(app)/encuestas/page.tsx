import { redirect } from 'next/navigation';

// El módulo real de encuestas de satisfacción vive dentro de Clientes.
// Esta ruta queda como alias para links previos (ej. Preparación de Auditoría).
export default function EncuestasPage() {
  redirect('/clientes?tab=encuestas');
}
