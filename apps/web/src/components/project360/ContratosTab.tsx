'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { exportToPDF, exportToWord, exportToExcel } from '@/lib/exportUtils';
import {
  FileSignature, Plus, AlertTriangle, CheckCircle, Calendar,
  DollarSign, Shield, Clock, Trash2, Eye, AlertCircle,
  FileText, Bell, FileCode, FileSpreadsheet, Presentation,
  AlertOctagon, ShieldAlert, Pencil, X
} from 'lucide-react';

interface Contract {
  id: string;
  contractNumber: string | null;
  contractType: string | null;
  startDate: string | null;
  endDate: string | null;
  renewalDate: string | null;
  durationMonths: number | null;
  totalValue: number | null;
  currency: string;
  paymentTerms: string | null;
  billingFrequency: string | null;
  slaDescription: string | null;
  slaMetrics: any | null;
  penaltyClauses: string | null;
  penaltyAmount: number | null;
  guarantees: any | null;
  insurances: any | null;
  expirationAlertDays: number;
  isActive: boolean;
  criticalClauses: any | null;
  iaRiskAlert: string | null;
  finesApplied: any | null;
  totalFines: number;
  contractDocumentUrl: string | null;
  amendments: any | null;
  notes: string | null;
  slaResponseTime: number | null;
  slaResolutionTime: number | null;
  penaltyRate: number | null;
  insuranceRequired: boolean;
  insuranceAmount: number | null;
  renewalTerms: string | null;
  terminationClause: string | null;
  autoRenewal: boolean;
  renewalNoticeDays: number | null;
  iaRiskAlerts: string[] | null;
  complianceStatus: string;
  approvalStatus: string;
  signedByClient: boolean;
  signedByUs: boolean;
  digitalSignatureId: string | null;
  nextReviewDate: string | null;
  alerts: any[] | null;
}

interface Props {
  projectId: string;
}

const CONTRACT_TYPES = [
  { key: 'SERVICIO', label: 'Contrato de Servicio' },
  { key: 'LICITACION', label: 'Licitación/Concesión' },
  { key: 'MARCO', label: 'Contrato Marco' },
  { key: 'CONFIDENCIALIDAD', label: 'NDA/Confidencialidad' },
  { key: 'SUBCONTRATO', label: 'Subcontrato' },
  { key: 'LEASING', label: 'Leasing Operativo' },
  { key: 'MANTENIMIENTO', label: 'Mantenimiento' },
  { key: 'LOGISTICA', label: 'Logística/Transporte' },
  { key: 'OTRO', label: 'Otro' },
];

const BILLING_FREQUENCIES = [
  { key: 'SEMANAL', label: 'Semanal' },
  { key: 'QUINCENAL', label: 'Quincenal' },
  { key: 'MENSUAL', label: 'Mensual' },
  { key: 'BIMESTRAL', label: 'Bimestral' },
  { key: 'TRIMESTRAL', label: 'Trimestral' },
  { key: 'SEMESTRAL', label: 'Semestral' },
  { key: 'ANUAL', label: 'Anual' },
  { key: 'UNICO', label: 'Pago Único' },
];

export default function ContratosTab({ projectId }: Props) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [newContract, setNewContract] = useState({
    contractNumber: '', contractType: 'SERVICIO', startDate: '', endDate: '',
    totalValue: '', currency: 'ARS', paymentTerms: '', billingFrequency: 'MENSUAL',
    slaResponseTime: '', slaResolutionTime: '', penaltyRate: '',
    insuranceRequired: false, insuranceAmount: '',
    autoRenewal: false, renewalNoticeDays: '30',
    criticalClauses: '', terminationClause: '', renewalTerms: ''
  });

  // Estados para alertas y edición avanzada
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [alertContract, setAlertContract] = useState<Contract | null>(null);
  const [contractAlerts, setContractAlerts] = useState<any[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editContract, setEditContract] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/project360-v1/projects/${projectId}/contracts`) as any;
      setContracts(res.contracts || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    try {
      await apiFetch(`/project360-v1/projects/${projectId}/contracts`, {
        method: 'POST',
        json: {
          ...newContract,
          totalValue: Number(newContract.totalValue) || 0,
          slaResponseTime: Number(newContract.slaResponseTime) || null,
          slaResolutionTime: Number(newContract.slaResolutionTime) || null,
          penaltyRate: Number(newContract.penaltyRate) || null,
          insuranceAmount: Number(newContract.insuranceAmount) || null,
          renewalNoticeDays: Number(newContract.renewalNoticeDays) || null,
        }
      });
      setShowAddModal(false);
      setNewContract({
        contractNumber: '', contractType: 'SERVICIO', startDate: '', endDate: '',
        totalValue: '', currency: 'ARS', paymentTerms: '', billingFrequency: 'MENSUAL',
        slaResponseTime: '', slaResolutionTime: '', penaltyRate: '',
        insuranceRequired: false, insuranceAmount: '',
        autoRenewal: false, renewalNoticeDays: '30',
        criticalClauses: '', terminationClause: '', renewalTerms: ''
      });
      load();
    } catch (e: any) { alert(e.message); }
  };

  const handleAnalyzeIA = async (contractId: string) => {
    setAnalyzing(true);
    try {
      await apiFetch(`/project360-v1/contracts/${contractId}/analyze`, { method: 'POST' });
      load();
      alert('Análisis IA completado. Revisá las alertas generadas.');
    } catch (e: any) { alert(e.message); }
    setAnalyzing(false);
  };

  const loadAlerts = async (contract: Contract) => {
    setLoadingAlerts(true);
    setAlertContract(contract);
    try {
      const res = await apiFetch(`/project360-v1/contracts/${contract.id}/alerts`) as any;
      setContractAlerts(res.alerts || []);
      setShowAlertsModal(true);
    } catch (e: any) { alert(e.message); }
    setLoadingAlerts(false);
  };

  const openEditAdvanced = (contract: Contract) => {
    setEditContract({
      id: contract.id,
      slaDescription: contract.slaDescription || '',
      penaltyClauses: contract.penaltyClauses || '',
      guarantees: contract.guarantees ? JSON.stringify(contract.guarantees, null, 2) : '',
      insurances: contract.insurances ? JSON.stringify(contract.insurances, null, 2) : '',
      expirationAlertDays: contract.expirationAlertDays || 30,
      notes: contract.notes || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateAdvanced = async () => {
    try {
      await apiFetch(`/project360-v1/contracts/${editContract.id}`, {
        method: 'PUT',
        json: {
          slaDescription: editContract.slaDescription || null,
          penaltyClauses: editContract.penaltyClauses || null,
          guarantees: editContract.guarantees ? JSON.parse(editContract.guarantees) : null,
          insurances: editContract.insurances ? JSON.parse(editContract.insurances) : null,
          expirationAlertDays: Number(editContract.expirationAlertDays) || 30,
          notes: editContract.notes || null
        }
      });
      setShowEditModal(false);
      setEditContract(null);
      load();
    } catch (e: any) { alert(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este contrato?')) return;
    try {
      await apiFetch(`/project360-v1/contracts/${id}`, { method: 'DELETE' });
      load();
    } catch (e: any) { alert(e.message); }
  };

  const formatCurrency = (val: number | null, currency = 'ARS') => 
    val ? new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(val) : '-';

  const getDaysUntil = (date: string | null) => {
    if (!date) return null;
    const days = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando contratos...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Gestión Contractual</h2>
          <p className="text-sm text-gray-500">SLA, penalidades, garantías y alertas legales</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Nuevo Contrato
        </button>
      </div>

      {/* Alertas Activas */}
      {contracts.some(c => c.iaRiskAlerts && c.iaRiskAlerts.length > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Alertas de Riesgo Contractual (IA)
          </h3>
          <div className="space-y-2">
            {contracts.flatMap(c => (c.iaRiskAlerts || []).map((alert, i) => (
              <div key={`${c.id}-${i}`} className="flex items-start gap-2 text-sm text-red-800">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span><strong>{c.contractNumber || 'Contrato'}:</strong> {alert}</span>
              </div>
            )))}
          </div>
        </div>
      )}

      {/* Lista de Contratos */}
      {contracts.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <FileSignature className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Sin contratos registrados</h3>
          <p className="text-gray-500">Agregá el contrato del proyecto para gestionar SLA y alertas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contracts.map(contract => {
            const daysUntilEnd = getDaysUntil(contract.endDate);
            const isExpired = daysUntilEnd !== null && daysUntilEnd < 0;
            const isNearExpiry = daysUntilEnd !== null && daysUntilEnd > 0 && daysUntilEnd < 30;
            
            return (
              <div key={contract.id} className={`bg-white rounded-xl border p-5 ${isExpired ? 'border-red-300 bg-red-50/30' : isNearExpiry ? 'border-amber-300 bg-amber-50/30' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <FileSignature className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{contract.contractNumber || 'Sin número'}</h3>
                      <p className="text-xs text-gray-500">{CONTRACT_TYPES.find(t => t.key === contract.contractType)?.label || contract.contractType}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => loadAlerts(contract)}
                      className="p-1.5 text-amber-600 hover:bg-amber-50 rounded"
                      title="Ver alertas"
                    >
                      <ShieldAlert className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditAdvanced(contract)}
                      className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                      title="Editar avanzado"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setSelectedContract(contract)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                      title="Ver detalle"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(contract.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Alertas visuales */}
                {(isExpired || isNearExpiry || (contract.iaRiskAlerts && contract.iaRiskAlerts.length > 0)) && (
                  <div className={`mb-3 p-2 rounded-lg text-sm ${isExpired ? 'bg-red-100 text-red-800' : isNearExpiry ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'}`}>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="font-medium">
                        {isExpired ? `Vencido hace ${Math.abs(daysUntilEnd || 0)} días` : 
                         isNearExpiry ? `Vence en ${daysUntilEnd} días` : 
                         `${contract.iaRiskAlerts?.length || 0} alerta(s) de riesgo`}
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-xs text-gray-500">Valor Total</div>
                    <div className="font-semibold">{formatCurrency(contract.totalValue, contract.currency)}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-xs text-gray-500">Facturación</div>
                    <div className="font-semibold">{BILLING_FREQUENCIES.find(f => f.key === contract.billingFrequency)?.label || contract.billingFrequency}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-xs text-gray-500">SLA Respuesta</div>
                    <div className="font-semibold">{contract.slaResponseTime ? `${contract.slaResponseTime}hs` : '-'}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-xs text-gray-500">Penalidad</div>
                    <div className="font-semibold">{contract.penaltyRate ? `${contract.penaltyRate}%` : '-'}</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAnalyzeIA(contract.id)}
                    disabled={analyzing}
                    className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <Bell className="w-3 h-3" /> Análisis IA Riesgo
                  </button>
                </div>
                {/* Export Buttons */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={() => exportToPDF(contract, 'contract')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 rounded text-xs font-medium hover:bg-red-100"
                  >
                    <FileText className="w-3 h-3" /> PDF
                  </button>
                  <button
                    onClick={() => exportToWord(contract, 'contract')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded text-xs font-medium hover:bg-blue-100"
                  >
                    <FileCode className="w-3 h-3" /> Word
                  </button>
                  <button
                    onClick={() => exportToExcel(contract, 'contract')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded text-xs font-medium hover:bg-emerald-100"
                  >
                    <FileSpreadsheet className="w-3 h-3" /> Excel
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Agregar */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Nuevo Contrato</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Número de Contrato</label>
                  <input 
                    value={newContract.contractNumber} 
                    onChange={e => setNewContract({...newContract, contractNumber: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="Ej: CT-2024-001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                  <select 
                    value={newContract.contractType} 
                    onChange={e => setNewContract({...newContract, contractType: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    {CONTRACT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha Inicio</label>
                  <input 
                    type="date"
                    value={newContract.startDate} 
                    onChange={e => setNewContract({...newContract, startDate: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha Fin</label>
                  <input 
                    type="date"
                    value={newContract.endDate} 
                    onChange={e => setNewContract({...newContract, endDate: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Valor Total</label>
                  <input 
                    type="number"
                    value={newContract.totalValue} 
                    onChange={e => setNewContract({...newContract, totalValue: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Moneda</label>
                  <select 
                    value={newContract.currency} 
                    onChange={e => setNewContract({...newContract, currency: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">SLA Tiempo Respuesta (hs)</label>
                  <input 
                    type="number"
                    value={newContract.slaResponseTime} 
                    onChange={e => setNewContract({...newContract, slaResponseTime: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="Ej: 4"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tasa de Penalidad (%)</label>
                  <input 
                    type="number"
                    value={newContract.penaltyRate} 
                    onChange={e => setNewContract({...newContract, penaltyRate: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="Ej: 0.5"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Facturación</label>
                  <select 
                    value={newContract.billingFrequency} 
                    onChange={e => setNewContract({...newContract, billingFrequency: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    {BILLING_FREQUENCIES.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Términos de Pago</label>
                  <input 
                    value={newContract.paymentTerms} 
                    onChange={e => setNewContract({...newContract, paymentTerms: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="Ej: 30 días fecha factura"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input 
                    type="checkbox"
                    checked={newContract.insuranceRequired}
                    onChange={e => setNewContract({...newContract, insuranceRequired: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Seguro Requerido</span>
                </label>
                <label className="flex items-center gap-2">
                  <input 
                    type="checkbox"
                    checked={newContract.autoRenewal}
                    onChange={e => setNewContract({...newContract, autoRenewal: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Renovación Automática</span>
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cláusulas Críticas (una por línea)</label>
                <textarea 
                  value={newContract.criticalClauses} 
                  onChange={e => setNewContract({...newContract, criticalClauses: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  rows={3}
                  placeholder="Ej:&#10;Penalidad por incumplimiento SLA&#10;Confidencialidad de datos&#10;Exclusividad territorial"
                />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={handleAdd} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                Guardar Contrato
              </button>
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle */}
      {selectedContract && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Detalle del Contrato</h3>
              <button onClick={() => setSelectedContract(null)} className="p-2 text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-xs text-gray-500">Número</div>
                  <div className="font-semibold">{selectedContract.contractNumber || '-'}</div>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-xs text-gray-500">Tipo</div>
                  <div className="font-semibold">{CONTRACT_TYPES.find(t => t.key === selectedContract.contractType)?.label || selectedContract.contractType}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-xs text-gray-500">Período</div>
                  <div className="font-semibold">
                    {selectedContract.startDate ? new Date(selectedContract.startDate).toLocaleDateString() : '-'} 
                    {' → '} 
                    {selectedContract.endDate ? new Date(selectedContract.endDate).toLocaleDateString() : '-'}
                  </div>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-xs text-gray-500">Valor</div>
                  <div className="font-semibold">{formatCurrency(selectedContract.totalValue, selectedContract.currency)}</div>
                </div>
              </div>
              {selectedContract.iaRiskAlerts && selectedContract.iaRiskAlerts.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Alertas IA Detectadas
                  </h4>
                  <ul className="space-y-1">
                    {selectedContract.iaRiskAlerts.map((alert, i) => (
                      <li key={i} className="text-sm text-red-800 flex items-start gap-2">
                        <AlertCircle className="w-3 h-3 mt-1 flex-shrink-0" /> {alert}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedContract.criticalClauses && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Cláusulas Críticas</h4>
                  <pre className="bg-gray-50 rounded p-3 text-sm text-gray-700 whitespace-pre-wrap">{JSON.stringify(selectedContract.criticalClauses, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Alertas Contractuales */}
      {showAlertsModal && alertContract && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-600" /> Alertas: {alertContract.contractNumber}
              </h3>
              <button onClick={() => setShowAlertsModal(false)} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {loadingAlerts ? (
                <div className="text-center text-gray-500 py-8">Cargando alertas...</div>
              ) : contractAlerts.length === 0 ? (
                <div className="text-center text-gray-500 py-8 flex flex-col items-center gap-2">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                  <p>Sin alertas activas. El contrato está en orden.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contractAlerts.map((alert, i) => {
                    const severityColors: Record<string, string> = {
                      CRITICAL: 'bg-red-50 border-red-200 text-red-800',
                      HIGH: 'bg-amber-50 border-amber-200 text-amber-800',
                      MEDIUM: 'bg-blue-50 border-blue-200 text-blue-800',
                      LOW: 'bg-gray-50 border-gray-200 text-gray-700'
                    };
                    const icon = alert.severity === 'CRITICAL' ? <AlertOctagon className="w-4 h-4" /> :
                                 alert.severity === 'HIGH' ? <AlertTriangle className="w-4 h-4" /> :
                                 <AlertCircle className="w-4 h-4" />;
                    return (
                      <div key={i} className={`border rounded-lg p-3 ${severityColors[alert.severity] || severityColors.LOW}`}>
                        <div className="flex items-start gap-2">
                          {icon}
                          <div>
                            <div className="font-semibold text-xs uppercase tracking-wide opacity-70">{alert.type}</div>
                            <div className="text-sm">{alert.message}</div>
                            {alert.daysUntil !== undefined && (
                              <div className="text-xs mt-1 opacity-70">{alert.daysUntil >= 0 ? `En ${alert.daysUntil} días` : `Hace ${Math.abs(alert.daysUntil)} días`}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Edición Avanzada */}
      {showEditModal && editContract && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Pencil className="w-5 h-5 text-purple-600" /> Configuración Avanzada
              </h3>
              <button onClick={() => setShowEditModal(false)} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción SLA</label>
                <textarea
                  value={editContract.slaDescription}
                  onChange={e => setEditContract({...editContract, slaDescription: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  rows={3}
                  placeholder="Ej: Tiempo de respuesta 4hs, resolución 24hs..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cláusulas de Penalidad</label>
                <textarea
                  value={editContract.penaltyClauses}
                  onChange={e => setEditContract({...editContract, penaltyClauses: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  rows={3}
                  placeholder="Ej: 0.5% diario por retraso en entrega..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Garantías (JSON)</label>
                  <textarea
                    value={editContract.guarantees}
                    onChange={e => setEditContract({...editContract, guarantees: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono text-xs"
                    rows={4}
                    placeholder='[{"type":"Banco","amount":100000,"expiration":"2025-12-31"}]'
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Seguros (JSON)</label>
                  <textarea
                    value={editContract.insurances}
                    onChange={e => setEditContract({...editContract, insurances: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono text-xs"
                    rows={4}
                    placeholder='[{"type":"RC","coverage":500000,"expiration":"2025-06-30"}]'
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Días de alerta antes de vencimiento</label>
                <input
                  type="number"
                  value={editContract.expirationAlertDays}
                  onChange={e => setEditContract({...editContract, expirationAlertDays: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  min={1}
                  max={365}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notas Adicionales</label>
                <textarea
                  value={editContract.notes}
                  onChange={e => setEditContract({...editContract, notes: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  rows={2}
                />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3">
              <button onClick={handleUpdateAdvanced} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
                Guardar Cambios
              </button>
              <button onClick={() => setShowEditModal(false)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
