'use client';
import { useState } from 'react';
import { LayoutDashboard, ListChecks, ClipboardCheck, ScanLine, AlertTriangle } from 'lucide-react';
import InspeccionesDashboard from './inspecciones/Dashboard';
import InspeccionesPlantillas from './inspecciones/Plantillas';
import InspeccionesLista from './inspecciones/Lista';
import InspeccionesQRs from './inspecciones/QRs';
import InspeccionesHallazgos from './inspecciones/Hallazgos';

export default function InspeccionesContent() {
  const [tab, setTab] = useState<'dashboard'|'plantillas'|'inspecciones'|'qrs'|'hallazgos'>('dashboard');
  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {[
          { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { key: 'plantillas', label: 'Plantillas', icon: ListChecks },
          { key: 'inspecciones', label: 'Inspecciones', icon: ClipboardCheck },
          { key: 'qrs', label: 'QR Operativos', icon: ScanLine },
          { key: 'hallazgos', label: 'Hallazgos', icon: AlertTriangle },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>
      {tab === 'dashboard' && <InspeccionesDashboard />}
      {tab === 'plantillas' && <InspeccionesPlantillas />}
      {tab === 'inspecciones' && <InspeccionesLista />}
      {tab === 'qrs' && <InspeccionesQRs />}
      {tab === 'hallazgos' && <InspeccionesHallazgos />}
    </div>
  );
}
