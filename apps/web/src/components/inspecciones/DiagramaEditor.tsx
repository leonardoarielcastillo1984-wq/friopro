'use client';
import { useState, useRef, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { X, Plus, Upload, Trash2, Save, ImagePlus, MapPin } from 'lucide-react';

interface Punto { x: number; y: number; label: string }
interface FotoCuadrante { url: string; titulo: string; puntos: Punto[] }

const TITULOS_DEFAULT = ['Frente', 'Lateral izquierdo', 'Lateral derecho', 'Trasera'];

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
  const [activeFoto, setActiveFoto] = useState(0);
  const [addingPoint, setAddingPoint] = useState(false);
  const [saving, setSaving] = useState(false);
  // previewUrls: objectURL para mostrar en UI sin re-encodear base64
  const [previewUrls, setPreviewUrls] = useState<Record<number, string>>({});
  const imgRef = useRef<HTMLImageElement>(null);

  const foto = fotos[activeFoto] ?? { url: '', titulo: '', puntos: [] };
  const previewSrc = previewUrls[activeFoto] || foto.url;

  const handleFileUpload = useCallback((idx: number, file: File) => {
    // 1) Mostrar preview inmediato via objectURL
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrls(prev => ({ ...prev, [idx]: objectUrl }));
    // 2) Leer base64 para guardar en BD
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setFotos(prev => prev.map((f, i) => i === idx ? { ...f, url: base64 } : f));
    };
    reader.readAsDataURL(file);
  }, []);

  const handleImageClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!addingPoint) return;
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    setFotos(prev => prev.map((f, i) =>
      i === activeFoto ? { ...f, puntos: [...f.puntos, { x, y, label: `Punto ${f.puntos.length + 1}` }] } : f
    ));
    setAddingPoint(false);
  }, [addingPoint, activeFoto]);

  const updateLabel = (pIdx: number, label: string) =>
    setFotos(prev => prev.map((f, i) =>
      i === activeFoto ? { ...f, puntos: f.puntos.map((p, j) => j === pIdx ? { ...p, label } : p) } : f
    ));

  const removePunto = (pIdx: number) =>
    setFotos(prev => prev.map((f, i) =>
      i === activeFoto ? { ...f, puntos: f.puntos.filter((_, j) => j !== pIdx) } : f
    ));

  const addFoto = () => {
    if (fotos.length >= 4) return;
    const idx = fotos.length;
    setFotos(prev => [...prev, { url: '', titulo: TITULOS_DEFAULT[idx] || `Vista ${idx + 1}`, puntos: [] }]);
    setActiveFoto(idx);
  };

  const removeFoto = (idx: number) => {
    const next = fotos.filter((_, i) => i !== idx);
    setFotos(next);
    setPreviewUrls(prev => {
      const np = { ...prev };
      delete np[idx];
      return np;
    });
    setActiveFoto(Math.max(0, Math.min(activeFoto, next.length - 1)));
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/inspecciones/plantillas/${plantillaId}/diagrama`, {
        method: 'PATCH',
        json: { fotos },
      });
      onSaved();
    } catch (err: any) {
      alert(`Error al guardar: ${err?.message || 'intentá de nuevo'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Editor de Diagrama</h2>
            <p className="text-xs text-gray-500 mt-0.5">{plantillaNombre} · Hasta 4 fotos · Modelo maestro para todos los equipos con esta plantilla</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={save} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              <Save className="w-4 h-4" />{saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Banner maestro */}
        <div className="mx-6 mt-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
          <strong>Modelo maestro:</strong> Este diagrama se aplica automáticamente a todos los equipos que usen esta plantilla. Configuralo una sola vez.
        </div>

        <div className="flex">
          {/* Sidebar vistas */}
          <div className="w-44 border-r border-gray-100 flex flex-col p-3 gap-2 shrink-0 mt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 mb-1">Vistas</p>
            {fotos.map((f, idx) => {
              const thumb = previewUrls[idx] || f.url;
              return (
                <div
                  key={idx}
                  role="button"
                  tabIndex={0}
                  onClick={() => { setActiveFoto(idx); setAddingPoint(false); }}
                  onKeyDown={e => e.key === 'Enter' && setActiveFoto(idx)}
                  className={`relative cursor-pointer px-3 py-2 rounded-xl text-xs font-medium transition-colors group select-none ${
                    activeFoto === idx ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-gray-600 hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="truncate">{f.titulo || `Vista ${idx + 1}`}</span>
                    {fotos.length > 1 && (
                      <button type="button"
                        onClick={e => { e.stopPropagation(); removeFoto(idx); }}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="w-full h-10 rounded overflow-hidden bg-gray-100">
                    {thumb
                      ? <img src={thumb} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><ImagePlus className="w-4 h-4 text-gray-300" /></div>
                    }
                  </div>
                  <span className="text-gray-400 text-xs">{f.puntos.length} pts</span>
                </div>
              );
            })}
            {fotos.length < 4 && (
              <button type="button" onClick={addFoto}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-gray-500 hover:bg-gray-50 border border-dashed border-gray-300 transition-colors">
                <Plus className="w-3 h-3" />Agregar vista
              </button>
            )}
          </div>

          {/* Editor principal */}
          <div className="flex-1 flex flex-col p-5 gap-4 min-w-0">
            {/* Controles */}
            <div className="flex items-center gap-3 flex-wrap">
              <input
                value={foto.titulo}
                onChange={e => setFotos(prev => prev.map((f, i) => i === activeFoto ? { ...f, titulo: e.target.value } : f))}
                className="flex-1 min-w-0 text-sm font-semibold border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nombre de esta vista (ej: Frente)"
              />
              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg cursor-pointer transition-colors whitespace-nowrap">
                <Upload className="w-3.5 h-3.5" />
                {previewSrc ? 'Cambiar foto' : 'Subir foto'}
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const fl = e.target.files?.[0]; if (fl) handleFileUpload(activeFoto, fl); e.target.value = ''; }} />
              </label>
              {previewSrc && (
                <button type="button"
                  onClick={() => setAddingPoint(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    addingPoint ? 'bg-orange-500 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                  }`}>
                  <MapPin className="w-3.5 h-3.5" />
                  {addingPoint ? '▶ Click en la foto' : 'Agregar punto'}
                </button>
              )}
            </div>

            {/* Zona imagen */}
            {previewSrc ? (
              <div className={`relative rounded-xl border-2 transition-colors overflow-hidden ${
                addingPoint ? 'border-orange-400' : 'border-gray-200'
              }`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={previewSrc}
                  alt="diagrama"
                  onClick={handleImageClick}
                  className={`w-full block object-contain ${addingPoint ? 'cursor-crosshair' : 'cursor-default'}`}
                  style={{ maxHeight: 500 }}
                  draggable={false}
                />
                {/* Puntos superpuestos — sobre la imagen */}
                {foto.puntos.map((p, pIdx) => (
                  <div
                    key={pIdx}
                    className="absolute pointer-events-none"
                    style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%,-50%)' }}
                  >
                    <div className="w-6 h-6 rounded-full bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center text-white font-bold"
                      style={{ fontSize: 10 }}>
                      {pIdx + 1}
                    </div>
                  </div>
                ))}
                {addingPoint && (
                  <div className="absolute inset-x-0 bottom-3 flex justify-center pointer-events-none">
                    <div className="bg-orange-500 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xl">
                      Hacé click en la foto para colocar el punto
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" style={{ minHeight: 300 }}>
                <ImagePlus className="w-12 h-12 mb-3 text-gray-300" />
                <p className="font-medium text-sm text-gray-500">Subí una foto de este ángulo del equipo</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG — cualquier imagen</p>
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const fl = e.target.files?.[0]; if (fl) handleFileUpload(activeFoto, fl); e.target.value = ''; }} />
              </label>
            )}

            {/* Lista puntos */}
            {foto.puntos.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Puntos de control — {foto.titulo}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {foto.puntos.map((p, pIdx) => (
                    <div key={pIdx} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50">
                      <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shrink-0"
                        style={{ fontSize: 10 }}>
                        {pIdx + 1}
                      </div>
                      <input
                        value={p.label}
                        onChange={e => updateLabel(pIdx, e.target.value)}
                        className="flex-1 text-xs bg-transparent border-none outline-none min-w-0"
                        placeholder="Descripción del punto"
                      />
                      <button type="button" onClick={() => removePunto(pIdx)}
                        className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
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
