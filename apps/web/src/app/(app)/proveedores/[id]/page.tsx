'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { ArrowLeft, Star, ClipboardCheck, AlertTriangle, X, TrendingDown, TrendingUp } from 'lucide-react';

interface Supplier { id: string; code: string; name: string; legalName?: string; taxId?: string; email?: string; phone?: string; address?: string; category?: string; contactName?: string; contactPosition?: string; status: string; providerType?: string | null; isCritical: boolean; ehsRequirements?: string | null; ehsApproved?: boolean; evaluationScore?: number | null; avgScore?: number | null; computedStatus?: string; lastEvaluationDate?: string | null; nextEvaluationDate?: string | null; notes?: string; }
interface SupplierAudit { id: string; code: string; title: string; type: string; status: string; plannedStartDate?: string | null; actualStartDate?: string | null; actualEndDate?: string | null; }
interface Evaluation { id: string; date: string; qualityScore: number; deliveryScore: number; priceScore: number; serviceScore: number; documentationScore: number; overallScore: number; result: string; comments?: string; deliveredPpm?: number | null; customerDisruptions?: number; premiumFreightIncidents?: number; specialStatusNotifications?: number; specialStatusNotes?: string | null; }
interface DevPlan { id: string; title: string; objective?: string | null; actions?: any[] | null; status: string; targetDate?: string | null; completedAt?: string | null; evidence?: string | null; }
const sb = (s: string) => { const m: Record<string,string> = { APPROVED:'bg-green-100 text-green-700', CONDITIONAL:'bg-amber-100 text-amber-700', REJECTED:'bg-red-100 text-red-700', PENDING:'bg-gray-100 text-gray-700', SUSPENDED:'bg-purple-100 text-purple-700' }; const l: Record<string,string> = { APPROVED:'Aprobado', CONDITIONAL:'Condicional', REJECTED:'Rechazado', PENDING:'Pendiente', SUSPENDED:'Suspendido' }; return <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${m[s]||m.PENDING}`}>{l[s]||s}</span>; };
export default function SupplierDetailPage() {
  const { id } = useParams() as { id: string };
  const [s, setS] = useState<Supplier|null>(null);
  const [ev, setEv] = useState<Evaluation[]>([]);
  const [lo, setLo] = useState(true);
  const [m, setM] = useState(false);
  const [f, setF] = useState({ qualityScore:3, deliveryScore:3, priceScore:3, serviceScore:3, documentationScore:3, comments:'', deliveredPpm:'', customerDisruptions:'0', premiumFreightIncidents:'0', specialStatusNotifications:'0', specialStatusNotes:'' });
  const [plans, setPlans] = useState<DevPlan[]>([]);
  const [audits, setAudits] = useState<SupplierAudit[]>([]);
  const [showPlan, setShowPlan] = useState(false);
  const [planF, setPlanF] = useState({ title:'', objective:'', targetDate:'' });
  useEffect(() => { load(); }, [id]);
  const load = async () => { try { setLo(true); const [sr, er, pr, ar] = await Promise.all([apiFetch<{supplier:Supplier}>(`/suppliers/${id}`), apiFetch<{evaluations:Evaluation[]}>(`/suppliers/${id}/evaluations`).catch(()=>null), apiFetch<{plans:DevPlan[]}>(`/suppliers/${id}/development-plans`).catch(()=>null), apiFetch<{audits:SupplierAudit[]}>(`/suppliers/${id}/audits`).catch(()=>null)]); if(sr?.supplier) setS(sr.supplier); if(er?.evaluations) setEv(er.evaluations); if(pr?.plans) setPlans(pr.plans); if(ar?.audits) setAudits(ar.audits); } catch(e){ console.error(e); } finally{ setLo(false); } };
  const save = async (e: React.FormEvent) => { e.preventDefault(); try { await apiFetch(`/suppliers/${id}/evaluations`, { method:'POST', json:{ ...f, deliveredPpm: f.deliveredPpm===''?null:Number(f.deliveredPpm), customerDisruptions: Number(f.customerDisruptions)||0, premiumFreightIncidents: Number(f.premiumFreightIncidents)||0, specialStatusNotifications: Number(f.specialStatusNotifications)||0, specialStatusNotes: f.specialStatusNotes||null } }); setM(false); setF({ qualityScore:3, deliveryScore:3, priceScore:3, serviceScore:3, documentationScore:3, comments:'', deliveredPpm:'', customerDisruptions:'0', premiumFreightIncidents:'0', specialStatusNotifications:'0', specialStatusNotes:'' }); await load(); } catch(e){ console.error(e); alert('Error al guardar evaluacion'); } };
  const savePlan = async (e: React.FormEvent) => { e.preventDefault(); try { await apiFetch(`/suppliers/${id}/development-plans`, { method:'POST', json:{ title: planF.title, objective: planF.objective||null, targetDate: planF.targetDate||null } }); setShowPlan(false); setPlanF({ title:'', objective:'', targetDate:'' }); await load(); } catch(e){ console.error(e); alert('Error al crear plan'); } };
  const planStatus = async (planId: string, status: string) => { try { await apiFetch(`/suppliers/development-plans/${planId}`, { method:'PATCH', json:{ status } }); await load(); } catch(e){ console.error(e); } };
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
        <div><div className="text-gray-500">EHS (ISO 45001 §8.1.4)</div><div className="font-medium">{s.ehsApproved?<span className="text-emerald-600">Cumple requisitos EHS</span>:<span className="text-gray-400">No evaluado</span>}</div></div>
      </div>
      {s.ehsRequirements && (
        <div className="bg-emerald-50/50 rounded-xl border border-emerald-200 p-4">
          <p className="text-xs font-semibold text-emerald-800 mb-1">Requisitos EHS comunicados al proveedor/contratista</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{s.ehsRequirements}</p>
        </div>
      )}
      {/* IATF 8.4.2.4.1 — Auditorías de segunda parte */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Auditorías de segunda parte <span className="text-xs font-normal text-gray-400">IATF 8.4.2.4.1</span></h3>
          <span className="text-sm text-gray-500">{audits.length} registros</span>
        </div>
        {audits.length===0 ? <p className="text-sm text-gray-500">Sin auditorías vinculadas — al crear una auditoría de tipo SUPPLIER, asociá el proveedor.</p> : (
          <ul className="divide-y divide-gray-100">
            {audits.map(a=>(
              <li key={a.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/auditorias/${a.id}`} className="font-medium text-blue-600 hover:underline">{a.code} — {a.title}</Link>
                  <p className="text-xs text-gray-500">{a.plannedStartDate?new Date(a.plannedStartDate).toLocaleDateString('es-AR'):'sin fecha'}{a.actualEndDate?` → ejecutada ${new Date(a.actualEndDate).toLocaleDateString('es-AR')}`:''}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">{a.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* IATF 8.4.2.5 — Planes de desarrollo del proveedor */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Planes de desarrollo <span className="text-xs font-normal text-gray-400">IATF 8.4.2.5</span></h3>
          <button onClick={()=>setShowPlan(true)} className="inline-flex items-center gap-1 text-sm px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">+ Nuevo plan</button>
        </div>
        {plans.length===0 ? <p className="text-sm text-gray-500">Sin planes de desarrollo</p> : (
          <div className="space-y-2">
            {plans.map(p=>(
              <div key={p.id} className="border border-gray-200 rounded-lg p-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{p.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.status==='COMPLETED'?'bg-green-100 text-green-700':p.status==='CANCELLED'?'bg-gray-100 text-gray-600':'bg-blue-100 text-blue-700'}`}>{p.status==='COMPLETED'?'Completado':p.status==='CANCELLED'?'Cancelado':'Activo'}</span>
                  </div>
                  {p.objective && <p className="text-sm text-gray-600 mt-1">{p.objective}</p>}
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                    {p.targetDate && <span>Objetivo: {new Date(p.targetDate).toLocaleDateString('es-AR')}</span>}
                    {p.completedAt && <span>Completado: {new Date(p.completedAt).toLocaleDateString('es-AR')}</span>}
                  </div>
                  {Array.isArray(p.actions) && p.actions.length>0 && (
                    <ul className="mt-2 space-y-1">
                      {p.actions.map((a:any,i:number)=>(<li key={i} className="text-xs text-gray-600 flex gap-2"><span className={a.status==='DONE'?'text-green-600':'text-gray-400'}>{a.status==='DONE'?'✓':'○'}</span>{a.action||a.description||JSON.stringify(a)}</li>))}
                    </ul>
                  )}
                </div>
                {p.status==='ACTIVE' && (
                  <select value={p.status} onChange={e=>planStatus(p.id, e.target.value)} className="text-xs border border-gray-300 rounded px-2 py-1 flex-shrink-0">
                    <option value="ACTIVE">Activo</option>
                    <option value="COMPLETED">Completado</option>
                    <option value="CANCELLED">Cancelado</option>
                  </select>
                )}
              </div>
            ))}
          </div>
        )}
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
              {[{k:'qualityScore',l:'Calidad'},{k:'deliveryScore',l:'Cumplimiento'},{k:'priceScore',l:'Precio'},{k:'serviceScore',l:'Servicio'},{k:'documentationScore',l:'Documentacion'}].map(({k,l})=>(<div key={k} className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">{l} (1-5)</label><div className="flex items-center gap-2"><input type="range" min={1} max={5} value={f[k as keyof typeof f] as number} onChange={e=>setF({...f,[k]:Number(e.target.value)})} className="w-24"/><span className="w-6 text-center font-bold">{f[k as keyof typeof f]}</span></div></div>))}
              {/* IATF 8.4.2.4 — monitoreo suplementario */}
              <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-3 space-y-3">
                <p className="text-xs font-semibold text-orange-800">Monitoreo IATF 8.4.2.4</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium text-gray-600 mb-0.5">PPM entregados</label><input type="number" step="0.01" value={f.deliveredPpm} onChange={e=>setF({...f,deliveredPpm:e.target.value})} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"/></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-0.5">Disrupciones al cliente</label><input type="number" min={0} value={f.customerDisruptions} onChange={e=>setF({...f,customerDisruptions:e.target.value})} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"/></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-0.5">Fletes premium</label><input type="number" min={0} value={f.premiumFreightIncidents} onChange={e=>setF({...f,premiumFreightIncidents:e.target.value})} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"/></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-0.5">Special status notif.</label><input type="number" min={0} value={f.specialStatusNotifications} onChange={e=>setF({...f,specialStatusNotifications:e.target.value})} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"/></div>
                </div>
                <input type="text" value={f.specialStatusNotes} onChange={e=>setF({...f,specialStatusNotes:e.target.value})} placeholder="Detalle de special status (new business hold, etc.)" className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"/>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Comentarios</label><textarea value={f.comments} onChange={e=>setF({...f,comments:e.target.value})} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"/></div>
              <div className="bg-gray-50 rounded-lg p-3 flex justify-between"><span className="text-sm font-medium">Score calculado:</span><span className="text-lg font-bold">{((f.qualityScore+f.deliveryScore+f.priceScore+f.serviceScore+f.documentationScore)/5).toFixed(1)}</span></div>
              <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={()=>setM(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Cancelar</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Guardar evaluacion</button></div>
            </form>
          </div>
        </div>
      )}
      {/* Modal plan de desarrollo (IATF 8.4.2.5) */}
      {showPlan&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="border-b border-gray-200 p-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-gray-900">Plan de desarrollo — {s.name}</h2><button onClick={()=>setShowPlan(false)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5"/></button></div>
            <form onSubmit={savePlan} className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Título *</label><input type="text" required value={planF.title} onChange={e=>setPlanF({...planF,title:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Ej: Elevar desempeño a >90% OTIF"/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Objetivo de desempeño</label><textarea rows={3} value={planF.objective} onChange={e=>setPlanF({...planF,objective:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Ej: reducir PPM de 450 a <100 en 6 meses"/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Fecha objetivo</label><input type="date" value={planF.targetDate} onChange={e=>setPlanF({...planF,targetDate:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg"/></div>
              <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={()=>setShowPlan(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Cancelar</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Crear plan</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
