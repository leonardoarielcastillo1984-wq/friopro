'use client';

import { useState, useEffect } from 'react';
import { Hash, Loader2, Sparkles, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface DocCodeBadgeProps {
  outputKey: string;
  title: string;
  module: string;
  subModule?: string;
  outputType?: 'LIST' | 'RECORD' | 'DASHBOARD' | 'MATRIX' | 'MAP' | 'REPORT' | 'FORM';
}

type OutputDef = {
  id: string;
  documentCode: string | null;
  screenName: string;
  outputKey: string;
  module: string;
};

export default function DocCodeBadge({
  outputKey,
  title,
  module,
  subModule,
  outputType = 'LIST',
}: DocCodeBadgeProps) {
  const [def, setDef] = useState<OutputDef | null>(null);
  const [loadingDef, setLoadingDef] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [suggestingCode, setSuggestingCode] = useState(false);
  const [hasRule, setHasRule] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    // Wait for auth token to be available before loading
    if (typeof window !== 'undefined') {
      const token = window.localStorage.getItem('accessToken');
      if (!token) {
        // Retry shortly — AuthProvider may not have set token yet
        const timer = setTimeout(() => loadDef(), 1500);
        return () => clearTimeout(timer);
      }
    }
    loadDef();
  }, [outputKey]);

  async function loadDef(): Promise<OutputDef | null> {
    setLoadingDef(true);
    setErr('');
    try {
      // First, try to find by module filter
      let results = await apiFetch<OutputDef[]>(
        `/doc-export/outputs?module=${encodeURIComponent(module)}`
      );
      if (!Array.isArray(results)) {
        console.warn('[DocCodeBadge] GET /doc-export/outputs returned non-array:', results);
        results = [];
      }
      let found = results.find((r) => r.outputKey === outputKey) || null;

      // If not found by module, try fetching all and search by outputKey
      // (the output may exist under a different module name in the DB)
      if (!found) {
        const allResults = await apiFetch<OutputDef[]>('/doc-export/outputs');
        if (Array.isArray(allResults)) {
          found = allResults.find((r) => r.outputKey === outputKey) || null;
        }
      }

      if (found) {
        setDef(found);
        return found;
      }

      // Not found anywhere — auto-create
      try {
        const created = await apiFetch<OutputDef>('/doc-export/outputs', {
          method: 'POST',
          json: {
            module,
            subModule: subModule || undefined,
            screenName: title,
            outputKey,
            outputType,
          },
        });
        if (created && created.id) {
          setDef(created);
          return created;
        }
        setErr('No se pudo crear la definición documental');
        return null;
      } catch (postErr: any) {
        // 409 = already exists — fetch it from the full list
        if (postErr?.message?.includes('409') || postErr?.message?.includes('ya está en uso')) {
          const allResults = await apiFetch<OutputDef[]>('/doc-export/outputs');
          if (Array.isArray(allResults)) {
            const existing = allResults.find((r) => r.outputKey === outputKey);
            if (existing) {
              setDef(existing);
              return existing;
            }
          }
        }
        throw postErr;
      }
    } catch (e: any) {
      setErr(e?.message || 'Error al cargar definición documental');
      return null;
    } finally {
      setLoadingDef(false);
    }
  }

  async function handleButtonClick() {
    let current = def;
    if (!current) {
      current = await loadDef();
    }
    if (current) {
      openModalWith(current);
    }
  }

  async function openModal() {
    if (!def) return;
    openModalWith(def);
  }

  async function openModalWith(d: OutputDef) {
    setShowModal(true);
    setErr('');
    setNewCode(d.documentCode || '');
    setSuggestingCode(true);
    try {
      const res = await apiFetch<{ suggestedCode: string; hasRule: boolean }>(
        `/doc-export/outputs/${d.id}/suggest-code`
      );
      if (res && res.suggestedCode) {
        if (!d.documentCode) setNewCode(res.suggestedCode);
        setHasRule(res.hasRule || false);
      }
    } catch (e: any) {
      // Non-critical: modal still works without suggestion
    }
    setSuggestingCode(false);
  }

  async function suggestCode() {
    if (!def) return;
    setSuggestingCode(true);
    try {
      const r = await apiFetch<{ suggestedCode: string; hasRule: boolean }>(
        `/doc-export/outputs/${def.id}/suggest-code`
      );
      if (r && r.suggestedCode) {
        setNewCode(r.suggestedCode);
        setHasRule(r.hasRule || false);
      }
    } catch (e: any) {
      setErr(e?.message || 'Error al sugerir código');
    }
    setSuggestingCode(false);
  }

  async function assignCode() {
    if (!def || !newCode.trim()) return;
    setAssigning(true);
    setErr('');
    try {
      await apiFetch(`/doc-export/outputs/${def.id}/assign-code`, {
        method: 'POST',
        json: { documentCode: newCode.trim() },
      });
      setDef({ ...def, documentCode: newCode.trim() });
      setShowModal(false);
    } catch (e: any) {
      setErr(e?.message || 'Error al asignar código');
    } finally {
      setAssigning(false);
    }
  }

  if (loadingDef) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 rounded-lg">
        <Loader2 className="h-3 w-3 animate-spin" />
        ...
      </span>
    );
  }

  return (
    <>
      {def?.documentCode ? (
        <button
          onClick={openModal}
          title="Código documental asignado — clic para modificar"
          className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
        >
          <Hash className="h-3 w-3" />
          {def.documentCode}
        </button>
      ) : (
        <button
          onClick={handleButtonClick}
          title={err ? 'Error: ' + err + ' — clic para reintentar' : 'Asignar código documental a este módulo'}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
        >
          <Hash className="h-3 w-3" />
          Asignar código
        </button>
      )}

      {/* Error inline (visible sin modal) */}
      {err && !showModal && (
        <span className="text-[10px] text-red-500 ml-1" title={err}>⚠</span>
      )}

      {showModal && def && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
                <Hash className="h-4 w-4 text-indigo-600" />
                {def.documentCode ? 'Modificar código documental' : 'Asignar código documental'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-neutral-100">
                <X className="h-5 w-5 text-neutral-400" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="bg-neutral-50 rounded-lg px-4 py-3 space-y-1">
                <p className="text-xs text-neutral-500">Documento</p>
                <p className="text-sm font-medium text-neutral-800">{title}</p>
                {def.documentCode && (
                  <p className="text-xs font-mono text-indigo-600">Código actual: {def.documentCode}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-700 flex items-center gap-1">
                  Código documental
                  {hasRule && (
                    <span className="text-[10px] text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                      Regla activa
                    </span>
                  )}
                </label>
                <div className="flex gap-2">
                  <input
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && assignCode()}
                    placeholder="Ej: RIE-001"
                    className="flex-1 px-3 py-2 text-sm border border-neutral-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <button
                    onClick={suggestCode}
                    disabled={suggestingCode}
                    title="Sugerir código automático"
                    className="px-3 py-2 text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-100 flex items-center gap-1 disabled:opacity-50"
                  >
                    {suggestingCode ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Sugerir
                  </button>
                </div>
                <p className="text-[11px] text-neutral-400">
                  {hasRule
                    ? 'El código fue generado por la regla de codificación configurada.'
                    : 'No hay regla configurada. Podés definirla en Documentos → Configuración.'}
                </p>
              </div>

              {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</p>}
            </div>

            <div className="px-5 py-3 border-t border-neutral-100 flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 border border-neutral-200 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={assignCode}
                disabled={assigning || !newCode.trim()}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {assigning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {def.documentCode ? 'Actualizar código' : 'Asignar código'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
