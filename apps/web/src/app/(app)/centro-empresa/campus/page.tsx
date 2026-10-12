'use client';
// ============================================================
// Campus Empresarial 3D — edificios = departamentos.
// Vista de impacto + modo edición de posiciones.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import Scene3D from '../_components/Scene3D';
import { DeptPanel } from '../_components/DeptPanel';
import { fetchConfig, fetchResumen, saveConfig, impactSet } from '../_components/data';
import type { EmpresaConfig, ResumenResponse, DeptSalud } from '../_components/types';
import '../centro.css';

const POLL_MS = 60_000;

export default function CampusPage() {
  const [config, setConfig] = useState<EmpresaConfig | null>(null);
  const [data, setData] = useState<ResumenResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [impact, setImpact] = useState<{ origin: string; keys: Set<string> } | null>(null);
  const [canEdit] = useState(() => {
    try {
      const p = JSON.parse(localStorage.getItem('userPermissions') || '{}');
      const v = p['centro-empresa'];
      return (typeof v === 'string' ? v : v?.access) === 'edit';
    } catch { return true; } // admins → permisos no definidos → edit
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

  const selDept = data?.departments.find((d) => d.key === selected) ?? null;

  // Arrastre de edificio → persistir campusPos en la config.
  const moveDept = async (key: string, x: number, z: number) => {
    if (!config) return;
    const next: EmpresaConfig = JSON.parse(JSON.stringify(config));
    const d = next.departments.find((x) => x.key === key);
    if (!d) return;
    d.campusPos = { x: Math.round(x), z: Math.round(z) };
    setConfig(next);
    try { await saveConfig(next); } catch { /* reintenta en el próximo save */ }
  };

  const showImpact = (key: string) => {
    if (!config) return;
    setImpact({ origin: key, keys: impactSet(key, config.connections) });
  };

  return (
    <div className="ce-root">
      <header className="ce-header">
        <div className="ce-title">
          <h1>CAMPUS<span> EMPRESARIAL</span></h1>
          <small>Cada edificio es un departamento — tocá uno para ver su estado</small>
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
            template="campus"
            selectedKey={selected}
            editMode={editMode}
            impactKeys={impact ? new Set([impact.origin, ...impact.keys]) : null}
            onSelectDept={(k) => { setSelected(k); if (!k) setImpact(null); }}
            onMoveDept={moveDept}
          />
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

      {selDept && <DeptPanel dept={selDept} onClose={() => setSelected(null)} onImpact={() => showImpact(selDept.key)} />}
    </div>
  );
}
