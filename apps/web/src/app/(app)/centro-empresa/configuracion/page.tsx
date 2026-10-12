'use client';
// ============================================================
// Configurador del Centro Empresarial — departamentos, modelos,
// capas de proceso y conexiones. Persiste en /centro-empresa/config.
// ============================================================
import { useEffect, useState } from 'react';
import { Plus, Trash2, Save, RotateCcw } from 'lucide-react';
import { fetchConfig, saveConfig, fetchProcesos } from '../_components/data';
import type { EmpresaConfig, EmpresaDept, DeptLayer, ProcesoDisponible } from '../_components/types';
import '../centro.css';

const LAYERS: { value: DeptLayer; label: string }[] = [
  { value: 'STRATEGIC', label: 'Estratégico' },
  { value: 'OPERATIONAL', label: 'Operativo' },
  { value: 'SUPPORT', label: 'De apoyo' },
];

const MODEL_LABELS: Record<string, string> = {
  'office-building': 'Torre corporativa',
  'site-office': 'Oficinas',
  'factory': 'Planta industrial',
  'warehouse': 'Depósito / Taller',
  'car-wash': 'Servicio',
  'gas-station': 'Centro logístico',
  'water-tower': 'Torre',
};

const MODULE_OPTIONS = [
  { key: '', label: '— Sin vincular —' },
  { key: 'calidad', label: 'Calidad (NCs / CAPA)', href: '/calidad' },
  { key: 'rrhh', label: 'RRHH', href: '/rrhh' },
  { key: 'flota', label: 'Flota 360', href: '/flota-360' },
  { key: 'resultados', label: 'Resultado del Negocio', href: '/resultados' },
  { key: 'clientes', label: 'Clientes', href: '/clientes' },
  { key: 'proveedores', label: 'Proveedores', href: '/proveedores' },
  { key: 'documents', label: 'Documentos', href: '/documents' },
  { key: 'objetivos', label: 'Objetivos SGI', href: '/objetivos' },
  { key: 'indicadores', label: 'Indicadores', href: '/indicadores' },
  { key: 'procesos', label: 'Mapa de procesos (Contexto)', href: '/contexto-sgi' },
  { key: 'infraestructura', label: 'Infraestructura', href: '/infraestructura' },
];

const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<EmpresaConfig | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [procesos, setProcesos] = useState<ProcesoDisponible[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    fetchConfig().then(({ config, models }) => {
      setConfig(JSON.parse(JSON.stringify(config)));
      setModels(models);
    }).catch(() => {});
    fetchProcesos().then(setProcesos);
  }, []);

  const mutate = (fn: (c: EmpresaConfig) => void) => {
    setConfig((c) => { if (!c) return c; const n = JSON.parse(JSON.stringify(c)); fn(n); return n; });
    setDirty(true);
  };

  const setDept = (key: string, patch: Partial<EmpresaDept>) =>
    mutate((c) => { const d = c.departments.find((x) => x.key === key); if (d) Object.assign(d, patch); });

  const setModule = (key: string, moduleKey: string) =>
    mutate((c) => {
      const d = c.departments.find((x) => x.key === key);
      if (!d) return;
      const opt = MODULE_OPTIONS.find((o) => o.key === moduleKey);
      d.moduleKey = moduleKey || null;
      d.moduleHref = opt?.href || null;
    });

  const addDept = () => {
    const name = newName.trim();
    if (!name) return;
    mutate((c) => {
      const key = slug(name) || `depto-${c.departments.length + 1}`;
      if (c.departments.some((d) => d.key === key)) return;
      c.departments.push({
        key, name: name.toUpperCase(), model: 'site-office',
        layer: 'OPERATIONAL', enabled: true,
      });
    });
    setNewName('');
  };

  const removeDept = (key: string) =>
    mutate((c) => {
      c.departments = c.departments.filter((d) => d.key !== key);
      c.connections = c.connections.filter((x) => x.from !== key && x.to !== key);
    });

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await saveConfig(config);
      setDirty(false);
      alert('Configuración guardada');
    } catch (e: any) {
      alert('No se pudo guardar: ' + (e?.message || 'error'));
    } finally { setSaving(false); }
  };

  const enabledKeys = config?.departments.filter((d) => d.enabled).map((d) => d.key) ?? [];

  return (
    <div className="ce-root">
      <header className="ce-header">
        <div className="ce-title">
          <h1>CONFIGU<span>RACIÓN</span></h1>
          <small>Departamentos, edificios, capas de proceso y relaciones</small>
        </div>
        <div className="ce-actions">
          <button className="ce-btn ghost" onClick={() => location.reload()} disabled={!dirty}>
            <RotateCcw size={13} /> Descartar
          </button>
          <button className="ce-btn" onClick={save} disabled={!dirty || saving}>
            <Save size={13} /> {saving ? 'Guardando…' : 'Guardar configuración'}
          </button>
        </div>
      </header>

      {!config && <p className="ce-muted">Cargando configuración…</p>}

      {config && (
        <div className="ce-config">
          {/* Plantilla predeterminada */}
          <div className="ce-form" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <label style={{ fontSize: 12, color: 'var(--ce-dim)', whiteSpace: 'nowrap' }}>Plantilla predeterminada de la empresa:</label>
            <select
              style={{ maxWidth: 220 }}
              value={config.defaultTemplate}
              onChange={(e) => mutate((c) => { c.defaultTemplate = e.target.value as 'campus' | 'procesos'; })}
            >
              <option value="campus">Campus Empresarial</option>
              <option value="procesos">Mapa de Procesos</option>
            </select>
          </div>

          {/* Departamentos */}
          <div className="ce-section" style={{ borderTop: 'none' }}>
            <h4>Departamentos / procesos ({config.departments.length})</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="ce-dept-row" style={{ opacity: .6, padding: '0 12px' }}>
                <span /><span>Nombre</span><span>Subtítulo</span><span>Responsable</span>
                <span>Edificio</span><span>Capa</span><span>Módulo</span><span />
              </div>
              {config.departments.map((d) => (
                <div className="ce-dept" key={d.key} style={{ opacity: d.enabled ? 1 : .45 }}>
                  <div className="ce-dept-row">
                    <input type="checkbox" checked={d.enabled} onChange={(e) => setDept(d.key, { enabled: e.target.checked })} title="Visible en el campus" />
                    <input value={d.name} onChange={(e) => setDept(d.key, { name: e.target.value })} />
                    <input value={d.sub ?? ''} placeholder="Subtítulo" onChange={(e) => setDept(d.key, { sub: e.target.value })} />
                    <input value={d.responsable ?? ''} placeholder="Responsable" onChange={(e) => setDept(d.key, { responsable: e.target.value })} />
                    <select value={d.model} onChange={(e) => setDept(d.key, { model: e.target.value })}>
                      {models.map((m) => <option key={m} value={m}>{MODEL_LABELS[m] ?? m}</option>)}
                    </select>
                    <select value={d.layer} onChange={(e) => setDept(d.key, { layer: e.target.value as DeptLayer })}>
                      {LAYERS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                    <select value={d.moduleKey ?? ''} onChange={(e) => setModule(d.key, e.target.value)} title="Módulo vinculado (fuente de datos y link)">
                      {MODULE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                    <button className="del" onClick={() => removeDept(d.key)} title="Eliminar departamento"><Trash2 size={14} /></button>
                  </div>
                  <div className="ce-dept-extra">
                    <select
                      value={d.processId ?? ''}
                      onChange={(e) => setDept(d.key, { processId: e.target.value || null })}
                      title="Proceso real del mapa (Contexto SGI)"
                    >
                      <option value=''>— Proceso del mapa: sin vincular —</option>
                      {procesos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.parentId ? '· ' : ''}{p.code ? `[${p.code}] ` : ''}{p.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number" min={0} placeholder="Warn ≥"
                      value={d.umbrales?.warn ?? ''}
                      title="Umbrales: N alertas activas → Seguimiento"
                      onChange={(e) => setDept(d.key, { umbrales: { ...d.umbrales, warn: e.target.value === '' ? null : Number(e.target.value) } })}
                    />
                    <input
                      type="number" min={0} placeholder="Crit ≥"
                      value={d.umbrales?.crit ?? ''}
                      title="Umbrales: N alertas activas → Crítico"
                      onChange={(e) => setDept(d.key, { umbrales: { ...d.umbrales, crit: e.target.value === '' ? null : Number(e.target.value) } })}
                    />
                    <span className="ce-pos">
                      {d.campusPos ? `campus ${d.campusPos.x},${d.campusPos.z}` : 'campus auto'}
                      {' · '}
                      {d.procPos ? `proc ${d.procPos.x},${d.procPos.z}` : 'proc auto'}
                    </span>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ flex: 1 }}
                  className="ce-form"
                  value={newName}
                  placeholder="Nombre del nuevo departamento…"
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addDept()}
                />
                <button className="ce-btn ghost" onClick={addDept}><Plus size={13} /> Agregar</button>
              </div>
            </div>
          </div>

          {/* Conexiones (mapa de procesos) */}
          <div className="ce-section">
            <h4>Relaciones entre procesos ({config.connections.length})</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {config.connections.map((cn, i) => (
                <div className="ce-conn" key={i}>
                  <select value={cn.from} onChange={(e) => mutate((c) => { c.connections[i].from = e.target.value; })}>
                    {enabledKeys.map((k) => <option key={k} value={k}>{config.departments.find((d) => d.key === k)?.name ?? k}</option>)}
                  </select>
                  <span style={{ color: 'var(--ce-accent)' }}>→</span>
                  <select value={cn.to} onChange={(e) => mutate((c) => { c.connections[i].to = e.target.value; })}>
                    {enabledKeys.map((k) => <option key={k} value={k}>{config.departments.find((d) => d.key === k)?.name ?? k}</option>)}
                  </select>
                  <input value={cn.label ?? ''} placeholder="Qué se intercambia (opcional)" onChange={(e) => mutate((c) => { c.connections[i].label = e.target.value; })} />
                  <button className="del" style={{ background: 'none', border: 'none', color: 'var(--ce-dim)', cursor: 'pointer' }}
                    onClick={() => mutate((c) => { c.connections.splice(i, 1); })} title="Eliminar relación">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                className="ce-btn ghost"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => {
                  if (enabledKeys.length >= 2) {
                    mutate((c) => { c.connections.push({ from: enabledKeys[0], to: enabledKeys[1], label: '', tipo: 'INFORMACION' }); });
                  }
                }}
              >
                <Plus size={13} /> Agregar relación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
