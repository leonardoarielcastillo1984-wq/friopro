'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useModulePermission } from '@/hooks/useModulePermission';
import { TrendingUp, Receipt, Wallet, Building2, HandCoins, Upload, Eye, Pin, Landmark, LineChart, Scale } from 'lucide-react';
import Dashboard from './_components/Dashboard';
import Facturacion from './_components/Facturacion';
import Gastos from './_components/Gastos';
import CentrosCosto from './_components/CentrosCosto';
import CuentasPorCobrar from './_components/CuentasPorCobrar';
import CuentasPorPagar from './_components/CuentasPorPagar';
import FlujoCaja from './_components/FlujoCaja';
import Rentabilidad from './_components/Rentabilidad';
import ImportarSII from './_components/ImportarSII';

type Tab = 'resultados' | 'facturacion' | 'cobrar' | 'gastos' | 'pagar' | 'caja' | 'rentabilidad' | 'importar' | 'centros';

const TABS: { key: Tab; label: string; icon: any; edit?: boolean }[] = [
  { key: 'resultados', label: 'Resultados', icon: TrendingUp },
  { key: 'facturacion', label: 'Ventas / facturas', icon: Receipt },
  { key: 'cobrar', label: 'Cuentas por cobrar', icon: HandCoins },
  { key: 'gastos', label: 'Gastos', icon: Wallet },
  { key: 'pagar', label: 'Cuentas por pagar', icon: Landmark },
  { key: 'caja', label: 'Flujo de caja', icon: LineChart },
  { key: 'rentabilidad', label: 'Rentabilidad y proyección', icon: Scale },
  { key: 'importar', label: 'Importar SII', icon: Upload, edit: true },
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
  const router = useRouter();
  const permiso = useModulePermission('resultados');
  // Solo lectura únicamente si el permiso es explícitamente 'view' (admins sin mapa de permisos editan)
  const canEdit = permiso !== 'view';
  const tabParam = searchParams.get('tab') as Tab | null;
  const [tab, setTabState] = useState<Tab>(tabParam && TABS.some(t => t.key === tabParam) ? tabParam : 'resultados');
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [moneda, setMoneda] = useState<string>('');
  const [monedasUsadas, setMonedasUsadas] = useState<string[]>([]);
  const [config, setConfig] = useState<{ monedaLocal: string | null; monedaDefault: string | null } | null>(null);
  const [centroCostoId, setCentroCostoId] = useState('');
  const [centros, setCentros] = useState<any[]>([]);

  const setTab = (t: Tab) => { setTabState(t); router.replace(`/resultados?tab=${t}`, { scroll: false }); };

  const loadCentros = useCallback(() => {
    apiFetch<{ centros: any[] }>('/finanzas/centros-costo').then(d => setCentros(d.centros)).catch(() => {});
  }, []);
  const loadMonedas = useCallback(() => {
    apiFetch<{ monedas: string[] }>('/finanzas/monedas').then(d => setMonedasUsadas(d.monedas)).catch(() => {});
  }, []);
  // Arranca en la moneda configurada para la empresa activa (Argentina → ARS, Chile → CLP, o la elegida)
  useEffect(() => {
    loadCentros();
    Promise.all([
      apiFetch<{ monedaLocal: string | null; monedaDefault: string | null }>('/finanzas/config').catch(() => null),
      apiFetch<{ monedas: string[] }>('/finanzas/monedas').catch(() => ({ monedas: [] as string[] })),
    ]).then(([cfg, usadas]) => {
      setConfig(cfg);
      setMonedasUsadas(usadas.monedas);
      setMoneda(cfg?.monedaDefault || usadas.monedas[0] || 'USD');
    });
  }, [loadCentros, loadMonedas]);

  const fijarMoneda = async () => {
    try {
      setConfig(await apiFetch('/finanzas/config', { method: 'PUT', json: { monedaDefault: moneda === config?.monedaLocal ? null : moneda } }));
    } catch {}
  };

  const onChanged = () => { loadMonedas(); };

  const anioActual = new Date().getFullYear();
  const anios: number[] = [];
  for (let a = anioActual; a >= anioActual - 4; a--) anios.push(a);
  // Moneda local de la empresa + USD + cualquier otra con documentos cargados
  const opcionesMoneda = [...new Set([config?.monedaLocal, 'USD', ...monedasUsadas, moneda].filter(Boolean) as string[])];
  const tabsVisibles = TABS.filter(t => !t.edit || canEdit);
  const sel = 'rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none';

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Resultado de Negocio</h1>
          <p className="mt-0.5 text-sm text-neutral-500">Cuánto vendimos, cuánto gastamos y cuánto ganamos (o perdimos) cada mes.</p>
          {!canEdit && <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500"><Eye size={11} />Modo consulta</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {['resultados', 'rentabilidad'].includes(tab) && (
            <select value={anio} onChange={e => setAnio(Number(e.target.value))} className={sel}>
              {anios.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
          <select value={moneda} onChange={e => setMoneda(e.target.value)} className={sel} title="Muestra solo los documentos cargados en esa moneda (no convierte)">
            {opcionesMoneda.map(m => <option key={m} value={m}>{m === config?.monedaLocal ? `${m} (local)` : m}</option>)}
          </select>
          {canEdit && moneda && config && moneda !== config.monedaDefault && (
            <button onClick={fijarMoneda} className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs text-neutral-600 hover:bg-neutral-50" title="Que esta empresa abra siempre en esta moneda">
              <Pin size={12} /> Abrir siempre en {moneda}
            </button>
          )}
          {['resultados', 'rentabilidad'].includes(tab) && (
            <select value={centroCostoId} onChange={e => setCentroCostoId(e.target.value)} className={sel}>
              <option value="">Toda la empresa</option>
              {centros.filter(c => c.activo).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-neutral-200">
        {tabsVisibles.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}>
            <t.icon size={15} />{t.label}
          </button>
        ))}
      </div>

      {moneda && (
        <div key={moneda}>
          {tab === 'resultados' && <Dashboard anio={anio} moneda={moneda} centroCostoId={centroCostoId} canEdit={canEdit} />}
          {tab === 'facturacion' && <Facturacion centros={centros} moneda={moneda} monedas={opcionesMoneda} canEdit={canEdit} onChanged={onChanged} />}
          {tab === 'cobrar' && <CuentasPorCobrar moneda={moneda} onIrFacturacion={() => setTab('facturacion')} />}
          {tab === 'gastos' && <Gastos centros={centros} moneda={moneda} monedas={opcionesMoneda} canEdit={canEdit} onChanged={onChanged} />}
          {tab === 'pagar' && <CuentasPorPagar moneda={moneda} centros={centros} canEdit={canEdit} onChanged={onChanged} />}
          {tab === 'caja' && <FlujoCaja moneda={moneda} />}
          {tab === 'rentabilidad' && <Rentabilidad anio={anio} moneda={moneda} centroCostoId={centroCostoId} />}
          {tab === 'importar' && canEdit && <ImportarSII centros={centros} moneda={moneda} monedas={opcionesMoneda} onChanged={onChanged} />}
          {tab === 'centros' && <CentrosCosto centros={centros} canEdit={canEdit} reload={loadCentros} />}
        </div>
      )}
    </div>
  );
}
