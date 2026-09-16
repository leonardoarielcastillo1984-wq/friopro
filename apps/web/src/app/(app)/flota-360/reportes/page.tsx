'use client';

import Link from 'next/link';
import { FileBarChart, ExternalLink } from 'lucide-react';

export default function ReportesFlotaPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Reportes</h1>
        <p className="text-sm text-neutral-500">Exportación y reportes generales del sistema — no duplica lógica existente</p>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileBarChart className="h-6 w-6 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-neutral-800">Centro de reportes de SGI360</p>
            <p className="text-xs text-neutral-500">Incluye exportaciones de mantenimiento, flota e inspecciones</p>
          </div>
        </div>
        <Link href="/reportes" className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
          <ExternalLink className="h-4 w-4" /> Ir a Reportes
        </Link>
      </div>
    </div>
  );
}
