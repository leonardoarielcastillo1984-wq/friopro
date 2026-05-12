'use client';
import { useState } from 'react';
import { LayoutDashboard, ListChecks, ClipboardCheck, ScanLine, AlertTriangle, ArrowLeft, Wrench } from 'lucide-react';
import InspeccionesDashboard from './inspecciones/Dashboard';
import InspeccionesPlantillas from './inspecciones/Plantillas';
import InspeccionesLista from './inspecciones/Lista';
import InspeccionesQRs from './inspecciones/QRs';
import InspeccionesHallazgos from './inspecciones/Hallazgos';
import InspeccionesOTs from './inspecciones/OTs';

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'plantillas', label: 'Plantillas', icon: ListChecks },
  { key: 'inspecciones', label: 'Inspecciones', icon: ClipboardCheck },
  { key: 'qrs', label: 'QR Operativos', icon: ScanLine },
  { key: 'hallazgos', label: 'Hallazgos', icon: AlertTriangle },
  { key: 'ots', label: 'Órdenes de Trabajo', icon: Wrench },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function InspeccionesContent() {
  const [tab, setTab] = useState<TabKey>('dashboard');
  const currentIdx = TABS.findIndex(t => t.key === tab);
  const prevTab = currentIdx > 0 ? TABS[currentIdx - 1] : null;

  return (
    <div className="space-y-4">
      {/* Header con flecha volver */}
      <div className="flex items-center gap-3">
        {prevTab && (
          <button onClick={() => setTab(prevTab.key)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />{prevTab.label}
          </button>
        )}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-wrap">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'dashboard' && <InspeccionesDashboard />}
      {tab === 'plantillas' && <InspeccionesPlantillas />}
      {tab === 'inspecciones' && <InspeccionesLista />}
      {tab === 'qrs' && <InspeccionesQRs />}
      {tab === 'hallazgos' && <InspeccionesHallazgos />}
      {tab === 'ots' && <InspeccionesOTs />}
    </div>
  );
}
