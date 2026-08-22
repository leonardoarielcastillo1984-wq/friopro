'use client';

import { useState, useEffect } from 'react';
import { Hash, Loader2, Sparkles, X } from 'lucide-react';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('accessToken');
    if (token) headers['authorization'] = `Bearer ${token}`;
    const tenantId = window.localStorage.getItem('tenantId');
    if (tenantId) headers['x-tenant-id'] = tenantId;
    const csrf = window.localStorage.getItem('csrfToken');
    if (csrf) headers['x-csrf-token'] = csrf;
  }
  return headers;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'GET',
    headers: { ...getAuthHeaders() },
    credentials: 'include',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...getAuthHeaders(),
  };
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const resp = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(resp.error || `HTTP ${res.status}`);
  }
  return res.json();
}

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
    loadDef();
  }, [outputKey]);

  async function loadDef() {
    setLoadingDef(true);
    setErr('');
    try {
      const results = await apiGet<OutputDef[]>(
        `/doc-export/outputs?module=${encodeURIComponent(module)}`
      );
      const found = Array.isArray(results)
        ? results.find((r) => r.outputKey === outputKey)
        : null;
      if (found) {
        setDef(found);
      } else {
        const created = await apiPost<OutputDef>('/doc-export/outputs', {
          module,
          subModule: subModule || null,
          screenName: title,
          outputKey,
          outputType,
        });
        if (created && created.id) setDef(created);
      }
    } catch (e: any) {
      setErr(e?.message || 'Error al cargar definición documental');
    } finally {
      setLoadingDef(false);
    }
  }

  async function handleButtonClick() {
    if (!def) {
      await loadDef();
      return;
    }
    if (!def.documentCode) {
      openModal();
    } else {
      openModal();
    }
  }

  async function openModal() {
    if (!def) return;
    setShowModal(true);
    setErr('');
    setNewCode(def.documentCode || '');
    setSuggestingCode(true);
    try {
      const res = await apiGet<{ suggestedCode: string; hasRule: boolean }>(
        `/doc-export/outputs/${def.id}/suggest-code`
      );
      if (!def.documentCode) setNewCode(res.suggestedCode || '');
      setHasRule(res.hasRule || false);
    } catch (e: any) {
      setErr(e?.message || 'Error al sugerir código');
    }
    setSuggestingCode(false);
  }

  async function suggestCode() {
    if (!def) return;
    setSuggestingCode(true);
    try {
      const r = await apiGet<{ suggestedCode: string; hasRule: boolean }>(
        `/doc-export/outputs/${def.id}/suggest-code`
      );
      setNewCode(r.suggestedCode || '');
      setHasRule(r.hasRule || false);
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
      await apiPost(`/doc-export/outputs/${def.id}/assign-code`, {
        documentCode: newCode.trim(),
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
          title={def ? 'Asignar código documental a este módulo' : 'Clic para reintentar — ' + (err || 'cargando...')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
        >
          <Hash className="h-3 w-3" />
          {def ? 'Asignar código' : (err ? 'Reintentar' : 'Asignar código')}
        </button>
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
