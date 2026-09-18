'use client';

import { useRef, useState } from 'react';
import { apiFetch, getCsrfToken, getTenantId } from '@/lib/api';
import { X, FileText, Upload, Loader2 } from 'lucide-react';

export type FacturaData = {
  tipoComprobante: string;
  numero: string;
  puntoVenta: string;
  fecha: string;
  proveedor: string;
  cuitProveedor: string;
  neto: string;
  iva: string;
  total: string;
  concepto: string;
  categoria: string;
  notas: string;
};

export const FACTURA_INICIAL: FacturaData = {
  tipoComprobante: 'FACTURA', numero: '', puntoVenta: '', fecha: '',
  proveedor: '', cuitProveedor: '', neto: '', iva: '', total: '',
  concepto: '', categoria: 'REPARACION', notas: '',
};

const TIPOS = [
  { v: 'FACTURA', l: 'Factura' }, { v: 'TICKET', l: 'Ticket' },
  { v: 'NOTA_CREDITO', l: 'Nota de crédito' }, { v: 'PRESUPUESTO', l: 'Presupuesto' }, { v: 'OTRO', l: 'Otro' },
];
const CATEGORIAS = [
  { v: 'REPARACION', l: 'Reparación' }, { v: 'REPUESTO', l: 'Repuesto' },
  { v: 'SERVICE', l: 'Service' }, { v: 'NEUMATICO', l: 'Neumático' },
  { v: 'COMBUSTIBLE', l: 'Combustible' }, { v: 'OTRO', l: 'Otro' },
];

/**
 * Campos de factura reutilizables — se usan dentro del modal de carga
 * y también embebidos (con checkbox) en formularios de OT/repuestos.
 */
export function FacturaFields({ data, onChange, file, onFile }: {
  data: FacturaData;
  onChange: (d: FacturaData) => void;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof FacturaData, v: string) => onChange({ ...data, [k]: v });

  // Auto-calcular total si hay neto + iva
  const neto = parseFloat(data.neto) || 0;
  const iva = parseFloat(data.iva) || 0;
  const totalCalc = neto + iva;

  return (
    <div className="space-y-2.5 rounded-md border border-blue-100 bg-blue-50/40 p-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] font-medium text-neutral-600 mb-0.5">Tipo comprobante</label>
          <select value={data.tipoComprobante} onChange={(e) => set('tipoComprobante', e.target.value)} className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-xs bg-white">
            {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-neutral-600 mb-0.5">Categoría</label>
          <select value={data.categoria} onChange={(e) => set('categoria', e.target.value)} className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-xs bg-white">
            {CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[11px] font-medium text-neutral-600 mb-0.5">Pto. venta</label>
          <input value={data.puntoVenta} onChange={(e) => set('puntoVenta', e.target.value)} placeholder="0001" className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-xs" />
        </div>
        <div className="col-span-2">
          <label className="block text-[11px] font-medium text-neutral-600 mb-0.5">N° comprobante</label>
          <input value={data.numero} onChange={(e) => set('numero', e.target.value)} placeholder="00012345" className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-xs" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] font-medium text-neutral-600 mb-0.5">Fecha</label>
          <input type="date" value={data.fecha} onChange={(e) => set('fecha', e.target.value)} className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-xs" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-neutral-600 mb-0.5">Proveedor</label>
          <input value={data.proveedor} onChange={(e) => set('proveedor', e.target.value)} placeholder="Taller / casa de repuestos" className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-xs" />
        </div>
      </div>
      <div>
        <label className="block text-[11px] font-medium text-neutral-600 mb-0.5">CUIT proveedor</label>
        <input value={data.cuitProveedor} onChange={(e) => set('cuitProveedor', e.target.value)} placeholder="30-12345678-9" className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-xs" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[11px] font-medium text-neutral-600 mb-0.5">Neto ($)</label>
          <input type="number" min={0} step="0.01" value={data.neto} onChange={(e) => set('neto', e.target.value)} className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-xs" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-neutral-600 mb-0.5">IVA ($)</label>
          <input type="number" min={0} step="0.01" value={data.iva} onChange={(e) => set('iva', e.target.value)} className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-xs" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-neutral-600 mb-0.5">Total ($) *</label>
          <input type="number" min={0} step="0.01" value={data.total || (totalCalc > 0 ? String(totalCalc) : '')} onChange={(e) => set('total', e.target.value)} className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-xs font-semibold" />
        </div>
      </div>
      <div>
        <label className="block text-[11px] font-medium text-neutral-600 mb-0.5">Concepto</label>
        <input value={data.concepto} onChange={(e) => set('concepto', e.target.value)} placeholder="ej: Reparación de frenos / Kit de embrague" className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-xs" />
      </div>
      <div>
        <label className="block text-[11px] font-medium text-neutral-600 mb-0.5">Archivo (PDF o foto)</label>
        <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] || null)} />
        <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50">
          <Upload className="h-3 w-3" /> {file ? file.name : 'Adjuntar factura'}
        </button>
        {file && <button type="button" onClick={() => onFile(null)} className="ml-2 text-[10px] text-red-500 hover:underline">quitar</button>}
      </div>
    </div>
  );
}

/** Sube el archivo de factura y devuelve { url, name, mimeType } o null. */
export async function subirArchivoFactura(file: File): Promise<{ url: string; name: string; mimeType: string } | null> {
  const fd = new FormData();
  fd.append('file', file);
  const headers: Record<string, string> = {};
  const csrf = getCsrfToken();
  const tenantId = getTenantId();
  if (csrf) headers['x-csrf-token'] = csrf;
  if (tenantId) headers['x-tenant-id'] = tenantId;
  const res = await fetch('/api/flota/facturas/upload', {
    method: 'POST',
    credentials: 'include',
    headers,
    body: fd,
  });
  if (!res.ok) return null;
  return res.json();
}

/** Modal standalone para cargar una factura desde la ficha del vehículo. */
export default function FacturaModal({ vehiculoId, onClose, onSaved }: {
  vehiculoId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<FacturaData>(FACTURA_INICIAL);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    if (!data.total) { setError('El total es obligatorio'); return; }
    setSaving(true);
    setError(null);
    try {
      let fileUrl: string | undefined, fileName: string | undefined, mimeType: string | undefined;
      if (file) {
        const up = await subirArchivoFactura(file);
        if (up) { fileUrl = up.url; fileName = up.name; mimeType = up.mimeType; }
      }
      await apiFetch('/flota/facturas', {
        method: 'POST',
        json: {
          vehiculoId,
          tipoComprobante: data.tipoComprobante,
          numero: data.numero || undefined,
          puntoVenta: data.puntoVenta || undefined,
          fecha: data.fecha || undefined,
          proveedor: data.proveedor || undefined,
          cuitProveedor: data.cuitProveedor || undefined,
          neto: data.neto ? Number(data.neto) : undefined,
          iva: data.iva ? Number(data.iva) : undefined,
          total: Number(data.total),
          concepto: data.concepto || undefined,
          categoria: data.categoria,
          fileUrl, fileName, mimeType,
          notas: data.notas || undefined,
        },
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar la factura');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5"><FileText className="h-4 w-4 text-blue-600" /> Cargar factura</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-neutral-400" /></button>
        </div>
        <div className="p-4 space-y-3">
          {error && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-xs text-red-700">{error}</p>}
          <FacturaFields data={data} onChange={setData} file={file} onFile={setFile} />
          <div>
            <label className="block text-[11px] font-medium text-neutral-600 mb-0.5">Notas</label>
            <input value={data.notas} onChange={(e) => setData({ ...data, notas: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-xs" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
          <button onClick={onClose} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">Cancelar</button>
          <button disabled={saving || !data.total} onClick={guardar} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar factura
          </button>
        </div>
      </div>
    </div>
  );
}
