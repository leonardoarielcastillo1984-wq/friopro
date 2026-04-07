'use client';

import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { 
  ArrowLeft, Users, Building, ChevronDown, ChevronRight, User, 
  Search, Filter, Download, Maximize2, Minimize2, Edit3,
  Mail, Phone, Briefcase, Calendar, UserPlus
} from 'lucide-react';
import Link from 'next/link';

interface OrgChartEmployee {
  id: string;
  firstName: string;
  lastName: string;
  position?: { name: string };
  department?: { name: string };
  supervisorId: string | null;
  subordinates: { id: string }[];
  email?: string;
  phone?: string;
  hireDate?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'VACANT';
  children?: OrgChartEmployee[];
}

interface LevelConfig {
  color: string;
  bgGradient: string;
  borderColor: string;
  textColor: string;
}

const LEVEL_CONFIG: Record<string, LevelConfig> = {
  CEO: {
    color: '#1e40af',
    bgGradient: '#1e40af',
    borderColor: '#e5e7eb',
    textColor: 'text-gray-900'
  },
  DIRECTOR: {
    color: '#059669',
    bgGradient: '#059669',
    borderColor: '#e5e7eb',
    textColor: 'text-gray-900'
  },
  MANAGER: {
    color: '#ea580c',
    bgGradient: '#ea580c',
    borderColor: '#e5e7eb',
    textColor: 'text-gray-900'
  },
  SUPERVISOR: {
    color: '#7c3aed',
    bgGradient: '#7c3aed',
    borderColor: '#e5e7eb',
    textColor: 'text-gray-900'
  },
  STAFF: {
    color: '#6b7280',
    bgGradient: '#6b7280',
    borderColor: '#e5e7eb',
    textColor: 'text-gray-900'
  }
};

function getEmployeeLevel(employee: OrgChartEmployee, allEmployees: OrgChartEmployee[]): string {
  // Count subordinates to determine hierarchy level
  const directReports = allEmployees.filter(e => e.supervisorId === employee.id).length;
  const totalReports = countTotalReports(employee.id, allEmployees);
  
  if (totalReports >= 10) return 'CEO';
  if (totalReports >= 5) return 'DIRECTOR';
  if (directReports >= 3) return 'MANAGER';
  if (directReports >= 1) return 'SUPERVISOR';
  return 'STAFF';
}

function countTotalReports(employeeId: string, allEmployees: OrgChartEmployee[]): number {
  const direct = allEmployees.filter(e => e.supervisorId === employeeId);
  return direct.length + direct.reduce((sum, e) => sum + countTotalReports(e.id, allEmployees), 0);
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getStatusColor(status: string = 'ACTIVE'): string {
  switch (status) {
    case 'ACTIVE': return 'border-green-500';
    case 'INACTIVE': return 'border-gray-400';
    case 'VACANT': return 'border-yellow-500';
    default: return 'border-gray-400';
  }
}

export default function OrgChartPage() {
  const [orgChart, setOrgChart] = useState<OrgChartEmployee[]>([]);
  const [allEmployees, setAllEmployees] = useState<OrgChartEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [isCompact, setIsCompact] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [hoveredEmployee, setHoveredEmployee] = useState<string | null>(null);

  useEffect(() => {
    loadOrgChart();
  }, []);

  const loadOrgChart = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch<{ orgChart: OrgChartEmployee[] }>('/hr/org-chart');
      setOrgChart(res.orgChart || []);
      setAllEmployees(res.orgChart || []);
      
      // Expand all by default
      const allIds = new Set<string>();
      const collectIds = (nodes: OrgChartEmployee[]) => {
        nodes.forEach(node => {
          allIds.add(node.id);
          if (node.children) collectIds(node.children);
        });
      };
      collectIds(res.orgChart || []);
      setExpanded(allIds);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar organigrama');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const exportToPDF = async () => {
    try {
      // Simple print-based PDF export
      const element = document.getElementById('org-chart-content');
      if (!element) {
        alert('No se encontró el contenido del organigrama');
        return;
      }

      // Show loading state
      const exportBtn = document.querySelector('[title="Exportar a PDF"]') as HTMLButtonElement;
      if (exportBtn) {
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<div class="animate-spin h-5 w-5 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>';
      }

      // Store original styles
      const originalOverflow = document.body.style.overflow;
      
      // Prepare for printing
      document.body.style.overflow = 'visible';
      element.classList.add('print-mode');
      
      // Add print styles
      const printStyles = document.createElement('style');
      printStyles.innerHTML = `
        @media print {
          body { overflow: visible !important; }
          .print-mode { 
            overflow: visible !important; 
            page-break-inside: avoid;
          }
          .no-print { display: none !important; }
        }
      `;
      document.head.appendChild(printStyles);

      // Trigger print dialog
      window.print();

      // Restore styles
      setTimeout(() => {
        document.body.style.overflow = originalOverflow;
        element.classList.remove('print-mode');
        document.head.removeChild(printStyles);
        
        // Restore button
        if (exportBtn) {
          exportBtn.disabled = false;
          exportBtn.innerHTML = '<Download className="h-5 w-5" />';
        }
      }, 1000);

    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error al exportar el PDF. Por favor, intente nuevamente.');
      
      // Restore button
      const exportBtn = document.querySelector('[title="Exportar a PDF"]') as HTMLButtonElement;
      if (exportBtn) {
        exportBtn.disabled = false;
        exportBtn.innerHTML = '<Download className="h-5 w-5" />';
      }
    }
  };

  const departments = useMemo(() => {
    const depts = new Set(allEmployees.map(e => e.department?.name).filter(Boolean));
    return ['ALL', ...Array.from(depts)] as string[];
  }, [allEmployees]);

  const filteredEmployees = useMemo(() => {
    return allEmployees.filter(employee => {
      const matchesSearch = `${employee.firstName} ${employee.lastName} ${employee.position?.name}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDepartment = selectedDepartment === 'ALL' || employee.department?.name === selectedDepartment;
      
      // Check if searching for new employees
      const isNewEmployeeSearch = searchTerm.toLowerCase().includes('nuevo') || searchTerm.toLowerCase().includes('new');
      const employeeIsNew = employee.hireDate && 
        new Date(employee.hireDate) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const matchesNewFilter = !isNewEmployeeSearch || employeeIsNew;
      
      return matchesSearch && matchesDepartment && matchesNewFilter;
    });
  }, [allEmployees, searchTerm, selectedDepartment]);

  const renderNode = (employee: OrgChartEmployee, level: number = 0) => {
    const isExpanded = expanded.has(employee.id);
    const hasChildren = employee.children && employee.children.length > 0;
    const employeeLevel = getEmployeeLevel(employee, allEmployees);
    const levelConfig = LEVEL_CONFIG[employeeLevel];
    const isHovered = hoveredEmployee === employee.id;
    const isNewEmployee = employee.hireDate && 
      new Date(employee.hireDate) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    return (
      <div key={employee.id} className="select-none">
        {/* Connection Line - Minimalist dots */}
        {level > 0 && (
          <div className="relative">
            <div className="absolute left-6 flex items-center" style={{ top: '-12px' }}>
              <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
            </div>
          </div>
        )}

        {/* Employee Card - Minimalist Design */}
        <div
          className={`relative group transition-all duration-200 ${isCompact ? 'mb-3' : 'mb-4'}`}
          style={{ marginLeft: level > 0 ? '48px' : '0' }}
          onMouseEnter={() => setHoveredEmployee(employee.id)}
          onMouseLeave={() => setHoveredEmployee(null)}
        >
          <div
            className={`relative bg-white border rounded-lg shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${
              isCompact ? 'p-3' : 'p-4'
            }`}
            style={{ borderColor: levelConfig.borderColor }}
          >
            {/* Left accent bar */}
            <div 
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{ backgroundColor: levelConfig.color }}
            />

            {/* New Employee Badge */}
            {isNewEmployee && (
              <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                NUEVO
              </div>
            )}

            <div className="flex items-center gap-4">
              {/* Avatar - Minimalist */}
              <div className={`relative ${isCompact ? 'w-10 h-10' : 'w-12 h-12'} bg-gray-100 rounded-full flex items-center justify-center`}>
                <span className={`font-semibold ${isCompact ? 'text-sm' : 'text-base'}`} style={{ color: levelConfig.color }}>
                  {getInitials(employee.firstName, employee.lastName)}
                </span>
                {/* Online Indicator */}
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></div>
              </div>

              {/* Employee Info */}
              <div className="flex-1 min-w-0">
                <h3 className={`font-semibold text-gray-900 ${isCompact ? 'text-sm' : 'text-base'} truncate`}>
                  {employee.firstName} {employee.lastName}
                </h3>
                <p className={`text-gray-600 ${isCompact ? 'text-xs' : 'text-sm'} truncate`}>
                  {employee.position?.name || 'Sin puesto'}
                </p>
                {!isCompact && employee.department?.name && (
                  <p className="text-gray-500 text-xs truncate mt-1">
                    {employee.department.name}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {hasChildren && (
                  <button
                    onClick={() => toggleExpand(employee.id)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                )}
                
                <Link
                  href={`/rrhh/empleados?id=${employee.id}`}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <User className="h-4 w-4 text-gray-500" />
                </Link>
              </div>
            </div>

            {/* Hover Card - Cleaner Design */}
            {isHovered && !isCompact && (
              <div className="absolute top-full left-0 mt-2 p-4 bg-white rounded-lg shadow-lg z-10 min-w-72 border border-gray-100">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="font-semibold text-sm" style={{ color: levelConfig.color }}>
                        {getInitials(employee.firstName, employee.lastName)}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {employee.firstName} {employee.lastName}
                      </h4>
                      <p className="text-sm text-gray-600">{employee.position?.name}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="h-4 w-4" />
                      {employee.email || 'Sin email'}
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="h-4 w-4" />
                      {employee.phone || 'Sin teléfono'}
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Building className="h-4 w-4" />
                      {employee.department?.name || 'Sin departamento'}
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="h-4 w-4" />
                      {employee.hireDate ? new Date(employee.hireDate).toLocaleDateString() : 'Sin fecha'}
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Users className="h-4 w-4" />
                      {employee.subordinates?.length || 0} reportes directos
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Subtree */}
          {isExpanded && hasChildren && (
            <div className="relative mt-4">
              {level === 0 && (
                <div className="absolute left-6 top-0 flex flex-col items-center">
                  <div className="w-px h-full bg-gray-200"></div>
                </div>
              )}
              <div className="space-y-4">
                {employee.children!.map(child => renderNode(child, level + 1))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando organigrama...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error al cargar organigrama</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadOrgChart}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/rrhh" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Organigrama</h1>
                <p className="text-sm text-gray-500">{allEmployees.length} colaboradores</p>
              </div>
            </div>

            <div className="flex items-center gap-3 no-print">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar colaborador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                />
              </div>

              {/* Department Filter */}
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {departments.map(dept => (
                  <option key={dept} value={dept}>
                    {dept === 'ALL' ? 'Todos los departamentos' : dept}
                  </option>
                ))}
              </select>

              {/* New Employees Filter */}
              <button
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  searchTerm.includes('NUEVO') || searchTerm.includes('new')
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => {
                  if (searchTerm.includes('NUEVO')) {
                    setSearchTerm('');
                  } else {
                    setSearchTerm('NUEVO');
                  }
                }}
              >
                👤 Nuevos
              </button>

              {/* View Toggle */}
              <button
                onClick={() => setIsCompact(!isCompact)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title={isCompact ? 'Vista expandida' : 'Vista compacta'}
              >
                {isCompact ? <Maximize2 className="h-5 w-5" /> : <Minimize2 className="h-5 w-5" />}
              </button>

              {/* Export */}
              <button
                onClick={exportToPDF}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors no-print"
                title="Exportar a PDF (Imprimir)"
              >
                <Download className="h-5 w-5" />
              </button>

              {/* Edit Mode */}
              <button
                onClick={() => setShowEdit(!showEdit)}
                className={`p-2 rounded-lg transition-colors no-print ${
                  showEdit ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'
                }`}
                title="Modo edición"
              >
                <Edit3 className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white border-b border-gray-200 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-6 text-sm">
            <span className="text-gray-600 font-medium">Jerarquía:</span>
            {Object.entries(LEVEL_CONFIG).map(([level, config]) => (
              <div key={level} className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded"
                  style={{ background: config.bgGradient }}
                />
                <span className="text-gray-600">{level}</span>
              </div>
            ))}
            <div>
              <p className="text-sm text-gray-500">Jefes Directos</p>
              <p className="text-xl font-bold text-gray-900">
                {orgChart.filter(node => node.subordinates.length > 0).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Org Chart */}
      <div id="org-chart-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Organigrama Organizacional</h2>
          <p className="text-gray-600">
            Generado el {new Date().toLocaleDateString('es-ES', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
            {searchTerm && ` • Filtrado: "${searchTerm}"`}
            {selectedDepartment !== 'ALL' && ` • Departamento: ${selectedDepartment}`}
          </p>
        </div>

        {filteredEmployees.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron colaboradores</h3>
            <p className="text-gray-600">Intenta ajustar los filtros de búsqueda</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEmployees
              .filter(emp => !emp.supervisorId) // Root nodes only
              .map(employee => renderNode(employee, 0))}
          </div>
        )}
      </div>
    </div>
  );
}
