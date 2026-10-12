'use client';
// ============================================================
// Wrapper React del CampusWorld — monta el canvas, expone los
// controles de cámara y propaga selección de edificio/conexión.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw, RotateCw, Maximize2, Fullscreen, Minimize2 } from 'lucide-react';
import { CampusWorld } from './CampusWorld';
import { SALUD_META } from './types';
import type { EmpresaDept, EmpresaConn, DeptSalud, TemplateKey } from './types';

interface Props {
  depts: EmpresaDept[];
  connections: EmpresaConn[];
  salud: Map<string, DeptSalud>;
  template: TemplateKey;
  selectedKey?: string | null;
  editMode?: boolean;
  impactKeys?: Set<string> | null;   // null = vista normal
  tagData?: Map<string, { value?: string; dir?: 'up' | 'down' | 'flat' }>;
  onSelectDept?: (key: string | null) => void;
  onSelectConn?: (conn: EmpresaConn | null) => void;
  onMoveDept?: (key: string, x: number, z: number) => void;
}

export default function Scene3D({ depts, connections, salud, template, selectedKey, editMode, impactKeys, tagData, onSelectDept, onSelectConn, onMoveDept }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<CampusWorld | null>(null);
  const cbRef = useRef({ onSelectDept, onSelectConn, onMoveDept });
  cbRef.current = { onSelectDept, onSelectConn, onMoveDept };
  const [ready, setReady] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [hover, setHover] = useState<{ key: string; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const w = new CampusWorld(hostRef.current, {
      onSelectDept: (k) => cbRef.current.onSelectDept?.(k),
      onSelectConn: (c) => cbRef.current.onSelectConn?.(c),
      onMoveDept: (k, x, z) => cbRef.current.onMoveDept?.(k, x, z),
      onHover: (k, x, y) => setHover(k ? { key: k, x, y } : null),
    });
    worldRef.current = w;
    w.init(depts, connections, salud).then(() => setReady(true)).catch(() => setReady(true));
    return () => { w.dispose(); worldRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { worldRef.current?.setTemplate(template); }, [template, ready]);
  useEffect(() => { worldRef.current?.setEditMode(!!editMode); }, [editMode, ready]);
  useEffect(() => { if (tagData) worldRef.current?.setTagData(tagData); }, [tagData, ready]);
  useEffect(() => { worldRef.current?.focusOnly(impactKeys ?? null); }, [impactKeys, ready]);
  useEffect(() => {
    const w = worldRef.current;
    if (!w || !ready) return;
    salud.forEach((s, k) => w.setSalud(k, s));
  }, [salud, ready]);
  useEffect(() => { worldRef.current?.selectDept(selectedKey ?? null); }, [selectedKey, ready]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    wrapRef.current?.requestFullscreen?.().catch(() => {});
  };

  const w = () => worldRef.current;

  return (
    <div className="ce3-wrap" ref={wrapRef}>
      <div ref={hostRef} className="ce3-host" />
      {!ready && <div className="ce3-loading">Construyendo campus…</div>}
      <div className="ce3-zoom">
        <button onClick={() => w()?.zoomOut()} title="Alejar" aria-label="Alejar"><Minus size={13} /></button>
        <button onClick={() => w()?.zoomIn()} title="Acercar" aria-label="Acercar"><Plus size={13} /></button>
        <i />
        <button onClick={() => w()?.rotateL()} title="Girar izquierda" aria-label="Girar izquierda"><RotateCcw size={13} /></button>
        <button onClick={() => w()?.rotateR()} title="Girar derecha" aria-label="Girar derecha"><RotateCw size={13} /></button>
        <i />
        <button onClick={() => w()?.fitView()} title="Ver todo el campus" aria-label="Ver todo"><Maximize2 size={13} /></button>
        <button onClick={toggleFullscreen} title={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'} aria-pressed={fullscreen}>
          {fullscreen ? <Minimize2 size={13} /> : <Fullscreen size={13} />}
        </button>
      </div>
      <div className="ce3-legend">
        <span className="dot ok" /> En objetivo
        <span className="dot warn" /> Seguimiento
        <span className="dot crit" /> Crítico
        <span className="dot nodata" /> Sin datos
      </div>
      {editMode && <div className="ce3-edit">MODO EDICIÓN — arrastrá los edificios para reposicionarlos</div>}
      {hover && (() => {
        const d = depts.find((x) => x.key === hover.key);
        if (!d) return null;
        const s = SALUD_META[salud.get(hover.key) ?? 'nodata'];
        const rect = wrapRef.current?.getBoundingClientRect();
        return (
          <div className="ce-tip" style={{ left: hover.x - (rect?.left ?? 0) + 14, top: hover.y - (rect?.top ?? 0) + 10 }}>
            <b>{d.name}</b><span>{s.label}</span>
          </div>
        );
      })()}
    </div>
  );
}
