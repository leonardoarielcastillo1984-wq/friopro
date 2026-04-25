'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Plus, Search, Filter, Users, Building, Briefcase, MoreVertical, Edit2, UserCheck, Eye, Trash2, RefreshCw, UserPlus, Shield } from 'lucide-react';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  cuil?: string;
  birthDate?: string;
  email: string;
  phone: string;
  address?: string;
  status: string;
  hireDate: string;
  contractType: string;
  department?: {
    id: string;
    name: string;
  };
  position?: {
    id: string;
    name: string;
  };
  supervisor?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  reportsToPosition?: {
    id: string;
    name: string;
  };
  user?: {
    id: string;
    email: string;
  };
  _count: {
    subordinates: number;
    employeeCompetencies: number;
    trainingAssignments: number;
  };
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCreateDepartmentModal, setShowCreateDepartmentModal] = useState(false);
  const [showCreatePositionModal, setShowCreatePositionModal] = useState(false);
  const [showEditDepartmentModal, setShowEditDepartmentModal] = useState(false);
  const [showEditPositionModal, setShowEditPositionModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<any>(null);
  const [editingPosition, setEditingPosition] = useState<any>(null);
  const [dependencyMode, setDependencyMode] = useState<'EMPLOYEE' | 'POSITION'>('EMPLOYEE');
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedEmployeeForUser, setSelectedEmployeeForUser] = useState<any>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any>({});
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [showActionsMenu, setShowActionsMenu] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // DEBUG: Add console log to see what's happening
  console.log('🔵 EmployeesPage render - employees count:', employees.length);
  console.log('🔵 First employee sample:', employees[0]);

  useEffect(() => {
    loadEmployees();
    loadDepartments();
    loadPositions();
    loadSupervisors();
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const res = await apiFetch<{ roles: any[] }>('/hr/roles');
      setRoles(res?.roles ?? []);
    } catch {
      setRoles([]);
    }
  };

  const loadDepartments = async () => {
    try {
      const res = await apiFetch<{ departments: any[] }>('/hr/departments');
      setDepartments(res?.departments ?? []);
    } catch {
      setDepartments([]);
    }
  };

  const loadPositions = async () => {
    try {
      const res = await apiFetch<{ positions: any[] }>('/hr/positions');
      setPositions(res?.positions ?? []);
    } catch {
      setPositions([]);
    }
  };

  const loadSupervisors = async () => {
    try {
      const res = await apiFetch<{ employees: any[] }>('/hr/employees');
      setSupervisors(res?.employees ?? []);
    } catch {
      setSupervisors([]);
    }
  };

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ employees: any[] }>('/hr/employees');
      setEmployees(res?.employees ?? []);
    } catch {
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const resolveEmployeeDetails = async (employees: any[]) => {
    try {
      const [deptRes, posRes] = await Promise.all([
        apiFetch<{ departments: any[] }>('/hr/departments'),
        apiFetch<{ positions: any[] }>('/hr/positions')
      ]);
      
      const departments = deptRes.departments || [];
      const positions = posRes.positions || [];
      
      const employeesWithDetails = employees.map(employee => ({
        ...employee,
        department: departments.find((d: any) => d.id === employee.departmentId),
        position: positions.find((p: any) => p.id === employee.positionId),
        supervisor: employees.find((e: any) => e.id === employee.supervisorId)
      }));
      
      setEmployees(employeesWithDetails);
      setDepartments(departments);
      setPositions(positions);
    } catch (error) {
      console.error('Error resolving employee details:', error);
    }
  };

  const handleCreateEmployee = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const formEl = event.currentTarget;
      const formData = new FormData(formEl);

      const reportsToPositionIdRaw = (formData.get('reportsToPositionId') as string | null)?.trim() || undefined;
      let supervisorId = (formData.get('supervisorId') as string | null)?.trim() || undefined;
      const reportsToPositionId = dependencyMode === 'POSITION' ? reportsToPositionIdRaw : undefined;

      if (dependencyMode === 'POSITION' && reportsToPositionId) {
        const occupant = supervisors.find((s: any) => s?.status === 'ACTIVE' && s?.deletedAt == null && s?.positionId === reportsToPositionId);
        if (occupant?.id) supervisorId = occupant.id;
      }

      // Helper to convert DD/MM/YYYY or ISO to ISO date string
      const toISODate = (val: string | null) => {
        if (!val) return undefined;
        const str = val.trim();
        if (str.includes('/')) {
          const [d, m, y] = str.split('/');
          return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        return str;
      };

      const employeeData: any = {
        firstName: formData.get('firstName') as string,
        lastName: formData.get('lastName') as string,
        dni: formData.get('dni') as string,
        birthDate: toISODate(formData.get('birthDate') as string),
        address: formData.get('address') as string,
        phone: formData.get('phone') as string,
        email: formData.get('email') as string,
        cuil: (formData.get('cuil') as string | null)?.trim() || undefined,
        hireDate: toISODate(formData.get('hireDate') as string),
        contractType: formData.get('contractType') as string,
        departmentId: (formData.get('departmentId') as string | null)?.trim() || undefined,
        positionId: (formData.get('positionId') as string | null)?.trim() || undefined,
        supervisorId,
        reportsToPositionId,
        location: (formData.get('location') as string | null)?.trim() || undefined,
        notes: (formData.get('notes') as string | null)?.trim() || undefined,
      };

      // Remove undefined/null fields to avoid sending them to Prisma
      Object.keys(employeeData).forEach(key => {
        if (employeeData[key] === undefined || employeeData[key] === null || employeeData[key] === '') {
          delete employeeData[key];
        }
      });

      // Use PATCH if editing an existing employee, POST for new employee
      if (selectedEmployee?.id) {
        await apiFetch(`/hr/employees/${selectedEmployee.id}`, {
          method: 'PATCH',
          json: employeeData
        });
      } else {
        await apiFetch('/hr/employees', {
          method: 'POST',
          json: employeeData
        });
      }

      // Close modals and reload employees
      setShowCreateModal(false);
      setShowEditModal(false);
      setSelectedEmployee(null);
      loadEmployees();

      // Reset form
      formEl?.reset();

    } catch (error) {
      console.error('Error saving employee:', error);
      alert('Error al guardar empleado: ' + (error as Error).message);
    }
  };

  const handleCreateDepartment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    try {
      const formData = new FormData(event.currentTarget);
      const departmentData = {
        name: formData.get('name') as string,
        description: (formData.get('description') as string | null)?.trim() || undefined,
      };

      console.log('[empleados] About to create department:', departmentData);
      await apiFetch('/hr/departments', {
        method: 'POST',
        json: departmentData
      });
      console.log('[empleados] Department created successfully');

      setShowCreateDepartmentModal(false);
      loadDepartments();
      event.currentTarget.reset();

    } catch (error) {
      console.error('Error creating department:', error);
      alert('Error al crear departamento: ' + (error as Error).message);
    }
  };

  const handleEditDepartment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingDepartment) return;

    try {
      const formData = new FormData(event.currentTarget);
      const departmentData = {
        name: formData.get('name') as string,
        description: (formData.get('description') as string | null)?.trim() || undefined,
      };

      await apiFetch(`/hr/departments/${editingDepartment.id}`, {
        method: 'PUT',
        json: departmentData
      });

      setShowEditDepartmentModal(false);
      setEditingDepartment(null);
      loadDepartments();
    } catch (error) {
      console.error('Error updating department:', error);
      alert('Error al actualizar departamento: ' + (error as Error).message);
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este departamento?')) return;

    try {
      await apiFetch(`/hr/departments/${id}`, { method: 'DELETE' });
      loadDepartments();
    } catch (error) {
      console.error('Error deleting department:', error);
      alert('Error al eliminar departamento: ' + (error as Error).message);
    }
  };

  const startEditDepartment = (dept: any) => {
    setEditingDepartment(dept);
    setShowEditDepartmentModal(true);
  };

  const handleEditPosition = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingPosition) return;

    try {
      const formData = new FormData(event.currentTarget);
      const positionData = {
        name: formData.get('name') as string,
        code: (formData.get('code') as string | null)?.trim() || undefined,
        category: (formData.get('category') as string | null)?.trim() || undefined,
        level: (formData.get('level') as string | null)?.trim() || undefined,
        objective: (formData.get('objective') as string | null)?.trim() || undefined,
        responsibilities: formData.get('responsibilities') ? (formData.get('responsibilities') as string).split('\n').filter(r => r.trim()) : [],
        tasks: formData.get('tasks') ? (formData.get('tasks') as string).split('\n').filter(t => t.trim()) : [],
        requirements: formData.get('requirements') ? (formData.get('requirements') as string).split('\n').filter(r => r.trim()) : [],
        kpis: formData.get('kpis') ? (formData.get('kpis') as string).split('\n').filter(k => k.trim()) : [],
        risks: formData.get('risks') ? (formData.get('risks') as string).split('\n').filter(r => r.trim()) : [],
      };

      await apiFetch(`/hr/positions/${editingPosition.id}`, {
        method: 'PUT',
        json: positionData
      });

      setShowEditPositionModal(false);
      setEditingPosition(null);
      loadPositions();
    } catch (error) {
      console.error('Error updating position:', error);
      alert('Error al actualizar puesto: ' + (error as Error).message);
    }
  };

  const handleDeletePosition = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este puesto?')) return;

    try {
      await apiFetch(`/hr/positions/${id}`, { method: 'DELETE' });
      loadPositions();
    } catch (error) {
      console.error('Error deleting position:', error);
      alert('Error al eliminar puesto: ' + (error as Error).message);
    }
  };

  const startEditPosition = (pos: any) => {
    setEditingPosition(pos);
    setShowEditPositionModal(true);
  };

  const startCreateUser = (employee: any) => {
    setSelectedEmployeeForUser(employee);
    setPermissions({}); // Reset permissions for new user
    setShowCreateUserModal(true);
  };

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedEmployeeForUser) return;

    try {
      const formData = new FormData(event.currentTarget);
      const userData = {
        email: formData.get('email') as string,
        password: formData.get('password') as string,
      };

      await apiFetch(`/hr/employees/${selectedEmployeeForUser.id}/users`, {
        method: 'POST',
        json: userData
      });

      setShowCreateUserModal(false);
      await loadEmployees(); // Refresh to update access badge
      
      // Find the updated employee with user data
      const updatedEmployee = employees.find(e => e.id === selectedEmployeeForUser.id);
      if (updatedEmployee) {
        setSelectedEmployeeForUser(updatedEmployee);
      }
      
      // Open permissions modal directly after creating user
      setShowPermissionsModal(true);
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Error al crear usuario: ' + (error as Error).message);
    }
  };

  const togglePermission = (module: string, action: 'view' | 'edit') => {
    setPermissions((prev: any) => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: !prev[module]?.[action]
      }
    }));
  };

  const handleSavePermissions = async () => {
    if (!selectedEmployeeForUser) return;
    
    try {
      // Transform permissions from { module: { view: bool, edit: bool } } to { module: 'none'|'view'|'edit' }
      const transformedPermissions: Record<string, 'none' | 'view' | 'edit'> = {};
      
      modules.forEach((mod) => {
        const perms = permissions[mod.key] || { view: false, edit: false };
        if (perms.edit) {
          transformedPermissions[mod.key] = 'edit';
        } else if (perms.view) {
          transformedPermissions[mod.key] = 'view';
        } else {
          transformedPermissions[mod.key] = 'none';
        }
      });
      
      // Save to localStorage
      localStorage.setItem(`permissions_${selectedEmployeeForUser.id}`, JSON.stringify(transformedPermissions));
      
      // Close modal
      setShowPermissionsModal(false);
      setSelectedEmployeeForUser(null);
      setPermissions({});
    } catch (error) {
      console.error('Error saving permissions:', error);
      alert('Error al guardar permisos: ' + (error as Error).message);
    }
  };

  const loadEmployeePermissions = async (employee: any) => {
    if (!employee?.user) {
      const defaultPerms: any = {};
      modules.forEach((mod) => {
        defaultPerms[mod.key] = { view: false, edit: false };
      });
      setPermissions(defaultPerms);
      return;
    }
    
    try {
      // Load from localStorage
      const stored = localStorage.getItem(`permissions_${employee.id}`);
      const apiPerms = stored ? JSON.parse(stored) : {};
      
      // Convert to UI format
      const perms: any = {};
      modules.forEach((mod) => {
        const level = apiPerms[mod.key] || 'none';
        perms[mod.key] = {
          view: level === 'view' || level === 'edit',
          edit: level === 'edit'
        };
      });
      
      setPermissions(perms);
    } catch (err) {
      const defaultPerms: any = {};
      modules.forEach((mod) => {
        defaultPerms[mod.key] = { view: false, edit: false };
      });
      setPermissions(defaultPerms);
    }
  };

  const modules = [
    { key: 'dashboard', label: 'Inicio', icon: '🏠' },
    { key: 'panel', label: 'Panel General', icon: '📊' },
    { key: 'documents', label: 'Documentos', icon: '📄' },
    { key: 'normativos', label: 'Normativos', icon: '📚' },
    { key: 'audit', label: 'Auditoría IA', icon: '🤖' },
    { key: 'no-conformidades', label: 'No Conformidades', icon: '⚠️' },
    { key: 'riesgos', label: 'Riesgos', icon: '🛡️' },
    { key: 'indicadores', label: 'Indicadores', icon: '📈' },
    { key: 'capacitaciones', label: 'Capacitaciones', icon: '🎓' },
    { key: 'rrhh', label: 'RRHH', icon: '👥' },
    { key: 'reportes', label: 'Reportes', icon: '📋' },
    { key: 'notificaciones', label: 'Notificaciones', icon: '🔔' },
    { key: 'integraciones', label: 'Integraciones', icon: '🔧' },
    { key: 'configuracion', label: 'Configuración', icon: '⚙️' },
  ];

  const handleCreatePosition = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log('🔵 Creating position...');
    
    try {
      const formData = new FormData(event.currentTarget);
      const positionData = {
        name: formData.get('name') as string,
        code: (formData.get('code') as string | null)?.trim() || undefined,
        category: (formData.get('category') as string | null)?.trim() || undefined,
        level: (formData.get('level') as string | null)?.trim() || undefined,
        objective: (formData.get('objective') as string | null)?.trim() || undefined,
        responsibilities: formData.get('responsibilities') ? (formData.get('responsibilities') as string).split('\n').filter(r => r.trim()) : [],
        tasks: formData.get('tasks') ? (formData.get('tasks') as string).split('\n').filter(t => t.trim()) : [],
        requirements: formData.get('requirements') ? (formData.get('requirements') as string).split('\n').filter(r => r.trim()) : [],
        kpis: formData.get('kpis') ? (formData.get('kpis') as string).split('\n').filter(k => k.trim()) : [],
        risks: formData.get('risks') ? (formData.get('risks') as string).split('\n').filter(r => r.trim()) : [],
      };

      console.log('🔵 Position data:', positionData);

      await apiFetch('/hr/positions', {
        method: 'POST',
        json: positionData
      });

      setShowCreatePositionModal(false);
      loadPositions();
      event.currentTarget.reset();

    } catch (error) {
      console.error('Error creating position:', error);
      alert('Error al crear puesto: ' + (error as Error).message);
    }
  };

  const filteredEmployees = employees.filter(employee => 
    employee.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.dni.includes(searchTerm) ||
    employee.position?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.department?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'INACTIVE': return 'bg-gray-100 text-gray-800';
      case 'ON_LEAVE': return 'bg-yellow-100 text-yellow-800';
      case 'TERMINATED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getContractTypeColor = (type: string) => {
    switch (type) {
      case 'PERMANENT': return 'bg-blue-100 text-blue-800';
      case 'TEMPORARY': return 'bg-orange-100 text-orange-800';
      case 'CONTRACTOR': return 'bg-purple-100 text-purple-800';
      case 'INTERN': return 'bg-pink-100 text-pink-800';
      case 'PART_TIME': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empleados</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => loadEmployees()}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nuevo Empleado
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Buscar por nombre, email, DNI, puesto o departamento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          <Filter className="h-4 w-4" />
          Filtros
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Empleados</p>
              <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Activos</p>
              <p className="text-2xl font-bold text-green-600">
                {employees.filter(e => e.status === 'ACTIVE').length}
              </p>
            </div>
            <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
              <div className="h-4 w-4 bg-green-500 rounded-full" />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Departamentos</p>
              <p className="text-2xl font-bold text-gray-900">{departments.length}</p>
            </div>
            <Building className="h-8 w-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Puestos</p>
              <p className="text-2xl font-bold text-gray-900">{positions.length}</p>
            </div>
            <Briefcase className="h-8 w-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="overflow-x-visible">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Empleado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contacto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Puesto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Departamento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contrato
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEmployees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {employee.firstName} {employee.lastName}
                        </div>
                        <div className="text-sm text-gray-500">DNI: {employee.dni}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{employee.email}</div>
                    <div className="text-sm text-gray-500">{employee.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {employee.position?.name || 'Sin asignar'}
                    </div>
                    {employee.supervisor && (
                      <div className="text-sm text-gray-500">
                        Supervisor: {employee.supervisor.firstName} {employee.supervisor.lastName}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {employee.department?.name || 'Sin asignar'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(employee.status)}`}>
                      {employee.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getContractTypeColor(employee.contractType)}`}>
                      {employee.contractType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      {/* Direct action buttons - always visible */}
                      {employee.user ? (
                        <>
                          <button
                            onClick={async () => {
                              setSelectedEmployeeForUser(employee);
                              await loadEmployeePermissions(employee);
                              setShowPermissionsModal(true);
                            }}
                            className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                            title="Gestionar permisos"
                          >
                            Permisos
                          </button>
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                            Activo
                          </span>
                        </>
                      ) : (
                        <button
                          onClick={() => startCreateUser(employee)}
                          className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                          title="Dar acceso al sistema"
                        >
                          Dar Acceso
                        </button>
                      )}
                      
                      {/* Dropdown menu for other actions */}
                      <div className="relative ml-2">
                        <button
                          onClick={() => {
                            setSelectedEmployee(employee);
                            setShowActionsMenu(employee.id);
                          }}
                          className="text-gray-400 hover:text-gray-600 p-1"
                        >
                          <MoreVertical className="h-5 w-5" />
                        </button>
                        
                        {showActionsMenu === employee.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                            <div className="py-1">
                              <button
                                onClick={() => {
                                  setShowActionsMenu(null);
                                  setSelectedEmployee(employee);
                                  setShowEditModal(true);
                                }}
                                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
                              >
                                <Edit2 className="h-4 w-4 mr-2" />
                                Editar
                              </button>
                              <button
                                onClick={() => {
                                  setShowActionsMenu(null);
                                  setSelectedEmployee(employee);
                                  setShowStatusModal(true);
                                }}
                                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
                              >
                                <UserCheck className="h-4 w-4 mr-2" />
                                Cambiar Estado
                              </button>
                              <button
                                onClick={() => {
                                  setShowActionsMenu(null);
                                  setSelectedEmployee(employee);
                                  setShowDetailsModal(true);
                                }}
                                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Ver Detalles
                              </button>
                              <div className="border-t border-gray-100"></div>
                              <button
                                onClick={() => {
                                  setShowActionsMenu(null);
                                  setSelectedEmployee(employee);
                                  setShowDeleteModal(true);
                                }}
                                className="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredEmployees.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No se encontraron empleados</p>
            <p className="text-sm text-gray-400 mt-1">
              {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Crea tu primer empleado para comenzar'}
            </p>
          </div>
        )}
      </div>

      {/* Create Employee Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Nuevo Empleado</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            {/* Employee Creation Form */}
            <form onSubmit={handleCreateEmployee} className="space-y-6">
              {/* Personal Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Información Personal</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Juan"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Apellido *
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Pérez"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      DNI *
                    </label>
                    <input
                      type="text"
                      name="dni"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="12345678"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CUIL
                    </label>
                    <input
                      type="text"
                      name="cuil"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="20-12345678-9"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha de Nacimiento *
                    </label>
                    <input
                      type="date"
                      name="birthDate"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="juan.perez@empresa.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono *
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+54 11 1234-5678"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dirección *
                    </label>
                    <input
                      type="text"
                      name="address"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Av. Principal 123, Buenos Aires"
                    />
                  </div>
                </div>
              </div>

              {/* Work Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Información Laboral</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Departamento
                    </label>
                    <div className="flex gap-2">
                      <select
                        name="departmentId"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Seleccionar departamento</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          console.log('🔵 Open department modal clicked!');
                          setShowCreateDepartmentModal(true);
                        }}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        title="Crear nuevo departamento"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Departments List */}
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Departamentos existentes</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {departments.map((dept) => (
                        <div key={dept.id} className="flex items-center justify-between p-2 border border-gray-200 rounded">
                          <span className="text-sm text-gray-900">{dept.name}</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEditDepartment(dept)}
                              className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDepartment(dept.id)}
                              className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Puesto
                    </label>
                    <div className="flex gap-2">
                      <select
                        name="positionId"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Seleccionar puesto</option>
                        {positions.map((pos) => (
                          <option key={pos.id} value={pos.id}>
                            {pos.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowCreatePositionModal(true)}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        title="Crear nuevo puesto"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Positions List */}
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Puestos existentes</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {positions.map((pos) => (
                        <div key={pos.id} className="flex items-center justify-between p-2 border border-gray-200 rounded">
                          <span className="text-sm text-gray-900">{pos.name}</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEditPosition(pos)}
                              className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePosition(pos.id)}
                              className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dependencia (Supervisor)
                    </label>

                    <div className="flex gap-4 mb-2">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="dependencyMode"
                          value="EMPLOYEE"
                          checked={dependencyMode === 'EMPLOYEE'}
                          onChange={() => setDependencyMode('EMPLOYEE')}
                        />
                        Persona
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="dependencyMode"
                          value="POSITION"
                          checked={dependencyMode === 'POSITION'}
                          onChange={() => setDependencyMode('POSITION')}
                        />
                        Puesto
                      </label>
                    </div>

                    {dependencyMode === 'POSITION' && (
                      <select
                        name="reportsToPositionId"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                      >
                        <option value="">Seleccionar puesto superior</option>
                        {positions.map((pos: any) => (
                          <option key={pos.id} value={pos.id}>
                            {pos.name}
                          </option>
                        ))}
                      </select>
                    )}

                    <select
                      name="supervisorId"
                      disabled={dependencyMode === 'POSITION'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar dependencia</option>
                      {supervisors.map((supervisor) => (
                        <option key={supervisor.id} value={supervisor.id}>
                          {supervisor.firstName} {supervisor.lastName} - {supervisor.position?.name || 'Sin puesto'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Contrato *
                    </label>
                    <select
                      name="contractType"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar tipo</option>
                      <option value="PERMANENT">Permanente</option>
                      <option value="TEMPORARY">Temporal</option>
                      <option value="CONTRACTOR">Contratista</option>
                      <option value="INTERN">Pasante</option>
                      <option value="PART_TIME">Medio Tiempo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha de Ingreso *
                    </label>
                    <input
                      type="date"
                      name="hireDate"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ubicación
                    </label>
                    <input
                      type="text"
                      name="location"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Oficina Central - Buenos Aires"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas Adicionales
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Información adicional relevante sobre el empleado..."
                />
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Crear Empleado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Details Modal */}
      {showDetailsModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Detalles de {selectedEmployee.firstName} {selectedEmployee.lastName}
              </h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Información Personal</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Nombre Completo</label>
                    <p className="text-gray-900">{selectedEmployee.firstName} {selectedEmployee.lastName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">DNI</label>
                    <p className="text-gray-900">{selectedEmployee.dni}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="text-gray-900">{selectedEmployee.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Teléfono</label>
                    <p className="text-gray-900">{selectedEmployee.phone}</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Información Laboral</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Puesto</label>
                    <p className="text-gray-900">{selectedEmployee.position?.name || 'Sin asignar'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Departamento</label>
                    <p className="text-gray-900">{selectedEmployee.department?.name || 'Sin asignar'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Tipo de Contrato</label>
                    <p className="text-gray-900">{selectedEmployee.contractType}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Fecha de Ingreso</label>
                    <p className="text-gray-900">{new Date(selectedEmployee.hireDate).toLocaleDateString('es-ES')}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{selectedEmployee._count.subordinates}</div>
                  <div className="text-sm text-gray-500">Subordinados</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{selectedEmployee._count.employeeCompetencies}</div>
                  <div className="text-sm text-gray-500">Competencias</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">{selectedEmployee._count.trainingAssignments}</div>
                  <div className="text-sm text-gray-500">Capacitaciones</div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Department Modal */}
      {showCreateDepartmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Nuevo Departamento</h2>
              <button
                onClick={() => setShowCreateDepartmentModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <form id="department-form" onSubmit={handleCreateDepartment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Departamento *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Tecnología, Recursos Humanos"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Descripción del departamento..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateDepartmentModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    console.log('🔵 Create Department button clicked!');
                    
                    const form = document.querySelector('#department-form') as HTMLFormElement;
                    if (!form) {
                      console.error('❌ Form not found!');
                      return;
                    }

                    const formData = new FormData(form);
                    const departmentData = {
                      name: formData.get('name') as string,
                      description: (formData.get('description') as string | null)?.trim() || undefined,
                    };

                    console.log('🔵 Department data:', departmentData);
                    console.log('🔵 Sending JSON:', JSON.stringify(departmentData));

                    try {
                      const response = await apiFetch('/hr/departments', {
                        method: 'POST',
                        json: departmentData
                      });

                      console.log('✅ Department created successfully:', response);
                      setShowCreateDepartmentModal(false);
                      loadDepartments();
                      form.reset();
                    } catch (error) {
                      console.error('❌ Error creating department:', error);
                      alert('Error al crear departamento: ' + (error as Error).message);
                    }
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Crear Departamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Department Modal */}
      {showEditDepartmentModal && editingDepartment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Editar Departamento</h2>
              <button
                onClick={() => { setShowEditDepartmentModal(false); setEditingDepartment(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form id="department-edit-form" onSubmit={handleEditDepartment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Departamento *
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingDepartment.name}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Recursos Humanos"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  name="description"
                  defaultValue={editingDepartment.description || ''}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Descripción opcional del departamento"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => { setShowEditDepartmentModal(false); setEditingDepartment(null); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Position Modal */}
      {showCreatePositionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Nuevo Puesto</h2>
              <button
                onClick={() => setShowCreatePositionModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <form id="position-form" onSubmit={handleCreatePosition} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del Puesto *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Desarrollador Senior"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Código
                  </label>
                  <input
                    type="text"
                    name="code"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: DEV-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoría
                  </label>
                  <input
                    type="text"
                    name="category"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Técnica, Administrativa"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nivel
                  </label>
                  <input
                    type="text"
                    name="level"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Senior, Junior, Gerencial"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Objetivo del Puesto
                </label>
                <textarea
                  name="objective"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Objetivo principal del puesto..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Responsabilidades (una por línea)
                </label>
                <textarea
                  name="responsibilities"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Responsabilidad 1&#10;Responsabilidad 2&#10;Responsabilidad 3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tareas Principales (una por línea)
                </label>
                <textarea
                  name="tasks"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Tarea 1&#10;Tarea 2&#10;Tarea 3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Requisitos (uno por línea)
                </label>
                <textarea
                  name="requirements"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Requisito 1&#10;Requisito 2&#10;Requisito 3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  KPIs (uno por línea)
                </label>
                <textarea
                  name="kpis"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="KPI 1&#10;KPI 2&#10;KPI 3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Riesgos Asociados (uno por línea)
                </label>
                <textarea
                  name="risks"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Riesgo 1&#10;Riesgo 2&#10;Riesgo 3"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreatePositionModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    console.log('🔵 Create Position button clicked!');
                    
                    const form = document.querySelector('#position-form') as HTMLFormElement;
                    if (!form) {
                      console.error('❌ Form not found!');
                      return;
                    }

                    const formData = new FormData(form);
                    const positionData = {
                      name: formData.get('name') as string,
                      code: (formData.get('code') as string | null)?.trim() || undefined,
                      category: (formData.get('category') as string | null)?.trim() || undefined,
                      level: (formData.get('level') as string | null)?.trim() || undefined,
                      objective: (formData.get('objective') as string | null)?.trim() || undefined,
                      responsibilities: formData.get('responsibilities') ? (formData.get('responsibilities') as string).split('\n').filter(r => r.trim()) : [],
                      tasks: formData.get('tasks') ? (formData.get('tasks') as string).split('\n').filter(t => t.trim()) : [],
                      requirements: formData.get('requirements') ? (formData.get('requirements') as string).split('\n').filter(r => r.trim()) : [],
                      kpis: formData.get('kpis') ? (formData.get('kpis') as string).split('\n').filter(k => k.trim()) : [],
                      risks: formData.get('risks') ? (formData.get('risks') as string).split('\n').filter(r => r.trim()) : [],
                    };

                    console.log('🔵 Position data:', positionData);

                    try {
                      const result = await apiFetch('/hr/positions', {
                        method: 'POST',
                        json: positionData,
                      });

                      console.log('✅ Position created:', result);

                      setShowCreatePositionModal(false);
                      loadPositions();
                      form.reset();

                    } catch (error) {
                      console.error('❌ Error creating position:', error);
                      alert('Error al crear puesto: ' + (error as Error).message);
                    }
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Crear Puesto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Editar Empleado</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreateEmployee} className="space-y-6">
              {/* Personal Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Información Personal</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      defaultValue={selectedEmployee.firstName}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Juan"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Apellido *
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      defaultValue={selectedEmployee.lastName}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Pérez"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      DNI *
                    </label>
                    <input
                      type="text"
                      name="dni"
                      defaultValue={selectedEmployee.dni}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="12345678"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CUIL
                    </label>
                    <input
                      type="text"
                      name="cuil"
                      defaultValue={selectedEmployee.cuil || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="20-12345678-9"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha de Nacimiento *
                    </label>
                    <input
                      type="date"
                      name="birthDate"
                      defaultValue={selectedEmployee.birthDate ? new Date(selectedEmployee.birthDate).toISOString().split('T')[0] : ''}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      name="email"
                      defaultValue={selectedEmployee.email}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="juan.perez@empresa.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono *
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      defaultValue={selectedEmployee.phone}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+54 11 1234-5678"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dirección *
                    </label>
                    <input
                      type="text"
                      name="address"
                      defaultValue={selectedEmployee.address}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Calle 123, Ciudad"
                    />
                  </div>
                </div>
              </div>

              {/* Work Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Información Laboral</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Departamento *
                    </label>
                    <div className="flex gap-2">
                      <select
                        name="departmentId"
                        defaultValue={selectedEmployee.department?.id || ''}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Seleccionar departamento</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowCreateDepartmentModal(true)}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        title="Crear nuevo departamento"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Puesto *
                    </label>
                    <div className="flex gap-2">
                      <select
                        name="positionId"
                        defaultValue={selectedEmployee.position?.id || ''}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Seleccionar puesto</option>
                        {positions.map((pos) => (
                          <option key={pos.id} value={pos.id}>
                            {pos.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowCreatePositionModal(true)}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        title="Crear nuevo puesto"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Contrato *
                    </label>
                    <select
                      name="contractType"
                      defaultValue={selectedEmployee.contractType}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="FULL_TIME">Tiempo Completo</option>
                      <option value="PART_TIME">Medio Tiempo</option>
                      <option value="CONTRACTOR">Contratista</option>
                      <option value="INTERN">Pasante</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha de Ingreso *
                    </label>
                    <input
                      type="date"
                      name="hireDate"
                      defaultValue={selectedEmployee.hireDate ? new Date(selectedEmployee.hireDate).toISOString().split('T')[0] : ''}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Dependency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dependencia (Supervisor)
                </label>

                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="dependencyMode"
                      value="EMPLOYEE"
                      checked={dependencyMode === 'EMPLOYEE'}
                      onChange={() => setDependencyMode('EMPLOYEE')}
                    />
                    Persona
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="dependencyMode"
                      value="POSITION"
                      checked={dependencyMode === 'POSITION'}
                      onChange={() => setDependencyMode('POSITION')}
                    />
                    Puesto
                  </label>
                </div>

                {dependencyMode === 'EMPLOYEE' ? (
                  <select
                    name="supervisorId"
                    defaultValue={selectedEmployee.supervisor?.id || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar supervisor</option>
                    {supervisors.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.firstName} {sup.lastName} - {sup.position?.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    name="reportsToPositionId"
                    defaultValue={selectedEmployee.reportsToPosition?.id || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar puesto superior</option>
                    {positions.map((pos) => (
                      <option key={pos.id} value={pos.id}>
                        {pos.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Status Modal */}
      {showStatusModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Cambiar Estado</h2>
              <button
                onClick={() => setShowStatusModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <form name="status-form" className="space-y-4">
              <p className="text-gray-600">
                Selecciona el nuevo estado para <strong>{selectedEmployee.firstName} {selectedEmployee.lastName}</strong>
              </p>
              
              <div className="space-y-2">
                <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="status"
                    value="ACTIVE"
                    defaultChecked={selectedEmployee.status === 'ACTIVE'}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium">Activo</div>
                    <div className="text-sm text-gray-500">Empleado trabajando actualmente</div>
                  </div>
                </label>
                
                <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="status"
                    value="INACTIVE"
                    defaultChecked={selectedEmployee.status === 'INACTIVE'}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium">Inactivo</div>
                    <div className="text-sm text-gray-500">Empleado no activo temporalmente</div>
                  </div>
                </label>
                
                <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="status"
                    value="TERMINATED"
                    defaultChecked={selectedEmployee.status === 'TERMINATED'}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium">Dado de baja</div>
                    <div className="text-sm text-gray-500">Empleado ha dejado la empresa</div>
                  </div>
                </label>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const form = document.querySelector('form[name="status-form"]') as HTMLFormElement;
                    const selectedStatus = form.querySelector('input[name="status"]:checked') as HTMLInputElement;
                    const newStatus = selectedStatus?.value;
                    
                    console.log('🔵 Selected status:', newStatus);
                    
                    if (!newStatus) {
                      alert('Por favor selecciona un estado');
                      return;
                    }
                    
                    setIsUpdating(true);
                    
                    try {
                      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/hr/employees/${selectedEmployee.id}/status`, {
                        method: 'PATCH',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ status: newStatus }),
                      });
                      
                      console.log('🔵 Response status:', response.status);
                      const result = await response.json();
                      console.log('🔵 Response:', result);
                      
                      if (response.ok) {
                        // Close modal first
                        setShowStatusModal(false);
                        // Then reload data
                        await loadEmployees();
                        // Show success message
                        alert('Estado actualizado correctamente');
                      } else {
                        throw new Error(result.error || 'Error al actualizar estado');
                      }
                    } catch (error) {
                      console.error('❌ Error updating status:', error);
                      alert('Error al actualizar estado: ' + (error as Error).message);
                    } finally {
                      setIsUpdating(false);
                    }
                  }}
                  disabled={isUpdating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdating ? 'Actualizando...' : 'Cambiar Estado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Eliminar Empleado</h2>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              
              <div className="text-center">
                <p className="text-gray-900 font-medium">¿Estás seguro?</p>
                <p className="text-gray-600 mt-1">
                  Estás por eliminar a <strong>{selectedEmployee.firstName} {selectedEmployee.lastName}</strong>. 
                  Esta acción no se puede deshacer.
                </p>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/hr/employees/${selectedEmployee.id}`, {
                        method: 'DELETE',
                      });
                      
                      if (response.ok) {
                        setShowDeleteModal(false);
                        loadEmployees();
                        alert('Empleado eliminado correctamente');
                      } else {
                        throw new Error('Error al eliminar empleado');
                      }
                    } catch (error) {
                      console.error('Error deleting employee:', error);
                      alert('Error al eliminar empleado');
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateUserModal && selectedEmployeeForUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Dar Acceso: {selectedEmployeeForUser.firstName} {selectedEmployeeForUser.lastName}
              </h2>
              <button
                onClick={() => { setShowCreateUserModal(false); setSelectedEmployeeForUser(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form id="create-user-form" onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="empleado@empresa.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña *
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Después de crear el usuario</strong>, podrás asignar permisos específicos para cada módulo del sistema.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => { setShowCreateUserModal(false); setSelectedEmployeeForUser(null); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Crear Usuario y Configurar Permisos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermissionsModal && selectedEmployeeForUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-4xl w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Permisos: {selectedEmployeeForUser.firstName} {selectedEmployeeForUser.lastName}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Configurá el acceso a cada módulo del sistema
                </p>
              </div>
              <button
                onClick={() => { setShowPermissionsModal(false); setSelectedEmployeeForUser(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* Legend */}
            <div className="flex gap-6 mb-6 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-400"></span>
                <span className="text-sm text-gray-700">Sin acceso</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-400"></span>
                <span className="text-sm text-gray-700">Solo ver</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-400"></span>
                <span className="text-sm text-gray-700">Ver y editar</span>
              </div>
            </div>

            <div className="space-y-3">
              {modules.map((module) => {
                const currentAccess = permissions[module.key]?.access || 'none';
                return (
                  <div key={module.key} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{module.icon}</span>
                        <span className="font-medium text-gray-900">{module.label}</span>
                      </div>
                      
                      <div className="flex gap-2">
                        <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                          currentAccess === 'none' ? 'bg-red-100 border-2 border-red-400' : 'bg-gray-100 hover:bg-gray-200'
                        }`}>
                          <input
                            type="radio"
                            name={`access-${module.key}`}
                            checked={currentAccess === 'none'}
                            onChange={() => setPermissions((prev: any) => ({
                              ...prev,
                              [module.key]: { access: 'none' }
                            }))}
                            className="w-4 h-4 text-red-600"
                          />
                          <span className="text-sm font-medium">Sin acceso</span>
                        </label>

                        <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                          currentAccess === 'view' ? 'bg-blue-100 border-2 border-blue-400' : 'bg-gray-100 hover:bg-gray-200'
                        }`}>
                          <input
                            type="radio"
                            name={`access-${module.key}`}
                            checked={currentAccess === 'view'}
                            onChange={() => setPermissions((prev: any) => ({
                              ...prev,
                              [module.key]: { access: 'view' }
                            }))}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-sm font-medium">Ver</span>
                        </label>

                        <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                          currentAccess === 'edit' ? 'bg-green-100 border-2 border-green-400' : 'bg-gray-100 hover:bg-gray-200'
                        }`}>
                          <input
                            type="radio"
                            name={`access-${module.key}`}
                            checked={currentAccess === 'edit'}
                            onChange={() => setPermissions((prev: any) => ({
                              ...prev,
                              [module.key]: { access: 'edit' }
                            }))}
                            className="w-4 h-4 text-green-600"
                          />
                          <span className="text-sm font-medium">Editar</span>
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 mt-6">
              <button
                type="button"
                onClick={() => { setShowPermissionsModal(false); setSelectedEmployeeForUser(null); }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Guardar Permisos
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Position Modal */}
      {showEditPositionModal && editingPosition && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Editar Puesto</h2>
              <button
                onClick={() => { setShowEditPositionModal(false); setEditingPosition(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form id="position-edit-form" onSubmit={handleEditPosition} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del Puesto *
                  </label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingPosition.name}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Desarrollador Senior"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Código
                  </label>
                  <input
                    type="text"
                    name="code"
                    defaultValue={editingPosition.code || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: DEV-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoría
                  </label>
                  <input
                    type="text"
                    name="category"
                    defaultValue={editingPosition.category || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Técnico"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nivel
                  </label>
                  <input
                    type="text"
                    name="level"
                    defaultValue={editingPosition.level || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Senior"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Objetivo del Puesto
                </label>
                <textarea
                  name="objective"
                  defaultValue={editingPosition.objective || ''}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Objetivo principal del puesto"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Responsabilidades (una por línea)
                </label>
                <textarea
                  name="responsibilities"
                  defaultValue={editingPosition.responsibilities?.join('\n') || ''}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Una responsabilidad por línea"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tareas (una por línea)
                </label>
                <textarea
                  name="tasks"
                  defaultValue={editingPosition.tasks?.join('\n') || ''}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Una tarea por línea"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Requisitos (uno por línea)
                </label>
                <textarea
                  name="requirements"
                  defaultValue={editingPosition.requirements?.join('\n') || ''}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Un requisito por línea"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  KPIs (uno por línea)
                </label>
                <textarea
                  name="kpis"
                  defaultValue={editingPosition.kpis?.join('\n') || ''}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Un KPI por línea"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Riesgos (uno por línea)
                </label>
                <textarea
                  name="risks"
                  defaultValue={editingPosition.risks?.join('\n') || ''}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Un riesgo por línea"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => { setShowEditPositionModal(false); setEditingPosition(null); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
