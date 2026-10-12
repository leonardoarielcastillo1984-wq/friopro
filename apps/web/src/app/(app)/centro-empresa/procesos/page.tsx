'use client';
// ============================================================
// Mapa de Procesos 3D — mismos edificios, distribuidos en
// bandas estratégicas / operativas / apoyo con conexiones.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import Scene3D from '../_components/Scene3D';
import { DeptPanel, ConnPanel } from '../_components/DeptPanel';
import { fetchConfig, fetchResumen } from '../_components/data';
import type { EmpresaConfig, ResumenResponse, DeptSalud, EmpresaConn } from '../_components/types';
import '../centro.css';

const POLL_MS = 60_000;

export default function ProcesosPage() {
  const [config, setConfig] = useState<EmpresaConfig | null>(null);
  const [data, setData] = useState<ResumenResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [selConn, setSelConn] = useState<EmpresaConn | null>(null);

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

  return (
    <div className="ce-root">
      <header className="ce-header">
        <div className="ce-title">
          <h1>MAPA DE<span> PROCESOS</span></h1>
          <small>Estratégicos · Operativos · De apoyo — las líneas son relaciones entre procesos</small>
        </div>
      </header>

      {config ? (
        <Scene3D
          depts={config.departments}
          connections={config.connections}
          salud={salud}
          template="procesos"
          selectedKey={selected}
          onSelectDept={(k) => { setSelected(k); if (k) setSelConn(null); }}
          onSelectConn={(c) => { setSelConn(c); if (c) setSelected(null); }}
        />
      ) : (
        <div className="ce3-wrap"><div className="ce3-loading">Cargando configuración…</div></div>
      )}

      {selDept && <DeptPanel dept={selDept} onClose={() => setSelected(null)} />}
      {selConn && data && <ConnPanel conn={selConn} depts={data.departments} onClose={() => setSelConn(null)} />}
    </div>
  );
}
