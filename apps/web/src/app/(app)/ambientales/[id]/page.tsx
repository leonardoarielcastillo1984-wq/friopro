'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Leaf, ArrowLeft, Plus, Loader2, AlertTriangle, BrainCircuit, FileWarning, CheckCircle2, AlertOctagon } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface EnvAction {
  id: string; description: string; dueDate: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  effectiveness: 'EFFECTIVE' | 'NOT_EFFECTIVE' | 'PENDING';
}
interface EnvControl {
  id: string; type: string; description: string;
  implemented: boolean; effective: boolean; observation: string | null;
}
interface EnvReview {
  id: string; reviewDate: string; result: string; comments: string | null;
}
interface Aspect {
  id: string; code: string; process: string; aspect: string; impact: string;
  category: string; condition: string; naturalness: string; magnitude: number;
  severity: number; frequency: number; legalCompliance: number;
  significance: number; initialSignificance: number | null; isSignificant: boolean;
  status: string; reviewFrequency: string | null; reviewDate: string | null;
  currentControls: string | null; improvementActions: string | null;
  responsibleId: string | null;
  actions: EnvAction[]; controls: EnvControl[]; reviews: EnvReview[];
  reductionPercent: number | null;
}

const S_MAP: Record<string, string> = { OPEN:'Abierto', IN_TREATMENT:'En tratamiento', CONTROLLED:'Controlado', CLOSED:'Cerrado' };
const S_CLR: Record<string, string> = { OPEN:'bg-red-100 text-red-700', IN_TREATMENT:'bg-amber-100 text-amber-700', CONTROLLED:'bg-emerald-100 text-emerald-700', CLOSED:'bg-slate-100 text-slate-700' };
function fd(d?:string|null){ return d ? new Date(d).toLocaleDateString('es-AR') : '-'; }

export default function AspectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [a, setA] = useState<Aspect | null>(null);
  const [load, setLoad] = useState(true);
  const [err, setErr] = useState<string|null>(null);
  const [tab, setTab] = useState<'ac'|'ct'|'rv'|'ai'|'al'>('ac');
  const [aiL, setAiL] = useState(false); const [aiR, setAiR] = useState<string|null>(null);
  const [ncL, setNcL] = useState(false); const [ncR, setNcR] = useState<any>(null);
  const [mAc, setMAc] = useState(false); const [fAc, setFAc] = useState<Partial<EnvAction>>({status:'PENDING',effectiveness:'PENDING'}); const [eAc, setEAc] = useState<string|null>(null);
  const [mCt, setMCt] = useState(false); const [fCt, setFCt] = useState<Partial<EnvControl>>({type:'OPERATIONAL',implemented:false,effective:false}); const [eCt, setECt] = useState<string|null>(null);
  const [mRv, setMRv] = useState(false); const [fRv, setFRv] = useState<Partial<EnvReview>>({result:'CONTROLLED'}); const [eRv, setERv] = useState<string|null>(null);

  async function reload() { setLoad(true); setErr(null); try { const r = await apiFetch<{ item: Aspect }>(`/aspects/${id}`); setA(r.item); } catch(e:any){ setErr(e?.message||'Error'); } finally { setLoad(false); } }
  useEffect(() => { reload(); }, [id]);

  async function sAc(){ if(!a)return; const u=eAc?`/aspects/${id}/actions/${eAc}`:`/aspects/${id}/actions`; try{ await apiFetch(u,{method:eAc?'PUT':'POST',json:fAc}); setMAc(false); setEAc(null); setFAc({status:'PENDING',effectiveness:'PENDING'}); reload(); }catch(e:any){ alert('Error: '+e?.message); } }
  async function dAc(x:string){ if(!confirm('Eliminar?'))return; try{ await apiFetch(`/aspects/${id}/actions/${x}`,{method:'DELETE'}); reload(); }catch(e:any){ alert(e?.message); } }
  async function sCt(){ if(!a)return; const u=eCt?`/aspects/${id}/controls/${eCt}`:`/aspects/${id}/controls`; try{ await apiFetch(u,{method:eCt?'PUT':'POST',json:fCt}); setMCt(false); setECt(null); setFCt({type:'OPERATIONAL',implemented:false,effective:false}); reload(); }catch(e:any){ alert('Error: '+e?.message); } }
  async function dCt(x:string){ if(!confirm('Eliminar?'))return; try{ await apiFetch(`/aspects/${id}/controls/${x}`,{method:'DELETE'}); reload(); }catch(e:any){ alert(e?.message); } }
  async function sRv(){ if(!a)return; const u=eRv?`/aspects/${id}/reviews/${eRv}`:`/aspects/${id}/reviews`; try{ await apiFetch(u,{method:eRv?'PUT':'POST',json:fRv}); setMRv(false); setERv(null); setFRv({result:'CONTROLLED'}); reload(); }catch(e:any){ alert('Error: '+e?.message); } }
  async function dRv(x:string){ if(!confirm('Eliminar?'))return; try{ await apiFetch(`/aspects/${id}/reviews/${x}`,{method:'DELETE'}); reload(); }catch(e:any){ alert(e?.message); } }
  async function runAi(){ setAiL(true); setAiR(null); try{ const r=await apiFetch<{analysis:string}>(`/aspects/${id}/ai-analyze`,{method:'POST'}); setAiR(r.analysis); }catch(e:any){ setAiR('Error: '+e?.message); }finally{ setAiL(false); } }
  async function creNc(){ setNcL(true); setNcR(null); try{ const r=await apiFetch<any>(`/aspects/${id}/create-nc`,{method:'POST'}); setNcR(r); if(r.created) reload(); }catch(e:any){ alert('Error NC: '+e?.message); }finally{ setNcL(false); } }

  const alerts = useMemo(() => { if(!a) return []; const f:string[]=[]; const n=new Date(); if(a.isSignificant && (!a.actions||a.actions.length===0)) f.push('Sin acciones'); if(a.isSignificant && (!a.controls||a.controls.length===0||!a.controls.some(c=>c.implemented))) f.push('Sin controles'); if(a.actions?.some(ac=>ac.dueDate && new Date(ac.dueDate)<n && ac.status!=='COMPLETED')) f.push('Acciones vencidas'); if(a.controls?.some(c=>!c.implemented)) f.push('Controles no implementados'); if(a.controls?.some(c=>c.implemented && !c.effective)) f.push('Controles no eficaces'); if(!a.reviews||a.reviews.length===0) f.push('Sin revisiones'); if(a.reviewDate && new Date(a.reviewDate)<n) f.push('Revision vencida'); return f; }, [a]);

  if(load) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600"/></div>;
  if(err||!a) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-red-600">{err||'No encontrado'}</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/ambientales" className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><ArrowLeft className="h-5 w-5"/></Link>
            <div className="p-2 bg-green-100 rounded-lg"><Leaf className="h-5 w-5 text-green-600"/></div>
            <div><h1 className="text-xl font-bold text-gray-900">{a.code}</h1><p className="text-sm text-gray-500">{a.process} — {a.aspect}</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`px-3 py-1 text-xs font-medium rounded-full ${S_CLR[a.status]||'bg-gray-100 text-gray-700'}`}>{S_MAP[a.status]||a.status}</span>
            {a.isSignificant && <span className="px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Significativo</span>}
            {a.reductionPercent!==null && <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">Reducción: {a.reductionPercent}%</span>}
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">Significancia: {a.significance} {a.initialSignificance?`(inicial ${a.initialSignificance})`:''}</span>
          </div>
          {alerts.length>0 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800 mb-1"><AlertTriangle className="h-4 w-4"/> Alertas ({alerts.length})</div>
              <div className="flex flex-wrap gap-2">{alerts.map((x,i)=><span key={i} className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded">{x}</span>)}</div>
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button onClick={runAi} disabled={aiL} className="flex items-center gap-2 px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50"><BrainCircuit className="h-4 w-4"/> {aiL?'Analizando...':'Analizar'}</button>
            <button onClick={creNc} disabled={ncL} className="flex items-center gap-2 px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"><FileWarning className="h-4 w-4"/> {ncL?'Creando...':'Crear NC'}</button>
          </div>
          {aiR && <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-900 whitespace-pre-line"><div className="font-medium mb-1 flex items-center gap-2"><BrainCircuit className="h-4 w-4"/> Análisis IA</div>{aiR}<button onClick={()=>setAiR(null)} className="mt-2 text-xs text-indigo-600 hover:underline block">Ocultar</button></div>}
          {ncR && (
            <div className={`mt-4 p-4 rounded-lg text-sm ${ncR.created?'bg-green-50 border border-green-200 text-green-900':'bg-gray-50 border border-gray-200 text-gray-700'}`}>
              <div className="font-medium mb-1 flex items-center gap-2">{ncR.created?<CheckCircle2 className="h-4 w-4"/>:<AlertOctagon className="h-4 w-4"/>} {ncR.created?`NC creada: ${ncR.ncr?.code||''}`:ncR.reason||'No se creó NC'}</div>
              <button onClick={()=>setNcR(null)} className="mt-2 text-xs hover:underline block">Ocultar</button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6 flex-wrap">
          {(['ac','ct','rv','ai','al'] as const).map(t=> (
            <button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 text-sm font-medium rounded-lg border transition ${tab===t?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
              {t==='ac'?`Acciones (${a.actions?.length||0})`:t==='ct'?`Controles (${a.controls?.length||0})`:t==='rv'?`Revisiones (${a.reviews?.length||0})`:t==='ai'?'IA':`Alertas (${alerts.length})`}
            </button>
          ))}
        </div>

        {/* ACTIONS */}
        {tab==='ac' && (
          <div>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">Acciones</h2><button onClick={()=>{setEAc(null);setFAc({status:'PENDING',effectiveness:'PENDING'});setMAc(true);}} className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"><Plus className="h-4 w-4"/> Nueva</button></div>
            {mAc && (
              <div className="bg-white border rounded-xl p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div><label className="block text-xs text-gray-500 mb-1">Descripción</label><textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={3} value={fAc.description||''} onChange={e=>setFAc({...fAc,description:e.target.value})}/></div>
                  <div className="space-y-3">
                    <div><label className="block text-xs text-gray-500 mb-1">Vencimiento</label><input type="date" className="w-full px-3 py-2 border rounded-lg text-sm" value={fAc.dueDate?fAc.dueDate.split('T')[0]:''} onChange={e=>setFAc({...fAc,dueDate:e.target.value})}/></div>
                    <div className="flex gap-3">
                      <div className="flex-1"><label className="block text-xs text-gray-500 mb-1">Estado</label><select className="w-full px-3 py-2 border rounded-lg text-sm" value={fAc.status||'PENDING'} onChange={e=>setFAc({...fAc,status:e.target.value as any})}><option value="PENDING">Pendiente</option><option value="IN_PROGRESS">En proceso</option><option value="COMPLETED">Finalizada</option></select></div>
                      <div className="flex-1"><label className="block text-xs text-gray-500 mb-1">Eficacia</label><select className="w-full px-3 py-2 border rounded-lg text-sm" value={fAc.effectiveness||'PENDING'} onChange={e=>setFAc({...fAc,effectiveness:e.target.value as any})}><option value="EFFECTIVE">Eficaz</option><option value="NOT_EFFECTIVE">No eficaz</option><option value="PENDING">Pendiente</option></select></div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2"><button onClick={sAc} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Guardar</button><button onClick={()=>setMAc(false)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button></div>
              </div>
            )}
            <div className="bg-white border rounded-xl overflow-hidden">
              {(!a.actions||a.actions.length===0)?<div className="p-8 text-center text-gray-500 text-sm">Sin acciones</div>: (
                <table className="w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Descripción</th><th className="px-4 py-3">Vencimiento</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Eficacia</th><th className="px-4 py-3 w-20"></th></tr></thead>
                  <tbody>{a.actions.map(x=> (
                    <tr key={x.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-800">{x.description}</td>
                      <td className="px-4 py-3">{fd(x.dueDate)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full ${x.status==='COMPLETED'?'bg-emerald-100 text-emerald-700':x.status==='IN_PROGRESS'?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-700'}`}>{x.status==='COMPLETED'?'Finalizada':x.status==='IN_PROGRESS'?'En proceso':'Pendiente'}</span></td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full ${x.effectiveness==='EFFECTIVE'?'bg-emerald-100 text-emerald-700':x.effectiveness==='NOT_EFFECTIVE'?'bg-red-100 text-red-700':'bg-gray-100 text-gray-700'}`}>{x.effectiveness==='EFFECTIVE'?'Eficaz':x.effectiveness==='NOT_EFFECTIVE'?'No eficaz':'Pendiente'}</span></td>
                      <td className="px-4 py-3"><div className="flex gap-1"><button onClick={()=>{setEAc(x.id);setFAc({...x});setMAc(true);}} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded" title="Editar">✎</button><button onClick={()=>dAc(x.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Eliminar">✕</button></div></td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* CONTROLS */}
        {tab==='ct' && (
          <div>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">Controles</h2><button onClick={()=>{setECt(null);setFCt({type:'OPERATIONAL',implemented:false,effective:false});setMCt(true);}} className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"><Plus className="h-4 w-4"/> Nuevo</button></div>
            {mCt && (
              <div className="bg-white border rounded-xl p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div><label className="block text-xs text-gray-500 mb-1">Tipo</label><select className="w-full px-3 py-2 border rounded-lg text-sm" value={fCt.type||'OPERATIONAL'} onChange={e=>setFCt({...fCt,type:e.target.value})}><option value="OPERATIONAL">Operativo</option><option value="ENGINEERING">Ingeniería</option><option value="ADMINISTRATIVE">Administrativo</option></select></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Descripción</label><input className="w-full px-3 py-2 border rounded-lg text-sm" value={fCt.description||''} onChange={e=>setFCt({...fCt,description:e.target.value})}/></div>
                  <div className="flex gap-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!fCt.implemented} onChange={e=>setFCt({...fCt,implemented:e.target.checked})}/> Implementado</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!fCt.effective} onChange={e=>setFCt({...fCt,effective:e.target.checked})}/> Eficaz</label></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Observación</label><input className="w-full px-3 py-2 border rounded-lg text-sm" value={fCt.observation||''} onChange={e=>setFCt({...fCt,observation:e.target.value})}/></div>
                </div>
                <div className="flex gap-2"><button onClick={sCt} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Guardar</button><button onClick={()=>setMCt(false)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button></div>
              </div>
            )}
            <div className="bg-white border rounded-xl overflow-hidden">
              {(!a.controls||a.controls.length===0)?<div className="p-8 text-center text-gray-500 text-sm">Sin controles</div>: (
                <table className="w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Descripción</th><th className="px-4 py-3">Implementado</th><th className="px-4 py-3">Eficaz</th><th className="px-4 py-3 w-20"></th></tr></thead>
                  <tbody>{a.controls.map(x=> (
                    <tr key={x.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">{x.type==='OPERATIONAL'?'Operativo':x.type==='ENGINEERING'?'Ingeniería':'Administrativo'}</td>
                      <td className="px-4 py-3">{x.description}</td>
                      <td className="px-4 py-3">{x.implemented?<span className="text-emerald-600">✓</span>:<span className="text-red-600">✕</span>}</td>
                      <td className="px-4 py-3">{x.effective?<span className="text-emerald-600">✓</span>:<span className="text-red-600">✕</span>}</td>
                      <td className="px-4 py-3"><div className="flex gap-1"><button onClick={()=>{setECt(x.id);setFCt({...x});setMCt(true);}} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded" title="Editar">✎</button><button onClick={()=>dCt(x.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Eliminar">✕</button></div></td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* REVIEWS */}
        {tab==='rv' && (
          <div>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold">Revisiones</h2><button onClick={()=>{setERv(null);setFRv({result:'CONTROLLED'});setMRv(true);}} className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"><Plus className="h-4 w-4"/> Nueva</button></div>
            {mRv && (
              <div className="bg-white border rounded-xl p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div><label className="block text-xs text-gray-500 mb-1">Fecha</label><input type="date" className="w-full px-3 py-2 border rounded-lg text-sm" value={fRv.reviewDate?fRv.reviewDate.split('T')[0]:''} onChange={e=>setFRv({...fRv,reviewDate:e.target.value})}/></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Resultado</label><select className="w-full px-3 py-2 border rounded-lg text-sm" value={fRv.result||'CONTROLLED'} onChange={e=>setFRv({...fRv,result:e.target.value})}><option value="CONTROLLED">Controlado</option><option value="NOT_CONTROLLED">No controlado</option></select></div>
                  <div className="md:col-span-2"><label className="block text-xs text-gray-500 mb-1">Comentarios</label><textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} value={fRv.comments||''} onChange={e=>setFRv({...fRv,comments:e.target.value})}/></div>
                </div>
                <div className="flex gap-2"><button onClick={sRv} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Guardar</button><button onClick={()=>setMRv(false)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button></div>
              </div>
            )}
            <div className="bg-white border rounded-xl overflow-hidden">
              {(!a.reviews||a.reviews.length===0)?<div className="p-8 text-center text-gray-500 text-sm">Sin revisiones</div>: (
                <table className="w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Resultado</th><th className="px-4 py-3">Comentarios</th><th className="px-4 py-3 w-20"></th></tr></thead>
                  <tbody>{a.reviews.map(x=> (
                    <tr key={x.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">{fd(x.reviewDate)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full ${x.result==='CONTROLLED'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>{x.result==='CONTROLLED'?'Controlado':'No controlado'}</span></td>
                      <td className="px-4 py-3 text-gray-700">{x.comments||'-'}</td>
                      <td className="px-4 py-3"><div className="flex gap-1"><button onClick={()=>{setERv(x.id);setFRv({...x});setMRv(true);}} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded" title="Editar">✎</button><button onClick={()=>dRv(x.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Eliminar">✕</button></div></td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* AI */}
        {tab==='ai' && (
          <div className="bg-white border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Análisis con IA</h2>
            <p className="text-sm text-gray-600 mb-4">Ejecutar desde la cabecera. El resultado aparece allí.</p>
            <button onClick={runAi} disabled={aiL} className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50"><BrainCircuit className="h-4 w-4"/> {aiL?'Analizando...':'Analizar ahora'}</button>
          </div>
        )}

        {/* ALERTS */}
        {tab==='al' && (
          <div className="bg-white border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Alertas del aspecto</h2>
            {alerts.length===0 ? <div className="text-sm text-gray-500">No hay alertas activas</div> : (
              <div className="space-y-2">{alerts.map((x,i)=>(
                <div key={i} className="flex items-center gap-2 text-sm p-3 bg-amber-50 border border-amber-200 rounded-lg"><AlertTriangle className="h-4 w-4 text-amber-600 shrink-0"/>{x}</div>
              ))}</div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
