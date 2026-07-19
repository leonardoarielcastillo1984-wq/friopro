'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Plus, Trash2, Save, Hash, Tag, Palette, ChevronRight, AlertCircle, CheckCircle2, Pencil, X
} from 'lucide-react';

interface TypeConfig {
  id: string; name: string; abbreviation: string;
  description?: string; color: string; nextSequence: number;
}
interface CodeConfig { prefix: string; digitCount: number; separator: string }

const PRESET_TYPES = [
  { name: 'Procedimiento',       abbreviation: 'PR', color: '#3B82F6', description: 'Describe paso a paso cómo realizar una actividad' },
  { name: 'Instructivo',         abbreviation: 'IT', color: '#8B5CF6', description: 'Instrucciones detalladas de trabajo' },
  { name: 'Manual',              abbreviation: 'MA', color: '#10B981', description: 'Documentos de referencia y políticas generales' },
  { name: 'Política',            abbreviation: 'PO', color: '#F59E0B', description: 'Directrices y compromisos de la organización' },
  { name: 'Registro',            abbreviation: 'RE', color: '#EF4444', description: 'Evidencia de actividades realizadas' },
  { name: 'Formulario',          abbreviation: 'FO', color: '#06B6D4', description: 'Plantillas para captura de datos' },
  { name: 'Plan',                abbreviation: 'PL', color: '#84CC16', description: 'Planificación de actividades y recursos' },
  { name: 'Especificación',      abbreviation: 'ES', color: '#F97316', description: 'Requisitos técnicos y de calidad' },
];

export default function ConfiguracionDocumentos() {
  const [codeConfig, setCodeConfig] = useState<CodeConfig>({ prefix: 'SGI', digitCount: 3, separator: '-' });
  const [types, setTypes] = useState<TypeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [newType, setNewType] = useState({ name: '', abbreviation: '', description: '', color: '#3B82F6' });
  const [addingType, setAddingType] = useState(false);
  const [editType, setEditType] = useState<TypeConfig | null>(null);
  const [preview, setPreview] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch('/documents/code-config').then((d: any) => setCodeConfig(d)),
      apiFetch('/documents/types').then((d: any) => setTypes(d.types || [])),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const sampleAbbr = types[0]?.abbreviation || 'PR';
    const seq = String(1).padStart(codeConfig.digitCount, '0');
    setPreview(`${codeConfig.prefix}${codeConfig.separator}${sampleAbbr}${codeConfig.separator}${seq}`);
  }, [codeConfig, types]);

  async function saveConfig() {
    setSavingConfig(true);
    try {
      const saved = await apiFetch('/documents/code-config', {
        method: 'PUT',
        body: JSON.stringify(codeConfig),
      }) as any;
      setCodeConfig(saved);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 2000);
    } catch {}
    setSavingConfig(false);
  }

  async function createType(data: typeof newType) {
    try {
      const created = await apiFetch('/documents/types', {
        method: 'POST',
        body: JSON.stringify(data),
      }) as TypeConfig;
      setTypes(t => [...t, created]);
      setNewType({ name: '', abbreviation: '', description: '', color: '#3B82F6' });
      setAddingType(false);
    } catch (e: any) {
      alert(e?.message || 'Error al crear el tipo');
    }
  }

  async function saveEditType() {
    if (!editType) return;
    try {
      const updated = await apiFetch(`/documents/types/${editType.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editType.name, description: editType.description, color: editType.color }),
      }) as TypeConfig;
      setTypes(t => t.map(x => x.id === updated.id ? { ...x, ...updated } : x));
      setEditType(null);
    } catch {}
  }

  async function deleteType(id: string) {
    if (!confirm('¿Eliminar este tipo? Los documentos existentes no se verán afectados.')) return;
    await apiFetch(`/documents/types/${id}`, { method: 'DELETE' });
    setTypes(t => t.filter(x => x.id !== id));
  }

  async function addPreset(preset: typeof PRESET_TYPES[0]) {
    await createType(preset);
  }

  if (loading) return <div className="text-sm text-neutral-400 py-8 text-center">Cargando configuración...</div>;

  const presetsAvailable = PRESET_TYPES.filter(p => !types.some(t => t.abbreviation === p.abbreviation));

  return (
    <div className="max-w-3xl space-y-8">

      {/* ── Configuración de codificación ── */}
      <section className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="font-semibold text-neutral-800 flex items-center gap-2">
            <Hash className="h-4 w-4 text-blue-600" /> Formato de código documental
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Define cómo se generarán automáticamente los códigos al crear documentos.
          </p>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Prefijo de empresa</label>
              <input
                className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="SGI"
                value={codeConfig.prefix}
                onChange={e => setCodeConfig(c => ({ ...c, prefix: e.target.value.toUpperCase().slice(0, 10) }))}
              />
              <p className="text-xs text-neutral-400 mt-1">ej: SGI, DADA, LOG, RF</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Dígitos de secuencia</label>
              <select
                className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={codeConfig.digitCount}
                onChange={e => setCodeConfig(c => ({ ...c, digitCount: Number(e.target.value) }))}
              >
                <option value={2}>2 dígitos (01)</option>
                <option value={3}>3 dígitos (001)</option>
                <option value={4}>4 dígitos (0001)</option>
                <option value={5}>5 dígitos (00001)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Separador</label>
              <select
                className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={codeConfig.separator}
                onChange={e => setCodeConfig(c => ({ ...c, separator: e.target.value }))}
              >
                <option value="-">Guion  ( - )</option>
                <option value=".">Punto  ( . )</option>
                <option value="/">Barra  ( / )</option>
                <option value="_">Guion bajo  ( _ )</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <span className="text-xs text-blue-600 font-medium">Vista previa:</span>
            <code className="text-blue-800 font-mono text-base font-bold tracking-wider">{preview}</code>
            <span className="text-xs text-blue-500 ml-2">→ próximo sería {preview.slice(0, -String(1).padStart(codeConfig.digitCount, '0').length) + String(2).padStart(codeConfig.digitCount, '0')}</span>
          </div>

          <button
            onClick={saveConfig}
            disabled={savingConfig}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
              configSaved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
            } disabled:opacity-50`}
          >
            {configSaved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {configSaved ? 'Guardado' : savingConfig ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      </section>

      {/* ── Tipos documentales ── */}
      <section className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-neutral-800 flex items-center gap-2">
              <Tag className="h-4 w-4 text-purple-600" /> Tipos documentales
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              Cada tipo tiene su propio contador de secuencia. La abreviatura forma parte del código.
            </p>
          </div>
          <button
            onClick={() => setAddingType(true)}
            className="flex items-center gap-1.5 text-sm bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700"
          >
            <Plus className="h-4 w-4" /> Nuevo tipo
          </button>
        </div>

        <div className="divide-y divide-neutral-100">
          {types.length === 0 && !addingType && (
            <div className="px-6 py-8 text-center text-sm text-neutral-400">
              <Tag className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No hay tipos configurados. Agregá uno nuevo o usá uno de los predefinidos.
            </div>
          )}

          {types.map(t => (
            <div key={t.id} className="px-6 py-4">
              {editType?.id === t.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <input
                      className="col-span-2 text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nombre"
                      value={editType.name}
                      onChange={e => setEditType(x => x ? { ...x, name: e.target.value } : null)}
                    />
                    <div className="flex gap-2">
                      <input
                        type="color"
                        className="h-10 w-12 rounded-lg border border-neutral-200 cursor-pointer"
                        value={editType.color}
                        onChange={e => setEditType(x => x ? { ...x, color: e.target.value } : null)}
                      />
                      <input
                        className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Descripción"
                        value={editType.description || ''}
                        onChange={e => setEditType(x => x ? { ...x, description: e.target.value } : null)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEditType} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Guardar</button>
                    <button onClick={() => setEditType(null)} className="px-3 py-1.5 text-xs border border-neutral-200 rounded-lg hover:bg-neutral-50">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: t.color }}>
                    {t.abbreviation}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-neutral-800 text-sm">{t.name}</span>
                      <code className="text-xs font-mono text-neutral-400">{codeConfig.prefix}{codeConfig.separator}{t.abbreviation}{codeConfig.separator}...</code>
                    </div>
                    {t.description && <p className="text-xs text-neutral-500 mt-0.5">{t.description}</p>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-neutral-400">Próximo: <span className="font-mono font-semibold text-neutral-600">#{t.nextSequence}</span></span>
                    <button onClick={() => setEditType(t)} className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-blue-600">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deleteType(t.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-neutral-400 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {addingType && (
            <div className="px-6 py-4 bg-purple-50 border-t border-purple-100">
              <p className="text-xs font-medium text-purple-700 mb-3">Nuevo tipo documental</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <input
                  className="text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Nombre (ej: Procedimiento)"
                  value={newType.name}
                  onChange={e => setNewType(n => ({ ...n, name: e.target.value }))}
                />
                <input
                  className="text-sm border border-neutral-200 rounded-lg px-3 py-2 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Abrev. (ej: PR)"
                  maxLength={10}
                  value={newType.abbreviation}
                  onChange={e => setNewType(n => ({ ...n, abbreviation: e.target.value.toUpperCase() }))}
                />
                <input
                  className="col-span-2 text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Descripción (opcional)"
                  value={newType.description}
                  onChange={e => setNewType(n => ({ ...n, description: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-3 mb-3">
                <label className="text-xs text-neutral-600">Color:</label>
                <input
                  type="color"
                  className="h-8 w-12 rounded border border-neutral-200 cursor-pointer"
                  value={newType.color}
                  onChange={e => setNewType(n => ({ ...n, color: e.target.value }))}
                />
                {newType.abbreviation && (
                  <span className="text-xs text-neutral-500">Vista previa del código:
                    <code className="ml-1 font-mono font-bold" style={{ color: newType.color }}>
                      {codeConfig.prefix}{codeConfig.separator}{newType.abbreviation}{codeConfig.separator}{String(1).padStart(codeConfig.digitCount, '0')}
                    </code>
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => createType(newType)}
                  disabled={!newType.name || !newType.abbreviation}
                  className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-40"
                >
                  Agregar tipo
                </button>
                <button onClick={() => setAddingType(false)} className="px-4 py-2 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tipos predefinidos */}
        {presetsAvailable.length > 0 && (
          <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50">
            <p className="text-xs font-medium text-neutral-500 mb-3">Tipos predefinidos para agregar rápido:</p>
            <div className="flex flex-wrap gap-2">
              {presetsAvailable.map(p => (
                <button
                  key={p.abbreviation}
                  onClick={() => addPreset(p)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-neutral-200 bg-white hover:border-blue-300 hover:text-blue-700 transition-colors"
                >
                  <span className="w-4 h-4 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: p.color }} />
                  {p.abbreviation} · {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Info anti-duplicados ── */}
      <section className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-4">
        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Regla anti-duplicados activa</p>
          <p className="text-xs text-amber-700 mt-1">
            El sistema garantiza que no pueden existir dos documentos con el mismo código dentro de tu organización.
            Cuando reservás un código al crear un documento, el contador avanza automáticamente,
            asegurando correlatividad aunque varios usuarios creen documentos simultáneamente.
          </p>
        </div>
      </section>
    </div>
  );
}
