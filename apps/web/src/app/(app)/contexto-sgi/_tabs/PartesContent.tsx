'use client';
import { useState, useEffect } from 'react';
import { UsersRound, Plus, Edit, Trash2, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function PartesContent() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [genAction, setGenAction] = useState(false);

  useEffect(() => { load(); }, []);
  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/stakeholders') as any;
      setItems(data?.items || data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  const open = (item?: any) => {
    setEditing(item || { name:'', type:'EXTERNAL', category:'CUSTOMER', influence:3, interest:3, complianceStatus:'COMPLIES', complianceLevel:100, requiresAction:false });
    setShowModal(true);
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing?.name?.trim()) { alert('Nombre requerido'); return; }
    const d = { ...editing };
    delete d.reviewDate;
    if (d.complianceLevel !== undefined && (d.complianceLevel < 0 || d.complianceLevel > 100)) { alert('Nivel 0-100'); return; }
    if (d.requiresAction && d.complianceStatus === 'COMPLIES') { alert('No requiere acción si Cumple'); return; }
    setSaving(true);
    try {
      if (d.id) await apiFetch(`/stakeholders/${d.id}`, { method:'PUT', json:d });
      else await apiFetch('/stakeholders', { method:'POST', json:d });
      setShowModal(false); load();
    } catch (e: any) { alert('Error: '+e.message); }
    finally { setSaving(false); }
  };
  const del = async (id: string) => {
    if (!confirm('Eliminar?')) return;
    await apiFetch(`/stakeholders/${id}`, { method:'DELETE' }); load();
  };
  const gen = async (item: any) => {
    if (!item.id) return;
    setGenAction(true);
    try {
      await apiFetch('/actions', { method:'POST', json:{
        title: `Acción ${item.name} - ${item.complianceStatus==='NON_COMPLIANT'?'No Cumple':'Parcial'}`,
        description: `Origen: Parte Interesada\n${item.name}\nEstado: ${item.complianceStatus}\nNivel: ${item.complianceLevel}%\nEvidencia: ${item.complianceEvidence||'—'}`,
        type: item.complianceStatus==='NON_COMPLIANT'?'CORRECTIVE':'IMPROVEMENT',
        priority: item.complianceStatus==='NON_COMPLIANT'?'HIGH':'MEDIUM',
        sourceType:'STAKEHOLDER', sourceId:item.id, status:'OPEN',
        openDate: new Date().toISOString().split('T')[0]
      }});
      alert('Acción creada');
    } catch(e: any){ alert('Error: '+e.message); }
    finally{ setGenAction(false); }
  };
  const fi = filter==='ALL'?items:items.filter((x:any)=>x.complianceStatus===filter);
  const icon = (s?:string) => s==='COMPLIES'?<CheckCircle className="w-4 h-4 text-green-500"/>:s==='PARTIAL'?<AlertCircle className="w-4 h-4 text-yellow-500"/>:s==='NON_COMPLIANT'?<XCircle className="w-4 h-4 text-red-500"/>:null;
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold">Partes Interesadas</h1>
      <p className="text-sm text-gray-600 mb-6">Stakeholders con Evaluación de Cumplimiento</p>
      <div className="bg-white rounded-xl border p-4 mb-6 flex justify-between">
        <select value={filter} onChange={e=>setFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="ALL">Todos</option><option value="COMPLIES">Cumple</option><option value="PARTIAL">Parcial</option><option value="NON_COMPLIANT">No cumple</option>
        </select>
        <button onClick={()=>open()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"><Plus className="w-4 h-4"/>Nueva</button>
      </div>
      {loading?<div className="text-center py-12">Cargando...</div>:
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full"><thead className="bg-gray-50 border-b"><tr>
          <th className="px-4 py-3 text-left text-xs font-semibold">Nombre</th>
          <th className="px-4 py-3 text-left text-xs font-semibold">Tipo</th>
          <th className="px-4 py-3 text-left text-xs font-semibold">Cat</th>
          <th className="px-4 py-3 text-left text-xs font-semibold">Estado</th>
          <th className="px-4 py-3 text-left text-xs font-semibold">Nivel</th>
          <th className="px-4 py-3 text-left text-xs font-semibold">Acción?</th>
          <th className="px-4 py-3 text-left text-xs font-semibold">Ops</th>
        </tr></thead><tbody className="divide-y">
        {fi.map((i:any)=>(<tr key={i.id} className="hover:bg-gray-50">
          <td className="px-4 py-3 text-sm font-medium">{i.name}</td>
          <td className="px-4 py-3 text-sm">{i.type==='INTERNAL'?'Interna':'Externa'}</td>
          <td className="px-4 py-3 text-sm">{i.category}</td>
          <td className="px-4 py-3 text-sm flex items-center gap-2">{icon(i.complianceStatus)}{i.complianceStatus==='COMPLIES'?'Cumple':i.complianceStatus==='PARTIAL'?'Parcial':i.complianceStatus==='NON_COMPLIANT'?'No cumple':''}</td>
          <td className="px-4 py-3 text-sm">{i.complianceLevel?`${i.complianceLevel}%`:'—'}</td>
          <td className="px-4 py-3 text-sm">{i.requiresAction?'Sí':'No'}</td>
          <td className="px-4 py-3 text-sm"><div className="flex gap-2">
            {i.requiresAction&&<button onClick={()=>gen(i)} disabled={genAction} className="px-2 py-1 text-xs bg-green-600 text-white rounded disabled:opacity-50">Generar Acción</button>}
            <button onClick={()=>open(i)} className="p-1 hover:bg-gray-200 rounded"><Edit className="w-4 h-4"/></button>
            <button onClick={()=>del(i.id)} className="p-1 hover:bg-gray-200 rounded"><Trash2 className="w-4 h-4"/></button>
          </div></td>
        </tr>))}
        </tbody></table>
      </div>}

      {showModal&&editing&&<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
          <div className="flex justify-between p-6 border-b"><div className="flex items-center gap-2"><UsersRound className="w-5 h-5 text-blue-600"/><h2 className="text-lg font-semibold">{editing.id?'Editar':'Nueva'}</h2></div><button onClick={()=>setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><XCircle className="w-5 h-5"/></button></div>
          <form onSubmit={save} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4"><div className="col-span-2"><label className="block text-sm font-medium mb-1">Nombre *</label><input type="text" value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" required/></div>
            <div><label className="block text-sm font-medium mb-1">Tipo *</label><select value={editing.type} onChange={e=>setEditing({...editing,type:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="INTERNAL">Interna</option><option value="EXTERNAL">Externa</option></select></div>
            <div><label className="block text-sm font-medium mb-1">Categoría *</label><select value={editing.category} onChange={e=>setEditing({...editing,category:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="EMPLOYEE">Empleado</option><option value="CUSTOMER">Cliente</option><option value="SUPPLIER">Proveedor</option><option value="COMMUNITY">Comunidad</option><option value="REGULATOR">Regulador</option><option value="SHAREHOLDER">Accionista</option><option value="OTHER">Otro</option></select></div>
            </div>
            <div><label className="block text-sm font-medium mb-1">Necesidades</label><textarea rows={3} value={editing.needs||''} onChange={e=>setEditing({...editing,needs:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm"/></div>
            <div><label className="block text-sm font-medium mb-1">Expectativas</label><textarea rows={3} value={editing.expectations||''} onChange={e=>setEditing({...editing,expectations:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm"/></div>
            <div><label className="block text-sm font-medium mb-1">Requisitos</label><textarea rows={3} value={editing.requirements||''} onChange={e=>setEditing({...editing,requirements:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm"/></div>

            <div className="border-t pt-4"><h3 className="text-sm font-semibold mb-3">Evaluación de Cumplimiento</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className="block text-sm font-medium mb-1">Estado</label><select value={editing.complianceStatus||'COMPLIES'} onChange={e=>setEditing({...editing,complianceStatus:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="COMPLIES">Cumple</option><option value="PARTIAL">Parcial</option><option value="NON_COMPLIANT">No cumple</option></select></div>
              <div><label className="block text-sm font-medium mb-1">Nivel (%)</label><input type="number" min="0" max="100" value={editing.complianceLevel||100} onChange={e=>setEditing({...editing,complianceLevel:parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm"/></div>
            </div>
            <div className="mb-4"><label className="block text-sm font-medium mb-1">Fecha última evaluación</label><input type="date" value={editing.lastEvaluationDate||''} onChange={e=>setEditing({...editing,lastEvaluationDate:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm"/></div>
            <div className="mb-4"><label className="block text-sm font-medium mb-1">Evidencia</label><textarea rows={3} value={editing.complianceEvidence||''} onChange={e=>setEditing({...editing,complianceEvidence:e.target.value})} placeholder="Ej: indicadores, auditorías" className="w-full px-3 py-2 border rounded-lg text-sm"/></div>
            <div className="mb-4"><label className="block text-sm font-medium mb-1">Indicador asociado</label><input type="text" value={editing.indicatorId||''} onChange={e=>setEditing({...editing,indicatorId:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm"/></div>
            <div className="flex items-center gap-2"><input type="checkbox" id="ra" checked={editing.requiresAction||false} onChange={e=>setEditing({...editing,requiresAction:e.target.checked})} className="w-4 h-4"/><label htmlFor="ra" className="text-sm font-medium">¿Requiere acción CAPA?</label></div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              <div><label className="block text-sm font-medium mb-1">Influencia (1-5)</label><input type="number" min="1" max="5" value={editing.influence||3} onChange={e=>setEditing({...editing,influence:Math.max(1,Math.min(5,parseInt(e.target.value)))})} className="w-full px-3 py-2 border rounded-lg text-sm"/></div>
              <div><label className="block text-sm font-medium mb-1">Interés (1-5)</label><input type="number" min="1" max="5" value={editing.interest||3} onChange={e=>setEditing({...editing,interest:Math.max(1,Math.min(5,parseInt(e.target.value)))})} className="w-full px-3 py-2 border rounded-lg text-sm"/></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium mb-1">Contacto</label><input type="text" value={editing.contactName||''} onChange={e=>setEditing({...editing,contactName:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm"/></div>
              <div><label className="block text-sm font-medium mb-1">Email</label><input type="email" value={editing.contactEmail||''} onChange={e=>setEditing({...editing,contactEmail:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm"/></div>
            </div>
            <div><label className="block text-sm font-medium mb-1">Notas</label><textarea rows={3} value={editing.notes||''} onChange={e=>setEditing({...editing,notes:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm"/></div>

            <div className="p-6 border-t flex gap-3">
              <button type="button" onClick={()=>setShowModal(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 text-sm">{saving?'Guardando...':'Guardar'}</button>
            </div>
          </form>
        </div>
      </div>}
    </div>
  );
}
