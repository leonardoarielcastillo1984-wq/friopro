'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { TrendingUp, Receipt, Wallet, Building2 } from 'lucide-react';
import Dashboard from './_components/Dashboard';
import Facturacion from './_components/Facturacion';
import Gastos from './_components/Gastos';
import CentrosCosto from './_components/CentrosCosto';

type Tab = 'resultados' | 'facturacion' | 'gastos' | 'centros';

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'resultados', label: 'Resultados', icon: TrendingUp },
  { key: 'facturacion', label: 'Facturación', icon: Receipt },
  { key: 'gastos', label: 'Gastos', icon: Wallet },
  { key: 'centros', label: 'Centros de costo', icon: Building2 },
];

export default function ResultadosPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-neutral-500">Cargando…</div>}>
      <ResultadosPageInner />
    </Suspense>
  );
}

function ResultadosPageInner() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'resultados');
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [moneda, setMoneda] = useState('');
  const [centroCostoId, setCentroCostoId] = useState('');
  const [centros, setCentros] = useState<any[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const loadCentros = useCallback(() => {
    apiFetch<{ centros: any[] }>('/finanzas/centros-costo').then(d => setCentros(d.centros)).catch(() => {});
  }, []);
  useEffect(() => { loadCentros(); }, [loadCentros]);

  const anios: number[] = [];
  const anioActual = new Date().getFullYear();
  for (let a = anioActual; a >= anioActual - 3; a--) anios.push(a);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Resultados del Negocio</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Consolidado económico: facturación, cobranzas, costos operativos y estructura.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={anio} onChange={e => setAnio(Number(e.target.value))}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none">
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={moneda} onChange={e => setMoneda(e.target.value)}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none">
            <option value="">Todas las monedas</option>
            <option value="ARS">ARS</option><option value="CLP">CLP</option><option value="USD">USD</option>
          </select>
          <select value={centroCostoId} onChange={e => setCentroCostoId(e.target.value)}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none">
            <option value="">Todas las unidades</option>
            {centros.filter(c => c.activo).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-4 flex gap-1 border-b border-neutral-200">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}>
            <t.icon size={15} />{t.label}
          </button>
        ))}
      </div>

      <div key={reloadKey}>
        {tab === 'resultados' && <Dashboard anio={anio} moneda={moneda} centroCostoId={centroCostoId} />}
        {tab === 'facturacion' && <Facturacion centros={centros} onChanged={() => setReloadKey(k => k + 1)} />}
        {tab === 'gastos' && <Gastos centros={centros} onChanged={() => setReloadKey(k => k + 1)} />}
        {tab === 'centros' && <CentrosCosto centros={centros} reload={loadCentros} />}
      </div>
    </div>
  );
}
