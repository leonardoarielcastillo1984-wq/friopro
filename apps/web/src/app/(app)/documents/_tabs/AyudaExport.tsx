'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { HelpCircle, BookOpen, ChevronRight } from 'lucide-react';

interface HelpSection {
  title: string;
  description: string;
}

export default function AyudaExport() {
  const [sections, setSections] = useState<HelpSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ sections: HelpSection[] }>('/doc-export/help')
      .then(d => setSections(Array.isArray(d?.sections) ? d.sections : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-neutral-400">Cargando...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-brand-600" /> Ayuda del Sistema de Exportación
      </h2>

      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="h-8 w-8 text-brand-600" />
          <div>
            <h3 className="font-semibold text-neutral-800">Sistema de Exportación Documental</h3>
            <p className="text-sm text-neutral-500">Guía rápida de funcionalidades</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {sections.map((s, i) => (
            <div key={i} className="rounded-lg border border-neutral-100 p-4 hover:border-brand-200 transition-colors">
              <div className="flex items-start gap-2">
                <ChevronRight className="h-4 w-4 text-brand-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-neutral-800">{s.title}</h4>
                  <p className="text-xs text-neutral-500 mt-1">{s.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">Flujo recomendado</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
          <li>Configure su plantilla institucional (pestaña Plantillas)</li>
          <li>Defina reglas de codificación (pestaña Codificación)</li>
          <li>Registre las salidas documentales de cada módulo (pestaña Salidas)</li>
          <li>Use el botón Exportar PDF en cualquier módulo del sistema</li>
          <li>Revise el historial de exportaciones (pestaña Historial)</li>
          <li>Para documentos controlados, cree revisiones y gestione aprobaciones (pestaña Revisiones)</li>
          <li>Valide autenticidad escaneando el código QR del PDF</li>
        </ol>
      </div>
    </div>
  );
}
