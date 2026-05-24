'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Plus, Trash2, TrendingUp, Wallet } from 'lucide-react';

interface Props {
  projectId: string;
}

export default function BudgetTab({ projectId }: Props) {
  const [budgetItems, setBudgetItems] = useState<any[]>([]);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({
    nombre: '', categoria: 'MATERIAL', cantidad: '', unidadMedida: 'unidades',
    costoUnitario: '', costoTotalEstimado: '', moneda: 'ARS',
    descripcion: '', proveedorNombre: ''
  });

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, bRes] = await Promise.all([
        apiFetch(`/project360/projects/${projectId}`) as any,
        apiFetch(`/project360/projects/${projectId}/budget-items`) as any,
      ]);
      setProject(pRes.project);
      setBudgetItems(bRes.budgetItems || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const handleAdd = async () => {
    if (!newItem.nombre || !newItem.costoTotalEstimado) return;
    try {
      const cantidad = parseFloat(newItem.cantidad || '1');
      const costoUnitario = parseFloat(newItem.costoUnitario || '0');
      const costoTotalEstimado = parseFloat(newItem.costoTotalEstimado || '0');
      const res = await apiFetch(`/project360/projects/${projectId}/budget-items`, {
        method: 'POST',
        json: { nombre: newItem.nombre, categoria: newItem.categoria, cantidad, unidadMedida: newItem.unidadMedida, costoUnitario, costoTotalEstimado, moneda: newItem.moneda, descripcion: newItem.descripcion, proveedorNombre: newItem.proveedorNombre, estado: 'PRESUPUESTADO' }
      }) as any;
      setBudgetItems([...budgetItems, res.budgetItem]);
      setNewItem({ nombre: '', categoria: 'MATERIAL', cantidad: '', unidadMedida: 'unidades', costoUnitario: '', costoTotalEstimado: '', moneda: 'ARS', descripcion: '', proveedorNombre: '' });
      setShowAdd(false);
    } catch (e: any) { alert(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar ítem?')) return;
    await apiFetch(`/project360/budget-items/${id}`, { method: 'DELETE' });
    setBudgetItems(budgetItems.filter(b => b.id !== id));
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando presupuesto...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Wallet className="w-5 h-5 text-indigo-600" /> Presupuesto</h2>
          <p className="text-sm text-gray-500">Recursos dimensionados y gastos proyectados</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Agregar Recurso
        </button>
      </div>

      {project?.budget && (
        <div className="bg-white rounded-xl border p-6">
          <div className="flex justify-between text-sm mb-2">
            <span>Total: <strong>{project.budget?.toLocaleString('es-AR', { style: 'currency', currency: project.budgetCurrency || 'ARS' })}</strong></span>
            <span>Gasto: <strong>{(project.actualCost || 0).toLocaleString('es-AR', { style: 'currency', currency: project.budgetCurrency || 'ARS' })}</strong></span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3"><div className="bg-indigo-600 h-3 rounded-full" style={{ width: `${Math.min(100, ((project.actualCost || 0) / (project.budget || 1)) * 100)}%` }} /></div>
          <p className="text-xs text-gray-500 mt-1">{Math.round(((project.actualCost || 0) / (project.budget || 1)) * 100)}% consumido</p>
        </div>
      )}

      {budgetItems.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Sin ítems de presupuesto</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="divide-y">
            {budgetItems.map((item: any) => (
              <div key={item.id} className="flex items-center gap-3 p-4">
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.name} <span className="text-xs text-gray-500">({item.category})</span></p>
                  <div className="flex gap-3 text-xs text-gray-600 mt-1">
                    <span>Est: {item.estimated?.toLocaleString('es-AR', { style: 'currency', currency: item.currency || 'ARS' })}</span>
                    <span>Act: {item.actual?.toLocaleString('es-AR', { style: 'currency', currency: item.currency || 'ARS' })}</span>
                    {item.isExpense && <span className="text-red-600 font-medium">GASTO</span>}
                  </div>
                </div>
                <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-3">
            <h3 className="text-lg font-semibold">Nuevo Recurso</h3>
            <input type="text" value={newItem.nombre} onChange={e => setNewItem({ ...newItem, nombre: e.target.value })} placeholder="Nombre del recurso" className="w-full px-3 py-2 border rounded-lg text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <select value={newItem.categoria} onChange={e => setNewItem({ ...newItem, categoria: e.target.value })} className="px-3 py-2 border rounded-lg text-sm">
                <option value="MATERIAL">Material</option><option value="MANO_OBRA">Mano de obra</option><option value="SERVICIO">Servicio</option><option value="EQUIPO">Equipo</option><option value="SUBCONTRATO">Subcontrato</option><option value="TECNOLOGIA">Tecnología</option><option value="OTRO">Otro</option>
              </select>
              <select value={newItem.unidadMedida} onChange={e => setNewItem({ ...newItem, unidadMedida: e.target.value })} className="px-3 py-2 border rounded-lg text-sm">
                <option value="unidades">Unidades</option><option value="horas">Horas</option><option value="dias">Días</option><option value="meses">Meses</option><option value="m2">m²</option><option value="kg">kg</option><option value="litros">Litros</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" value={newItem.cantidad} onChange={e => setNewItem({ ...newItem, cantidad: e.target.value })} placeholder="Cantidad" className="px-3 py-2 border rounded-lg text-sm" />
              <input type="number" value={newItem.costoUnitario} onChange={e => setNewItem({ ...newItem, costoUnitario: e.target.value })} placeholder="Costo unitario" className="px-3 py-2 border rounded-lg text-sm" />
              <input type="number" value={newItem.costoTotalEstimado} onChange={e => setNewItem({ ...newItem, costoTotalEstimado: e.target.value })} placeholder="Costo total" className="px-3 py-2 border rounded-lg text-sm" />
            </div>
            <input type="text" value={newItem.proveedorNombre} onChange={e => setNewItem({ ...newItem, proveedorNombre: e.target.value })} placeholder="Proveedor / Responsable" className="w-full px-3 py-2 border rounded-lg text-sm" />
            <input type="text" value={newItem.descripcion} onChange={e => setNewItem({ ...newItem, descripcion: e.target.value })} placeholder="Descripción (opcional)" className="w-full px-3 py-2 border rounded-lg text-sm" />
            <div className="flex gap-3 pt-2">
              <button onClick={handleAdd} disabled={!newItem.nombre || !newItem.costoTotalEstimado} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">Agregar</button>
              <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
