'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  Wrench, Calendar, Users, AlertTriangle, CheckCircle, Clock, TrendingUp,
  Filter, Search, Plus, Eye, Edit, Trash2, FileText, BarChart3, Settings,
  Download, Upload, RefreshCw, Zap, Shield, HardDrive, WrenchIcon, X,
  ChevronLeft, ChevronRight
} from 'lucide-react';

// CalendarView Component
const CalendarView = ({ workOrders, maintenancePlans }: { workOrders: any[], maintenancePlans: any[] }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (number | null)[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const getEventsForDate = (day: number) => {
    const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().split('T')[0];
    const orders = workOrders.filter(o => o.scheduledDate?.startsWith(dateStr));
    const plans = maintenancePlans.filter(p => {
      const nextDate = p.nextExecutionDate;
      return nextDate?.startsWith(dateStr);
    });
    return { orders, plans };
  };

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <span>Preventivo</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span>Correctivo</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            <span>Emergencia</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200">
        {weekDays.map(day => (
          <div key={day} className="bg-gray-50 p-2 text-center text-sm font-medium text-gray-600">
            {day}
          </div>
        ))}
        {getDaysInMonth(currentDate).map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="bg-white min-h-[80px]"></div>;
          }
          const { orders, plans } = getEventsForDate(day);
          const hasEvents = orders.length > 0 || plans.length > 0;
          return (
            <div key={day} className={`bg-white min-h-[80px] p-1 ${hasEvents ? 'bg-blue-50' : ''}`}>
              <div className="text-sm font-medium text-gray-700 mb-1">{day}</div>
              <div className="space-y-1">
                {orders.map(order => (
                  <div
                    key={order.id}
                    className={`text-xs p-1 rounded truncate cursor-pointer ${
                      order.type === 'PREVENTIVE' ? 'bg-blue-100 text-blue-700' :
                      order.type === 'CORRECTIVE' ? 'bg-red-100 text-red-700' :
                      order.type === 'EMERGENCY' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-purple-100 text-purple-700'
                    }`}
                    title={`${order.title} - ${order.asset?.name}`}
                  >
                    {order.title}
                  </div>
                ))}
                {plans.map(plan => (
                  <div
                    key={plan.id}
                    className="text-xs p-1 rounded truncate bg-green-100 text-green-700 cursor-pointer"
                    title={`Plan: ${plan.title}`}
                  >
                    Plan: {plan.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-gray-200">
        <h4 className="font-medium text-gray-900 mb-2">Resumen del Mes</h4>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-blue-50 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-600">
              {workOrders.filter(o => {
                const date = new Date(o.scheduledDate);
                return date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
              }).length}
            </p>
            <p className="text-sm text-gray-600">Órdenes Programadas</p>
          </div>
          <div className="bg-green-50 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-green-600">
              {workOrders.filter(o => {
                const date = new Date(o.completionDate || '');
                return date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
              }).length}
            </p>
            <p className="text-sm text-gray-600">Completadas</p>
          </div>
          <div className="bg-yellow-50 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-yellow-600">
              {workOrders.filter(o => {
                const date = new Date(o.scheduledDate);
                return date < new Date() && o.status !== 'COMPLETED' && date.getMonth() === currentDate.getMonth();
              }).length}
            </p>
            <p className="text-sm text-gray-600">Vencidas</p>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-purple-600">
              {maintenancePlans.filter(p => {
                const date = new Date(p.nextExecutionDate || '');
                return date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
              }).length}
            </p>
            <p className="text-sm text-gray-600">Planes Activos</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// AdvancedKPIs Component
const AdvancedKPIs = ({ workOrders, assets }: { workOrders: any[], assets: any[] }) => {
  const calculateKPIs = () => {
    const completedOrders = workOrders.filter(o => o.status === 'COMPLETED' && o.completionDate);
    
    // MTTR (Mean Time To Repair) - Tiempo medio de reparación
    const mttr = completedOrders.length > 0
      ? completedOrders.reduce((sum, o) => {
          const start = new Date(o.scheduledDate).getTime();
          const end = new Date(o.completionDate!).getTime();
          return sum + ((end - start) / (1000 * 60 * 60)); // hours
        }, 0) / completedOrders.length
      : 0;

    // MTBF (Mean Time Between Failures) - Tiempo medio entre fallos
    const failures = workOrders.filter(o => o.type === 'CORRECTIVE' || o.type === 'EMERGENCY');
    const totalOperatingHours = assets.reduce((sum, a) => sum + (a.totalWorkOrders * 168), 0); // Approximation
    const mtbf = failures.length > 0 ? totalOperatingHours / failures.length : 0;

    // Availability - Disponibilidad
    const totalTime = assets.length * 720; // 30 days * 24 hours
    const downtime = completedOrders.reduce((sum, o) => sum + (o.actualDuration || o.estimatedDuration || 0), 0);
    const availability = totalTime > 0 ? ((totalTime - downtime) / totalTime) * 100 : 100;

    // Maintenance Cost Ratio
    const totalMaintenanceCost = assets.reduce((sum, a) => sum + (a.totalMaintenanceCost || 0), 0);
    const totalAssetValue = assets.reduce((sum, a) => sum + (a.acquisitionCost || 0), 0);
    const costRatio = totalAssetValue > 0 ? (totalMaintenanceCost / totalAssetValue) * 100 : 0;

    // OEE (Overall Equipment Effectiveness) - Simplified
    const oee = (availability / 100) * 0.85 * 0.90; // Availability * Performance * Quality (estimated)

    return {
      mttr: (mttr || 0).toFixed(1),
      mtbf: (mtbf || 0).toFixed(0),
      availability: (availability || 0).toFixed(1),
      costRatio: (costRatio || 0).toFixed(1),
      oee: ((oee || 0) * 100).toFixed(1),
      totalMaintenanceCost: totalMaintenanceCost || 0,
      totalAssetValue: totalAssetValue || 0
    };
  };

  const kpis = calculateKPIs();

  return (
    <div className="space-y-6">
      {/* Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Clock className="w-8 h-8 opacity-80" />
            <span className="text-sm bg-white/20 px-2 py-1 rounded">MTTR</span>
          </div>
          <p className="text-4xl font-bold">{kpis?.mttr || 0}h</p>
          <p className="text-sm opacity-80 mt-1">Tiempo Medio de Reparación</p>
          <p className="text-xs opacity-60 mt-2">Meta: &lt; 4 horas</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8 opacity-80" />
            <span className="text-sm bg-white/20 px-2 py-1 rounded">MTBF</span>
          </div>
          <p className="text-4xl font-bold">{kpis?.mtbf || 0}h</p>
          <p className="text-sm opacity-80 mt-1">Tiempo Medio entre Fallos</p>
          <p className="text-xs opacity-60 mt-2">Meta: &gt; 500 horas</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <CheckCircle className="w-8 h-8 opacity-80" />
            <span className="text-sm bg-white/20 px-2 py-1 rounded">OEE</span>
          </div>
          <p className="text-4xl font-bold">{kpis?.oee || 0}%</p>
          <p className="text-sm opacity-80 mt-1">Eficiencia Global</p>
          <p className="text-xs opacity-60 mt-2">Meta: &gt; 85%</p>
        </div>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Disponibilidad</h4>
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle cx="48" cy="48" r="40" stroke="#e5e7eb" strokeWidth="8" fill="none" />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#10b981"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(parseFloat(kpis?.availability || '0') / 100) * 251} 251`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-gray-900">{kpis?.availability || 0}%</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600">Disponibilidad del Equipo</p>
              <p className="text-xs text-gray-400 mt-1">Tiempo productivo / Tiempo total</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Costo de Mantenimiento</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Costo Total de Mantenimiento</span>
              <span className="font-semibold text-orange-600">${(kpis?.totalMaintenanceCost || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Valor de Activos</span>
              <span className="font-semibold text-blue-600">${(kpis?.totalAssetValue || 0).toLocaleString()}</span>
            </div>
            <div className="border-t pt-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Ratio Costo/Activo</span>
                <span className={`font-bold ${parseFloat(kpis?.costRatio || '0') > 10 ? 'text-red-600' : 'text-green-600'}`}>
                  {kpis?.costRatio || 0}%
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Meta: &lt; 5% del valor de activos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Análisis de Tendencias</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Órdenes este mes</p>
            <p className="text-2xl font-bold text-gray-900">
              {workOrders.filter(o => new Date(o.scheduledDate).getMonth() === new Date().getMonth()).length}
            </p>
            <p className="text-xs text-green-600 mt-1">↑ 12% vs mes anterior</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Costo promedio/orden</p>
            <p className="text-2xl font-bold text-gray-900">
              ${workOrders.length > 0 
                ? Math.round(workOrders.reduce((sum, o) => sum + (o.cost?.total || 0), 0) / workOrders.length).toLocaleString()
                : 0}
            </p>
            <p className="text-xs text-red-600 mt-1">↑ 5% vs mes anterior</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Tasa de cumplimiento</p>
            <p className="text-2xl font-bold text-gray-900">
              {workOrders.length > 0
                ? Math.round((workOrders.filter(o => o.status === 'COMPLETED').length / workOrders.length) * 100)
                : 0}%
            </p>
            <p className="text-xs text-green-600 mt-1">↑ 8% vs mes anterior</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Activos críticos</p>
            <p className="text-2xl font-bold text-gray-900">
              {assets.filter(a => a.status === 'MAINTENANCE').length}
            </p>
            <p className="text-xs text-gray-400 mt-1">Requieren atención</p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface WorkOrder {
  id: string;
  code: string;
  title: string;
  description: string;
  type: 'PREVENTIVE' | 'CORRECTIVE' | 'PREDICTIVE' | 'EMERGENCY';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ON_HOLD';
  asset: {
    id: string;
    name: string;
    code: string;
    location: string;
  };
  technician: {
    id: string;
    name: string;
    specialty: string;
  };
  scheduledDate: string;
  completionDate?: string;
  estimatedDuration: number; // hours
  actualDuration?: number; // hours
  cost: {
    labor: number;
    materials: number;
    total: number;
  };
  materials: Array<{
    part: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }>;
  tasks: Array<{
    id: string;
    description: string;
    completed: boolean;
    completedAt?: string;
    notes?: string;
  }>;
  safety: {
    riskAssessment: string;
    ppeRequired: string[];
    permits: string[];
    lockoutRequired: boolean;
  };
  reports: Array<{
    id: string;
    type: 'INITIAL' | 'PROGRESS' | 'FINAL';
    createdAt: string;
    createdBy: string;
    content: string;
    attachments: string[];
  }>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface MaintenancePlan {
  id: string;
  code: string;
  title: string;
  description?: string;
  type: 'PREVENTIVE' | 'CORRECTIVE' | 'PREDICTIVE' | 'EMERGENCY';
  status: 'ACTIVE' | 'PAUSED' | 'INACTIVE';
  assetId?: string;
  asset?: {
    id: string;
    name: string;
    code: string;
  };
  frequencyValue: number;
  frequencyUnit: 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';
  nextExecutionDate?: string;
  lastExecutionDate?: string;
  totalExecutions: number;
  createdAt: string;
  updatedAt: string;
}

interface Technician {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  specialization?: string;
  certification?: string;
  isActive: boolean;
  availabilityStatus?: string;
  createdAt: string;
  updatedAt: string;
}

interface SparePart {
  id: string;
  code: string;
  name: string;
  description?: string;
  category?: string;
  currentStock: number;
  minStock: number;
  maxStock?: number;
  unitCost: number;
  supplier?: string;
  supplierCode?: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

interface Asset {
  id: string;
  code: string;
  name: string;
  description?: string;
  category?: string;
  status?: string;
  location?: string;
  department?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string;
  warrantyDate?: string;
  acquisitionCost: number;
  totalMaintenanceCost?: number;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface MaintenanceStats {
  totalWorkOrders: number;
  pendingOrders: number;
  inProgressOrders: number;
  completedOrders: number;
  overdueOrders: number;
  emergencyOrders: number;
  preventiveCompliance: number;
  avgCompletionTime: number;
  totalCost: number;
  plannedMaintenanceCost: number;
  unplannedMaintenanceCost: number;
  technicianUtilization: number;
  sparePartsValue: number;
  criticalPartsLowStock: number;
}

export default function MantenimientoPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [maintenancePlans, setMaintenancePlans] = useState<MaintenancePlan[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stats, setStats] = useState<MaintenanceStats>({
    totalWorkOrders: 0,
    pendingOrders: 0,
    inProgressOrders: 0,
    completedOrders: 0,
    overdueOrders: 0,
    emergencyOrders: 0,
    preventiveCompliance: 0,
    avgCompletionTime: 0,
    totalCost: 0,
    plannedMaintenanceCost: 0,
    unplannedMaintenanceCost: 0,
    technicianUtilization: 0,
    sparePartsValue: 0,
    criticalPartsLowStock: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'orders' | 'plans' | 'technicians' | 'parts' | 'assets' | 'calendar' | 'kpis'>('orders');
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [showViewOrderModal, setShowViewOrderModal] = useState(false);
  const [showEditOrderModal, setShowEditOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showCreateTechnicianModal, setShowCreateTechnicianModal] = useState(false);
  const [showEditTechnicianModal, setShowEditTechnicianModal] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState<Technician | null>(null);
  const [showCreatePartModal, setShowCreatePartModal] = useState(false);
  const [showEditPartModal, setShowEditPartModal] = useState(false);
  const [editingPart, setEditingPart] = useState<SparePart | null>(null);
  const [showCreateAssetModal, setShowCreateAssetModal] = useState(false);
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [showEditPlanModal, setShowEditPlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [showEditAssetModal, setShowEditAssetModal] = useState(false);
  const [showMaintenanceCostsModal, setShowMaintenanceCostsModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [maintenanceHistory, setMaintenanceHistory] = useState<any[]>([]);

  useEffect(() => {
    loadMaintenanceData();
  }, []);

  const loadMaintenanceData = async () => {
    try {
      setLoading(true);
      const [ordersData, plansData, techniciansData, partsData, assetsData, statsData] = await Promise.all([
        apiFetch('/maintenance/work-orders'),
        apiFetch('/maintenance/plans'),
        apiFetch('/maintenance/technicians'),
        apiFetch('/maintenance/spare-parts'),
        apiFetch('/maintenance/assets'),
        apiFetch('/maintenance/stats')
      ]) as any;
      
      setWorkOrders(ordersData.workOrders || []);
      setMaintenancePlans(plansData.plans || []);
      setTechnicians(techniciansData.technicians || []);
      setSpareParts(partsData.parts || []);
      setAssets(assetsData.assets || []);
      setStats(statsData.stats || stats);
    } catch (error) {
      console.error('Error loading maintenance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkOrder = async (orderData: any) => {
    try {
      const response = await apiFetch('/maintenance/work-orders', {
        method: 'POST',
        json: orderData
      }) as any;
      setWorkOrders([...workOrders, response.workOrder]);
      setShowCreateOrderModal(false);
    } catch (error) {
      console.error('Error creating work order:', error);
    }
  };

  const handleCreateTechnician = async (technicianData: any) => {
    try {
      const response = await apiFetch('/maintenance/technicians', {
        method: 'POST',
        json: technicianData
      }) as any;
      setTechnicians([...technicians, response.technician]);
      setShowCreateTechnicianModal(false);
    } catch (error) {
      console.error('Error creating technician:', error);
    }
  };

  const handleCreatePlan = async (planData: any) => {
    try {
      const response = await apiFetch('/maintenance/plans', {
        method: 'POST',
        json: planData
      }) as any;
      setMaintenancePlans([...(maintenancePlans || []), response.plan]);
      setShowCreatePlanModal(false);
    } catch (error) {
      console.error('Error creating plan:', error);
    }
  };

  const handleExecutePlan = async (planId: string) => {
    try {
      const response = await apiFetch(`/maintenance/plans/${planId}/execute`, {
        method: 'POST'
      }) as any;
      setMaintenancePlans(maintenancePlans?.map(p => p.id === planId ? response.plan : p) || []);
    } catch (error) {
      console.error('Error executing plan:', error);
    }
  };

  const handleUpdatePlan = async (planId: string, planData: any) => {
    try {
      const response = await apiFetch(`/maintenance/plans/${planId}`, {
        method: 'PUT',
        json: planData
      }) as any;
      setMaintenancePlans(maintenancePlans?.map(p => p.id === planId ? response.plan : p) || []);
      setShowEditPlanModal(false);
      setSelectedPlan(null);
    } catch (error) {
      console.error('Error updating plan:', error);
    }
  };

  const handleCreatePart = async (partData: any) => {
    try {
      const response = await apiFetch('/maintenance/spare-parts', {
        method: 'POST',
        json: partData
      }) as any;
      setSpareParts([...spareParts, response.part]);
      setShowCreatePartModal(false);
    } catch (error) {
      console.error('Error creating part:', error);
    }
  };

  const handleCreateAsset = async (assetData: any) => {
    try {
      const response = await apiFetch('/maintenance/assets', {
        method: 'POST',
        json: assetData
      }) as any;
      setAssets([...assets, response.asset]);
      setShowCreateAssetModal(false);
    } catch (error) {
      console.error('Error creating asset:', error);
    }
  };

  const handleUpdateAsset = async (id: string, assetData: any) => {
    try {
      const response = await apiFetch(`/maintenance/assets/${id}`, {
        method: 'PUT',
        json: assetData
      }) as any;
      setAssets(assets.map(a => a.id === id ? response.asset : a));
      setShowEditAssetModal(false);
      setEditingAsset(null);
    } catch (error) {
      console.error('Error updating asset:', error);
    }
  };

  const handleDeleteWorkOrder = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta orden?')) return;
    try {
      await apiFetch(`/maintenance/work-orders/${id}`, { method: 'DELETE' });
      setWorkOrders(workOrders.filter(o => o.id !== id));
    } catch (error) {
      console.error('Error deleting work order:', error);
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este plan?')) return;
    try {
      await apiFetch(`/maintenance/plans/${id}`, { method: 'DELETE' });
      setMaintenancePlans(maintenancePlans?.filter(p => p.id !== id) || []);
    } catch (error) {
      console.error('Error deleting plan:', error);
    }
  };

  const handleDeleteTechnician = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este técnico?')) return;
    try {
      await apiFetch(`/maintenance/technicians/${id}`, { method: 'DELETE' });
      setTechnicians(technicians.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting technician:', error);
    }
  };

  const handleDeletePart = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este repuesto?')) return;
    try {
      await apiFetch(`/maintenance/spare-parts/${id}`, { method: 'DELETE' });
      setSpareParts(spareParts.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting spare part:', error);
    }
  };

  const handleUpdateTechnician = async (id: string, technicianData: any) => {
    try {
      const response = await apiFetch(`/maintenance/technicians/${id}`, {
        method: 'PUT',
        json: technicianData
      }) as any;
      setTechnicians(technicians.map(t => t.id === id ? response.technician : t));
      setShowEditTechnicianModal(false);
      setEditingTechnician(null);
    } catch (error) {
      console.error('Error updating technician:', error);
    }
  };

  const handleUpdatePart = async (id: string, partData: any) => {
    try {
      const response = await apiFetch(`/maintenance/spare-parts/${id}`, {
        method: 'PUT',
        json: partData
      }) as any;
      setSpareParts(spareParts.map(p => p.id === id ? response.part : p));
      setShowEditPartModal(false);
      setEditingPart(null);
    } catch (error) {
      console.error('Error updating spare part:', error);
    }
  };

  const handleDeleteAsset = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este activo?')) return;
    try {
      await apiFetch(`/maintenance/assets/${id}`, { method: 'DELETE' });
      setAssets(assets.filter(a => a.id !== id));
    } catch (error) {
      console.error('Error deleting asset:', error);
    }
  };

  const loadMaintenanceHistory = async (assetId: string) => {
    try {
      const response = await apiFetch(`/maintenance/assets/${assetId}/maintenance-costs`) as any;
      setMaintenanceHistory(response.maintenanceHistory || []);
    } catch (error) {
      console.error('Error loading maintenance history:', error);
    }
  };

  const handleAddMaintenanceCost = async (assetId: string, costData: any) => {
    try {
      const response = await apiFetch(`/maintenance/assets/${assetId}/maintenance-cost`, {
        method: 'POST',
        json: costData
      }) as any;
      setAssets(assets.map(a => a.id === assetId ? response.asset : a));
      setMaintenanceHistory([...maintenanceHistory, response.maintenanceRecord]);
    } catch (error) {
      console.error('Error adding maintenance cost:', error);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'PREVENTIVE': return 'text-blue-600 bg-blue-50';
      case 'CORRECTIVE': return 'text-orange-600 bg-orange-50';
      case 'PREDICTIVE': return 'text-purple-600 bg-purple-50';
      case 'EMERGENCY': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'PREVENTIVE': return 'Preventivo';
      case 'CORRECTIVE': return 'Correctivo';
      case 'PREDICTIVE': return 'Predictivo';
      case 'EMERGENCY': return 'Emergencia';
      default: return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-yellow-600 bg-yellow-50';
      case 'IN_PROGRESS': return 'text-blue-600 bg-blue-50';
      case 'COMPLETED': return 'text-green-600 bg-green-50';
      case 'CANCELLED': return 'text-red-600 bg-red-50';
      case 'ON_HOLD': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING': return 'Pendiente';
      case 'IN_PROGRESS': return 'En Progreso';
      case 'COMPLETED': return 'Completado';
      case 'CANCELLED': return 'Cancelado';
      case 'ON_HOLD': return 'En Pausa';
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'text-red-600 bg-red-50';
      case 'HIGH': return 'text-orange-600 bg-orange-50';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50';
      case 'LOW': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'Crítica';
      case 'HIGH': return 'Alta';
      case 'MEDIUM': return 'Media';
      case 'LOW': return 'Baja';
      default: return priority;
    }
  };

  const isOverdue = (order: WorkOrder) => {
    return new Date(order.scheduledDate) < new Date() && order.status !== 'COMPLETED';
  };

  const filteredWorkOrders = workOrders.filter(order => {
    if (searchQuery && !order.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !order.code.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !order.asset?.name?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterType !== 'all' && order.type !== filterType) return false;
    if (filterStatus !== 'all' && order.status !== filterStatus) return false;
    if (filterPriority !== 'all' && order.priority !== filterPriority) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mantenimiento Industrial</h1>
          <p className="text-gray-600">Gestión integral de mantenimiento y planes preventivos</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Upload className="w-4 h-4" />
            Importar
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <button 
            onClick={() => setShowCreateOrderModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Nueva Orden
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Órdenes Activas</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.inProgressOrders || 0}</p>
            </div>
            <Wrench className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Órdenes Vencidas</p>
              <p className="text-2xl font-bold text-red-900">{stats?.overdueOrders || 0}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Cumplimiento Preventivo</p>
              <p className="text-2xl font-bold text-green-900">{((stats?.preventiveCompliance) || 0).toFixed(1)}%</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Costo Total Mes</p>
              <p className="text-2xl font-bold text-purple-900">${(((stats?.totalCost) || 0) / 1000).toFixed(1)}K</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="flex items-center gap-6 p-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
              activeTab === 'orders' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Wrench className="w-4 h-4" />
            Órdenes de Trabajo
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
              activeTab === 'plans' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Planes de Mantenimiento
          </button>
          <button
            onClick={() => setActiveTab('technicians')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
              activeTab === 'technicians' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-4 h-4" />
            Técnicos
          </button>
          <button
            onClick={() => setActiveTab('parts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
              activeTab === 'parts' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            Repuestos
          </button>
          <button
            onClick={() => setActiveTab('assets')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
              activeTab === 'assets' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Wrench className="w-4 h-4" />
            Activos/Equipos
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
              activeTab === 'calendar' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Calendario
          </button>
          <button
            onClick={() => setActiveTab('kpis')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
              activeTab === 'kpis' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            KPIs
          </button>
        </div>

        {/* Filters */}
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-[300px]">
              <Search className="w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar órdenes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los tipos</option>
              <option value="PREVENTIVE">Preventivo</option>
              <option value="CORRECTIVE">Correctivo</option>
              <option value="PREDICTIVE">Predictivo</option>
              <option value="EMERGENCY">Emergencia</option>
            </select>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los estados</option>
              <option value="PENDING">Pendiente</option>
              <option value="IN_PROGRESS">En Progreso</option>
              <option value="COMPLETED">Completado</option>
              <option value="CANCELLED">Cancelado</option>
              <option value="ON_HOLD">En Pausa</option>
            </select>
            
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todas las prioridades</option>
              <option value="CRITICAL">Crítica</option>
              <option value="HIGH">Alta</option>
              <option value="MEDIUM">Media</option>
              <option value="LOW">Baja</option>
            </select>
          </div>
        </div>

        {/* Content based on active tab */}
        <div className="p-4">
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {filteredWorkOrders.length === 0 ? (
                <div className="text-center py-12">
                  <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No hay órdenes de trabajo</h3>
                  <p className="text-gray-600">
                    {searchQuery || filterType !== 'all' || filterStatus !== 'all' || filterPriority !== 'all'
                      ? 'No se encontraron órdenes con los filtros seleccionados'
                      : 'Comienza creando tu primera orden de trabajo'}
                  </p>
                </div>
              ) : (
                filteredWorkOrders.map(order => (
                  <div key={order.id} className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{order.title}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(order.type)}`}>
                            {getTypeLabel(order.type)}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(order.priority)}`}>
                            {getPriorityLabel(order.priority)}
                          </span>
                          {isOverdue(order) && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                              Vencida
                            </span>
                          )}
                        </div>
                        
                        <p className="text-gray-600 mb-3">{order.description}</p>
                        
                        <div className="flex items-center gap-6 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <WrenchIcon className="w-4 h-4" />
                            <span>{order.asset?.name} ({order.asset?.code})</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>{order.technician?.name || 'Sin asignar'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(order.scheduledDate).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{order.estimatedDuration}h estimadas</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-4 h-4" />
                            <span>${order.cost?.total || 0}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setSelectedOrder(order); setShowViewOrderModal(true); }}
                          className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                          title="Ver detalles"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteWorkOrder(order.id)}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                          title="Eliminar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'plans' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Planes de Mantenimiento ({maintenancePlans?.length || 0})</h3>
                <button 
                  onClick={() => setShowCreatePlanModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo Plan
                </button>
              </div>
              
              {(maintenancePlans?.length || 0) === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Sin Planes de Mantenimiento</h3>
                  <p className="text-gray-600 mb-4">Crea planes preventivos para programar mantenimientos automáticos</p>
                  <button 
                    onClick={() => setShowCreatePlanModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Crear Primer Plan
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {maintenancePlans?.filter(p => p && p.id).map(plan => (
                    <div key={plan.id} className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">{plan.title}</h4>
                          <p className="text-sm text-gray-500">{plan.code}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          plan.status === 'ACTIVE' 
                            ? 'bg-green-100 text-green-800' 
                            : plan.status === 'PAUSED'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {plan.status === 'ACTIVE' ? 'Activo' : plan.status === 'PAUSED' ? 'Pausado' : 'Inactivo'}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">{plan.description}</p>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Equipo:</span>
                          <span className="font-medium">{plan.asset?.name || 'No asignado'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Frecuencia:</span>
                          <span className="font-medium">{plan.frequencyValue} {plan.frequencyUnit === 'DAYS' ? 'días' : plan.frequencyUnit === 'WEEKS' ? 'semanas' : plan.frequencyUnit === 'MONTHS' ? 'meses' : 'años'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Próxima ejecución:</span>
                          <span className="font-medium text-blue-600">
                            {plan.nextExecutionDate ? new Date(plan.nextExecutionDate).toLocaleDateString() : 'No programada'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Última ejecución:</span>
                          <span className="font-medium">
                            {plan.lastExecutionDate ? new Date(plan.lastExecutionDate).toLocaleDateString() : 'Nunca'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Ejecuciones:</span>
                          <span className="font-medium">{plan.totalExecutions || 0}</span>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-gray-200 flex gap-2">
                        <button 
                          onClick={() => { setSelectedPlan(plan); setShowEditPlanModal(true); }}
                          className="flex-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                        >
                          Editar
                        </button>
                        <button 
                          onClick={() => handleExecutePlan(plan.id)}
                          className="flex-1 px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded hover:bg-green-100"
                        >
                          Ejecutar Ahora
                        </button>
                        <button 
                          onClick={() => handleDeletePlan(plan.id)}
                          className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100"
                          title="Eliminar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'technicians' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Técnicos ({technicians.length})</h3>
                <button 
                  onClick={() => setShowCreateTechnicianModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo Técnico
                </button>
              </div>
              {technicians.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Sin Técnicos</h3>
                  <p className="text-gray-600 mb-4">Agrega técnicos para asignar a órdenes de trabajo</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {technicians.map(tech => (
                    <div key={tech.id} className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900">{tech.name}</h4>
                          <p className="text-sm text-gray-500">{tech.email}</p>
                          <p className="text-sm text-gray-500">{tech.phone}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          tech.availabilityStatus === 'AVAILABLE' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {tech.availabilityStatus === 'AVAILABLE' ? 'Disponible' : 'Ocupado'}
                        </span>
                      </div>
                      {tech.specialization && (
                        <div className="mt-3 flex flex-wrap gap-1">
                            <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                              {tech.specialization}
                            </span>
                        </div>
                      )}
                      <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
                        <button 
                          onClick={() => { setEditingTechnician(tech); setShowEditTechnicianModal(true); }}
                          className="flex-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                        >
                          Editar
                        </button>
                        <button 
                          onClick={() => handleDeleteTechnician(tech.id)}
                          className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100"
                          title="Eliminar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'parts' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Repuestos ({spareParts.length})</h3>
                <button 
                  onClick={() => setShowCreatePartModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo Repuesto
                </button>
              </div>
              {spareParts.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <HardDrive className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Sin Repuestos</h3>
                  <p className="text-gray-600 mb-4">Agrega repuestos al inventario</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {spareParts.map(part => (
                    <div key={part.id} className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900">{part.name}</h4>
                          <p className="text-sm text-gray-500">{part.code}</p>
                          <p className="text-sm text-gray-500">{part.category}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          part.currentStock <= part.minStock 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {part.currentStock} / {part.minStock}
                        </span>
                      </div>
                      <div className="mt-3 flex justify-between items-center">
                        <span className="text-sm text-gray-600">Stock: {part.currentStock}</span>
                        <span className="text-sm font-medium text-gray-900">${part.unitCost}</span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
                        <button 
                          onClick={() => { setEditingPart(part); setShowEditPartModal(true); }}
                          className="flex-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                        >
                          Editar
                        </button>
                        <button 
                          onClick={() => handleDeletePart(part.id)}
                          className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100"
                          title="Eliminar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'assets' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Activos/Equipos ({assets.length})</h3>
                <button 
                  onClick={() => setShowCreateAssetModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo Activo
                </button>
              </div>
              {assets.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Sin Activos</h3>
                  <p className="text-gray-600 mb-4">Agrega equipos y activos para asignar a órdenes de trabajo</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {assets.map(asset => (
                    <div key={asset.id} className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900">{asset.name}</h4>
                          <p className="text-sm text-gray-500">{asset.code}</p>
                          <p className="text-sm text-gray-500">{asset.category}</p>
                          {asset.location && <p className="text-sm text-gray-400">{asset.location}</p>}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setEditingAsset(asset); setShowEditAssetModal(true); }}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Editar"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => { setSelectedAsset(asset); setShowMaintenanceCostsModal(true); }}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Ver costos de mantenimiento"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteAsset(asset.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Eliminar"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-gray-500">
                        <p>Costo Adquisición: ${(asset.acquisitionCost || 0).toLocaleString()}</p>
                        {(asset.totalMaintenanceCost || 0) > 0 && <p className="text-orange-600">Mantenimiento: ${(asset.totalMaintenanceCost || 0).toLocaleString()}</p>}
                        {asset.lastMaintenanceDate && (
                          <p>Último mantenimiento: {new Date(asset.lastMaintenanceDate).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {activeTab === 'calendar' && (
            <div className="p-4">
              <CalendarView workOrders={workOrders} maintenancePlans={maintenancePlans} />
            </div>
          )}

          {activeTab === 'kpis' && (
            <div className="p-4">
              <AdvancedKPIs workOrders={workOrders} assets={assets} />
            </div>
          )}
        </div>
      </div>

      {/* View Order Modal */}
      {showViewOrderModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Detalles de Orden</h2>
                <p className="text-sm text-gray-500">{selectedOrder.code}</p>
              </div>
              <button 
                onClick={() => { setShowViewOrderModal(false); setSelectedOrder(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm ${
                  selectedOrder.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                  selectedOrder.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                  selectedOrder.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {selectedOrder.status === 'COMPLETED' ? 'Completada' : selectedOrder.status === 'IN_PROGRESS' ? 'En Progreso' : selectedOrder.status === 'PENDING' ? 'Pendiente' : selectedOrder.status}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm ${
                  selectedOrder.priority === 'HIGH' ? 'bg-red-100 text-red-800' :
                  selectedOrder.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {selectedOrder.priority === 'HIGH' ? 'Alta' : selectedOrder.priority === 'MEDIUM' ? 'Media' : 'Baja'}
                </span>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">{selectedOrder.title}</h3>
                <p className="text-gray-600">{selectedOrder.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-500">Equipo/Activo</p>
                  <p className="font-medium text-gray-900">{selectedOrder.asset?.name || 'No asignado'} {selectedOrder.asset?.code ? `(${selectedOrder.asset.code})` : ''}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-500">Técnico Asignado</p>
                  <p className="font-medium text-gray-900">{selectedOrder.technician?.name || 'Sin asignar'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-500">Fecha Programada</p>
                  <p className="font-medium text-gray-900">{new Date(selectedOrder.scheduledDate).toLocaleDateString()}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-500">Duración Estimada</p>
                  <p className="font-medium text-gray-900">{selectedOrder.estimatedDuration} horas</p>
                </div>
              </div>

              {selectedOrder.cost && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Costos</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg text-center">
                      <p className="text-sm text-gray-600">Mano de Obra</p>
                      <p className="font-bold text-blue-600">${selectedOrder.cost.labor || 0}</p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg text-center">
                      <p className="text-sm text-gray-600">Repuestos</p>
                      <p className="font-bold text-orange-600">${selectedOrder.cost.parts || 0}</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg text-center">
                      <p className="text-sm text-gray-600">Total</p>
                      <p className="font-bold text-green-600">${selectedOrder.cost.total || 0}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button 
                onClick={() => { setShowViewOrderModal(false); setShowEditOrderModal(true); }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Editar Orden
              </button>
              <button 
                onClick={() => { setShowViewOrderModal(false); setSelectedOrder(null); }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {showEditOrderModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Editar Orden</h2>
                <p className="text-sm text-gray-500">{selectedOrder.code}</p>
              </div>
              <button 
                onClick={() => { setShowEditOrderModal(false); setSelectedOrder(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input
                  type="text"
                  id="editOrderTitle"
                  defaultValue={selectedOrder.title}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  id="editOrderDescription"
                  rows={3}
                  defaultValue={selectedOrder.description}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select
                    id="editOrderStatus"
                    defaultValue={selectedOrder.status}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PENDING">Pendiente</option>
                    <option value="IN_PROGRESS">En Progreso</option>
                    <option value="COMPLETED">Completada</option>
                    <option value="CANCELLED">Cancelada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                  <select
                    id="editOrderPriority"
                    defaultValue={selectedOrder.priority}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="LOW">Baja</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Equipo/Activo</label>
                <select
                  id="editOrderAsset"
                  defaultValue={selectedOrder.assetId || selectedOrder.asset?.id || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sin asignar</option>
                  {assets?.filter(a => a && a.id).map(asset => (
                    <option key={asset.id} value={asset.id}>{asset.name} ({asset.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Técnico Asignado</label>
                <select
                  id="editOrderTechnician"
                  defaultValue={selectedOrder.technicianId || selectedOrder.technician?.id || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sin asignar</option>
                  {technicians?.filter(t => t && t.id).map(tech => (
                    <option key={tech.id} value={tech.id}>{tech.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Programada</label>
                  <input
                    type="date"
                    id="editOrderDate"
                    defaultValue={selectedOrder.scheduledDate?.split('T')[0] || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duración Estimada (horas)</label>
                  <input
                    type="number"
                    id="editOrderDuration"
                    defaultValue={selectedOrder.estimatedDuration}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold text-gray-900 mb-3">Costos</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mano de Obra ($)</label>
                    <input
                      type="number"
                      id="editOrderLaborCost"
                      defaultValue={selectedOrder.cost?.labor || 0}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Repuestos ($)</label>
                    <input
                      type="number"
                      id="editOrderPartsCost"
                      defaultValue={selectedOrder.cost?.parts || 0}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button 
                onClick={() => {
                  const title = (document.getElementById('editOrderTitle') as HTMLInputElement)?.value;
                  const description = (document.getElementById('editOrderDescription') as HTMLTextAreaElement)?.value;
                  const status = (document.getElementById('editOrderStatus') as HTMLSelectElement)?.value;
                  const priority = (document.getElementById('editOrderPriority') as HTMLSelectElement)?.value;
                  const assetId = (document.getElementById('editOrderAsset') as HTMLSelectElement)?.value;
                  const technicianId = (document.getElementById('editOrderTechnician') as HTMLSelectElement)?.value;
                  const scheduledDate = (document.getElementById('editOrderDate') as HTMLInputElement)?.value;
                  const estimatedDuration = parseInt((document.getElementById('editOrderDuration') as HTMLInputElement)?.value || '0');
                  const laborCost = parseFloat((document.getElementById('editOrderLaborCost') as HTMLInputElement)?.value || '0');
                  const partsCost = parseFloat((document.getElementById('editOrderPartsCost') as HTMLInputElement)?.value || '0');
                  
                  const updatedOrder = {
                    ...selectedOrder,
                    title,
                    description,
                    status,
                    priority,
                    assetId,
                    technicianId,
                    scheduledDate: scheduledDate ? new Date(scheduledDate).toISOString() : selectedOrder.scheduledDate,
                    estimatedDuration,
                    cost: {
                      labor: laborCost,
                      parts: partsCost,
                      total: laborCost + partsCost
                    }
                  };
                  
                  setWorkOrders(workOrders.map(o => o.id === selectedOrder.id ? updatedOrder : o));
                  setShowEditOrderModal(false);
                  setSelectedOrder(null);
                  alert('Orden actualizada correctamente');
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Guardar Cambios
              </button>
              <button 
                onClick={() => { setShowEditOrderModal(false); setSelectedOrder(null); }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Work Order Modal */}
      {showCreateOrderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Nueva Orden de Trabajo</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input
                  type="text"
                  id="orderTitle"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Mantenimiento preventivo bomba #3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  id="orderDescription"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Detalles del trabajo a realizar"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    id="orderType"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PREVENTIVE">Preventivo</option>
                    <option value="CORRECTIVE">Correctivo</option>
                    <option value="PREDICTIVE">Predictivo</option>
                    <option value="EMERGENCY">Emergencia</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                  <select
                    id="orderPriority"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="LOW">Baja</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta</option>
                    <option value="CRITICAL">Crítica</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Equipo/Activo</label>
                <select
                  id="orderAsset"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar equipo...</option>
                  {assets?.filter(a => a && a.id).map(asset => (
                    <option key={asset.id} value={asset.id}>{asset.name} ({asset.code})</option>
                  ))}
                </select>
                {(!assets || assets.length === 0) && (
                  <p className="text-xs text-red-500 mt-1">
                    No hay activos. Crea activos primero en la pestaña "Activos/Equipos"
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Programada</label>
                <input
                  type="date"
                  id="orderDate"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Técnico Asignado</label>
                <select
                  id="orderTechnician"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar técnico...</option>
                  {technicians?.filter(t => t && t.id).map(tech => (
                    <option key={tech.id} value={tech.id}>{tech.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowCreateOrderModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const title = (document.getElementById('orderTitle') as HTMLInputElement)?.value;
                  const description = (document.getElementById('orderDescription') as HTMLTextAreaElement)?.value;
                  const type = (document.getElementById('orderType') as HTMLSelectElement)?.value;
                  const priority = (document.getElementById('orderPriority') as HTMLSelectElement)?.value;
                  const assetId = (document.getElementById('orderAsset') as HTMLInputElement)?.value;
                  const scheduledDate = (document.getElementById('orderDate') as HTMLInputElement)?.value;
                  const technicianId = (document.getElementById('orderTechnician') as HTMLSelectElement)?.value;
                  
                  if (title && assetId && scheduledDate) {
                    handleCreateWorkOrder({
                      title,
                      description,
                      type,
                      priority,
                      assetId,
                      scheduledDate: new Date(scheduledDate).toISOString(),
                      technicianId: technicianId || undefined,
                      estimatedHours: 2
                    });
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Crear Orden
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Plan Modal */}
      {showEditPlanModal && selectedPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Editar Plan</h2>
                <p className="text-sm text-gray-500">{selectedPlan.code}</p>
              </div>
              <button 
                onClick={() => { setShowEditPlanModal(false); setSelectedPlan(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input
                  type="text"
                  id="editPlanTitle"
                  defaultValue={selectedPlan.title}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  id="editPlanDescription"
                  rows={2}
                  defaultValue={selectedPlan.description}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Equipo/Activo</label>
                <select
                  id="editPlanAssetId"
                  defaultValue={selectedPlan.assetId || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sin asignar</option>
                  {assets?.filter(a => a && a.id).map(asset => (
                    <option key={asset.id} value={asset.id}>{asset.name} ({asset.code})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia</label>
                  <input
                    type="number"
                    id="editPlanFrequencyValue"
                    defaultValue={selectedPlan.frequencyValue}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
                  <select
                    id="editPlanFrequencyUnit"
                    defaultValue={selectedPlan.frequencyUnit}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="DAYS">Días</option>
                    <option value="WEEKS">Semanas</option>
                    <option value="MONTHS">Meses</option>
                    <option value="YEARS">Años</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Próxima Ejecución</label>
                <input
                  type="date"
                  id="editPlanNextExecution"
                  defaultValue={selectedPlan.nextExecutionDate?.split('T')[0] || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  id="editPlanStatus"
                  defaultValue={selectedPlan.status}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ACTIVE">Activo</option>
                  <option value="PAUSED">Pausado</option>
                  <option value="INACTIVE">Inactivo</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button 
                onClick={() => {
                  const title = (document.getElementById('editPlanTitle') as HTMLInputElement)?.value;
                  const description = (document.getElementById('editPlanDescription') as HTMLTextAreaElement)?.value;
                  const assetId = (document.getElementById('editPlanAssetId') as HTMLSelectElement)?.value;
                  const frequencyValue = parseInt((document.getElementById('editPlanFrequencyValue') as HTMLInputElement)?.value || '30');
                  const frequencyUnit = (document.getElementById('editPlanFrequencyUnit') as HTMLSelectElement)?.value;
                  const nextExecutionDate = (document.getElementById('editPlanNextExecution') as HTMLInputElement)?.value;
                  const status = (document.getElementById('editPlanStatus') as HTMLSelectElement)?.value;
                  
                  if (title) {
                    handleUpdatePlan(selectedPlan.id, { 
                      title, 
                      description, 
                      assetId, 
                      frequencyValue, 
                      frequencyUnit, 
                      nextExecutionDate,
                      status
                    });
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Guardar Cambios
              </button>
              <button 
                onClick={() => { setShowEditPlanModal(false); setSelectedPlan(null); }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      {showCreateTechnicianModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Nuevo Técnico</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" id="techName" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" id="techEmail" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input type="text" id="techPhone" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Especialidades (separadas por coma)</label>
                <input type="text" id="techSpecialties" placeholder="Ej: Mecánica, Eléctrica, PLC" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowCreateTechnicianModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={() => {
                const name = (document.getElementById('techName') as HTMLInputElement)?.value;
                const email = (document.getElementById('techEmail') as HTMLInputElement)?.value;
                const phone = (document.getElementById('techPhone') as HTMLInputElement)?.value;
                const specialtiesStr = (document.getElementById('techSpecialties') as HTMLInputElement)?.value;
                if (name && email) {
                  handleCreateTechnician({ name, email, phone, specialization: specialtiesStr || '' });
                }
              }} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Crear Técnico</button>
            </div>
          </div>
        </div>
      )}

      {showEditTechnicianModal && editingTechnician && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Editar Técnico</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" id="editTechName" defaultValue={editingTechnician.name} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" id="editTechEmail" defaultValue={editingTechnician.email || ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input type="text" id="editTechPhone" defaultValue={editingTechnician.phone || ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Especialización</label>
                <input type="text" id="editTechSpecialization" defaultValue={editingTechnician.specialization || ''} placeholder="Ej: Mecánica, Eléctrica, PLC" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => { setShowEditTechnicianModal(false); setEditingTechnician(null); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={() => {
                const name = (document.getElementById('editTechName') as HTMLInputElement)?.value;
                const email = (document.getElementById('editTechEmail') as HTMLInputElement)?.value;
                const phone = (document.getElementById('editTechPhone') as HTMLInputElement)?.value;
                const specialization = (document.getElementById('editTechSpecialization') as HTMLInputElement)?.value;
                if (name && editingTechnician) {
                  handleUpdateTechnician(editingTechnician.id, { name, email, phone, specialization });
                }
              }} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}

      {showCreatePlanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Nuevo Plan de Mantenimiento</h2>
              {/* Debug: {JSON.stringify({assetCount: assets?.length || 0})} */}
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                <input type="text" id="planCode" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: PLAN-001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input type="text" id="planTitle" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: Plan de Lubricación Mensual" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea id="planDescription" rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Descripción del plan..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Equipo/Activo</label>
                <select id="planAssetId" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Seleccionar equipo...</option>
                  {assets?.filter(a => a && a.id).map(asset => (
                    <option key={asset.id} value={asset.id}>{asset.name} ({asset.code})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia</label>
                  <input type="number" id="planFrequencyValue" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: 30" defaultValue={30} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
                  <select id="planFrequencyUnit" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="DAYS">Días</option>
                    <option value="WEEKS">Semanas</option>
                    <option value="MONTHS" selected>Meses</option>
                    <option value="YEARS">Años</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Próxima Ejecución</label>
                <input type="date" id="planNextExecution" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Mantenimiento</label>
                <select id="planType" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="PREVENTIVE">Preventivo</option>
                  <option value="PREDICTIVE">Predictivo</option>
                  <option value="CORRECTIVE">Correctivo</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowCreatePlanModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={() => {
                const code = (document.getElementById('planCode') as HTMLInputElement)?.value;
                const title = (document.getElementById('planTitle') as HTMLInputElement)?.value;
                const description = (document.getElementById('planDescription') as HTMLTextAreaElement)?.value;
                const assetId = (document.getElementById('planAssetId') as HTMLSelectElement)?.value;
                const frequencyValue = parseInt((document.getElementById('planFrequencyValue') as HTMLInputElement)?.value || '30');
                const frequencyUnit = (document.getElementById('planFrequencyUnit') as HTMLSelectElement)?.value;
                const nextExecutionDate = (document.getElementById('planNextExecution') as HTMLInputElement)?.value;
                const type = (document.getElementById('planType') as HTMLSelectElement)?.value;
                if (code && title) {
                  handleCreatePlan({ code, title, description, assetId, frequencyValue, frequencyUnit, nextExecutionDate, type, status: 'ACTIVE' });
                }
              }} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Crear Plan</button>
            </div>
          </div>
        </div>
      )}

      {showCreatePartModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Nuevo Repuesto</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                <input type="text" id="partCode" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" id="partName" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select id="partCategory" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="MECANICA">Mecánica</option>
                  <option value="ELECTRICA">Eléctrica</option>
                  <option value="NEUMATICA">Neumática</option>
                  <option value="HIDRAULICA">Hidráulica</option>
                  <option value="PLC">PLC/Automatización</option>
                  <option value="SEGURIDAD">Seguridad</option>
                  <option value="CONSUMIBLE">Consumible</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                  <input type="number" id="partStock" defaultValue="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Mín</label>
                  <input type="number" id="partMinStock" defaultValue="5" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Costo</label>
                  <input type="number" id="partCost" defaultValue="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowCreatePartModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={() => {
                const code = (document.getElementById('partCode') as HTMLInputElement)?.value;
                const name = (document.getElementById('partName') as HTMLInputElement)?.value;
                const category = (document.getElementById('partCategory') as HTMLSelectElement)?.value;
                const stock = parseInt((document.getElementById('partStock') as HTMLInputElement)?.value || '0');
                const minStock = parseInt((document.getElementById('partMinStock') as HTMLInputElement)?.value || '0');
                const cost = parseFloat((document.getElementById('partCost') as HTMLInputElement)?.value || '0');
                if (code && name) {
                  handleCreatePart({ code, name, category, currentStock: stock, minStock, unitCost: cost });
                }
              }} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Crear Repuesto</button>
            </div>
          </div>
        </div>
      )}
      {showCreateAssetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Nuevo Activo/Equipo</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                <input type="text" id="assetCode" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: EQ-001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" id="assetName" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: Compresor de aire" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea id="assetDescription" rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <input 
                    type="text" 
                    id="assetCategory" 
                    list="categoryOptions"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    placeholder="Escribir o seleccionar..."
                  />
                  <datalist id="categoryOptions">
                    <option value="PRODUCCION" />
                    <option value="LOGISTICA" />
                    <option value="SEGURIDAD" />
                    <option value="IT" />
                    <option value="GENERAL" />
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <input 
                    type="text" 
                    id="assetStatus" 
                    list="statusOptions"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    placeholder="Escribir o seleccionar..."
                  />
                  <datalist id="statusOptions">
                    <option value="ACTIVE" />
                    <option value="INACTIVE" />
                    <option value="MAINTENANCE" />
                  </datalist>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                <input type="text" id="assetLocation" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: Planta 1, Sector Norte" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fabricante/Modelo</label>
                <input type="text" id="assetManufacturer" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: Atlas Copco GA55" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Costo de Adquisición ($)</label>
                <input type="number" id="assetPurchaseCost" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: 50000" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button type="button" onClick={() => setShowCreateAssetModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button 
                type="button"
                onClick={() => {
                  console.log('=== Crear Activo clicked ===');
                  try {
                    const code = (document.getElementById('assetCode') as HTMLInputElement)?.value;
                    const name = (document.getElementById('assetName') as HTMLInputElement)?.value;
                    const description = (document.getElementById('assetDescription') as HTMLTextAreaElement)?.value;
                    const category = (document.getElementById('assetCategory') as HTMLInputElement)?.value || 'PRODUCCION';
                    const status = (document.getElementById('assetStatus') as HTMLInputElement)?.value || 'ACTIVE';
                    const location = (document.getElementById('assetLocation') as HTMLInputElement)?.value;
                    const manufacturer = (document.getElementById('assetManufacturer') as HTMLInputElement)?.value;
                    const purchaseCost = parseFloat((document.getElementById('assetPurchaseCost') as HTMLInputElement)?.value || '0');
                    console.log('Values:', { code, name, description, category, status, location, manufacturer, purchaseCost });
                    if (code && name) {
                      console.log('Calling handleCreateAsset...');
                      handleCreateAsset({ code, name, description, category, location, manufacturer, acquisitionCost: purchaseCost });
                    } else {
                      alert('Código y nombre son obligatorios');
                    }
                  } catch (err) {
                    console.error('Error in button click:', err);
                    alert('Error: ' + (err as Error).message);
                  }
                }} 
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Crear Activo
              </button>
            </div>
          </div>
        </div>
      )}
      {showEditAssetModal && editingAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Editar Activo/Equipo</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                <input type="text" id="editAssetCode" defaultValue={editingAsset.code} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" id="editAssetName" defaultValue={editingAsset.name} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea id="editAssetDescription" defaultValue={editingAsset.description || ''} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <input type="text" id="editAssetCategory" list="categoryOptions" defaultValue={editingAsset.category} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Escribir o seleccionar..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <input type="text" id="editAssetStatus" list="statusOptions" defaultValue={editingAsset.status} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Escribir o seleccionar..." />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                <input type="text" id="editAssetLocation" defaultValue={editingAsset.location || ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: Planta 1, Sector Norte" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fabricante/Modelo</label>
                <input type="text" id="editAssetManufacturer" defaultValue={editingAsset.manufacturer || ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: Atlas Copco GA55" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Costo de Adquisición ($)</label>
                <input type="number" id="editAssetPurchaseCost" defaultValue={editingAsset.acquisitionCost || 0} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: 50000" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button type="button" onClick={() => { setShowEditAssetModal(false); setEditingAsset(null); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button type="button" onClick={() => {
                const code = (document.getElementById('editAssetCode') as HTMLInputElement)?.value;
                const name = (document.getElementById('editAssetName') as HTMLInputElement)?.value;
                const description = (document.getElementById('editAssetDescription') as HTMLTextAreaElement)?.value;
                const category = (document.getElementById('editAssetCategory') as HTMLInputElement)?.value;
                const status = (document.getElementById('editAssetStatus') as HTMLInputElement)?.value;
                const location = (document.getElementById('editAssetLocation') as HTMLInputElement)?.value;
                const manufacturer = (document.getElementById('editAssetManufacturer') as HTMLInputElement)?.value;
                const purchaseCost = parseFloat((document.getElementById('editAssetPurchaseCost') as HTMLInputElement)?.value || '0');
                if (code && name && editingAsset) {
                  handleUpdateAsset(editingAsset.id, { code, name, description, category, status, location, manufacturer, acquisitionCost: purchaseCost });
                }
              }} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}
      {showMaintenanceCostsModal && selectedAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Costos de Mantenimiento</h2>
                <p className="text-sm text-gray-500">{selectedAsset.name} ({selectedAsset.code})</p>
              </div>
              <button onClick={() => { setShowMaintenanceCostsModal(false); setSelectedAsset(null); }} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-600">Costo Adquisición</p>
                  <p className="text-xl font-bold text-blue-600">${selectedAsset.acquisitionCost?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-600">Mantenimiento</p>
                  <p className="text-xl font-bold text-orange-600">${selectedAsset.totalMaintenanceCost?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-600">Costo Total</p>
                  <p className="text-xl font-bold text-green-600">${((selectedAsset.acquisitionCost || 0) + (selectedAsset.totalMaintenanceCost || 0)).toLocaleString()}</p>
                </div>
              </div>

              <h3 className="font-semibold text-gray-900 mb-4">Agregar Nuevo Costo</h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input type="date" id="maintDate" defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select id="maintType" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="PREVENTIVE">Preventivo</option>
                    <option value="CORRECTIVE">Correctivo</option>
                    <option value="PREDICTIVE">Predictivo</option>
                    <option value="EMERGENCY">Emergencia</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <input type="text" id="maintDescription" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: Cambio de filtros, reparación de bomba..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Costo ($)</label>
                  <input type="number" id="maintCost" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: 1500" />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      const date = (document.getElementById('maintDate') as HTMLInputElement)?.value;
                      const type = (document.getElementById('maintType') as HTMLSelectElement)?.value;
                      const description = (document.getElementById('maintDescription') as HTMLInputElement)?.value;
                      const cost = parseFloat((document.getElementById('maintCost') as HTMLInputElement)?.value || '0');
                      if (date && description && cost > 0) {
                        handleAddMaintenanceCost(selectedAsset.id, { date, type, description, cost });
                        (document.getElementById('maintDescription') as HTMLInputElement).value = '';
                        (document.getElementById('maintCost') as HTMLInputElement).value = '';
                      }
                    }}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Agregar Costo
                  </button>
                </div>
              </div>

              <h3 className="font-semibold text-gray-900 mb-4">Historial de Costos</h3>
              {maintenanceHistory.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No hay costos registrados</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {maintenanceHistory.map((record: any) => (
                    <div key={record.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{record.description}</p>
                        <p className="text-sm text-gray-500">{new Date(record.date).toLocaleDateString()} - {record.type}</p>
                      </div>
                      <p className="font-semibold text-orange-600">${(record.cost || 0).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
