'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { LayoutDashboard, ListChecks, ClipboardCheck, ScanLine, AlertTriangle, Bell, Star, BarChart2, Wrench, QrCode } from 'lucide-react';
import InspeccionesDashboard from '@/app/(app)/infraestructura/_tabs/inspecciones/Dashboard';
import InspeccionesPlantillas from '@/app/(app)/infraestructura/_tabs/inspecciones/Plantillas';
import InspeccionesLista from '@/app/(app)/infraestructura/_tabs/inspecciones/Lista';
import InspeccionesQRs from '@/app/(app)/infraestructura/_tabs/inspecciones/QRs';
import InspeccionesHallazgos from '@/app/(app)/infraestructura/_tabs/inspecciones/Hallazgos';
import InspeccionesOTs from '@/app/(app)/infraestructura/_tabs/inspecciones/OTs';
import AlertasConfig from '@/app/(app)/infraestructura/_tabs/inspecciones/AlertasConfig';
import QRFeedback from '@/app/(app)/infraestructura/_tabs/inspecciones/QRFeedback';
import FeedbackStats from '@/app/(app)/infraestructura/_tabs/inspecciones/FeedbackStats';
import IntervencionesQR from '@/app/(app)/mantenimiento/IntervencionesQR';

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'inspecciones', label: 'Inspecciones', icon: ClipboardCheck },
  { key: 'plantillas', label: 'Plantillas', icon: ListChecks },
  { key: 'qrs', label: 'QR Operativos', icon: ScanLine },
  { key: 'intervenciones', label: 'Intervenciones QR', icon: QrCode },
  { key: 'hallazgos', label: 'Hallazgos', icon: AlertTriangle },
  { key: 'ots', label: 'OTs de inspección', icon: Wrench },
  { key: 'feedback-qrs', label: 'QR Feedback', icon: Star },
  { key: 'satisfaccion', label: 'Satisfacción', icon: BarChart2 },
  { key: 'alertas', label: 'Alertas', icon: Bell },
] as const;

type TabKey = typeof TABS[number]['key'];

/**
 * Inspecciones Inteligentes embebidas en Flota 360.
 * Reutiliza los mismos componentes de Infraestructura (misma API /inspecciones,
 * mismos datos por tenant) — la gestión de transporte vive acá.
 */
export default function InspeccionesPage() {
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [assets, setAssets] = useState<any[]>([]);

  // Los activos solo se necesitan para Intervenciones QR — carga lazy
  useEffect(() => {
    if (tab === 'intervenciones' && assets.length === 0) {
      apiFetch<{ assets: any[] }>('/maintenance/assets')
        .then((r) => setAssets((r.assets || []).filter((a: any) => a.category === 'VEHICLE')))
        .catch(() => {});
    }
  }, [tab, assets.length]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Inspecciones Inteligentes</h1>
        <p className="text-sm text-neutral-500">Checklists QR de la flota — plantillas, QRs operativos, hallazgos y OTs generadas</p>
      </div>

      <div className="flex gap-1 bg-neutral-100 p-1 rounded-xl flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === key ? 'bg-white shadow text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <InspeccionesDashboard />}
      {tab === 'inspecciones' && <InspeccionesLista />}
      {tab === 'plantillas' && <InspeccionesPlantillas />}
      {tab === 'qrs' && <InspeccionesQRs assetScope="fleet" />}
      {tab === 'intervenciones' && <IntervencionesQR assets={assets} />}
      {tab === 'hallazgos' && <InspeccionesHallazgos />}
      {tab === 'ots' && <InspeccionesOTs />}
      {tab === 'feedback-qrs' && <QRFeedback assetScope="fleet" />}
      {tab === 'satisfaccion' && <FeedbackStats />}
      {tab === 'alertas' && <AlertasConfig />}
    </div>
  );
}
