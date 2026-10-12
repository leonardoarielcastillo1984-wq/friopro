'use client';
// ============================================================
// Campus Empresarial 3D — edificios = departamentos.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import Scene3D from '../_components/Scene3D';
import { DeptPanel } from '../_components/DeptPanel';
import { fetchConfig, fetchResumen } from '../_components/data';
import type { EmpresaConfig, ResumenResponse, DeptSalud } from '../_components/types';
import '../centro.css';

const POLL_MS = 60_000;

export default function CampusPage() {
  const [config, setConfig] = useState<EmpresaConfig | null>(null);
  const [data, setData] = useState<ResumenResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

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
          <h1>CAMPUS<span> EMPRESARIAL</span></h1>
          <small>Cada edificio es un departamento — tocá uno para ver su estado</small>
        </div>
      </header>

      {config ? (
        <Scene3D
          depts={config.departments}
          connections={config.connections}
          salud={salud}
          template="campus"
          selectedKey={selected}
          onSelectDept={(k) => setSelected(k)}
        />
      ) : (
        <div className="ce3-wrap"><div className="ce3-loading">Cargando configuración…</div></div>
      )}

      {selDept && <DeptPanel dept={selDept} onClose={() => setSelected(null)} />}
    </div>
  );
}
