'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { ArrowLeft, Star, ClipboardCheck, AlertTriangle, X, TrendingDown, TrendingUp } from 'lucide-react';

interface Supplier { id: string; code: string; name: string; legalName?: string; taxId?: string; email?: string; phone?: string; address?: string; category?: string; contactName?: string; contactPosition?: string; status: string; providerType?: string | null; isCritical: boolean; evaluationScore?: number | null; avgScore?: number | null; computedStatus?: string; lastEvaluationDate?: string | null; nextEvaluationDate?: string | null; notes?: string; }
interface Evaluation { id: string; date: string; qualityScore: number; deliveryScore: number; priceScore: number; serviceScore: number; documentationScore: number; overallScore: number; result: string; comments?: string; }
const sb = (s: string) => { const m: Record<string,string> = { APPROVED:'bg-green-100 text-green-700', CONDITIONAL:'bg-amber-100 text-amber-700', REJECTED:'bg-red-100 text-red-700', PENDING:'bg-gray-100 text-gray-700', SUSPENDED:'bg-purple-100 text-purple-700' }; const l: Record<string,string> = { APPROVED:'Aprobado', CONDITIONAL:'Condicional', REJECTED:'Rechazado', PENDING:'Pendiente', SUSPENDED:'Suspendido' }; return <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${m[s]||m.PENDING}`}>{l[s]||s}</span>; };
export default function SupplierDetailPage() {
  const { id } = useParams() as { id: string };
  const [s, setS] = useState<Supplier|null>(null);
  const [ev, setEv] = useState<Evaluation[]>([]);
  const [lo, setLo] = useState(true);
  const [m, setM] = useState(false);
  const [f, setF] = useState({ qualityScore:3, deliveryScore:3, priceScore:3, serviceScore:3, documentationScore:3, comments:'' });
  useEffect(() => { load(); }, [id]);
  const load = async () => { try { setLo(true); const [sr, er] = await Promise.all([apiFetch<{supplier:Supplier}>(`/suppliers/${id}`), apiFetch<{evaluations:Evaluation[]}>(`/suppliers/${id}/evaluations`).catch(()=>null)]); if(sr?.supplier) setS(sr.supplier); if(er?.evaluations) setEv(er.evaluations); } catch(e){ console.error(e); } finally{ setLo(false); } };
  const save = async (e: React.FormEvent) => { e.preventDefault(); try { await apiFetch(`/suppliers/${id}/evaluations`, { method:'POST', json:f }); setM(false); setF({ qualityScore:3, deliveryScore:3, priceScore:3, serviceScore:3, documentationScore:3, comments:'' }); await load(); } catch(e){ console.error(e); alert('Error al guardar evaluacion'); } };
  if(lo) return <div className="p-8 text-center text-gray-500">Cargando...</div>;
  if(!s) return <div className="p-8 text-center text-red-600">Proveedor no encontrado</div>;
  const sc = ev.map(e=>e.overallScore).reverse(); const av = ev.length ? (ev.reduce((a,b)=>a+b.overallScore,0)/ev.length).toFixed(1):null; const tr = sc.length>1 ? sc[sc.length-1]-sc[0] : 0;
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/proveedores" className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5"/></Link>
          <div><div className="flex items-center gap-2"><h1 className="text-2xl font-bold text-gray-900">{s.name}</h1>{sb(s.computedStatus||s.status)}{s.isCritical&&<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Critico</span>}</div><p className="text-sm text-gray-600 mt-1">{s.code} &middot; {s.category||'Sin categoria'}</p></div>
        </div>
        <button onClick={()=>setM(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><ClipboardCheck className="w-4 h-4"/> Evaluar</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="flex items-center gap-2 mb-2"><Star className="w-4 h-4 text-amber-500"/><span className="text-sm font-medium text-gray-700">Score actual</span></div><div className="text-2xl font-bold text-gray-900">{s.avgScore?.toFixed(1)??'—'}</div></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-blue-600"/><span className="text-sm font-medium text-gray-700">Score promedio historico</span></div><div className="text-2xl font-bold text-gray-900">{av??'—'}</div><div className="text-xs text-gray-500 mt-1">{ev.length} evaluacion{ev.length!==1?'es':''}</div></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-red-600"/><span className="text-sm font-medium text-gray-700">Tendencia</span></div><div className="text-2xl font-bold text-gray-900 flex items-center gap-2">{tr>0?<TrendingUp className="w-5 h-5 text-green-600"/>:tr<0?<TrendingDown className="w-5 h-5 text-red-600"/>:<span className="text-gray-400">—</span>}{tr!==0?Math.abs(tr).toFixed(1):'—'}</div></div>
      </div>
      {sc.length>0&&<div className="bg-white rounded-xl border border-gray-200 p-4"><h3 className="text-sm font-semibold text-gray-900 mb-3">Evolucion de evaluaciones</h3><div className="flex items-end gap-2 h-32">{sc.map((v,i)=><div key={i} className="flex-1 flex flex-col items-center gap-1"><div className="w-full bg-blue-100 rounded-t" style={{height:`${(v/5)*100}%`,minHeight:4}}/></div>)}</div></div>}
      <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div><div className="text-gray-500">Email</div><div className="font-medium">{s.email||'—'}</div></div>
        <div><div className="text-gray-500">Telefono</div><div className="font-medium">{s.phone||'—'}</div></div>
        <div><div className="text-gray-500">Contacto</div><div className="font-medium">{s.contactName||'—'}</div></div>
        <div><div className="text-gray-500">Cargo</div><div className="font-medium">{s.contactPosition||'—'}</div></div>
        <div><div className="text-gray-500">Direccion</div><div className="font-medium">{s.address||'—'}</div></div>
        <div><div className="text-gray-500">Tipo</div><div className="font-medium">{s.providerType||'—'}</div></div>
        <div><div className="text-gray-500">Ultima eval.</div><div className="font-medium">{s.lastEvaluationDate?new Date(s.lastEvaluationDate).toLocaleDateString('es-AR'):'—'}</div></div>
        <div><div className="text-gray-500">Proxima eval.</div><div className="font-medium">{s.nextEvaluationDate?new Date(s.nextEvaluationDate).toLocaleDateString('es-AR'):'—'}</div></div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 p-4 flex items-center justify-between"><h3 className="font-semibold text-gray-900">Historial de evaluaciones</h3><span className="text-sm text-gray-500">{ev.length} registros</span></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-200 bg-gray-50"><th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Fecha</th><th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Score</th><th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Calidad</th><th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Cumpl.</th><th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Precio</th><th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Servicio</th><th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Doc.</th><th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Resultado</th><th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Comentarios</th></tr></thead>
            <tbody>{ev.length===0?<tr><td colSpan={9} className="text-center py-8 text-gray-500">Sin evaluaciones</td></tr>:ev.map(e=>(<tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50"><td className="px-4 py-3 text-sm">{new Date(e.date).toLocaleDateString('es-AR')}</td><td className="px-4 py-3 text-sm font-bold">{e.overallScore.toFixed(1)}</td><td className="px-4 py-3 text-sm">{e.qualityScore}</td><td className="px-4 py-3 text-sm">{e.deliveryScore}</td><td className="px-4 py-3 text-sm">{e.priceScore}</td><td className="px-4 py-3 text-sm">{e.serviceScore}</td><td className="px-4 py-3 text-sm">{e.documentationScore}</td><td className="px-4 py-3 text-sm">{sb(e.result)}</td><td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{e.comments||'—'}</td></tr>))}</tbody>
          </table>
        </div>
      </div>
      {m&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="border-b border-gray-200 p-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-gray-900">Evaluar: {s.name}</h2><button onClick={()=>setM(false)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5"/></button></div>
            <form onSubmit={save} className="p-6 space-y-4">
              {[{k:'qualityScore',l:'Calidad'},{k:'deliveryScore',l:'Cumplimiento'},{k:'priceScore',l:'Precio'},{k:'serviceScore',l:'Servicio'},{k:'documentationScore',l:'Documentacion'}].map(({k,l})=>(<div key={k} className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">{l} (1-5)</label><div className="flex items-center gap-2"><input type="range" min={1} max={5} value={f[k as keyof typeof f]} onChange={e=>setF({...f,[k]:Number(e.target.value)})} className="w-24"/><span className="w-6 text-center font-bold">{f[k as keyof typeof f]}</span></div></div>))}
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Comentarios</label><textarea value={f.comments} onChange={e=>setF({...f,comments:e.target.value})} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"/></div>
              <div className="bg-gray-50 rounded-lg p-3 flex justify-between"><span className="text-sm font-medium">Score calculado:</span><span className="text-lg font-bold">{((f.qualityScore+f.deliveryScore+f.priceScore+f.serviceScore+f.documentationScore)/5).toFixed(1)}</span></div>
              <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={()=>setM(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Cancelar</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Guardar evaluacion</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
