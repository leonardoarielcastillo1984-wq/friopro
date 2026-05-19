'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { Plus, Zap, Trash2, X, ListChecks, Wrench, Truck, Package, Settings, ShieldAlert, Building2, Pencil, Eye, LayoutTemplate, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import AssetDiagram from '@/components/inspecciones/AssetDiagram';
import DiagramaEditor from '@/components/inspecciones/DiagramaEditor';

const CAT_ICON: Record<string, any> = { CAMION: Truck, AUTOELEVADOR: Package, MAQUINARIA: Settings, SEGURIDAD: ShieldAlert, INFRAESTRUCTURA: Building2, ELECTRICO: Zap, GENERAL: Wrench };
const CAT_COLOR: Record<string, string> = { CAMION: 'bg-blue-100 text-blue-700', AUTOELEVADOR: 'bg-amber-100 text-amber-700', MAQUINARIA: 'bg-purple-100 text-purple-700', SEGURIDAD: 'bg-red-100 text-red-700', INFRAESTRUCTURA: 'bg-emerald-100 text-emerald-700', ELECTRICO: 'bg-orange-100 text-orange-700', GENERAL: 'bg-gray-100 text-gray-600' };

const DIAGRAM_CATS = ['CAMION', 'AUTOELEVADOR', 'EXTINTOR', 'MAQUINARIA', 'EDIFICIO'];
const CAT_TO_DIAGRAM: Record<string, string> = { CAMION: 'CAMION', AUTOELEVADOR: 'AUTOELEVADOR', EXTINTOR: 'EXTINTOR', MAQUINARIA: 'MAQUINARIA', INFRAESTRUCTURA: 'EDIFICIO', SEGURIDAD: 'EDIFICIO' };

export default function InspeccionesPlantillas() {
  const [plantillas, setPlantillas] = useState<any[]>([]);
  const [builtIn, setBuiltIn] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showBuiltIn, setShowBuiltIn] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '', categoria: 'GENERAL' });
  const [items, setItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewCat, setPreviewCat] = useState<string | null>(null);
  const [diagramaPlantilla, setDiagramaPlantilla] = useState<any | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, b] = await Promise.all([
        apiFetch('/inspecciones/plantillas') as any,
        apiFetch('/inspecciones/plantillas/built-in') as any,
      ]);
      setPlantillas(p.plantillas || []); setBuiltIn(b.templates || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditingId(null);
    setForm({ nombre: '', descripcion: '', categoria: 'GENERAL' });
    setItems([]);
    setShowNew(true);
  };

  const openEdit = async (p: any) => {
    const r: any = await apiFetch(`/inspecciones/plantillas/${p.id}`);
    const plantilla = r.plantilla;
    setEditingId(plantilla.id);
    setForm({ nombre: plantilla.nombre, descripcion: plantilla.descripcion || '', categoria: plantilla.categoria });
    setItems((plantilla.items || []).map((it: any) => ({
      label: it.label, tipo: it.tipo, seccion: it.seccion || '',
      isRequerido: it.isRequerido, triggerHallazgo: it.triggerHallazgo,
    })));
    setShowNew(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, items: items.map((it, i) => ({ ...it, orden: i })) };
      if (editingId) {
        await apiFetch(`/inspecciones/plantillas/${editingId}`, { method: 'PATCH', json: payload });
      } else {
        await apiFetch('/inspecciones/plantillas', { method: 'POST', json: payload });
      }
      setShowNew(false); setEditingId(null);
      setForm({ nombre: '', descripcion: '', categoria: 'GENERAL' }); setItems([]); load();
    } finally { setSaving(false); }
  };

  const handleFromBuiltIn = async (key: string) => {
    try { await apiFetch('/inspecciones/plantillas/from-built-in', { method: 'POST', json: { key } }); setShowBuiltIn(false); load(); }
    catch { alert('Error importando template'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Desactivar plantilla?')) return;
    await apiFetch(`/inspecciones/plantillas/${id}`, { method: 'DELETE' }); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-gray-800">Plantillas de Inspección</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowBuiltIn(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Zap className="w-3.5 h-3.5 text-amber-500" />Templates built-in
          </button>
          <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-3.5 h-3.5" />Nueva plantilla
          </button>
        </div>
      </div>

      {loading
        ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        : plantillas.length === 0
          ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
              <ListChecks className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">Sin plantillas aún</p>
              <p className="text-xs text-gray-400 mt-1">Importá un template built-in o creá una desde cero</p>
              <button onClick={() => setShowBuiltIn(true)} className="mt-4 px-4 py-2 text-xs bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600">
                <Zap className="w-3 h-3 inline mr-1" />Ver templates
              </button>
            </div>
          )
          : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {plantillas.map((p: any) => {
                const Icon = CAT_ICON[p.categoria] || Wrench;
                return (
                  <div key={p.id} className="bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`p-2 rounded-lg ${CAT_COLOR[p.categoria] || 'bg-gray-100 text-gray-600'}`}><Icon className="w-4 h-4" /></div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setDiagramaPlantilla(p)} className="text-gray-300 hover:text-purple-500 transition-colors" title="Editar diagrama de fotos"><LayoutTemplate className="w-3.5 h-3.5" /></button>
                        <button onClick={() => openEdit(p)} className="text-gray-300 hover:text-blue-500 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(p.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <p className="font-semibold text-gray-800 text-sm">{p.nombre}</p>
                    {p.descripcion && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.descripcion}</p>}
                    <div className="flex items-center gap-2 mt-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLOR[p.categoria] || 'bg-gray-100 text-gray-600'}`}>{p.categoria}</span>
                      <span className="text-xs text-gray-400">{p._count?.items || 0} items · {p._count?.instancias || 0} QRs</span>
                      {CAT_TO_DIAGRAM[p.categoria] && (
                        <button onClick={() => setPreviewCat(CAT_TO_DIAGRAM[p.categoria])} className="ml-auto text-gray-300 hover:text-blue-500 transition-colors" title="Ver diagrama">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

      {/* Modal Editor Diagrama */}
      {diagramaPlantilla && (
        <DiagramaEditor
          plantillaId={diagramaPlantilla.id}
          plantillaNombre={diagramaPlantilla.nombre}
          initialFotos={diagramaPlantilla.diagramaFotos || []}
          onClose={() => setDiagramaPlantilla(null)}
          onSaved={() => { setDiagramaPlantilla(null); load(); }}
        />
      )}

      {/* Modal Built-in */}
      {showBuiltIn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div><h3 className="font-semibold text-gray-900">Templates Built-in</h3><p className="text-xs text-gray-500 mt-0.5">Seleccioná un template preconfigurado para importar</p></div>
              <button onClick={() => setShowBuiltIn(false)}><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-3">
              {builtIn.map((t: any) => (
                <div key={t.key} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="font-medium text-sm text-gray-800">{t.nombre}</p>
                    <p className="text-xs text-gray-500">{t.descripcion} · {t.itemsCount} items</p>
                  </div>
                  <button onClick={() => handleFromBuiltIn(t.key)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">Importar</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Nueva Plantilla */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white flex items-center justify-between p-5 border-b border-gray-100 z-10">
              <h3 className="font-semibold text-gray-900">{editingId ? 'Editar plantilla' : 'Nueva plantilla de inspección'}</h3>
              <button onClick={() => setShowNew(false)}><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Nombre *</label>
                  <input required value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="Ej: Checklist Camión 25" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Categoría</label>
                  <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none bg-white">
                    {['CAMION', 'AUTOELEVADOR', 'MAQUINARIA', 'SEGURIDAD', 'INFRAESTRUCTURA', 'ELECTRICO', 'GENERAL'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <input value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none" placeholder="Descripción (opcional)" />

              {CAT_TO_DIAGRAM[form.categoria] && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Vista previa del diagrama de puntos de control:</p>
                  <AssetDiagram categoria={CAT_TO_DIAGRAM[form.categoria]} />
                </div>
              )}

              {/* Items agrupados por sección */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-medium text-gray-600">Items del checklist ({items.length})</label>
                  <button type="button"
                    onClick={() => {
                      const newSec = `Sección ${[...new Set(items.map(x => x.seccion || 'General'))].length + 1}`;
                      setItems(p => [...p, { label: '', tipo: 'SI_NO', seccion: newSec, isRequerido: true, triggerHallazgo: false }]);
                    }}
                    className="text-xs bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium">
                    <Plus className="w-3 h-3" />Nueva sección
                  </button>
                </div>

                {/* Renderizado por grupos */}
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {(() => {
                    const secciones = [...new Set(items.map(x => x.seccion || 'General'))];
                    return secciones.map(sec => {
                      const secItems = items.map((x, i) => ({ ...x, _idx: i })).filter(x => (x.seccion || 'General') === sec);
                      const isCollapsed = collapsedSections[sec];
                      return (
                        <div key={sec} className="border border-gray-200 rounded-xl overflow-hidden">
                          {/* Cabecera de sección */}
                          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 border-b border-gray-100">
                            <button type="button" onClick={() => setCollapsedSections(p => ({ ...p, [sec]: !p[sec] }))} className="text-gray-400 hover:text-gray-600 shrink-0">
                              {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                            <input
                              value={sec === 'General' && secItems[0]?.seccion === '' ? '' : sec}
                              placeholder="Nombre del grupo"
                              onChange={e => {
                                const newSec = e.target.value;
                                setItems(p => p.map((x, i) => secItems.find(s => s._idx === i) ? { ...x, seccion: newSec } : x));
                                if (collapsedSections[sec] !== undefined) {
                                  setCollapsedSections(p => { const n = { ...p }; n[newSec] = n[sec]; delete n[sec]; return n; });
                                }
                              }}
                              className="flex-1 text-xs font-semibold bg-transparent border-none outline-none text-gray-700 placeholder:text-gray-400"
                            />
                            <span className="text-xs text-gray-400 shrink-0">{secItems.length} item{secItems.length !== 1 ? 's' : ''}</span>
                            <button type="button"
                              onClick={() => {
                                if (secItems.length > 0 && !confirm(`¿Eliminar la sección "${sec}" y sus ${secItems.length} items?`)) return;
                                setItems(p => p.filter((_, i) => !secItems.find(s => s._idx === i)));
                              }}
                              className="text-gray-300 hover:text-red-500 shrink-0"><Trash2 className="w-3 h-3" /></button>
                          </div>

                          {/* Items de la sección */}
                          {!isCollapsed && (
                            <div className="divide-y divide-gray-50">
                              {secItems.map(item => (
                                <div key={item._idx} className="flex gap-1.5 items-center px-3 py-2 hover:bg-gray-50/50 flex-wrap">
                                  <GripVertical className="w-3 h-3 text-gray-300 shrink-0" />
                                  <input placeholder="Descripción del item *" value={item.label}
                                    onChange={e => setItems(p => p.map((x, j) => j === item._idx ? { ...x, label: e.target.value } : x))}
                                    className="flex-1 min-w-[120px] text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-300" />
                                  <select value={item.tipo} onChange={e => setItems(p => p.map((x, j) => j === item._idx ? { ...x, tipo: e.target.value } : x))}
                                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none bg-white">
                                    {['SI_NO', 'TEXTO', 'NUMERO', 'ESCALA', 'FECHA'].map(t => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                  <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer whitespace-nowrap">
                                    <input type="checkbox" checked={item.triggerHallazgo} onChange={e => setItems(p => p.map((x, j) => j === item._idx ? { ...x, triggerHallazgo: e.target.checked } : x))} />
                                    Hallazgo
                                  </label>
                                  <button type="button" onClick={() => setItems(p => p.filter((_, j) => j !== item._idx))} className="text-gray-300 hover:text-red-500 shrink-0"><X className="w-3 h-3" /></button>
                                </div>
                              ))}
                              <div className="px-3 py-2">
                                <button type="button"
                                  onClick={() => setItems(p => {
                                    const lastIdx = Math.max(...secItems.map(s => s._idx));
                                    const next = [...p];
                                    next.splice(lastIdx + 1, 0, { label: '', tipo: 'SI_NO', seccion: sec, isRequerido: true, triggerHallazgo: false });
                                    return next;
                                  })}
                                  className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
                                  <Plus className="w-3 h-3" />Agregar item en "{sec}"
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}

                  {items.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-xs border-2 border-dashed border-gray-200 rounded-xl">
                      Sin items aún. Creá una sección para empezar.
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowNew(false)} className="flex-1 text-sm border border-gray-200 py-2.5 rounded-xl hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-60">
                  {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear plantilla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal preview diagrama */}
      {previewCat && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setPreviewCat(null)}>
          <div className="w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <AssetDiagram categoria={previewCat} />
            <button onClick={() => setPreviewCat(null)} className="mt-3 w-full text-sm text-white/70 hover:text-white text-center">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
