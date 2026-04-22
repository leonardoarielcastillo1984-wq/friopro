'use client';
import { useState, useEffect } from 'react';
import { UsersRound, Plus, Edit, Trash2, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Stakeholder {
  id?: string;
  name: string;
  type: 'INTERNAL' | 'EXTERNAL';
  category: 'EMPLOYEE' | 'CUSTOMER' | 'SUPPLIER' | 'COMMUNITY' | 'REGULATOR' | 'SHAREHOLDER' | 'OTHER';
  needs?: string;
  expectations?: string;
  requirements?: string;
  influence?: number;
  interest?: number;
  contactName?: string;
  contactEmail?: string;
  notes?: string;
  complianceStatus?: 'COMPLIES' | 'PARTIAL' | 'NON_COMPLIANT';
  complianceLevel?: number;
  lastEvaluationDate?: string;
  complianceEvidence?: string;
  indicatorId?: string;
  requiresAction?: boolean;
}

export default function PartesInteresadasPage() {
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Stakeholder | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [generatingAction, setGeneratingAction] = useState(false);

  useEffect(() => {
    loadStakeholders();
  }, []);

  const loadStakeholders = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/stakeholders') as Stakeholder[];
      setStakeholders(data);
    } catch (e: any) {
      console.error('Error loading stakeholders:', e);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item?: Stakeholder) => {
    setEditingItem(item || {
      name: '',
      type: 'EXTERNAL',
      category: 'CUSTOMER',
      influence: 3,
      interest: 3,
      complianceStatus: 'COMPLIES',
      complianceLevel: 100,
      requiresAction: false,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
  };

  const validateForm = (item: Stakeholder): string | null => {
    if (!item.name?.trim()) return 'El nombre es requerido';
    if (item.complianceLevel !== undefined && (item.complianceLevel < 0 || item.complianceLevel > 100)) {
      return 'El nivel de cumplimiento debe estar entre 0 y 100';
    }
    if (item.requiresAction && item.complianceStatus === 'COMPLIES') {
      return 'No se puede marcar "Requiere acción" si el estado es "Cumple"';
    }
    return null;
  };

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const validationError = validateForm(editingItem);
    if (validationError) {
      alert(validationError);
      return;
    }

    setSaving(true);
    try {
      if (editingItem.id) {
        await apiFetch(`/stakeholders/${editingItem.id}`, {
          method: 'PUT',
          json: editingItem,
        });
      } else {
        await apiFetch('/stakeholders', {
          method: 'POST',
          json: editingItem,
        });
      }
      closeModal();
      loadStakeholders();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm('¿Eliminar esta parte interesada?')) return;
    try {
      await apiFetch(`/stakeholders/${id}`, { method: 'DELETE' });
      loadStakeholders();
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const generateAction = async (stakeholder: Stakeholder) => {
    if (!stakeholder.id) return;

    const actionType = stakeholder.complianceStatus === 'NON_COMPLIANT' ? 'CORRECTIVE' : 'IMPROVEMENT';
    
    setGeneratingAction(true);
    try {
      await apiFetch('/actions', {
        method: 'POST',
        json: {
          title: `Acción para ${stakeholder.name} - ${stakeholder.complianceStatus === 'NON_COMPLIANT' ? 'No Cumple' : 'Parcial'}`,
          description: `Origen: Parte Interesada\n\nParte interesada: ${stakeholder.name}\nCategoría: ${stakeholder.category}\nEstado de cumplimiento: ${stakeholder.complianceStatus}\nNivel: ${stakeholder.complianceLevel}%\n\nEvidencia:\n${stakeholder.complianceEvidence || '—'}`,
          type: actionType,
          priority: stakeholder.complianceStatus === 'NON_COMPLIANT' ? 'HIGH' : 'MEDIUM',
          sourceType: 'STAKEHOLDER',
          sourceId: stakeholder.id,
          status: 'OPEN',
          openDate: new Date().toISOString().split('T')[0],
        },
      });
      alert('Acción CAPA creada correctamente en el módulo Acciones');
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setGeneratingAction(false);
    }
  };

  const filteredStakeholders = filterStatus === 'ALL' 
    ? stakeholders 
    : stakeholders.filter(s => s.complianceStatus === filterStatus);

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'COMPLIES': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'PARTIAL': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'NON_COMPLIANT': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Partes Interesadas</h1>
        <p className="text-sm text-gray-600">Stakeholders del SGI (ISO 9001/14001/45001 §4.2) con Evaluación de Cumplimiento</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Filtro por estado:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Todos</option>
              <option value="COMPLIES">✅ Cumple</option>
              <option value="PARTIAL">⚠️ Parcial</option>
              <option value="NON_COMPLIANT">❌ No cumple</option>
            </select>
          </div>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Nueva Parte Interesada
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Categoría</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Estado Cumplimiento</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Nivel (%)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">¿Requiere Acción?</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStakeholders.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.type === 'INTERNAL' ? 'Interna' : 'Externa'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.category}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 flex items-center gap-2">
                    {getStatusIcon(item.complianceStatus)}
                    {item.complianceStatus === 'COMPLIES' && 'Cumple'}
                    {item.complianceStatus === 'PARTIAL' && 'Parcial'}
                    {item.complianceStatus === 'NON_COMPLIANT' && 'No cumple'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.complianceLevel ? `${item.complianceLevel}%` : '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.requiresAction ? 'Sí' : 'No'}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      {item.requiresAction && (
                        <button
                          onClick={() => generateAction(item)}
                          disabled={generatingAction}
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          Generar Acción
                        </button>
                      )}
                      <button onClick={() => openModal(item)} className="p-1 hover:bg-gray-200 rounded">
                        <Edit className="w-4 h-4 text-gray-600" />
                      </button>
                      <button onClick={() => deleteItem(item.id!)} className="p-1 hover:bg-gray-200 rounded">
                        <Trash2 className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <UsersRound className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingItem.id ? 'Editar Parte Interesada' : 'Nueva Parte Interesada'}
                </h2>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={saveItem} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                  <select
                    value={editingItem.type}
                    onChange={(e) => setEditingItem({ ...editingItem, type: e.target.value as 'INTERNAL' | 'EXTERNAL' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="INTERNAL">Interna</option>
                    <option value="EXTERNAL">Externa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
                  <select
                    value={editingItem.category}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="EMPLOYEE">Empleado</option>
                    <option value="CUSTOMER">Cliente</option>
                    <option value="SUPPLIER">Proveedor</option>
                    <option value="COMMUNITY">Comunidad</option>
                    <option value="REGULATOR">Regulador/Autoridad</option>
                    <option value="SHAREHOLDER">Accionista/Propietario</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Necesidades</label>
                <textarea
                  rows={3}
                  value={editingItem.needs || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, needs: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expectativas</label>
                <textarea
                  rows={3}
                  value={editingItem.expectations || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, expectations: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Requisitos aplicables</label>
                <textarea
                  rows={3}
                  value={editingItem.requirements || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, requirements: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Evaluación de Cumplimiento (ISO 9001 cláusulas 4.2 y 9.1)</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estado de cumplimiento</label>
                    <select
                      value={editingItem.complianceStatus || 'COMPLIES'}
                      onChange={(e) => setEditingItem({ ...editingItem, complianceStatus: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="COMPLIES">Cumple</option>
                      <option value="PARTIAL">Parcial</option>
                      <option value="NON_COMPLIANT">No cumple</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nivel de cumplimiento (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editingItem.complianceLevel || 100}
                      onChange={(e) => setEditingItem({ ...editingItem, complianceLevel: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha última evaluación</label>
                  <input
                    type="date"
                    value={editingItem.lastEvaluationDate || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, lastEvaluationDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Evidencia</label>
                  <textarea
                    rows={3}
                    value={editingItem.complianceEvidence || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, complianceEvidence: e.target.value })}
                    placeholder="Ej: indicadores, auditorías, reportes, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Indicador asociado (opcional)</label>
                  <input
                    type="text"
                    value={editingItem.indicatorId || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, indicatorId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="requiresAction"
                    checked={editingItem.requiresAction || false}
                    onChange={(e) => setEditingItem({ ...editingItem, requiresAction: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label htmlFor="requiresAction" className="text-sm font-medium text-gray-700">
                    ¿Requiere acción CAPA?
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Influencia (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={editingItem.influence || 3}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setEditingItem({ ...editingItem, influence: Math.max(1, Math.min(5, val)) });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interés (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={editingItem.interest || 3}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setEditingItem({ ...editingItem, interest: Math.max(1, Math.min(5, val)) });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contacto</label>
                  <input
                    type="text"
                    value={editingItem.contactName || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, contactName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email contacto</label>
                  <input
                    type="email"
                    value={editingItem.contactEmail || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, contactEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  rows={3}
                  value={editingItem.notes || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button type="button" onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
