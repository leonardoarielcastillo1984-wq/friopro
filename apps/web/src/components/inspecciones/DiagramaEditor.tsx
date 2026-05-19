'use client';
import { useState, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { X, Plus, Upload, Trash2, Save, ImagePlus, MapPin } from 'lucide-react';

interface Punto { x: number; y: number; label: string }
interface FotoCuadrante { url: string; titulo: string; puntos: Punto[] }
const TITULOS = ['Frente', 'Lateral izquierdo', 'Lateral derecho', 'Trasera'];

interface Props {
  plantillaId: string;
  plantillaNombre: string;
  initialFotos?: FotoCuadrante[];
  onClose: () => void;
  onSaved: () => void;
}

export default function DiagramaEditor({ plantillaId, plantillaNombre, initialFotos, onClose, onSaved }: Props) {
  const [fotos, setFotos] = useState<FotoCuadrante[]>(
    initialFotos?.length ? initialFotos : [{ url: '', titulo: 'Frente', puntos: [] }]
  );
  const [activeIdx, setActiveIdx] = useState(0);
  const [addingPoint, setAddingPoint] = useState(false);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const foto = fotos[activeIdx] ?? { url: '', titulo: '', puntos: [] };

  function onFileChange(idx: number, file: File) {
    console.log('[DiagramaEditor] onFileChange idx=', idx, 'file=', file.name, file.type, file.size);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      console.log('[DiagramaEditor] FileReader loaded, dataUrl length=', dataUrl?.length);
      setFotos(prev => {
        const next = prev.map((f, i) => i === idx ? { ...f, url: dataUrl } : f);
        console.log('[DiagramaEditor] setFotos next[idx].url length=', next[idx]?.url?.length);
        return next;
      });
    };
    reader.onerror = (err) => console.error('[DiagramaEditor] FileReader error', err);
    reader.readAsDataURL(file);
  }

  function onImgClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!addingPoint) return;
    const div = containerRef.current;
    if (!div) return;
    const rect = div.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    setFotos(prev => prev.map((f, i) =>
      i === activeIdx ? { ...f, puntos: [...f.puntos, { x, y, label: `Punto ${f.puntos.length + 1}` }] } : f
    ));
    setAddingPoint(false);
  }

  function removePoint(pIdx: number) {
    setFotos(prev => prev.map((f, i) =>
      i === activeIdx ? { ...f, puntos: f.puntos.filter((_, j) => j !== pIdx) } : f
    ));
  }

  function updateLabel(pIdx: number, label: string) {
    setFotos(prev => prev.map((f, i) =>
      i === activeIdx ? { ...f, puntos: f.puntos.map((p, j) => j === pIdx ? { ...p, label } : p) } : f
    ));
  }

  async function save() {
    setSaving(true);
    try {
      await apiFetch(`/inspecciones/plantillas/${plantillaId}/diagrama`, {
        method: 'PATCH',
        json: { fotos },
      });
      onSaved();
    } catch (e: any) {
      alert('Error al guardar: ' + (e?.message || 'intentá de nuevo'));
    } finally {
      setSaving(false);
    }
  }

  console.log('[DiagramaEditor] render activeIdx=', activeIdx, 'foto.url length=', foto.url?.length, 'fotos.length=', fotos.length);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 9999, overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 900, margin: '16px 0', boxShadow: '0 25px 50px rgba(0,0,0,.25)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>Editor de Diagrama</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{plantillaNombre} · Modelo maestro — aplica a todos los equipos con esta plantilla</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? .6 : 1 }}>
              <Save size={15} />{saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" onClick={onClose} style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex' }}>
          {/* Sidebar */}
          <div style={{ width: 160, borderRight: '1px solid #f1f5f9', padding: 12, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', padding: '0 4px 4px' }}>Vistas</div>
            {fotos.map((f, idx) => (
              <div
                key={idx}
                onClick={() => { setActiveIdx(idx); setAddingPoint(false); }}
                style={{
                  cursor: 'pointer', padding: '8px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                  background: activeIdx === idx ? '#eff6ff' : 'transparent',
                  border: activeIdx === idx ? '1px solid #bfdbfe' : '1px solid transparent',
                  color: activeIdx === idx ? '#1d4ed8' : '#475569',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{f.titulo || `Vista ${idx + 1}`}</span>
                  {fotos.length > 1 && (
                    <span onClick={e => { e.stopPropagation(); setFotos(prev => prev.filter((_, i) => i !== idx)); setActiveIdx(Math.max(0, idx - 1)); }}
                      style={{ color: '#94a3b8', cursor: 'pointer', marginLeft: 4 }}>
                      <X size={11} />
                    </span>
                  )}
                </div>
                {/* thumbnail */}
                <div style={{ width: '100%', height: 40, borderRadius: 6, overflow: 'hidden', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {f.url
                    ? <img src={f.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <ImagePlus size={16} color="#cbd5e1" />
                  }
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>{f.puntos.length} puntos</div>
              </div>
            ))}
            {fotos.length < 4 && (
              <button type="button" onClick={() => {
                const idx = fotos.length;
                setFotos(prev => [...prev, { url: '', titulo: TITULOS[idx] || `Vista ${idx + 1}`, puntos: [] }]);
                setActiveIdx(idx);
              }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: 'none', border: '1px dashed #cbd5e1', borderRadius: 10, fontSize: 11, color: '#64748b', cursor: 'pointer' }}>
                <Plus size={12} />Agregar vista
              </button>
            )}
          </div>

          {/* Área principal */}
          <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {/* Controles cuadrante */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                value={foto.titulo}
                onChange={e => setFotos(prev => prev.map((f, i) => i === activeIdx ? { ...f, titulo: e.target.value } : f))}
                style={{ flex: 1, minWidth: 120, padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, outline: 'none' }}
                placeholder="Nombre de esta vista (ej: Frente)"
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                <Upload size={13} />{foto.url ? 'Cambiar foto' : 'Subir foto'}
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const fl = e.target.files?.[0]; if (fl) onFileChange(activeIdx, fl); }} />
              </label>
              {foto.url && (
                <button type="button" onClick={() => setAddingPoint(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: addingPoint ? '#f97316' : '#ecfdf5', border: `1px solid ${addingPoint ? '#ea580c' : '#bbf7d0'}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: addingPoint ? '#fff' : '#15803d', cursor: 'pointer' }}>
                  <MapPin size={13} />{addingPoint ? '▶ Click en la foto' : 'Agregar punto'}
                </button>
              )}
            </div>

            {/* Imagen principal */}
            {foto.url ? (
              <div
                ref={containerRef}
                onClick={onImgClick}
                style={{
                  position: 'relative',
                  border: `2px solid ${addingPoint ? '#f97316' : '#e2e8f0'}`,
                  borderRadius: 12,
                  cursor: addingPoint ? 'crosshair' : 'default',
                  lineHeight: 0,
                  userSelect: 'none',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={foto.url}
                  alt="diagrama"
                  style={{ width: '100%', borderRadius: 10, display: 'block', maxHeight: 500, objectFit: 'contain' }}
                  draggable={false}
                />
                {/* Puntos */}
                {foto.puntos.map((p, pIdx) => (
                  <div key={pIdx} style={{
                    position: 'absolute',
                    left: `${p.x}%`, top: `${p.y}%`,
                    transform: 'translate(-50%,-50%)',
                    width: 24, height: 24,
                    borderRadius: '50%',
                    background: '#2563eb',
                    border: '2px solid #fff',
                    boxShadow: '0 2px 6px rgba(0,0,0,.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 10, fontWeight: 700,
                    pointerEvents: 'none',
                  }}>
                    {pIdx + 1}
                  </div>
                ))}
                {addingPoint && (
                  <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', background: '#f97316', color: '#fff', padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, pointerEvents: 'none', boxShadow: '0 2px 8px rgba(0,0,0,.2)' }}>
                    Hacé click donde quieras colocar el punto
                  </div>
                )}
              </div>
            ) : (
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 280, border: '2px dashed #e2e8f0', borderRadius: 12, cursor: 'pointer', background: '#fafafa' }}>
                <ImagePlus size={40} color="#cbd5e1" style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8' }}>Subí una foto de este ángulo del equipo</div>
                <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>JPG, PNG — cualquier imagen</div>
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const fl = e.target.files?.[0]; if (fl) onFileChange(activeIdx, fl); }} />
              </label>
            )}

            {/* Lista puntos */}
            {foto.puntos.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                  Puntos de control — {foto.titulo}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {foto.puntos.map((p, pIdx) => (
                    <div key={pIdx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#2563eb', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {pIdx + 1}
                      </div>
                      <input
                        value={p.label}
                        onChange={e => updateLabel(pIdx, e.target.value)}
                        style={{ flex: 1, fontSize: 12, border: 'none', background: 'none', outline: 'none', minWidth: 0 }}
                        placeholder="Descripción del punto"
                      />
                      <button type="button" onClick={() => removePoint(pIdx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', flexShrink: 0 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
