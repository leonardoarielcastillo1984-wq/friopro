'use client';
// ============================================================
// Mapa de Procesos 3D — mismos edificios, distribuidos en
// bandas estratégicas / operativas / apoyo con conexiones.
// Vista de impacto + modo edición de posiciones.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import Scene3D from '../_components/Scene3D';
import { DeptPanel, ConnPanel } from '../_components/DeptPanel';
import { fetchConfig, fetchResumen, saveConfig, impactSet, tagDataFor } from '../_components/data';
import { KpiStrip } from '../_components/KpiStrip';
import type { EmpresaConfig, ResumenResponse, DeptSalud, EmpresaConn } from '../_components/types';
import '../centro.css';

const POLL_MS = 60_000;

export default function ProcesosPage() {
  const [config, setConfig] = useState<EmpresaConfig | null>(null);
  const [data, setData] = useState<ResumenResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [selConn, setSelConn] = useState<EmpresaConn | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [impact, setImpact] = useState<{ origin: string; keys: Set<string> } | null>(null);
  const [canEdit] = useState(() => {
    try {
      const p = JSON.parse(localStorage.getItem('userPermissions') || '{}');
      const v = p['centro-empresa'];
      return (typeof v === 'string' ? v : v?.access) === 'edit';
    } catch { return true; }
  });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [{ config: c }, r] = await Promise.all([fetchConfig(), fetchResumen()]);
        if (!alive) return;
        setConfig(c); setData(r);
      } catch { /* retry en el próximo poll */ }
    };
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const salud = useMemo(() => {
    const m = new Map<string, DeptSalud>();
    data?.departments.forEach((d) => m.set(d.key, d.salud));
    return m;
  }, [data]);

  const tagData = useMemo(() => tagDataFor(data?.departments ?? []), [data]);

  const selDept = data?.departments.find((d) => d.key === selected) ?? null;

  const moveDept = async (key: string, x: number, z: number) => {
    if (!config) return;
    const next: EmpresaConfig = JSON.parse(JSON.stringify(config));
    const d = next.departments.find((x) => x.key === key);
    if (!d) return;
    d.procPos = { x: Math.round(x), z: Math.round(z) };
    setConfig(next);
    try { await saveConfig(next); } catch { /* reintenta */ }
  };

  const showImpact = (key: string) => {
    if (!config) return;
    setImpact({ origin: key, keys: impactSet(key, config.connections) });
  };

  return (
    <div className="ce-root">
      <header className="ce-header">
        <div className="ce-title">
          <h1>MAPA DE<span> PROCESOS</span></h1>
          <small>Estratégicos · Operativos · De apoyo — las líneas son relaciones entre procesos</small>
        </div>
        <div className="ce-actions">
          {canEdit && (
            <button className={`ce-btn ${editMode ? '' : 'ghost'}`} onClick={() => setEditMode(!editMode)}>
              <Pencil size={13} /> {editMode ? 'Terminar edición' : 'Editar posiciones'}
            </button>
          )}
        </div>
      </header>

      {config ? (
        <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
          <Scene3D
            depts={config.departments}
            connections={config.connections}
            salud={salud}
            template="procesos"
            selectedKey={selected}
            editMode={editMode}
            impactKeys={impact ? new Set([impact.origin, ...impact.keys]) : null}
            tagData={tagData}
            onSelectDept={(k) => { setSelected(k); if (k) { setSelConn(null); } else { setImpact(null); } }}
            onSelectConn={(c) => { setSelConn(c); if (c) { setSelected(null); setImpact(null); } }}
            onMoveDept={moveDept}
          />
          {/* Leyenda lateral — estilo mockup */}
          <div className="ce-legend">
            <b>Procesos</b>
            <span><i className="dot" style={{ background: '#38bdf8' }} /> Estratégicos</span>
            <span><i className="dot" style={{ background: '#34d399' }} /> Operativos</span>
            <span><i className="dot" style={{ background: '#f59e0b' }} /> De Apoyo</span>
            <b style={{ marginTop: 8 }}>Flujo de proceso</b>
            <span><i className="flow" /> Flujo principal</span>
            <span><i className="flow dash" /> Interdependencia</span>
          </div>
          {impact && data && (
            <div className="ce3-impact">
              <h4>Impacto desde {data.departments.find((d) => d.key === impact.origin)?.name}</h4>
              {impact.keys.size === 0 ? (
                <small className="ce-muted">Sin procesos aguas abajo configurados.</small>
              ) : (
                <ul>
                  {[...impact.keys].map((k) => {
                    const d = data.departments.find((x) => x.key === k);
                    return d ? <li key={k}><span className={`ce-salud ${d.salud}`}><i />{d.name}</span></li> : null;
                  })}
                </ul>
              )}
              <button className="close" onClick={() => setImpact(null)}>Cerrar impacto</button>
            </div>
          )}
        </div>
      ) : (
        <div className="ce3-wrap"><div className="ce3-loading">Cargando configuración…</div></div>
      )}

      {data && <KpiStrip r={data.resumen} />}

      {selDept && <DeptPanel dept={selDept} onClose={() => setSelected(null)} onImpact={() => showImpact(selDept.key)} />}
      {selConn && data && <ConnPanel conn={selConn} depts={data.departments} onClose={() => setSelConn(null)} />}
    </div>
  );
}
