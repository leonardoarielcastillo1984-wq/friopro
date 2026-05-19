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
    initialFotos?.length
      ? initialFotos
      : [{ url: '', titulo: 'Frente', puntos: [] }]
  );
  const [activeFoto, setActiveFoto] = useState(0);
  const [addingPoint, setAddingPoint] = useState(false);
  const [editingPoint, setEditingPoint] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  const foto = fotos[activeFoto];

  const handleFileUpload = useCallback((idx: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setFotos(prev => prev.map((f, i) => i === idx ? { ...f, url } : f));
    };
    reader.readAsDataURL(file);
  }, []);

  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!addingPoint || !foto.url) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    const label = `Punto ${foto.puntos.length + 1}`;
    setFotos(prev => prev.map((f, i) =>
      i === activeFoto ? { ...f, puntos: [...f.puntos, { x, y, label }] } : f
    ));
    setEditingPoint(foto.puntos.length);
    setAddingPoint(false);
  }, [addingPoint, foto, activeFoto]);

  const updatePuntoLabel = (pIdx: number, label: string) => {
    setFotos(prev => prev.map((f, i) =>
      i === activeFoto
        ? { ...f, puntos: f.puntos.map((p, j) => j === pIdx ? { ...p, label } : p) }
        : f
    ));
  };

  const removePunto = (pIdx: number) => {
    setFotos(prev => prev.map((f, i) =>
      i === activeFoto ? { ...f, puntos: f.puntos.filter((_, j) => j !== pIdx) } : f
    ));
    setEditingPoint(null);
  };

  const addFoto = () => {
    if (fotos.length >= 4) return;
    const idx = fotos.length;
    setFotos(prev => [...prev, { url: '', titulo: TITULOS_DEFAULT[idx] || `Vista ${idx + 1}`, puntos: [] }]);
    setActiveFoto(idx);
  };

  const removeFoto = (idx: number) => {
    setFotos(prev => prev.filter((_, i) => i !== idx));
    setActiveFoto(Math.max(0, idx - 1));
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/inspecciones/plantillas/${plantillaId}/diagrama`, {
        method: 'PATCH',
        body: JSON.stringify({ fotos }),
      });
      onSaved();
    } catch (e) {
      alert('Error al guardar. Intentá de nuevo.');
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
            <p className="text-xs text-gray-500 mt-0.5">{plantillaNombre} · Hasta 4 fotos con puntos de control</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />{saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex gap-0 h-full">
          {/* Sidebar — tabs de cuadrantes */}
          <div className="w-44 border-r border-gray-100 flex flex-col p-3 gap-2 shrink-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 mb-1">Vistas</p>
            {fotos.map((f, idx) => (
              <button
                key={idx}
                onClick={() => { setActiveFoto(idx); setAddingPoint(false); setEditingPoint(null); }}
                className={`relative text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-colors group ${
                  activeFoto === idx ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate">{f.titulo || `Vista ${idx + 1}`}</span>
                  {fotos.length > 1 && (
                    <button
                      onClick={e => { e.stopPropagation(); removeFoto(idx); }}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {f.url && <div className="mt-1 w-full h-8 rounded overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt="" className="w-full h-full object-cover" />
                </div>}
                {!f.url && <div className="mt-1 w-full h-8 rounded bg-gray-100 flex items-center justify-center">
                  <ImagePlus className="w-3 h-3 text-gray-400" />
                </div>}
                <span className="text-xs text-gray-400">{f.puntos.length} puntos</span>
              </button>
            ))}
            {fotos.length < 4 && (
              <button
                onClick={addFoto}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-gray-500 hover:bg-gray-50 border border-dashed border-gray-300 transition-colors"
              >
                <Plus className="w-3 h-3" />Agregar vista
              </button>
            )}
          </div>

          {/* Editor principal */}
          <div className="flex-1 flex flex-col p-5 gap-4 min-w-0">
            {/* Título del cuadrante */}
            <div className="flex items-center gap-3">
              <input
                value={foto.titulo}
                onChange={e => setFotos(prev => prev.map((f, i) => i === activeFoto ? { ...f, titulo: e.target.value } : f))}
                className="flex-1 text-sm font-semibold border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nombre de esta vista (ej: Frente)"
              />
              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                {foto.url ? 'Cambiar foto' : 'Subir foto'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(activeFoto, f); }}
                />
              </label>
              {foto.url && (
                <button
                  onClick={() => setAddingPoint(!addingPoint)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    addingPoint
                      ? 'bg-orange-500 text-white'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {addingPoint ? 'Click en la foto →' : 'Agregar punto'}
                </button>
              )}
            </div>

            {/* Área de imagen */}
            <div
              ref={imgRef}
              onClick={handleImageClick}
              className={`relative rounded-xl overflow-hidden bg-gray-100 border-2 transition-colors ${
                addingPoint ? 'border-orange-400 cursor-crosshair' : 'border-gray-200 cursor-default'
              }`}
              style={{ minHeight: 340 }}
            >
              {foto.url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={foto.url} alt="diagrama" className="w-full object-contain max-h-[500px]" />
                  {/* Puntos superpuestos */}
                  <div className="absolute inset-0">
                    {foto.puntos.map((p, pIdx) => (
                      <div
                        key={pIdx}
                        className="absolute"
                        style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%,-50%)' }}
                        onClick={e => { e.stopPropagation(); setEditingPoint(pIdx === editingPoint ? null : pIdx); }}
                      >
                        <div className="relative w-7 h-7 rounded-full bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center text-white font-bold text-xs cursor-pointer hover:scale-110 transition-transform">
                          {pIdx + 1}
                        </div>
                        {/* Tooltip etiqueta */}
                        <div className="absolute left-8 top-1/2 -translate-y-1/2 whitespace-nowrap bg-black/80 text-white text-xs rounded px-2 py-1 pointer-events-none">
                          {p.label}
                        </div>
                      </div>
                    ))}
                  </div>
                  {addingPoint && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-orange-500/90 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-xl">
                        Hacé click donde quieras colocar el punto
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <label className="flex flex-col items-center justify-center h-64 cursor-pointer text-gray-400 hover:text-gray-600 transition-colors">
                  <ImagePlus className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="font-medium text-sm">Subí una foto para esta vista</p>
                  <p className="text-xs mt-1">JPG, PNG — se acepta cualquier imagen</p>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(activeFoto, f); }}
                  />
                </label>
              )}
            </div>

            {/* Panel de puntos */}
            {foto.puntos.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Puntos de control — {foto.titulo}</p>
                <div className="grid grid-cols-2 gap-2">
                  {foto.puntos.map((p, pIdx) => (
                    <div
                      key={pIdx}
                      className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                        editingPoint === pIdx ? 'border-blue-300 bg-blue-50' : 'border-gray-100 bg-gray-50'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shrink-0" style={{ fontSize: 10 }}>
                        {pIdx + 1}
                      </div>
                      <input
                        value={p.label}
                        onChange={e => updatePuntoLabel(pIdx, e.target.value)}
                        className="flex-1 text-xs bg-transparent border-none outline-none min-w-0"
                        placeholder="Descripción del punto"
                      />
                      <button onClick={() => removePunto(pIdx)} className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
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
