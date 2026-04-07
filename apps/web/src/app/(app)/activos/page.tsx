'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  Package, Plus, Search, Filter, Edit, Trash2, Eye, Archive,
  AlertTriangle, CheckCircle, Clock, Calendar, DollarSign,
  TrendingUp, TrendingDown, BarChart3, Settings, Download,
  Upload, QrCode, Camera, FileText, Wrench, Zap, X
} from 'lucide-react';

interface Asset {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  type: 'EQUIPMENT' | 'FURNITURE' | 'VEHICLE' | 'IT' | 'FACILITY' | 'OTHER';
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'RETIRED' | 'LOST';
  location: {
    building: string;
    floor: string;
    room?: string;
    coordinates?: string;
  };
  specifications: {
    brand?: string;
    model?: string;
    serialNumber?: string;
    year?: number;
    color?: string;
    dimensions?: {
      length: number;
      width: number;
      height: number;
      unit: string;
    };
    weight?: {
      value: number;
      unit: string;
    };
  };
  financial: {
    purchaseDate: string;
    purchaseCost: number;
    currentValue: number;
    depreciationMethod: 'STRAIGHT_LINE' | 'DECLINING_BALANCE' | 'UNITS_OF_PRODUCTION';
    usefulLife: number; // years
    accumulatedDepreciation: number;
    salvageValue?: number;
  };
  maintenance: {
    lastMaintenanceDate?: string;
    nextMaintenanceDate?: string;
    maintenanceInterval: number; // days
    maintenanceCost: number;
    warrantyExpiry?: string;
    supplier?: {
      name: string;
      contact: string;
      phone: string;
      email: string;
    };
  };
  usage: {
    usageHours?: number;
    lastUsedDate?: string;
    utilizationRate?: number; // percentage
    condition: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    performance?: {
      efficiency: number; // percentage
      availability: number; // percentage
      reliability: number; // percentage
    };
  };
  documentation: Array<{
    id: string;
    name: string;
    type: 'MANUAL' | 'WARRANTY' | 'INVOICE' | 'PHOTO' | 'CERTIFICATE' | 'OTHER';
    url: string;
    uploadDate: string;
  }>;
  qrCode?: string;
  tags: string[];
  assignedTo?: {
    id: string;
    name: string;
    department: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface AssetStats {
  total: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  totalValue: number;
  depreciatedValue: number;
  maintenanceDue: number;
  warrantyExpiring: number;
  utilizationRate: number;
  avgAge: number;
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stats, setStats] = useState<AssetStats>({
    total: 0,
    byCategory: {},
    byStatus: {},
    byType: {},
    totalValue: 0,
    depreciatedValue: 0,
    maintenanceDue: 0,
    warrantyExpiring: 0,
    utilizationRate: 0,
    avgAge: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const [assetsData, statsData] = await Promise.all([
        apiFetch('/assets'),
        apiFetch('/assets/stats')
      ]) as any;
      
      setAssets(assetsData.assets || []);
      setStats(statsData.stats || stats);
    } catch (error) {
      console.error('Error loading assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'text-green-600 bg-green-50';
      case 'INACTIVE': return 'text-gray-600 bg-gray-50';
      case 'MAINTENANCE': return 'text-yellow-600 bg-yellow-50';
      case 'RETIRED': return 'text-red-600 bg-red-50';
      case 'LOST': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'Activo';
      case 'INACTIVE': return 'Inactivo';
      case 'MAINTENANCE': return 'En Mantenimiento';
      case 'RETIRED': return 'Retirado';
      case 'LOST': return 'Perdido';
      default: return status;
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'EXCELLENT': return 'text-green-600';
      case 'GOOD': return 'text-blue-600';
      case 'FAIR': return 'text-yellow-600';
      case 'POOR': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getConditionLabel = (condition: string) => {
    switch (condition) {
      case 'EXCELLENT': return 'Excelente';
      case 'GOOD': return 'Bueno';
      case 'FAIR': return 'Regular';
      case 'POOR': return 'Pobre';
      default: return condition;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'EQUIPMENT': return 'text-blue-600 bg-blue-50';
      case 'FURNITURE': return 'text-green-600 bg-green-50';
      case 'VEHICLE': return 'text-purple-600 bg-purple-50';
      case 'IT': return 'text-orange-600 bg-orange-50';
      case 'FACILITY': return 'text-gray-600 bg-gray-50';
      case 'OTHER': return 'text-pink-600 bg-pink-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'EQUIPMENT': return 'Equipo';
      case 'FURNITURE': return 'Mobiliario';
      case 'VEHICLE': return 'Vehículo';
      case 'IT': return 'TI';
      case 'FACILITY': return 'Instalación';
      case 'OTHER': return 'Otro';
      default: return type;
    }
  };

  const isMaintenanceDue = (asset: Asset) => {
    if (!asset.maintenance.nextMaintenanceDate) return false;
    return new Date(asset.maintenance.nextMaintenanceDate) <= new Date();
  };

  const isWarrantyExpiring = (asset: Asset) => {
    if (!asset.maintenance.warrantyExpiry) return false;
    const expiryDate = new Date(asset.maintenance.warrantyExpiry);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expiryDate <= thirtyDaysFromNow;
  };

  const getDepreciationRate = (asset: Asset) => {
    if (asset.financial.purchaseCost === 0) return 0;
    return (asset.financial.accumulatedDepreciation / asset.financial.purchaseCost) * 100;
  };

  const filteredAssets = assets.filter(asset => {
    if (searchQuery && !asset.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !asset.description.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !asset.specifications.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterCategory !== 'all' && asset.category !== filterCategory) return false;
    if (filterStatus !== 'all' && asset.status !== filterStatus) return false;
    if (filterType !== 'all' && asset.type !== filterType) return false;
    return true;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'category':
        return a.category.localeCompare(b.category);
      case 'status':
        return a.status.localeCompare(b.status);
      case 'value':
        return b.financial.currentValue - a.financial.currentValue;
      case 'purchaseDate':
        return new Date(b.financial.purchaseDate).getTime() - new Date(a.financial.purchaseDate).getTime();
      case 'condition':
        const conditionOrder = { EXCELLENT: 0, GOOD: 1, FAIR: 2, POOR: 3 };
        return conditionOrder[a.usage.condition as keyof typeof conditionOrder] - conditionOrder[b.usage.condition as keyof typeof conditionOrder];
      default:
        return 0;
    }
  });

  const handleDelete = async (assetId: string) => {
    if (confirm('¿Está seguro de eliminar este activo? Esta acción no se puede deshacer.')) {
      try {
        await apiFetch(`/assets/${assetId}`, { method: 'DELETE' });
        loadAssets();
      } catch (error) {
        console.error('Error deleting asset:', error);
      }
    }
  };

  const generateQRCode = async (assetId: string) => {
    try {
      const response = await apiFetch(`/assets/${assetId}/qr-code`, { method: 'POST' }) as any;
      // Download QR code
      const blob = new Blob([response.qrCode], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-code-${assetId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Activos</h1>
          <p className="text-gray-600">Gestión de inventario y control de activos</p>
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
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Nuevo Activo
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Activos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Package className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Valor Total</p>
              <p className="text-2xl font-bold text-gray-900">${(stats.totalValue / 1000000).toFixed(1)}M</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tasa Utilización</p>
              <p className="text-2xl font-bold text-gray-900">{stats.utilizationRate.toFixed(0)}%</p>
            </div>
            <BarChart3 className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Mantenimiento Vencido</p>
              <p className="text-2xl font-bold text-gray-900">{stats.maintenanceDue}</p>
            </div>
            <Wrench className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-[300px]">
            <Search className="w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar activos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todas las categorías</option>
            <option value="electronics">Electrónicos</option>
            <option value="furniture">Mobiliario</option>
            <option value="vehicles">Vehículos</option>
            <option value="machinery">Maquinaria</option>
            <option value="tools">Herramientas</option>
          </select>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todos los estados</option>
            <option value="ACTIVE">Activo</option>
            <option value="INACTIVE">Inactivo</option>
            <option value="MAINTENANCE">En Mantenimiento</option>
            <option value="RETIRED">Retirado</option>
            <option value="LOST">Perdido</option>
          </select>
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todos los tipos</option>
            <option value="EQUIPMENT">Equipo</option>
            <option value="FURNITURE">Mobiliario</option>
            <option value="VEHICLE">Vehículo</option>
            <option value="IT">TI</option>
            <option value="FACILITY">Instalación</option>
            <option value="OTHER">Otro</option>
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="name">Nombre</option>
            <option value="category">Categoría</option>
            <option value="status">Estado</option>
            <option value="value">Valor</option>
            <option value="purchaseDate">Fecha Compra</option>
            <option value="condition">Condición</option>
          </select>
        </div>
      </div>

      {/* Assets List */}
      <div className="space-y-4">
        {filteredAssets.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay activos</h3>
            <p className="text-gray-600 mb-4">
              {searchQuery || filterCategory !== 'all' || filterStatus !== 'all' || filterType !== 'all'
                ? 'No se encontraron activos con los filtros seleccionados'
                : 'Comienza agregando tu primer activo'}
            </p>
            {!searchQuery && filterCategory === 'all' && filterStatus === 'all' && filterType === 'all' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Agregar Activo
              </button>
            )}
          </div>
        ) : (
          filteredAssets.map(asset => (
            <div key={asset.id} className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{asset.name}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(asset.status)}`}>
                        {getStatusLabel(asset.status)}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(asset.type)}`}>
                        {getTypeLabel(asset.type)}
                      </span>
                      {isMaintenanceDue(asset) && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-700">
                          Mantenimiento Vencido
                        </span>
                      )}
                      {isWarrantyExpiring(asset) && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                          Garantía por Vencer
                        </span>
                      )}
                    </div>
                    
                    <p className="text-gray-600 mb-3">{asset.description}</p>
                    
                    <div className="flex items-center gap-6 text-sm text-gray-500 mb-3">
                      <div className="flex items-center gap-1">
                        <Package className="w-4 h-4" />
                        <span>{asset.category} - {asset.subcategory}</span>
                      </div>
                      {asset.specifications.serialNumber && (
                        <div className="flex items-center gap-1">
                          <span>S/N: {asset.specifications.serialNumber}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <span>Condición: </span>
                        <span className={`font-medium ${getConditionColor(asset.usage.condition)}`}>
                          {getConditionLabel(asset.usage.condition)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>Comprado: {new Date(asset.financial.purchaseDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        <span>Valor: ${(asset.financial.currentValue / 1000).toFixed(0)}K</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Ubicación: {asset.location.building} - {asset.location.floor}</span>
                      </div>
                      {asset.assignedTo && (
                        <div className="flex items-center gap-1">
                          <span>Asignado a: {asset.assignedTo.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/activos/${asset.id}`}
                      className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                      title="Ver detalles"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    <button className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-lg">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => generateQRCode(asset.id)}
                      className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-lg"
                      title="Generar QR Code"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-lg">
                      <Camera className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(asset.id)}
                      className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Financial Info */}
                <div className="grid grid-cols-4 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <div className="font-medium text-gray-900">${(asset.financial.purchaseCost / 1000).toFixed(0)}K</div>
                    <div className="text-gray-600">Costo Compra</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-gray-900">${(asset.financial.currentValue / 1000).toFixed(0)}K</div>
                    <div className="text-gray-600">Valor Actual</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-gray-900">{getDepreciationRate(asset).toFixed(0)}%</div>
                    <div className="text-gray-600">Depreciación</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-gray-900">{asset.financial.usefulLife} años</div>
                    <div className="text-gray-600">Vida Útil</div>
                  </div>
                </div>
                
                {/* Performance Metrics */}
                {asset.usage.performance && (
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="font-medium text-gray-900">{asset.usage.performance.efficiency.toFixed(0)}%</div>
                      <div className="text-gray-600">Eficiencia</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-gray-900">{asset.usage.performance.availability.toFixed(0)}%</div>
                      <div className="text-gray-600">Disponibilidad</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-gray-900">{asset.usage.performance.reliability.toFixed(0)}%</div>
                      <div className="text-gray-600">Confiabilidad</div>
                    </div>
                  </div>
                )}
                
                {/* Maintenance Info */}
                {asset.maintenance.nextMaintenanceDate && (
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-800">
                        Próximo mantenimiento: {new Date(asset.maintenance.nextMaintenanceDate).toLocaleDateString()}
                      </span>
                    </div>
                    {isMaintenanceDue(asset) && (
                      <span className="px-2 py-1 bg-yellow-200 text-yellow-800 text-xs rounded-full">
                        Vencido
                      </span>
                    )}
                  </div>
                )}
                
                {/* Tags */}
                {asset.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {asset.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Asset Modal (placeholder) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Nuevo Activo</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Formulario de creación de activos</p>
              <p className="text-sm text-gray-500 mt-2">Esta funcionalidad estará disponible próximamente</p>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
