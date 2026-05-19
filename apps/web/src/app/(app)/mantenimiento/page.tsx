'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  Wrench, Calendar, Users, AlertTriangle, CheckCircle, Clock, TrendingUp,
  Filter, Search, Plus, Eye, Edit, Trash2, FileText, BarChart3, Settings,
  Download, Upload, RefreshCw, Zap, Shield, HardDrive, WrenchIcon, X,
  ChevronLeft, ChevronRight, Truck, Circle, Fuel, MapPin
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
  origen?: string;
  activoNombreLibre?: string;
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
  frequencyUnit: 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS' | 'KM';
  triggerKm?: number;
  lastOdometerExecution?: number;
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
  currentOdometer?: number;
  createdAt: string;
  updatedAt: string;
  _count?: { inspeccionQRs: number; workOrders: number };
  inspeccionQRs?: { lastUsedAt: string | null }[];
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
  const [activeTab, setActiveTab] = useState<'orders' | 'plans' | 'technicians' | 'parts' | 'assets' | 'calendar' | 'kpis' | 'flota-dashboard' | 'flota-vehiculos' | 'flota-neumaticos' | 'flota-conductores' | 'flota-vencimientos' | 'flota-combustible'>('orders');

  // ── Estado Flota ──────────────────────────────────────────────
  const [flotaVehiculos, setFlotaVehiculos] = useState<any[]>([]);
  const [flotaConductores, setFlotaConductores] = useState<any[]>([]);
  const [flotaNeumaticos, setFlotaNeumaticos] = useState<any[]>([]);
  const [flotaVencimientos, setFlotaVencimientos] = useState<any[]>([]);
  const [flotaStats, setFlotaStats] = useState<any>(null);
  const [flotaDashboard, setFlotaDashboard] = useState<any>(null);
  const [flotaLoaded, setFlotaLoaded] = useState(false);
  const [showVehModal, setShowVehModal] = useState(false);
  const [showConductorModal, setShowConductorModal] = useState(false);
  const [showNeumaticoModal, setShowNeumaticoModal] = useState(false);
  const [showVtoModal, setShowVtoModal] = useState<string | null>(null);
  const [showMontarModal, setShowMontarModal] = useState<string | null>(null);
  const [showDesmontarModal, setShowDesmontarModal] = useState<string | null>(null);
  const [showHistorialNeumModal, setShowHistorialNeumModal] = useState<string | null>(null);
  const [historialNeum, setHistorialNeum] = useState<any[]>([]);
  const [flotaRepuestos, setFlotaRepuestos] = useState<any[]>([]);
  const [showCombustibleModal, setShowCombustibleModal] = useState<string | null>(null);
  const [editingVeh, setEditingVeh] = useState<any>(null);
  const [editingCond, setEditingCond] = useState<any>(null);
  const [editingNeum, setEditingNeum] = useState<any>(null);
  const [selectedVehComb, setSelectedVehComb] = useState<any>(null);
  const [combustibleReg, setCombustibleReg] = useState<any[]>([]);
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
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [historialAsset, setHistorialAsset] = useState<Asset | null>(null);
  const [historialData, setHistorialData] = useState<any>(null);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialTab, setHistorialTab] = useState<'ots' | 'inspecciones'>('ots');

  useEffect(() => {
    loadMaintenanceData();
  }, []);

  useEffect(() => {
    if (activeTab.startsWith('flota') && !flotaLoaded) {
      loadFlotaData();
    }
  }, [activeTab, flotaLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setTechnicians((techniciansData.technicians || []).sort((a: any, b: any) => a.name.localeCompare(b.name)));
      setSpareParts(partsData.parts || []);
      setAssets(assetsData.assets || []);
      setStats(statsData.stats || stats);
    } catch (error) {
      console.error('Error loading maintenance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFlotaData = async () => {
    try {
      const [v, c, n, vto, s, rep, dash] = await Promise.all([
        apiFetch('/flota/vehiculos'),
        apiFetch('/flota/conductores'),
        apiFetch('/flota/neumaticos'),
        apiFetch('/flota/vencimientos'),
        apiFetch('/flota/stats'),
        apiFetch('/flota/neumaticos/repuestos'),
        apiFetch('/flota/dashboard'),
      ]) as any;
      setFlotaVehiculos(v.vehiculos || []);
      setFlotaConductores(c.conductores || []);
      setFlotaNeumaticos(n.neumaticos || []);
      setFlotaVencimientos(vto.vencimientos || []);
      setFlotaStats(s.stats || null);
      setFlotaRepuestos(rep.parts || []);
      setFlotaDashboard(dash || null);
      setFlotaLoaded(true);
    } catch (e) { console.error('Flota load error:', e); }
  };

  const loadHistorialNeum = async (neumaticoId: string) => {
    const data = await apiFetch(`/flota/neumaticos/${neumaticoId}/historial`) as any;
    setHistorialNeum(data.historial || []);
    setShowHistorialNeumModal(neumaticoId);
  };

  const desmontarNeumaticoConKm = async (neumaticoId: string, kmAlDesmontar: number | null, profBandaFin: number | null) => {
    await apiFetch(`/flota/neumaticos/${neumaticoId}/desmontar`, { method: 'POST', json: { kmAlDesmontar, profBandaFin } });
    setShowDesmontarModal(null);
    loadFlotaData();
  };

  const loadCombustible = async (vehiculoId: string) => {
    const data = await apiFetch(`/flota/vehiculos/${vehiculoId}/combustible`) as any;
    setCombustibleReg(data.registros || []);
  };

  const saveVehiculo = async (data: any) => {
    if (editingVeh) {
      await apiFetch(`/flota/vehiculos/${editingVeh.id}`, { method: 'PATCH', json: data });
    } else {
      await apiFetch('/flota/vehiculos', { method: 'POST', json: data });
    }
    setShowVehModal(false); setEditingVeh(null); loadFlotaData();
  };

  const saveConductor = async (data: any) => {
    if (editingCond) {
      await apiFetch(`/flota/conductores/${editingCond.id}`, { method: 'PATCH', json: data });
    } else {
      await apiFetch('/flota/conductores', { method: 'POST', json: data });
    }
    setShowConductorModal(false); setEditingCond(null); loadFlotaData();
  };

  const saveNeumatico = async (data: any) => {
    await apiFetch('/flota/neumaticos', { method: 'POST', json: data });
    setShowNeumaticoModal(false); loadFlotaData();
  };

  const updateNeumatico = async (id: string, data: any) => {
    await apiFetch(`/flota/neumaticos/${id}`, { method: 'PATCH', json: data });
    setShowNeumaticoModal(false); setEditingNeum(null); loadFlotaData();
  };

  const deleteNeumatico = async (id: string) => {
    if (!confirm('¿Eliminar este neumático? Solo se pueden eliminar los que estén DISPONIBLES (no montados).')) return;
    try {
      await apiFetch(`/flota/neumaticos/${id}`, { method: 'DELETE' });
      loadFlotaData();
    } catch (e: any) {
      alert(e?.message || 'No se pudo eliminar. Verifique que el neumático esté DISPONIBLE.');
    }
  };

  const deleteVehiculo = async (id: string) => {
    if (!confirm('¿Eliminar este vehículo? Se marcará como BAJA y no aparecerá en la lista.')) return;
    try {
      await apiFetch(`/flota/vehiculos/${id}`, { method: 'DELETE' });
      loadFlotaData();
    } catch (e: any) {
      alert(e?.message || 'No se pudo eliminar el vehículo.');
    }
  };

  const reactivarVehiculo = async (id: string) => {
    if (!confirm('¿Reactivar este vehículo? Volverá a estado ACTIVO.')) return;
    try {
      await apiFetch(`/flota/vehiculos/${id}`, { method: 'PATCH', json: { status: 'ACTIVO' } });
      loadFlotaData();
    } catch (e: any) {
      alert(e?.message || 'No se pudo reactivar el vehículo.');
    }
  };

  const deleteConductor = async (id: string) => {
    if (!confirm('¿Eliminar este conductor?')) return;
    try {
      await apiFetch(`/flota/conductores/${id}`, { method: 'DELETE' });
      loadFlotaData();
    } catch (e: any) {
      alert(e?.message || 'No se pudo eliminar el conductor.');
    }
  };

  const montarNeumatico = async (neumaticoId: string, data: any) => {
    await apiFetch(`/flota/neumaticos/${neumaticoId}/montar`, { method: 'POST', json: data });
    setShowMontarModal(null); loadFlotaData();
  };

  const desmontarNeumatico = async (neumaticoId: string) => {
    if (!confirm('¿Desmontar neumático?')) return;
    await apiFetch(`/flota/neumaticos/${neumaticoId}/desmontar`, { method: 'POST', json: {} });
    loadFlotaData();
  };

  const saveVencimiento = async (vehiculoId: string, data: any) => {
    await apiFetch(`/flota/vehiculos/${vehiculoId}/vencimientos`, { method: 'POST', json: data });
    setShowVtoModal(null); loadFlotaData();
  };

  const renovarVencimiento = async (id: string) => {
    await apiFetch(`/flota/vencimientos/${id}`, { method: 'PATCH', json: { renovado: true } });
    loadFlotaData();
  };

  const eliminarVencimiento = async (id: string) => {
    if (!confirm('¿Eliminar vencimiento?')) return;
    await apiFetch(`/flota/vencimientos/${id}`, { method: 'DELETE' });
    loadFlotaData();
  };

  const saveCombustible = async (vehiculoId: string, data: any) => {
    await apiFetch(`/flota/vehiculos/${vehiculoId}/combustible`, { method: 'POST', json: data });
    setShowCombustibleModal(null); loadCombustible(vehiculoId); loadFlotaData();
  };

  const diasHastaVto = (fecha: string) => Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000);

  const vtoOrdenados = useMemo(() => [...flotaVencimientos].sort((a, b) => new Date(a.fechaVto).getTime() - new Date(b.fechaVto).getTime()), [flotaVencimientos]);
  const vtoVencidos = vtoOrdenados.filter(v => diasHastaVto(v.fechaVto) < 0);
  const vtoPorVencer = vtoOrdenados.filter(v => { const d = diasHastaVto(v.fechaVto); return d >= 0 && d <= 30; });

  const TIPO_LABELS: Record<string, string> = { CAMION: 'Camión', TRACTOR: 'Tractor', SEMI: 'Semi', UTILITARIO: 'Utilitario', OTRO: 'Otro' };
  const VEH_STATUS_COLOR: Record<string, string> = { ACTIVO: 'bg-emerald-100 text-emerald-700', EN_TALLER: 'bg-amber-100 text-amber-700', INACTIVO: 'bg-gray-100 text-gray-500', BAJA: 'bg-red-100 text-red-600' };

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

  const openHistorial = async (asset: Asset) => {
    setHistorialAsset(asset); setShowHistorialModal(true); setHistorialLoading(true); setHistorialData(null); setHistorialTab('ots');
    try {
      const r = await apiFetch(`/maintenance/assets/${asset.id}/historial`) as any;
      setHistorialData(r);
    } catch (e) { console.error('historial error', e); }
    finally { setHistorialLoading(false); }
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
        <div className="overflow-x-auto" style={{overflowY:'visible'}}>
          <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 min-w-max relative z-10">
            {/* Mantenimiento group */}
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 mr-1">Mantenimiento</span>
            {([
              { id: 'orders', label: 'OT', icon: <Wrench className="w-3.5 h-3.5" /> },
              { id: 'plans', label: 'Planes', icon: <Calendar className="w-3.5 h-3.5" /> },
              { id: 'assets', label: 'Activos', icon: <HardDrive className="w-3.5 h-3.5" /> },
              { id: 'parts', label: 'Repuestos', icon: <HardDrive className="w-3.5 h-3.5" /> },
              { id: 'technicians', label: 'Técnicos', icon: <Users className="w-3.5 h-3.5" /> },
              { id: 'calendar', label: 'Calendario', icon: <Calendar className="w-3.5 h-3.5" /> },
              { id: 'kpis', label: 'KPIs', icon: <TrendingUp className="w-3.5 h-3.5" /> },
            ] as any[]).map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${activeTab === t.id ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}>
                {t.icon}{t.label}
              </button>
            ))}
            {/* Divider + Flota label */}
            <div className="flex items-center gap-1.5 mx-3 select-none pointer-events-none">
              <div className="w-px h-5 bg-gray-200" />
              <span className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1 ml-1"><Truck className="w-3 h-3" />Flota 360</span>
              <div className="w-px h-5 bg-gray-200" />
            </div>
            {([
              { id: 'flota-dashboard', label: 'Dashboard', icon: <TrendingUp className="w-3.5 h-3.5" /> },
              { id: 'flota-vehiculos', label: 'Vehículos', icon: <Truck className="w-3.5 h-3.5" /> },
              { id: 'flota-neumaticos', label: 'Neumáticos', icon: <Circle className="w-3.5 h-3.5" /> },
              { id: 'flota-conductores', label: 'Conductores', icon: <Users className="w-3.5 h-3.5" /> },
              { id: 'flota-vencimientos', label: 'Vencimientos', icon: <AlertTriangle className="w-3.5 h-3.5" />, badge: vtoVencidos.length + vtoPorVencer.length || 0 },
              { id: 'flota-combustible', label: 'Combustible', icon: <Fuel className="w-3.5 h-3.5" /> },
            ] as any[]).map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap relative ${activeTab === t.id ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}>
                {t.icon}{t.label}
                {t.badge > 0 && <span className="ml-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">{t.badge > 9 ? '9+' : t.badge}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className={`p-4 ${activeTab.startsWith('flota') ? 'hidden' : ''}`}>
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
                          {order.origen === 'INSPECCION' && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-violet-100 text-violet-700">
                              🔍 Inspección
                            </span>
                          )}
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
                            <span>{order.activoNombreLibre || (order.asset ? `${order.asset.name} (${order.asset.code})` : 'Sin activo')}</span>
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
                          <span className="font-medium">
                            {plan.frequencyUnit === 'KM' ? `cada ${(plan.triggerKm || plan.frequencyValue).toLocaleString('es-AR')} km` : `${plan.frequencyValue} ${plan.frequencyUnit === 'DAYS' ? 'días' : plan.frequencyUnit === 'WEEKS' ? 'semanas' : plan.frequencyUnit === 'MONTHS' ? 'meses' : 'años'}`}
                          </span>
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
                            onClick={() => openHistorial(asset)}
                            className="p-1 text-purple-600 hover:bg-purple-50 rounded"
                            title="Hoja de vida del activo"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
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
                        {asset.currentOdometer != null && (
                          <p className="text-blue-600 font-semibold">🔢 Odómetro: {asset.currentOdometer.toLocaleString('es-AR')} km</p>
                        )}
                      </div>
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {(asset._count?.inspeccionQRs || 0) > 0
                          ? <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                              🔗 {asset._count.inspeccionQRs} QR{asset._count.inspeccionQRs !== 1 ? 's' : ''} vinculado{asset._count.inspeccionQRs !== 1 ? 's' : ''}
                            </span>
                          : <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Sin QR vinculado</span>
                        }
                        {asset.inspeccionQRs?.[0]?.lastUsedAt && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                            📋 Última insp: {new Date(asset.inspeccionQRs[0].lastUsedAt).toLocaleDateString('es-AR')}
                          </span>
                        )}
                        {asset.status === 'MAINTENANCE' && (
                          <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">⚠️ En mantenimiento</span>
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

          {/* ══ FLOTA: DASHBOARD EJECUTIVO ══ */}
          {activeTab === 'flota-dashboard' && (
            <div className="p-4 space-y-5">
              {!flotaDashboard ? (
                <div className="text-center py-16 text-gray-400">Cargando dashboard...</div>
              ) : (() => {
                const f = flotaDashboard.flota || {};
                const m = flotaDashboard.mantenimiento || {};
                const comb = f.combustible || {};
                const neu = f.neumaticos || {};
                const venc = f.vencimientos || {};
                const cond = f.conductores || {};

                const dispColor = f.disponibilidadPct >= 80 ? 'text-emerald-600' : f.disponibilidadPct >= 60 ? 'text-amber-600' : 'text-red-600';
                const dispBg = f.disponibilidadPct >= 80 ? 'bg-emerald-50 border-emerald-200' : f.disponibilidadPct >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

                const TIPO_LABELS_OT: any = { CORRECTIVE: 'Correctivo', PREVENTIVE: 'Preventivo', PREDICTIVE: 'Predictivo', EMERGENCY: 'Emergencia' };
                const PRIOR_COLORS: any = { CRITICAL: 'bg-red-500', HIGH: 'bg-orange-400', MEDIUM: 'bg-amber-400', LOW: 'bg-blue-400' };

                return (
                  <>
                    {/* ── Fila 1: KPIs principales ── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Disponibilidad */}
                      <div className={`rounded-2xl border p-4 flex flex-col items-center justify-center ${dispBg}`}>
                        <p className={`text-4xl font-extrabold ${dispColor}`}>{f.disponibilidadPct}%</p>
                        <p className="text-xs font-semibold text-gray-500 mt-1 uppercase tracking-wide">Disponibilidad</p>
                        <div className="flex gap-2 mt-2 text-xs">
                          <span className="text-emerald-600 font-bold">{f.activos} activos</span>
                          <span className="text-amber-600 font-bold">{f.enTaller} en taller</span>
                        </div>
                      </div>
                      {/* Combustible mes */}
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Combustible mes</p>
                        <p className="text-2xl font-bold text-gray-900">{(comb.litrosMes || 0).toLocaleString('es-AR')} L</p>
                        {comb.variacionLitros != null && (
                          <p className={`text-xs mt-1 font-semibold ${comb.variacionLitros > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {comb.variacionLitros > 0 ? '▲' : '▼'} {Math.abs(comb.variacionLitros)}% vs mes ant.
                          </p>
                        )}
                        {comb.l100km && <p className="text-xs text-gray-500 mt-1">{comb.l100km} L/100km promedio</p>}
                        {comb.costoMes > 0 && <p className="text-xs text-gray-400 mt-0.5">${(comb.costoMes || 0).toLocaleString('es-AR')} total</p>}
                      </div>
                      {/* OTs */}
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Órdenes de trabajo</p>
                        <p className="text-2xl font-bold text-gray-900">{m.otAbiertas} <span className="text-sm font-medium text-gray-400">abiertas</span></p>
                        <p className="text-xs text-gray-500 mt-1">{m.otCerradasMes} cerradas este mes</p>
                        {m.mttrHoras != null && <p className="text-xs text-blue-600 font-semibold mt-1">MTTR: {m.mttrHoras}h</p>}
                        {m.costoOTMes > 0 && <p className="text-xs text-gray-400 mt-0.5">${(m.costoOTMes || 0).toLocaleString('es-AR')} en mant.</p>}
                      </div>
                      {/* Alertas consolidadas */}
                      <div className={`rounded-2xl border p-4 ${(venc.vencidos + neu.enAlerta + cond.enAlerta?.length) > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Alertas activas</p>
                        <p className={`text-2xl font-bold ${(venc.vencidos + neu.enAlerta + (cond.enAlerta?.length || 0)) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {(venc.vencidos || 0) + (neu.enAlerta || 0) + (cond.enAlerta?.length || 0)}
                        </p>
                        <div className="space-y-0.5 mt-2 text-xs">
                          {venc.vencidos > 0 && <p className="text-red-600 font-semibold">⛔ {venc.vencidos} docs vencidos</p>}
                          {neu.enAlerta > 0 && <p className="text-orange-600 font-semibold">⚠ {neu.enAlerta} neumáticos</p>}
                          {(cond.enAlerta?.length || 0) > 0 && <p className="text-amber-600 font-semibold">🪪 {cond.enAlerta.length} conductores</p>}
                          {(venc.vencidos + neu.enAlerta + (cond.enAlerta?.length || 0)) === 0 && <p className="text-emerald-600 font-semibold">✓ Sin alertas</p>}
                        </div>
                      </div>
                    </div>

                    {/* ── Fila 2: Flota status + Neumáticos + Conductores ── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Estado de la flota */}
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Truck className="w-4 h-4 text-blue-500" />Estado de flota</p>
                        <div className="space-y-2">
                          {[
                            { label: 'Activos', count: f.activos, total: f.totalVehiculos, color: 'bg-emerald-500' },
                            { label: 'En taller', count: f.enTaller, total: f.totalVehiculos, color: 'bg-amber-500' },
                            { label: 'Inactivos', count: f.inactivos, total: f.totalVehiculos, color: 'bg-gray-300' },
                          ].map(s => (
                            <div key={s.label}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-500">{s.label}</span>
                                <span className="font-bold text-gray-700">{s.count || 0}/{s.total}</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2">
                                <div className={`${s.color} h-2 rounded-full`} style={{ width: `${s.total > 0 ? Math.round(((s.count || 0) / s.total) * 100) : 0}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Neumáticos */}
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Circle className="w-4 h-4 text-purple-500" />Neumáticos</p>
                        <div className="grid grid-cols-2 gap-2 text-center">
                          {[
                            { label: 'Total', v: neu.total || 0, color: 'text-gray-700' },
                            { label: 'Montados', v: neu.montados || 0, color: 'text-blue-600' },
                            { label: 'Disponibles', v: neu.disponibles || 0, color: 'text-emerald-600' },
                            { label: 'En alerta', v: neu.enAlerta || 0, color: neu.enAlerta > 0 ? 'text-red-600' : 'text-gray-400' },
                          ].map(k => (
                            <div key={k.label} className="bg-gray-50 rounded-xl p-2">
                              <p className={`text-xl font-bold ${k.color}`}>{k.v}</p>
                              <p className="text-xs text-gray-400">{k.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Vencimientos próximos */}
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" />Vencimientos próximos</p>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                          {(venc.lista || []).length === 0 && <p className="text-xs text-gray-400 text-center py-4">Sin vencimientos próximos</p>}
                          {(venc.lista || []).map((v: any, i: number) => (
                            <div key={i} className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-xs ${v.diasRestantes < 0 ? 'bg-red-50' : v.diasRestantes <= 7 ? 'bg-orange-50' : 'bg-amber-50'}`}>
                              <span className="font-semibold text-gray-700 truncate max-w-[6rem]">{v.dominio}</span>
                              <span className="text-gray-500 truncate">{v.tipo}</span>
                              <span className={`font-bold shrink-0 ml-1 ${v.diasRestantes < 0 ? 'text-red-600' : v.diasRestantes <= 7 ? 'text-orange-600' : 'text-amber-600'}`}>
                                {v.diasRestantes < 0 ? `${Math.abs(v.diasRestantes)}d venc.` : `${v.diasRestantes}d`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* ── Fila 3: OTs por tipo + Consumidores + Conductores alerta ── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* OTs por tipo */}
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Wrench className="w-4 h-4 text-gray-500" />OTs últimos 30 días</p>
                        {(m.otPorTipo || []).length === 0 && <p className="text-xs text-gray-400 text-center py-4">Sin OTs recientes</p>}
                        <div className="space-y-2">
                          {(m.otPorTipo || []).map((t: any) => {
                            const total = (m.otPorTipo || []).reduce((s: number, x: any) => s + x.count, 0);
                            const pct = total > 0 ? Math.round((t.count / total) * 100) : 0;
                            const colors: any = { CORRECTIVE: 'bg-red-400', PREVENTIVE: 'bg-blue-400', PREDICTIVE: 'bg-purple-400', EMERGENCY: 'bg-orange-500' };
                            return (
                              <div key={t.tipo}>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-gray-500">{TIPO_LABELS_OT[t.tipo] || t.tipo}</span>
                                  <span className="font-bold text-gray-700">{t.count} ({pct}%)</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                  <div className={`${colors[t.tipo] || 'bg-gray-400'} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* Por prioridad */}
                        {(m.otPorPrioridad || []).length > 0 && (
                          <div className="flex gap-1.5 mt-3 flex-wrap">
                            {(m.otPorPrioridad || []).map((p: any) => (
                              <span key={p.prioridad} className={`text-xs text-white px-2 py-0.5 rounded-full font-semibold ${PRIOR_COLORS[p.prioridad] || 'bg-gray-400'}`}>
                                {p.prioridad} ×{p.count}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Top consumidores */}
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Fuel className="w-4 h-4 text-blue-500" />Top consumo combustible</p>
                        {(f.topConsumidores || []).length === 0 && <p className="text-xs text-gray-400 text-center py-4">Sin registros este mes</p>}
                        <div className="space-y-2">
                          {(f.topConsumidores || []).map((v: any, i: number) => {
                            const maxL = (f.topConsumidores || [])[0]?.litros || 1;
                            return (
                              <div key={v.dominio}>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="font-semibold text-gray-700">{v.dominio}</span>
                                  <span className="text-gray-500">{v.litros.toLocaleString('es-AR')} L{v.costo > 0 ? ` · $${v.costo.toLocaleString('es-AR')}` : ''}</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                  <div className={`${i === 0 ? 'bg-red-400' : i === 1 ? 'bg-orange-400' : 'bg-blue-400'} h-2 rounded-full`} style={{ width: `${Math.round((v.litros / maxL) * 100)}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Conductores en alerta */}
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-500" />Conductores — docs</p>
                        {(cond.enAlerta || []).length === 0 ? (
                          <div className="text-center py-4">
                            <p className="text-emerald-600 font-semibold text-sm">✓ Todo al día</p>
                            <p className="text-xs text-gray-400 mt-1">{cond.total} conductores activos</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {(cond.enAlerta || []).map((c: any) => (
                              <div key={c.nombre} className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                                <p className="text-xs font-semibold text-gray-800">{c.nombre}</p>
                                <div className="flex gap-3 mt-0.5 text-xs">
                                  {c.licDias != null && <span className={c.licDias < 0 ? 'text-red-600 font-bold' : c.licDias <= 7 ? 'text-orange-600 font-bold' : 'text-amber-600'}>
                                    Lic: {c.licDias < 0 ? `vencida ${Math.abs(c.licDias)}d` : `${c.licDias}d`}
                                  </span>}
                                  {c.psicoDias != null && c.psicoDias <= 30 && <span className={c.psicoDias < 0 ? 'text-red-600 font-bold' : 'text-amber-600'}>
                                    Psico: {c.psicoDias < 0 ? `vencido ${Math.abs(c.psicoDias)}d` : `${c.psicoDias}d`}
                                  </span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Fila 4: MTTR + Resumen texto ejecutivo ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Resumen ejecutivo */}
                      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Resumen ejecutivo</p>
                        <div className="space-y-2 text-sm">
                          <p>
                            <span className={`font-bold text-lg ${dispColor.replace('text-', 'text-')}`}>{f.disponibilidadPct}%</span>
                            <span className="text-slate-300"> de disponibilidad — {f.activos}/{f.totalVehiculos} unidades operativas</span>
                          </p>
                          {comb.l100km && <p className="text-slate-300">Consumo promedio: <span className="text-white font-bold">{comb.l100km} L/100km</span></p>}
                          {m.mttrHoras != null && <p className="text-slate-300">Tiempo medio de reparación: <span className="text-white font-bold">{m.mttrHoras}h</span></p>}
                          {m.costoOTMes > 0 && <p className="text-slate-300">Costo mantenimiento mes: <span className="text-white font-bold">${m.costoOTMes.toLocaleString('es-AR')}</span></p>}
                          {(venc.vencidos || 0) > 0 && <p className="text-red-400 font-semibold">⚠ {venc.vencidos} documentos vencidos requieren acción inmediata</p>}
                          {(cond.enAlerta?.length || 0) > 0 && <p className="text-amber-400 font-semibold">⚠ {cond.enAlerta.length} conductores con documentación próxima a vencer</p>}
                          {f.disponibilidadPct >= 80 && (venc.vencidos || 0) === 0 && <p className="text-emerald-400 font-semibold">✓ Flota en buen estado operativo</p>}
                        </div>
                      </div>
                      {/* Métricas de mantenimiento */}
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <p className="text-sm font-semibold text-gray-700 mb-3">Indicadores mantenimiento</p>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: 'OTs abiertas', v: m.otAbiertas, color: m.otAbiertas > 5 ? 'text-red-600' : 'text-gray-800' },
                            { label: 'Cerradas mes', v: m.otCerradasMes, color: 'text-emerald-600' },
                            { label: 'MTTR (hs)', v: m.mttrHoras != null ? `${m.mttrHoras}h` : '—', color: 'text-blue-600' },
                            { label: 'Costo OT mes', v: m.costoOTMes > 0 ? `$${(m.costoOTMes || 0).toLocaleString('es-AR')}` : '—', color: 'text-gray-700' },
                          ].map(k => (
                            <div key={k.label} className="bg-gray-50 rounded-xl p-3 text-center">
                              <p className={`text-xl font-bold ${k.color}`}>{k.v}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{k.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* ══ FLOTA: VEHÍCULOS ══ */}
          {activeTab === 'flota-vehiculos' && (
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Truck className="w-5 h-5 text-blue-600" />Vehículos ({flotaVehiculos.length})</h3>
                <button onClick={() => { setEditingVeh(null); setShowVehModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"><Plus className="w-4 h-4" />Nuevo vehículo</button>
              </div>
              {flotaStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  {[
                    { label: 'Activos', v: flotaStats.activos, color: 'emerald' },
                    { label: 'En taller', v: flotaStats.enTaller, color: 'amber' },
                    { label: 'Vtos. próximos', v: flotaStats.vencimientosProximos, color: flotaStats.vencimientosProximos > 0 ? 'red' : 'gray' },
                    { label: 'Neumáticos', v: flotaStats.neumaticos, color: 'purple' },
                  ].map(k => (
                    <div key={k.label} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-200">
                      <p className="text-xl font-bold text-gray-900">{k.v}</p>
                      <p className="text-xs text-gray-500">{k.label}</p>
                    </div>
                  ))}
                </div>
              )}
              {flotaVehiculos.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-xl"><Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">Sin vehículos registrados</p></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {flotaVehiculos.map((v: any) => {
                    const vtoAlert = (v.vencimientos || []).filter((vt: any) => !vt.renovado && diasHastaVto(vt.fechaVto) <= 30);
                    return (
                      <div key={v.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-gray-900">{v.dominio}</span>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${VEH_STATUS_COLOR[v.status] || 'bg-gray-100 text-gray-500'}`}>{v.status}</span>
                            </div>
                            <p className="text-sm text-gray-500">{TIPO_LABELS[v.tipo] || v.tipo}{v.marca ? ` · ${v.marca}` : ''}{v.modelo ? ` ${v.modelo}` : ''}{v.anio ? ` (${v.anio})` : ''}</p>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => { setEditingVeh(v); setShowVehModal(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"><Edit className="w-3.5 h-3.5" /></button>
                            {v.status === 'BAJA' ? (
                              <button onClick={() => reactivarVehiculo(v.id)} className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50" title="Reactivar"><RefreshCw className="w-3.5 h-3.5" /></button>
                            ) : (
                              <button onClick={() => deleteVehiculo(v.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50" title="Eliminar (marcar BAJA)"><Trash2 className="w-3.5 h-3.5" /></button>
                            )}
                          </div>
                        </div>
                        {v.currentOdometer != null && (
                          <div className="bg-blue-50 rounded-lg px-3 py-1.5 mb-2 flex items-center gap-2">
                            <span className="text-base">🔢</span>
                            <p className="text-sm font-bold text-blue-700">{v.currentOdometer.toLocaleString('es-AR')} km</p>
                          </div>
                        )}
                        {v.conductor && (
                          <p className="text-xs text-gray-500 mb-2 flex items-center gap-1"><Users className="w-3 h-3" />{v.conductor.nombre}{v.conductor.categoria ? ` · Cat. ${v.conductor.categoria}` : ''}</p>
                        )}
                        {(v.posicionesNeumatico || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {(v.posicionesNeumatico || []).map((p: any) => (
                              <span key={p.id} className="text-xs bg-purple-50 text-purple-700 border border-purple-100 px-1.5 py-0.5 rounded">E{p.eje}-{p.lado}{p.posicion !== 'SIMPLE' ? `-${p.posicion}` : ''}</span>
                            ))}
                          </div>
                        )}
                        {vtoAlert.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5 mb-2">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{vtoAlert.length} doc. por vencer ({vtoAlert.map((vt: any) => vt.tipo).join(', ')})
                          </div>
                        )}
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => setShowVtoModal(v.id)} className="flex-1 text-xs border border-gray-200 text-gray-600 rounded-lg py-1.5 hover:bg-gray-50 flex items-center justify-center gap-1"><Calendar className="w-3 h-3" />Vencimientos</button>
                          <button onClick={() => { setSelectedVehComb(v); setShowCombustibleModal(v.id); loadCombustible(v.id); }} className="flex-1 text-xs border border-gray-200 text-gray-600 rounded-lg py-1.5 hover:bg-gray-50 flex items-center justify-center gap-1"><Fuel className="w-3 h-3" />Combustible</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ FLOTA: NEUMÁTICOS ══ */}
          {activeTab === 'flota-neumaticos' && (
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Circle className="w-5 h-5 text-purple-600" />Neumáticos ({flotaNeumaticos.length})</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Cada neumático es una unidad física. Vinculala a un artículo de Repuestos para gestionar stock.</p>
                </div>
                <button onClick={() => { setEditingNeum(null); setShowNeumaticoModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"><Plus className="w-4 h-4" />Nuevo neumático</button>
              </div>
              {/* Resumen por estado */}
              {flotaNeumaticos.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {(['DISPONIBLE','EN_USO','EN_REPARACION','BAJA'] as const).map(s => {
                    const cnt = flotaNeumaticos.filter((n: any) => n.status === s).length;
                    const colors: any = { DISPONIBLE: 'bg-emerald-50 text-emerald-700 border-emerald-200', EN_USO: 'bg-blue-50 text-blue-700 border-blue-200', EN_REPARACION: 'bg-amber-50 text-amber-700 border-amber-200', BAJA: 'bg-red-50 text-red-700 border-red-200' };
                    const labels: any = { DISPONIBLE: 'Disponibles', EN_USO: 'Montados', EN_REPARACION: 'En reparación', BAJA: 'De baja' };
                    return <div key={s} className={`rounded-xl border p-2 text-center ${colors[s]}`}><p className="text-lg font-bold">{cnt}</p><p className="text-xs">{labels[s]}</p></div>;
                  })}
                </div>
              )}
              {flotaNeumaticos.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-xl"><Circle className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">Sin neumáticos registrados</p></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {flotaNeumaticos.map((n: any) => {
                    const montadoEn = (n.posiciones || []).find((p: any) => p.activo);
                    const sColor: any = { DISPONIBLE: 'bg-emerald-100 text-emerald-700', EN_USO: 'bg-blue-100 text-blue-700', EN_REPARACION: 'bg-amber-100 text-amber-700', BAJA: 'bg-red-100 text-red-600' };
                    const bandaAlert = n.profBanda != null && n.profBanda < 3;
                    return (
                      <div key={n.id} className={`bg-white rounded-xl border p-4 ${bandaAlert ? 'border-red-300' : 'border-gray-200'}`}>
                        <div className="flex items-start justify-between mb-1">
                          <div>
                            <p className="font-bold text-gray-900">{n.codigo}</p>
                            <p className="text-xs text-gray-500">{[n.marca, n.modelo, n.medida].filter(Boolean).join(' · ')}</p>
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${sColor[n.status] || 'bg-gray-100 text-gray-500'}`}>{n.status}</span>
                        </div>
                        {/* Condición + articulo repuesto */}
                        <div className="flex flex-wrap gap-1 mb-2">
                          {n.condicion && <span className={`text-xs px-1.5 py-0.5 rounded ${n.condicion === 'NUEVA' ? 'bg-emerald-50 text-emerald-700' : n.condicion === 'RECAPADA' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>{n.condicion}</span>}
                          {n.sparePart && <span className="text-xs bg-purple-50 text-purple-700 border border-purple-100 px-1.5 py-0.5 rounded">📦 {n.sparePart.name} · stock: {n.sparePart.currentStock}</span>}
                          {bandaAlert && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">⚠ banda baja</span>}
                        </div>
                        {/* Métricas */}
                        <div className="grid grid-cols-3 gap-1.5 text-xs text-center mb-2">
                          <div className="bg-gray-50 rounded-lg p-1.5"><p className="font-bold text-gray-800">{(n.kmAcumulados || 0).toLocaleString('es-AR')}</p><p className="text-gray-400">km acum.</p></div>
                          <div className={`rounded-lg p-1.5 ${bandaAlert ? 'bg-red-50' : 'bg-gray-50'}`}><p className={`font-bold ${bandaAlert ? 'text-red-600' : 'text-gray-800'}`}>{n.profBanda != null ? `${n.profBanda}mm` : '—'}</p><p className="text-gray-400">banda</p></div>
                          <div className="bg-gray-50 rounded-lg p-1.5"><p className="font-bold text-gray-800">{n.dot || '—'}</p><p className="text-gray-400">DOT</p></div>
                        </div>
                        {/* Montado en */}
                        {montadoEn && (
                          <div className="bg-blue-50 rounded-lg px-3 py-1.5 mb-2 text-xs text-blue-700 flex justify-between items-center">
                            <span className="font-semibold">🚛 {montadoEn.vehiculo?.dominio} · E{montadoEn.eje}-{montadoEn.lado}</span>
                            {montadoEn.kmAlMontar != null && <span className="text-blue-500">desde {montadoEn.kmAlMontar.toLocaleString('es-AR')} km</span>}
                          </div>
                        )}
                        {/* Acciones */}
                        <div className="flex gap-1.5 mt-2">
                          {n.status === 'DISPONIBLE' && <button onClick={() => setShowMontarModal(n.id)} className="flex-1 text-xs bg-blue-600 text-white rounded-lg py-1.5 hover:bg-blue-700 flex items-center justify-center gap-1"><Plus className="w-3 h-3" />Montar</button>}
                          {n.status === 'EN_USO' && <button onClick={() => setShowDesmontarModal(n.id)} className="flex-1 text-xs border border-gray-200 text-gray-600 rounded-lg py-1.5 hover:bg-gray-50 flex items-center justify-center gap-1"><X className="w-3 h-3" />Desmontar</button>}
                          <button onClick={() => loadHistorialNeum(n.id)} className="text-xs border border-gray-200 text-gray-500 rounded-lg py-1.5 px-2 hover:bg-gray-50">Historial</button>
                          <button onClick={() => { setEditingNeum(n); setShowNeumaticoModal(true); }} className="text-xs border border-gray-200 text-gray-500 rounded-lg py-1.5 px-2 hover:bg-gray-50" title="Editar"><Edit className="w-3 h-3" /></button>
                          {n.status === 'DISPONIBLE' && <button onClick={() => deleteNeumatico(n.id)} className="text-xs border border-red-200 text-red-500 rounded-lg py-1.5 px-2 hover:bg-red-50" title="Eliminar"><Trash2 className="w-3 h-3" /></button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ FLOTA: CONDUCTORES ══ */}
          {activeTab === 'flota-conductores' && (
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-600" />Conductores ({flotaConductores.length})</h3>
                <button onClick={() => { setEditingCond(null); setShowConductorModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"><Plus className="w-4 h-4" />Nuevo conductor</button>
              </div>
              {flotaConductores.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-xl"><Users className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">Sin conductores registrados</p></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {flotaConductores.map((c: any) => {
                    const licDias = c.licenciaVto ? diasHastaVto(c.licenciaVto) : null;
                    const psicoDias = c.psicofisicoVto ? diasHastaVto(c.psicofisicoVto) : null;
                    return (
                      <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-bold text-gray-900">{c.nombre}</p>
                            <p className="text-sm text-gray-500">{[c.dni ? `DNI ${c.dni}` : null, c.telefono].filter(Boolean).join(' · ')}</p>
                          </div>
                          <div className="flex gap-1 items-center">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.status === 'ACTIVO' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{c.status}</span>
                            <button onClick={() => { setEditingCond(c); setShowConductorModal(true); }} className="p-1 text-gray-400 hover:text-blue-600"><Edit className="w-3.5 h-3.5" /></button>
                            <button onClick={() => deleteConductor(c.id)} className="p-1 text-gray-400 hover:text-red-600" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs my-2">
                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-gray-400 mb-0.5">Lic. cat. {c.categoria || '—'}</p>
                            {licDias != null && <p className={licDias < 0 ? 'text-red-600 font-semibold' : licDias <= 30 ? 'text-amber-600' : 'text-gray-500'}>{licDias < 0 ? '⚠️ Vencida' : `En ${licDias}d`}</p>}
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-gray-400 mb-0.5">Psicofísico</p>
                            {psicoDias != null && <p className={psicoDias < 0 ? 'text-red-600 font-semibold' : psicoDias <= 30 ? 'text-amber-600' : 'text-gray-500'}>{psicoDias < 0 ? '⚠️ Vencido' : `En ${psicoDias}d`}</p>}
                          </div>
                        </div>
                        {(c.vehiculos || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">{(c.vehiculos || []).map((v: any) => <span key={v.id} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded">{v.dominio}</span>)}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ FLOTA: VENCIMIENTOS ══ */}
          {activeTab === 'flota-vencimientos' && (
            <div className="p-4 space-y-5">
              {[
                { label: '⛔ Vencidos', items: vtoVencidos, ringColor: 'bg-red-500' },
                { label: '⚠️ Por vencer (≤30 días)', items: vtoPorVencer, ringColor: 'bg-amber-500' },
                { label: '✅ Al día', items: vtoOrdenados.filter(v => diasHastaVto(v.fechaVto) > 30), ringColor: 'bg-emerald-500' },
              ].map(group => group.items.length > 0 && (
                <div key={group.label}>
                  <p className="text-sm font-semibold text-gray-700 mb-2">{group.label} ({group.items.length})</p>
                  <div className="space-y-2">
                    {group.items.map((v: any) => {
                      const dias = diasHastaVto(v.fechaVto);
                      return (
                        <div key={v.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${group.ringColor}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold border border-gray-200 text-gray-600 px-2 py-0.5 rounded">{v.tipo}</span>
                              <span className="font-semibold text-gray-900">{v.vehiculo?.dominio}</span>
                              {v.descripcion && <span className="text-xs text-gray-400">{v.descripcion}</span>}
                            </div>
                            <p className="text-xs text-gray-500">{new Date(v.fechaVto).toLocaleDateString('es-AR')}{dias < 0 ? ` — hace ${Math.abs(dias)}d` : ` — en ${dias}d`}</p>
                          </div>
                          <button onClick={() => renovarVencimiento(v.id)} className="text-xs bg-emerald-600 text-white px-2.5 py-1 rounded-lg hover:bg-emerald-700 shrink-0">Renovar</button>
                          <button onClick={() => eliminarVencimiento(v.id)} className="text-gray-300 hover:text-red-500 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {vtoOrdenados.length === 0 && (
                <div className="text-center py-16 bg-gray-50 rounded-xl">
                  <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Sin vencimientos registrados</p>
                  <p className="text-xs text-gray-400 mt-1">Entrá a un vehículo y agregá sus documentos (VTV, seguro, etc.)</p>
                </div>
              )}
            </div>
          )}

          {/* ══ FLOTA: COMBUSTIBLE ══ */}
          {activeTab === 'flota-combustible' && (
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Fuel className="w-5 h-5 text-blue-600" />Combustible — seleccioná un vehículo</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {flotaVehiculos.map((v: any) => (
                  <button key={v.id} onClick={() => { setSelectedVehComb(v); setShowCombustibleModal(v.id); loadCombustible(v.id); }}
                    className="bg-white rounded-xl border border-gray-200 p-4 text-left hover:shadow-md hover:border-blue-300 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Fuel className="w-5 h-5 text-blue-600" /></div>
                      <div><p className="font-bold text-gray-900">{v.dominio}</p><p className="text-xs text-gray-500">{TIPO_LABELS[v.tipo]} · {v._count?.registrosCombustible || 0} registros</p></div>
                    </div>
                    {v.currentOdometer != null && <p className="text-xs text-blue-600 font-medium mt-2">🔢 {v.currentOdometer.toLocaleString('es-AR')} km</p>}
                  </button>
                ))}
                {flotaVehiculos.length === 0 && <p className="text-gray-400 text-sm col-span-3 text-center py-8">Primero registrá vehículos en la pestaña Vehículos</p>}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Hoja de Vida del Activo Modal */}
      {showHistorialModal && historialAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">📋 Hoja de Vida — {historialAsset.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{historialAsset.code} · {historialAsset.category}</p>
              </div>
              <button onClick={() => setShowHistorialModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            {/* Resumen */}
            {historialData && (
              <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50 border-b border-gray-100 text-center text-sm">
                <div>
                  <p className="text-xl font-bold text-blue-600">{historialData.workOrders?.length || 0}</p>
                  <p className="text-xs text-gray-500">Órdenes de trabajo</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-purple-600">{historialData.inspecciones?.length || 0}</p>
                  <p className="text-xs text-gray-500">Inspecciones</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-emerald-600">{historialData.qrs?.length || 0}</p>
                  <p className="text-xs text-gray-500">QRs vinculados</p>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              <button onClick={() => setHistorialTab('ots')} className={`flex-1 py-2.5 text-sm font-medium ${historialTab === 'ots' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                🔧 Órdenes de Trabajo
              </button>
              <button onClick={() => setHistorialTab('inspecciones')} className={`flex-1 py-2.5 text-sm font-medium ${historialTab === 'inspecciones' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>
                📋 Inspecciones QR
              </button>
            </div>

            <div className="p-4">
              {historialLoading && (
                <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
              )}

              {!historialLoading && historialData && historialTab === 'ots' && (
                <div className="space-y-2">
                  {historialData.workOrders?.length === 0
                    ? <p className="text-sm text-gray-400 text-center py-8">Sin órdenes de trabajo para este activo aún.</p>
                    : historialData.workOrders.map((ot: any) => (
                      <div key={ot.id} className="border border-gray-100 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{ot.title}</p>
                            <p className="text-xs text-gray-400">{ot.code} · {ot.type} · {new Date(ot.createdAt).toLocaleDateString('es-AR')}</p>
                            {ot.technician && <p className="text-xs text-blue-500">Técnico: {ot.technician.name}</p>}
                            {ot.origen === 'INSPECCION' && (
                              <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-medium">🔍 Origen: Inspección QR</span>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                            ot.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                            ot.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                            ot.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                          }`}>{ot.status}</span>
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}

              {!historialLoading && historialData && historialTab === 'inspecciones' && (
                <div className="space-y-3">
                  {historialData.inspecciones?.length >= 2 && (() => {
                    const pts = [...historialData.inspecciones].reverse().filter((i: any) => i.puntaje !== null);
                    if (pts.length < 2) return null;
                    const W = 340, H = 80, pad = 10;
                    const xs = pts.map((_: any, i: number) => pad + (i / (pts.length - 1)) * (W - pad * 2));
                    const ys = pts.map((i: any) => H - pad - ((i.puntaje / 100) * (H - pad * 2)));
                    const polyline = xs.map((x: number, i: number) => `${x},${ys[i]}`).join(' ');
                    const last = pts[pts.length - 1];
                    const avg = Math.round(pts.reduce((s: number, i: any) => s + i.puntaje, 0) / pts.length);
                    return (
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-gray-600">Tendencia de puntaje</span>
                          <div className="flex gap-3 text-xs text-gray-500">
                            <span>Promedio: <b className="text-gray-700">{avg}%</b></span>
                            <span>Último: <b className={last.puntaje >= 80 ? 'text-green-600' : last.puntaje >= 60 ? 'text-amber-500' : 'text-red-600'}>{last.puntaje}%</b></span>
                          </div>
                        </div>
                        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16">
                          <line x1={pad} y1={H - pad - ((80 / 100) * (H - pad * 2))} x2={W - pad} y2={H - pad - ((80 / 100) * (H - pad * 2))} stroke="#d1fae5" strokeWidth="1" strokeDasharray="4 2" />
                          <line x1={pad} y1={H - pad - ((60 / 100) * (H - pad * 2))} x2={W - pad} y2={H - pad - ((60 / 100) * (H - pad * 2))} stroke="#fef3c7" strokeWidth="1" strokeDasharray="4 2" />
                          <polyline points={polyline} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
                          {xs.map((x: number, i: number) => (
                            <circle key={i} cx={x} cy={ys[i]} r="3"
                              fill={pts[i].puntaje >= 80 ? '#10b981' : pts[i].puntaje >= 60 ? '#f59e0b' : '#ef4444'} />
                          ))}
                        </svg>
                      </div>
                    );
                  })()}
                  {historialData.inspecciones?.length === 0
                    ? <p className="text-sm text-gray-400 text-center py-8">Sin inspecciones registradas aún. Vinculá un QR operativo a este activo.</p>
                    : historialData.inspecciones.map((ins: any) => (
                      <div key={ins.id} className="border border-gray-100 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800">{ins.inspectorNombre}</p>
                            <p className="text-xs text-gray-400">{new Date(ins.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                            {ins.hallazgosCount > 0 && <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">{ins.hallazgosCount} hallazgo{ins.hallazgosCount !== 1 ? 's' : ''}</span>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-bold ${ins.puntaje >= 80 ? 'text-green-600' : ins.puntaje >= 60 ? 'text-amber-500' : 'text-red-600'}`}>{ins.puntaje}%</p>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                              ins.estado === 'COMPLETA' ? 'bg-green-100 text-green-700' :
                              ins.estado === 'CON_HALLAZGOS' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                            }`}>{ins.estado}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                    <option value="KM">Kilómetros</option>
                  </select>
                </div>
              </div>
              <div id="editPlanKmField">
                <label className="block text-sm font-medium text-gray-700 mb-1">Intervalo en km (solo si unidad = KM)</label>
                <input type="number" id="editPlanTriggerKm" defaultValue={selectedPlan.triggerKm || selectedPlan.frequencyValue}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: 10000" />
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
                  const triggerKm = frequencyUnit === 'KM' ? parseFloat((document.getElementById('editPlanTriggerKm') as HTMLInputElement)?.value || '0') || null : null;
                  const nextExecutionDate = (document.getElementById('editPlanNextExecution') as HTMLInputElement)?.value;
                  const status = (document.getElementById('editPlanStatus') as HTMLSelectElement)?.value;
                  
                  if (title) {
                    handleUpdatePlan(selectedPlan.id, { 
                      title, 
                      description, 
                      assetId, 
                      frequencyValue, 
                      frequencyUnit,
                      ...(triggerKm ? { triggerKm } : {}),
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
                    <option value="MONTHS">Meses</option>
                    <option value="YEARS">Años</option>
                    <option value="KM">Kilómetros</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Intervalo km <span className="text-gray-400 font-normal">(solo si unidad = Kilómetros)</span></label>
                <div className="relative">
                  <input type="number" id="planTriggerKm" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: 10000" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">km</span>
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
                const triggerKmCreate = frequencyUnit === 'KM' ? parseFloat((document.getElementById('planTriggerKm') as HTMLInputElement)?.value || '0') || null : null;
                const nextExecutionDate = (document.getElementById('planNextExecution') as HTMLInputElement)?.value;
                const type = (document.getElementById('planType') as HTMLSelectElement)?.value;
                if (code && title) {
                  handleCreatePlan({ code, title, description, assetId, frequencyValue, frequencyUnit, ...(triggerKmCreate ? { triggerKm: triggerKmCreate } : {}), nextExecutionDate, type, status: 'ACTIVE' });
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

      {/* ══ MODALS FLOTA ══ */}

      {showVehModal && (
        <FlotaModal title={editingVeh ? `Editar ${editingVeh.dominio}` : 'Nuevo vehículo'} onClose={() => { setShowVehModal(false); setEditingVeh(null); }}>
          <FlotaVehiculoForm vehiculo={editingVeh} conductores={flotaConductores} tipoLabels={TIPO_LABELS} onSave={saveVehiculo} onClose={() => { setShowVehModal(false); setEditingVeh(null); }} />
        </FlotaModal>
      )}

      {showConductorModal && (
        <FlotaModal title={editingCond ? `Editar ${editingCond.nombre}` : 'Nuevo conductor'} onClose={() => { setShowConductorModal(false); setEditingCond(null); }}>
          <FlotaConductorForm conductor={editingCond} onSave={saveConductor} onClose={() => { setShowConductorModal(false); setEditingCond(null); }} />
        </FlotaModal>
      )}

      {showNeumaticoModal && (
        <FlotaModal title={editingNeum ? 'Editar neumático' : 'Nuevo neumático'} onClose={() => { setShowNeumaticoModal(false); setEditingNeum(null); }}>
          <FlotaNeumaticoForm
            repuestos={flotaRepuestos}
            neumatico={editingNeum}
            onSave={editingNeum ? (data: any) => updateNeumatico(editingNeum.id, data) : saveNeumatico}
            onClose={() => { setShowNeumaticoModal(false); setEditingNeum(null); }}
          />
        </FlotaModal>
      )}

      {showMontarModal && (
        <FlotaModal title="Montar neumático en vehículo" onClose={() => setShowMontarModal(null)}>
          <FlotaMontarForm
            neumaticoId={showMontarModal}
            vehiculos={flotaVehiculos}
            tipoLabels={TIPO_LABELS}
            onSave={montarNeumatico}
            onClose={() => setShowMontarModal(null)}
          />
        </FlotaModal>
      )}

      {showDesmontarModal && (() => {
        const n = flotaNeumaticos.find(x => x.id === showDesmontarModal);
        const posActiva = n ? (n.posiciones || []).find((p: any) => p.activo) : null;
        return (
          <FlotaModal title="Desmontar neumático" onClose={() => setShowDesmontarModal(null)}>
            <FlotaDesmontarForm
              neumatico={n}
              posActiva={posActiva}
              vehiculo={posActiva ? flotaVehiculos.find(v => v.id === posActiva.vehiculoId) : null}
              onSave={desmontarNeumaticoConKm}
              onClose={() => setShowDesmontarModal(null)}
            />
          </FlotaModal>
        );
      })()}

      {showHistorialNeumModal && (() => {
        const n = flotaNeumaticos.find(x => x.id === showHistorialNeumModal);
        return (
          <FlotaModal title={`Historial — ${n?.codigo || ''}`} onClose={() => { setShowHistorialNeumModal(null); setHistorialNeum([]); }}>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {historialNeum.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Sin historial de montajes</p>}
              {historialNeum.map((h: any, i: number) => (
                <div key={h.id || i} className="border border-gray-200 rounded-xl px-3 py-2 text-sm">
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-gray-800">{h.vehiculo?.dominio} · E{h.eje}-{h.lado}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${h.activo ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{h.activo ? 'Montado' : 'Desmontado'}</span>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-gray-500">
                    <span>Montado: {h.kmAlMontar != null ? `${h.kmAlMontar.toLocaleString('es-AR')} km` : '—'}</span>
                    <span>Desmontado: {h.kmAlDesmontar != null ? `${h.kmAlDesmontar.toLocaleString('es-AR')} km` : '—'}</span>
                    {h.kmAlMontar != null && h.kmAlDesmontar != null && <span className="text-purple-600 font-semibold">+{(h.kmAlDesmontar - h.kmAlMontar).toLocaleString('es-AR')} km</span>}
                  </div>
                  {(h.profBandaInicio != null || h.profBandaFin != null) && (
                    <p className="text-xs text-gray-400 mt-0.5">Banda: {h.profBandaInicio ?? '—'}mm → {h.profBandaFin ?? '—'}mm</p>
                  )}
                </div>
              ))}
            </div>
          </FlotaModal>
        );
      })()}

      {showVtoModal && (
        <FlotaModal title={`Vencimientos — ${flotaVehiculos.find(v => v.id === showVtoModal)?.dominio || ''}`} onClose={() => setShowVtoModal(null)}>
          <FlotaVtoForm
            vehiculoId={showVtoModal}
            vencimientos={flotaVencimientos.filter(v => v.vehiculoId === showVtoModal)}
            diasHastaVto={diasHastaVto}
            onSave={saveVencimiento}
            onRenovar={renovarVencimiento}
            onEliminar={eliminarVencimiento}
            onClose={() => setShowVtoModal(null)}
          />
        </FlotaModal>
      )}

      {showCombustibleModal && selectedVehComb && (
        <FlotaModal title={`Combustible — ${selectedVehComb.dominio}`} onClose={() => { setShowCombustibleModal(null); setSelectedVehComb(null); setCombustibleReg([]); }}>
          <FlotaCombustibleForm
            vehiculo={selectedVehComb}
            registros={combustibleReg}
            onSave={saveCombustible}
            onClose={() => { setShowCombustibleModal(null); setSelectedVehComb(null); setCombustibleReg([]); }}
          />
        </FlotaModal>
      )}

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FLOTA MODAL COMPONENTS
// ═══════════════════════════════════════════════════════════════

function FlotaModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

const FI = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>{children}</div>
);
const inp = "w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500";

function FlotaVehiculoForm({ vehiculo, conductores, tipoLabels, onSave, onClose }: any) {
  const [f, setF] = useState({
    dominio: vehiculo?.dominio || '', tipo: vehiculo?.tipo || 'CAMION', marca: vehiculo?.marca || '',
    modelo: vehiculo?.modelo || '', anio: vehiculo?.anio?.toString() || '', color: vehiculo?.color || '',
    chasis: vehiculo?.chasis || '', motor: vehiculo?.motor || '', status: vehiculo?.status || 'ACTIVO',
    conductorId: vehiculo?.conductorId || '', currentOdometer: vehiculo?.currentOdometer?.toString() || '', notas: vehiculo?.notas || '',
  });
  const set = (k: string) => (e: any) => setF(p => ({ ...p, [k]: e.target.value }));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><FI label="Dominio / Patente *"><input value={f.dominio} onChange={set('dominio')} className={inp + ' uppercase'} placeholder="ABC123" /></FI></div>
        <FI label="Tipo"><select value={f.tipo} onChange={set('tipo')} className={inp}>{Object.entries(tipoLabels).map(([k, v]: any) => <option key={k} value={k}>{v}</option>)}</select></FI>
        <FI label="Estado"><select value={f.status} onChange={set('status')} className={inp}>{['ACTIVO','EN_TALLER','INACTIVO','BAJA'].map(s => <option key={s}>{s}</option>)}</select></FI>
        <FI label="Marca"><input value={f.marca} onChange={set('marca')} className={inp} placeholder="Volvo, Scania..." /></FI>
        <FI label="Modelo"><input value={f.modelo} onChange={set('modelo')} className={inp} /></FI>
        <FI label="Año"><input type="number" value={f.anio} onChange={set('anio')} className={inp} placeholder="2022" /></FI>
        <FI label="Color"><input value={f.color} onChange={set('color')} className={inp} /></FI>
        <FI label="Nº Chasis"><input value={f.chasis} onChange={set('chasis')} className={inp} /></FI>
        <FI label="Nº Motor"><input value={f.motor} onChange={set('motor')} className={inp} /></FI>
        <FI label="Odómetro actual (km)"><input type="number" value={f.currentOdometer} onChange={set('currentOdometer')} className={inp} placeholder="125000" /></FI>
        <FI label="Conductor asignado">
          <select value={f.conductorId} onChange={set('conductorId')} className={inp}>
            <option value="">Sin asignar</option>
            {conductores.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </FI>
        <div className="col-span-2"><FI label="Notas"><textarea value={f.notas} onChange={set('notas')} className={inp + ' h-14 resize-none'} /></FI></div>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 hover:bg-gray-50 text-sm">Cancelar</button>
        <button onClick={() => { if (!f.dominio.trim()) return alert('Dominio requerido'); onSave({ ...f, anio: f.anio ? parseInt(f.anio) : undefined, currentOdometer: f.currentOdometer ? parseFloat(f.currentOdometer) : undefined, conductorId: f.conductorId || null, crearActivoMantenimiento: !vehiculo }); }} className="flex-1 bg-blue-600 text-white rounded-lg py-2 hover:bg-blue-700 text-sm">Guardar</button>
      </div>
    </div>
  );
}

function FlotaConductorForm({ conductor, onSave, onClose }: any) {
  const [f, setF] = useState({
    nombre: conductor?.nombre || '', dni: conductor?.dni || '', telefono: conductor?.telefono || '',
    email: conductor?.email || '', categoria: conductor?.categoria || '', nroLicencia: conductor?.nroLicencia || '',
    licenciaVto: conductor?.licenciaVto?.split('T')[0] || '', psicofisicoVto: conductor?.psicofisicoVto?.split('T')[0] || '',
    status: conductor?.status || 'ACTIVO', notas: conductor?.notas || '',
  });
  const set = (k: string) => (e: any) => setF(p => ({ ...p, [k]: e.target.value }));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><FI label="Nombre completo *"><input value={f.nombre} onChange={set('nombre')} className={inp} /></FI></div>
        <FI label="DNI"><input value={f.dni} onChange={set('dni')} className={inp} /></FI>
        <FI label="Teléfono"><input value={f.telefono} onChange={set('telefono')} className={inp} /></FI>
        <FI label="Email"><input type="email" value={f.email} onChange={set('email')} className={inp} /></FI>
        <FI label="Categoría lic."><select value={f.categoria} onChange={set('categoria')} className={inp}><option value="">—</option>{['A','B','C','D','E'].map(c => <option key={c}>{c}</option>)}</select></FI>
        <FI label="Nº Licencia"><input value={f.nroLicencia} onChange={set('nroLicencia')} className={inp} /></FI>
        <FI label="Estado"><select value={f.status} onChange={set('status')} className={inp}>{['ACTIVO','INACTIVO','SUSPENDIDO'].map(s => <option key={s}>{s}</option>)}</select></FI>
        <FI label="Vto. Licencia"><input type="date" value={f.licenciaVto} onChange={set('licenciaVto')} className={inp} /></FI>
        <FI label="Vto. Psicofísico"><input type="date" value={f.psicofisicoVto} onChange={set('psicofisicoVto')} className={inp} /></FI>
        <div className="col-span-2"><FI label="Notas"><textarea value={f.notas} onChange={set('notas')} className={inp + ' h-14 resize-none'} /></FI></div>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 hover:bg-gray-50 text-sm">Cancelar</button>
        <button onClick={() => { if (!f.nombre.trim()) return alert('Nombre requerido'); onSave(f); }} className="flex-1 bg-blue-600 text-white rounded-lg py-2 hover:bg-blue-700 text-sm">Guardar</button>
      </div>
    </div>
  );
}

function FlotaNeumaticoForm({ repuestos, neumatico, onSave, onClose }: any) {
  const isEditing = !!neumatico;
  const [f, setF] = useState({ codigo: '', marca: '', modelo: '', medida: '', dot: '', condicion: 'NUEVA', profBanda: '', sparePartId: '', notas: '' });
  
  // Initialize form with neumatico data when editing
  useEffect(() => {
    if (neumatico) {
      setF({
        codigo: neumatico.codigo || '',
        marca: neumatico.marca || '',
        modelo: neumatico.modelo || '',
        medida: neumatico.medida || '',
        dot: neumatico.dot || '',
        condicion: neumatico.condicion || 'NUEVA',
        profBanda: neumatico.profBanda != null ? String(neumatico.profBanda) : '',
        sparePartId: neumatico.sparePartId || '',
        notas: neumatico.notas || '',
      });
    }
  }, [neumatico]);
  
  const set = (k: string) => (e: any) => setF(p => ({ ...p, [k]: e.target.value }));
  const selPart = repuestos.find((r: any) => r.id === f.sparePartId);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <FI label="Artículo de Repuesto (opcional)">
            <select value={f.sparePartId} onChange={set('sparePartId')} className={inp} disabled={isEditing}>
              <option value="">Sin vincular a repuesto</option>
              {repuestos.map((r: any) => <option key={r.id} value={r.id}>{r.code} — {r.name} (stock: {r.currentStock})</option>)}
            </select>
          </FI>
          {selPart && !isEditing && <p className="text-xs text-purple-600 mt-1">📦 Al montar esta rueda, se descontará 1 unidad del stock ({selPart.currentStock} disponibles)</p>}
          {isEditing && selPart && <p className="text-xs text-gray-400 mt-1">📦 Vinculado a: {selPart.name}</p>}
        </div>
        <div className="col-span-2"><FI label="Código / Nº serie *"><input value={f.codigo} onChange={set('codigo')} className={inp} placeholder={selPart ? selPart.code + '-001' : 'NM-001'} /></FI></div>
        <FI label="Marca"><input value={f.marca} onChange={set('marca')} className={inp} placeholder={selPart?.name?.split(' ')[0] || 'Bridgestone...'} /></FI>
        <FI label="Modelo"><input value={f.modelo} onChange={set('modelo')} className={inp} /></FI>
        <FI label="Medida"><input value={f.medida} onChange={set('medida')} className={inp} placeholder="295/80R22.5" /></FI>
        <FI label="DOT"><input value={f.dot} onChange={set('dot')} className={inp} placeholder="2452" /></FI>
        <FI label="Condición *"><select value={f.condicion} onChange={set('condicion')} className={inp}><option value="NUEVA">Nueva</option><option value="USADA">Usada</option><option value="RECAPADA">Recapada</option></select></FI>
        <FI label="Prof. banda (mm)"><input type="number" step="0.1" value={f.profBanda} onChange={set('profBanda')} className={inp} placeholder="12" /></FI>
        <div className="col-span-2"><FI label="Notas"><textarea value={f.notas} onChange={set('notas')} className={inp + ' h-12 resize-none'} /></FI></div>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 hover:bg-gray-50 text-sm">Cancelar</button>
        <button onClick={() => { if (!f.codigo.trim()) return alert('Código requerido'); onSave({ ...f, profBanda: f.profBanda ? parseFloat(f.profBanda) : undefined, sparePartId: f.sparePartId || null }); }} className="flex-1 bg-blue-600 text-white rounded-lg py-2 hover:bg-blue-700 text-sm">{isEditing ? 'Guardar cambios' : 'Crear'}</button>
      </div>
    </div>
  );
}

function FlotaMontarForm({ neumaticoId, vehiculos, tipoLabels, onSave, onClose }: any) {
  const [f, setF] = useState({ vehiculoId: '', eje: '1', lado: 'IZQ', posicion: 'SIMPLE', kmAlMontar: '', profBandaInicio: '' });
  const set = (k: string) => (e: any) => setF(p => ({ ...p, [k]: e.target.value }));
  // Pre-carga KM del vehículo seleccionado
  const vehSel = vehiculos.find((v: any) => v.id === f.vehiculoId);
  const handleVehiculo = (e: any) => {
    const veh = vehiculos.find((v: any) => v.id === e.target.value);
    setF(p => ({ ...p, vehiculoId: e.target.value, kmAlMontar: veh?.currentOdometer != null ? String(veh.currentOdometer) : '' }));
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <FI label="Vehículo *">
            <select value={f.vehiculoId} onChange={handleVehiculo} className={inp}>
              <option value="">Seleccionar...</option>
              {vehiculos.map((v: any) => <option key={v.id} value={v.id}>{v.dominio} — {tipoLabels[v.tipo] || v.tipo}{v.currentOdometer ? ` (${v.currentOdometer.toLocaleString('es-AR')} km)` : ''}</option>)}
            </select>
          </FI>
        </div>
        <FI label="Eje *"><select value={f.eje} onChange={set('eje')} className={inp}>{[1,2,3,4,5].map(n => <option key={n} value={n}>Eje {n}</option>)}</select></FI>
        <FI label="Lado *"><select value={f.lado} onChange={set('lado')} className={inp}><option value="IZQ">Izquierdo</option><option value="DER">Derecho</option></select></FI>
        <FI label="Posición"><select value={f.posicion} onChange={set('posicion')} className={inp}><option value="SIMPLE">Simple</option><option value="EXT">Doble externo</option><option value="INT">Doble interno</option></select></FI>
        <FI label="Odómetro al montar (km)">
          <input type="number" value={f.kmAlMontar} onChange={set('kmAlMontar')} className={inp} placeholder={vehSel?.currentOdometer ? String(vehSel.currentOdometer) : '0'} />
        </FI>
        <div className="col-span-2"><FI label="Prof. banda al montar (mm)"><input type="number" step="0.1" value={f.profBandaInicio} onChange={set('profBandaInicio')} className={inp} placeholder="12" /></FI></div>
      </div>
      {vehSel?.currentOdometer && !f.kmAlMontar && <p className="text-xs text-blue-600">🔢 Odómetro actual de {vehSel.dominio}: {vehSel.currentOdometer.toLocaleString('es-AR')} km (pre-cargado automáticamente)</p>}
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 hover:bg-gray-50 text-sm">Cancelar</button>
        <button onClick={() => { if (!f.vehiculoId) return alert('Selección un vehículo'); onSave(neumaticoId, { vehiculoId: f.vehiculoId, eje: parseInt(f.eje), lado: f.lado, posicion: f.posicion, kmAlMontar: f.kmAlMontar ? parseFloat(f.kmAlMontar) : undefined, profBandaInicio: f.profBandaInicio ? parseFloat(f.profBandaInicio) : undefined }); }} className="flex-1 bg-blue-600 text-white rounded-lg py-2 hover:bg-blue-700 text-sm">Montar</button>
      </div>
    </div>
  );
}

function FlotaDesmontarForm({ neumatico, posActiva, vehiculo, onSave, onClose }: any) {
  const defaultKm = vehiculo?.currentOdometer != null ? String(vehiculo.currentOdometer) : '';
  const [km, setKm] = useState(defaultKm);
  const [banda, setBanda] = useState('');
  const kmRecorridos = posActiva?.kmAlMontar != null && km ? parseFloat(km) - posActiva.kmAlMontar : null;
  return (
    <div className="space-y-4">
      {posActiva && (
        <div className="bg-blue-50 rounded-xl p-3 text-sm">
          <p className="font-semibold text-blue-800">🚛 Montado en: {vehiculo?.dominio || '—'} · E{posActiva.eje}-{posActiva.lado}</p>
          {posActiva.kmAlMontar != null && <p className="text-blue-600 text-xs mt-0.5">KM al montar: {posActiva.kmAlMontar.toLocaleString('es-AR')} km</p>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <FI label="Odómetro al desmontar (km)">
            <input type="number" value={km} onChange={e => setKm(e.target.value)} className={inp} placeholder={vehiculo?.currentOdometer ? String(vehiculo.currentOdometer) : '0'} />
          </FI>
          {kmRecorridos != null && kmRecorridos > 0 && <p className="text-xs text-purple-600 mt-1">🛣 Km recorridos en este montaje: <strong>{kmRecorridos.toLocaleString('es-AR')} km</strong></p>}
        </div>
        <div className="col-span-2">
          <FI label="Prof. banda al desmontar (mm)">
            <input type="number" step="0.1" value={banda} onChange={e => setBanda(e.target.value)} className={inp} placeholder="Ej: 4.5" />
          </FI>
          {banda && parseFloat(banda) < 3 && <p className="text-xs text-red-600 mt-1">⚠ Banda por debajo de 3mm — considerar reemplazo</p>}
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 hover:bg-gray-50 text-sm">Cancelar</button>
        <button onClick={() => onSave(neumatico.id, km ? parseFloat(km) : null, banda ? parseFloat(banda) : null)} className="flex-1 bg-amber-600 text-white rounded-lg py-2 hover:bg-amber-700 text-sm">Confirmar desmontaje</button>
      </div>
    </div>
  );
}

function FlotaVtoForm({ vehiculoId, vencimientos, diasHastaVto, onSave, onRenovar, onEliminar, onClose }: any) {
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ tipo: 'VTV', descripcion: '', fechaVto: '', alertaDias: '30' });
  const set = (k: string) => (e: any) => setF(p => ({ ...p, [k]: e.target.value }));
  return (
    <div>
      <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
        {vencimientos.length === 0 && !adding && <p className="text-sm text-gray-400 text-center py-4">Sin vencimientos</p>}
        {vencimientos.map((v: any) => {
          const dias = diasHastaVto(v.fechaVto);
          return (
            <div key={v.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 border ${dias < 0 ? 'bg-red-50 border-red-200' : dias <= 30 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
              <span className="text-xs font-bold bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded shrink-0">{v.tipo}</span>
              <div className="flex-1 min-w-0">
                {v.descripcion && <p className="text-xs text-gray-500 truncate">{v.descripcion}</p>}
                <p className="text-xs font-medium text-gray-700">{new Date(v.fechaVto).toLocaleDateString('es-AR')}{dias < 0 ? ` ⛔ hace ${Math.abs(dias)}d` : ` · en ${dias}d`}</p>
              </div>
              {!v.renovado && <button onClick={() => onRenovar(v.id)} className="text-xs bg-emerald-600 text-white px-2 py-1 rounded-lg shrink-0">Renovar</button>}
              <button onClick={() => onEliminar(v.id)} className="text-gray-300 hover:text-red-500 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          );
        })}
      </div>
      {adding ? (
        <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FI label="Tipo *"><select value={f.tipo} onChange={set('tipo')} className={inp}>{['VTV','SEGURO','HABILITACION','RUTA','OTRO'].map(t => <option key={t}>{t}</option>)}</select></FI>
            <FI label="Descripción"><input value={f.descripcion} onChange={set('descripcion')} className={inp} /></FI>
            <FI label="Fecha vencimiento *"><input type="date" value={f.fechaVto} onChange={set('fechaVto')} className={inp} /></FI>
            <FI label="Alertar N días antes"><input type="number" value={f.alertaDias} onChange={set('alertaDias')} className={inp} /></FI>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-1.5 text-sm">Cancelar</button>
            <button onClick={() => { if (!f.fechaVto) return alert('Fecha requerida'); onSave(vehiculoId, { ...f, alertaDias: parseInt(f.alertaDias) }); setAdding(false); setF({ tipo: 'VTV', descripcion: '', fechaVto: '', alertaDias: '30' }); }} className="flex-1 bg-blue-600 text-white rounded-lg py-1.5 text-sm">Agregar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full border-2 border-dashed border-gray-200 text-gray-400 rounded-xl py-3 text-sm hover:border-blue-300 hover:text-blue-500 flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" />Agregar vencimiento
        </button>
      )}
      <button onClick={onClose} className="w-full mt-3 border border-gray-200 text-gray-600 rounded-lg py-2 hover:bg-gray-50 text-sm">Cerrar</button>
    </div>
  );
}

function FlotaCombustibleForm({ vehiculo, registros, onSave, onClose }: any) {
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ litros: '', precioPorLitro: '', odometro: '', estacion: '', tipoCombustible: 'DIESEL', fecha: new Date().toISOString().split('T')[0], notas: '' });
  const set = (k: string) => (e: any) => setF(p => ({ ...p, [k]: e.target.value }));
  const totalLitros = registros.reduce((s: number, r: any) => s + r.litros, 0);
  const totalCosto = registros.reduce((s: number, r: any) => s + (r.costoTotal || 0), 0);
  const rends = registros.filter((r: any) => r.rendimiento);
  const rendProm = rends.length ? rends.reduce((s: number, r: any) => s + r.rendimiento, 0) / rends.length : 0;
  return (
    <div>
      {registros.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-blue-50 rounded-xl p-3 text-center"><p className="text-lg font-bold text-blue-700">{totalLitros.toLocaleString('es-AR', { maximumFractionDigits: 0 })} L</p><p className="text-xs text-blue-500">Total cargado</p></div>
          <div className="bg-green-50 rounded-xl p-3 text-center"><p className="text-lg font-bold text-green-700">${totalCosto.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</p><p className="text-xs text-green-500">Costo total</p></div>
          <div className="bg-purple-50 rounded-xl p-3 text-center"><p className="text-lg font-bold text-purple-700">{rendProm > 0 ? `${rendProm.toFixed(1)} km/L` : '—'}</p><p className="text-xs text-purple-500">Rendimiento</p></div>
        </div>
      )}
      <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
        {registros.slice(0, 10).map((r: any) => (
          <div key={r.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2 text-sm">
            <Fuel className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="flex-1"><span className="font-medium">{r.litros} L</span>{r.precioPorLitro && <span className="text-gray-500"> · ${r.precioPorLitro}/L</span>}{r.rendimiento && <span className="text-emerald-600 font-medium"> · {r.rendimiento} km/L</span>}</div>
            <div className="text-xs text-gray-400 text-right"><p>{new Date(r.fecha).toLocaleDateString('es-AR')}</p>{r.odometro && <p>{r.odometro.toLocaleString('es-AR')} km</p>}</div>
          </div>
        ))}
        {registros.length === 0 && !adding && <p className="text-sm text-gray-400 text-center py-4">Sin registros</p>}
      </div>
      {adding ? (
        <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FI label="Litros *"><input type="number" step="0.01" value={f.litros} onChange={set('litros')} className={inp} placeholder="120" /></FI>
            <FI label="Precio/litro"><input type="number" step="0.01" value={f.precioPorLitro} onChange={set('precioPorLitro')} className={inp} placeholder="1200" /></FI>
            <FI label="Odómetro (km)"><input type="number" value={f.odometro} onChange={set('odometro')} className={inp} /></FI>
            <FI label="Tipo"><select value={f.tipoCombustible} onChange={set('tipoCombustible')} className={inp}>{['DIESEL','NAFTA','GNC','ELECTRICO'].map(t => <option key={t}>{t}</option>)}</select></FI>
            <FI label="Estación"><input value={f.estacion} onChange={set('estacion')} className={inp} /></FI>
            <FI label="Fecha"><input type="date" value={f.fecha} onChange={set('fecha')} className={inp} /></FI>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-1.5 text-sm">Cancelar</button>
            <button onClick={() => { if (!f.litros) return alert('Litros requerido'); onSave(vehiculo.id, { ...f, litros: parseFloat(f.litros), precioPorLitro: f.precioPorLitro ? parseFloat(f.precioPorLitro) : undefined, odometro: f.odometro ? parseFloat(f.odometro) : undefined }); setAdding(false); }} className="flex-1 bg-blue-600 text-white rounded-lg py-1.5 text-sm">Registrar carga</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full border-2 border-dashed border-gray-200 text-gray-400 rounded-xl py-3 text-sm hover:border-blue-300 hover:text-blue-500 flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" />Nueva carga de combustible
        </button>
      )}
      <button onClick={onClose} className="w-full mt-3 border border-gray-200 text-gray-600 rounded-lg py-2 hover:bg-gray-50 text-sm">Cerrar</button>
    </div>
  );
}
