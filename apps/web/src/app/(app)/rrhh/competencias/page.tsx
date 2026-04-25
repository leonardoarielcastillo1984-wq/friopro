'use client';

import { useState, useEffect } from 'react';
import MatrizPolivalenciaPage from './matriz/page';
import { apiFetch } from '@/lib/api';
import { 
  ArrowLeft, Search, Filter, TrendingUp, Users, Award, BookOpen,
  ChevronDown, ChevronRight, Plus, Edit2, Trash2, X,
  Target, BarChart3, AlertCircle, CheckCircle, Clock
} from 'lucide-react';
import Link from 'next/link';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position?: string | { name: string };
  department?: string | { name: string };
  avatar?: string;
}

interface Competency {
  id: string;
  name: string;
  category: 'technical' | 'behavioral' | 'leadership';
  description: string;
  levels: CompetencyLevel[];
}

interface CompetencyLevel {
  level: number;
  name: string;
  description: string;
  behaviors: string[];
}

interface EmployeeCompetency {
  id: string;
  employeeId: string;
  competencyId: string;
  currentLevel: number;
  requiredLevel: number;
  lastEvaluated: string;
  evaluatorId?: string;
  gap: number;
  priority: 'high' | 'medium' | 'low';
}

interface Position {
  id: string;
  name: string;
  code: string;
  category: string;
  level: string;
}

export default function CompetenciasPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [employeeCompetencies, setEmployeeCompetencies] = useState<EmployeeCompetency[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedPriority, setSelectedPriority] = useState('ALL');
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showEvaluationForm, setShowEvaluationForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState<'competencies' | 'employees' | 'matrix'>('employees');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all data from real API
      const [employeesRes, competenciesRes, positionsRes, employeeCompetenciesRes] = await Promise.allSettled([
        apiFetch<{ employees: Employee[] }>('/hr/employees'),
        apiFetch<{ competencies: Competency[] }>('/hr/competencies'),
        apiFetch<{ positions: Position[] }>('/hr/positions'),
        apiFetch<{ employeeCompetencies: any[] }>('/hr/employee-competencies')
      ]);

      setEmployees(employeesRes.status === 'fulfilled' ? employeesRes.value.employees || [] : []);
      setCompetencies(competenciesRes.status === 'fulfilled' ? competenciesRes.value.competencies || [] : []);
      setPositions(positionsRes.status === 'fulfilled' ? positionsRes.value.positions || [] : []);
      
      // Use real employee competencies data with gaps calculated
      if (employeeCompetenciesRes.status === 'fulfilled') {
        const realData = employeeCompetenciesRes.value.employeeCompetencies || [];
        // Transform to match the frontend interface
        const transformed = realData.map((ec: any) => ({
          id: ec.id,
          employeeId: ec.employeeId,
          competencyId: ec.competencyId,
          currentLevel: ec.currentLevel,
          requiredLevel: ec.requiredLevel,
          lastEvaluated: ec.lastEvaluated,
          assessedBy: ec.assessedBy,
          gap: ec.gap,
          priority: ec.priority
        }));
        setEmployeeCompetencies(transformed);
      } else {
        setEmployeeCompetencies([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const getMockEmployees = (): Employee[] => [
    { id: '1', firstName: 'Juan', lastName: 'Pérez', email: 'juan.perez@company.com', position: 'Desarrollador Senior', department: 'Tecnología' },
    { id: '2', firstName: 'María', lastName: 'García', email: 'maria.garcia@company.com', position: 'Gerente de RRHH', department: 'Recursos Humanos' },
    { id: '3', firstName: 'Carlos', lastName: 'Rodríguez', email: 'carlos.rodriguez@company.com', position: 'Desarrollador Junior', department: 'Tecnología' },
    { id: '4', firstName: 'Ana', lastName: 'Martínez', email: 'ana.martinez@company.com', position: 'Diseñadora UX', department: 'Diseño' },
    { id: '5', firstName: 'Luis', lastName: 'Hernández', email: 'luis.hernandez@company.com', position: 'Analista de Datos', department: 'Análisis' }
  ];

  const getMockCompetencies = (): Competency[] => [
    {
      id: '1',
      name: 'Programación',
      category: 'technical',
      description: 'Capacidad para escribir código eficiente y mantenible',
      levels: [
        { level: 1, name: 'Básico', description: 'Puede escribir código simple', behaviors: ['Sintaxis básica', 'Estructuras de control'] },
        { level: 2, name: 'Intermedio', description: 'Puede desarrollar funcionalidades completas', behaviors: ['Funciones', 'Manejo de errores'] },
        { level: 3, name: 'Avanzado', description: 'Puede diseñar arquitecturas', behaviors: ['Patrones de diseño', 'Optimización'] },
        { level: 4, name: 'Experto', description: 'Puede liderar proyectos complejos', behaviors: ['Arquitectura avanzada', 'Mentoría'] },
        { level: 5, name: 'Maestro', description: 'Referencia en la industria', behaviors: ['Innovación', 'Investigación'] }
      ]
    },
    {
      id: '2',
      name: 'Comunicación',
      category: 'behavioral',
      description: 'Habilidad para transmitir ideas de forma clara y efectiva',
      levels: [
        { level: 1, name: 'Básico', description: 'Comunica información simple', behaviors: ['Escucha activa', 'Claridad básica'] },
        { level: 2, name: 'Intermedio', description: 'Presenta ideas estructuradas', behaviors: ['Presentaciones', 'Feedback constructivo'] },
        { level: 3, name: 'Avanzado', description: 'Influye y persuade', behaviors: ['Negociación', 'Oratoria'] },
        { level: 4, name: 'Experto', description: 'Lidera conversaciones difíciles', behaviors: ['Resolución de conflictos', 'Influencia estratégica'] },
        { level: 5, name: 'Maestro', description: 'Inspira y motiva', behaviors: ['Liderazgo inspirador', 'Coaching avanzado'] }
      ]
    },
    {
      id: '3',
      name: 'Liderazgo',
      category: 'leadership',
      description: 'Capacidad para guiar equipos y tomar decisiones estratégicas',
      levels: [
        { level: 1, name: 'Básico', description: 'Puede coordinar tareas simples', behaviors: ['Planificación básica', 'Seguimiento'] },
        { level: 2, name: 'Intermedio', description: 'Lidera equipos pequeños', behaviors: ['Motivación', 'Delegación'] },
        { level: 3, name: 'Avanzado', description: 'Gerencia de proyectos complejos', behaviors: ['Visión estratégica', 'Desarrollo de talento'] },
        { level: 4, name: 'Experto', description: 'Lidera departamentos', behaviors: ['Gestión del cambio', 'Transformación cultural'] },
        { level: 5, name: 'Maestro', description: 'Liderazgo organizacional', behaviors: ['Innovación en liderazgo', 'Sucesión planificada'] }
      ]
    },
    {
      id: '4',
      name: 'Resolución de Problemas',
      category: 'technical',
      description: 'Habilidad para analizar y resolver problemas complejos',
      levels: [
        { level: 1, name: 'Básico', description: 'Resuelve problemas predefinidos', behaviors: ['Análisis básico', 'Procedimientos estándar'] },
        { level: 2, name: 'Intermedio', description: 'Aborda problemas no estructurados', behaviors: ['Investigación', 'Creatividad'] },
        { level: 3, name: 'Avanzado', description: 'Resuelve problemas complejos', behaviors: ['Pensamiento crítico', 'Sistémico'] },
        { level: 4, name: 'Experto', description: 'Anticipa problemas potenciales', behaviors: ['Análisis predictivo', 'Mitigación de riesgos'] },
        { level: 5, name: 'Maestro', description: 'Innova en soluciones', behaviors: ['Investigación aplicada', 'Patrones disruptivos'] }
      ]
    },
    {
      id: '5',
      name: 'Trabajo en Equipo',
      category: 'behavioral',
      description: 'Capacidad para colaborar efectivamente con otros',
      levels: [
        { level: 1, name: 'Básico', description: 'Participa en equipos', behaviors: ['Colaboración básica', 'Respeto'] },
        { level: 2, name: 'Intermedio', description: 'Contribuye activamente', behaviors: ['Construcción de consenso', 'Apoyo mutuo'] },
        { level: 3, name: 'Avanzado', description: 'Facilita colaboraciones', behaviors: ['Mediación', 'Sinergia'] },
        { level: 4, name: 'Experto', description: 'Lidera equipos colaborativos', behaviors: ['Inteligencia emocional', 'Dinámica grupal'] },
        { level: 5, name: 'Maestro', description: 'Crea cultura colaborativa', behaviors: ['Transformación cultural', 'Comunidades de práctica'] }
      ]
    }
  ];

  const getMockPositions = (): Position[] => [
    { id: '1', name: 'Desarrollador Senior', code: 'DEV-001', category: 'Técnico', level: 'Senior' },
    { id: '2', name: 'Gerente de RRHH', code: 'RRHH-001', category: 'Administrativo', level: 'Gerencial' },
    { id: '3', name: 'Desarrollador Junior', code: 'DEV-002', category: 'Técnico', level: 'Junior' }
  ];

  const getMockEmployeeCompetencies = (): EmployeeCompetency[] => {
    const mockData: EmployeeCompetency[] = [];
    
    // Juan Pérez - Desarrollador Senior
    mockData.push(
      { id: '1', employeeId: '1', competencyId: '1', currentLevel: 4, requiredLevel: 5, lastEvaluated: '2024-01-15', gap: 1, priority: 'medium' },
      { id: '2', employeeId: '1', competencyId: '2', currentLevel: 3, requiredLevel: 3, lastEvaluated: '2024-01-15', gap: 0, priority: 'low' },
      { id: '3', employeeId: '1', competencyId: '3', currentLevel: 2, requiredLevel: 3, lastEvaluated: '2024-01-15', gap: 1, priority: 'medium' },
      { id: '4', employeeId: '1', competencyId: '4', currentLevel: 4, requiredLevel: 4, lastEvaluated: '2024-01-15', gap: 0, priority: 'low' },
      { id: '5', employeeId: '1', competencyId: '5', currentLevel: 3, requiredLevel: 4, lastEvaluated: '2024-01-15', gap: 1, priority: 'medium' }
    );
    
    // María García - Gerente de RRHH
    mockData.push(
      { id: '6', employeeId: '2', competencyId: '1', currentLevel: 2, requiredLevel: 2, lastEvaluated: '2024-01-10', gap: 0, priority: 'low' },
      { id: '7', employeeId: '2', competencyId: '2', currentLevel: 5, requiredLevel: 4, lastEvaluated: '2024-01-10', gap: 0, priority: 'low' },
      { id: '8', employeeId: '2', competencyId: '3', currentLevel: 4, requiredLevel: 4, lastEvaluated: '2024-01-10', gap: 0, priority: 'low' },
      { id: '9', employeeId: '2', competencyId: '4', currentLevel: 3, requiredLevel: 3, lastEvaluated: '2024-01-10', gap: 0, priority: 'low' },
      { id: '10', employeeId: '2', competencyId: '5', currentLevel: 4, requiredLevel: 4, lastEvaluated: '2024-01-10', gap: 0, priority: 'low' }
    );
    
    // Carlos Rodríguez - Desarrollador Junior
    mockData.push(
      { id: '11', employeeId: '3', competencyId: '1', currentLevel: 2, requiredLevel: 3, lastEvaluated: '2024-01-20', gap: 1, priority: 'high' },
      { id: '12', employeeId: '3', competencyId: '2', currentLevel: 2, requiredLevel: 2, lastEvaluated: '2024-01-20', gap: 0, priority: 'low' },
      { id: '13', employeeId: '3', competencyId: '3', currentLevel: 1, requiredLevel: 2, lastEvaluated: '2024-01-20', gap: 1, priority: 'high' },
      { id: '14', employeeId: '3', competencyId: '4', currentLevel: 2, requiredLevel: 3, lastEvaluated: '2024-01-20', gap: 1, priority: 'high' },
      { id: '15', employeeId: '3', competencyId: '5', currentLevel: 2, requiredLevel: 3, lastEvaluated: '2024-01-20', gap: 1, priority: 'high' }
    );
    
    return mockData;
  };

  const filteredEmployees = employees.filter(employee => {
    const positionName = typeof employee.position === 'string' ? employee.position : employee.position?.name || '';
    const matchesSearch = `${employee.firstName} ${employee.lastName} ${positionName}`.toLowerCase().includes(searchTerm.toLowerCase());
    const empComps = employeeCompetencies.filter(ec => ec.employeeId === employee.id);
    const hasPriority = selectedPriority === 'ALL' || 
      (selectedPriority === 'HIGH' && empComps.some(ec => ec.priority === 'high')) ||
      (selectedPriority === 'MEDIUM' && empComps.some(ec => ec.priority === 'medium')) ||
      (selectedPriority === 'LOW' && empComps.every(ec => ec.priority === 'low'));
    
    return matchesSearch && hasPriority;
  });

  const getEmployeeCompetencies = (employeeId: string) => {
    return employeeCompetencies.filter(ec => ec.employeeId === employeeId);
  };

  const getCompetencyById = (competencyId: string) => {
    return competencies.find(c => c.id === competencyId);
  };

  const getGapColor = (gap: number) => {
    if (gap === 0) return 'text-green-600 bg-green-100';
    if (gap === 1) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const renderEmployeeCard = (employee: Employee) => {
    const isExpanded = expandedEmployee === employee.id;
    const employeeComps = getEmployeeCompetencies(employee.id);
    const hasGaps = employeeComps.some(ec => ec.gap > 0);
    const criticalGaps = employeeComps.filter(ec => ec.gap >= 2).length;
    
    return (
      <div key={employee.id} className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                {employee.firstName[0]}{employee.lastName[0]}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {employee.firstName} {employee.lastName}
                </h3>
                <p className="text-sm text-gray-600">{typeof employee.position === 'string' ? employee.position : employee.position?.name}</p>
                <p className="text-xs text-gray-500">{typeof employee.department === 'string' ? employee.department : employee.department?.name}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {hasGaps && (
                <div className="flex items-center gap-1 px-2 py-1 bg-red-100 rounded-full">
                  <AlertCircle className="h-3 w-3 text-red-600" />
                  <span className="text-xs font-medium text-red-700">
                    {criticalGaps > 0 ? `${criticalGaps} críticas` : 'Brechas'}
                  </span>
                </div>
              )}
              
              <button
                onClick={() => setExpandedEmployee(isExpanded ? null : employee.id)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              
              <button
                onClick={() => {
                  setSelectedEmployee(employee);
                  setShowEvaluationForm(true);
                }}
                className="p-2 hover:bg-blue-100 rounded-lg transition-colors text-blue-600"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick Competency Overview */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
            {employeeComps.slice(0, isExpanded ? undefined : 5).map(ec => {
              const competency = getCompetencyById(ec.competencyId);
              const percentage = (ec.currentLevel / ec.requiredLevel) * 100;
              
              return (
                <div key={ec.id} className="text-center">
                  <p className="text-xs font-medium text-gray-600 mb-1">{competency?.name}</p>
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-bold text-gray-900">
                      {ec.currentLevel}/{ec.requiredLevel}
                    </span>
                    <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                      <div 
                        className={`h-1 rounded-full transition-all duration-300 ${
                          percentage >= 100 ? 'bg-green-500' : 
                          percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Expanded Content */}
          {isExpanded && (
            <div className="border-t pt-4 mt-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Detalle de Competencias</h4>
                  <div className="space-y-3">
                    {employeeComps.map(ec => {
                      const competency = getCompetencyById(ec.competencyId);
                      const percentage = (ec.currentLevel / ec.requiredLevel) * 100;
                      
                      return (
                        <div key={ec.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-gray-900">{competency?.name}</p>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getGapColor(ec.gap)}`}>
                                Gap: {ec.gap}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(ec.priority)}`}>
                                {ec.priority}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">{competency?.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              <span>Última evaluación: {ec.lastEvaluated}</span>
                              <span>Nivel actual: {ec.currentLevel}</span>
                              <span>Nivel requerido: {ec.requiredLevel}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col items-center">
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map(level => (
                                  <div
                                    key={level}
                                    className={`w-2 h-2 rounded-full ${
                                      level <= ec.currentLevel 
                                        ? 'bg-blue-500' 
                                        : 'bg-gray-300'
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="text-xs text-gray-500 mt-1">Actual</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map(level => (
                                  <div
                                    key={level}
                                    className={`w-2 h-2 rounded-full ${
                                      level <= ec.requiredLevel 
                                        ? 'bg-green-500' 
                                        : 'bg-gray-300'
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="text-xs text-gray-500 mt-1">Requerido</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Plan de Desarrollo</h4>
                  <div className="space-y-2">
                    {employeeComps.filter(ec => ec.gap > 0).map(ec => {
                      const competency = getCompetencyById(ec.competencyId);
                      
                      return (
                        <div key={ec.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {competency?.name} - Brecha de {ec.gap} nivel(es)
                            </p>
                            <p className="text-xs text-gray-600">
                              Acción recomendada: Capacitación en {competency?.name}
                            </p>
                          </div>
                          <button className="px-3 py-1 bg-yellow-600 text-white rounded text-xs font-medium">
                            Asignar
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
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
          <p className="text-gray-600">Cargando competencias...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error al cargar competencias</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadData}
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
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/rrhh" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Volver a RRHH
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Gestión de Competencias</h1>
                <p className="text-sm text-gray-500">Evaluación y desarrollo de talentos ISO 9001</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-red-600 font-medium">
                  {employeeCompetencies.filter(ec => ec.gap > 0).length} brechas
                </span>
              </div>
              <button
                onClick={() => {
                  if (employees.length === 0) {
                    alert('No hay empleados cargados. Primero agregá empleados en RRHH > Empleados.');
                    return;
                  }
                  setSelectedEmployee(employees[0]);
                  setShowEvaluationForm(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Nueva Evaluación
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 py-3">
            <button
              onClick={() => setActiveTab('employees')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                activeTab === 'employees'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Empleados
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                activeTab === 'matrix'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Ver en Matriz
            </button>
          </div>
        </div>
      </div>

      {activeTab !== 'matrix' && (
        <>
          {/* Stats Cards */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Empleados</p>
                <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Competencias Evaluadas</p>
                <p className="text-2xl font-bold text-gray-900">{employeeCompetencies.length}</p>
              </div>
              <Target className="h-8 w-8 text-green-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Brechas Críticas</p>
                <p className="text-2xl font-bold text-red-600">
                  {employeeCompetencies.filter(ec => ec.gap >= 2).length}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Capacitaciones Urgentes</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {employeeCompetencies.filter(ec => ec.priority === 'high').length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar empleados..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
          </div>
          
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Todas las prioridades</option>
            <option value="HIGH">Alta prioridad</option>
            <option value="MEDIUM">Media prioridad</option>
            <option value="LOW">Baja prioridad</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {filteredEmployees.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron empleados</h3>
            <p className="text-gray-600">No hay empleados que coincidan con los filtros seleccionados</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEmployees.map(renderEmployeeCard)}
          </div>
        )}
      </div>
        </>
      )}

      {activeTab === 'matrix' && (
        <div className="-mt-4">
          <MatrizPolivalenciaPage />
        </div>
      )}

      {/* Evaluation Form Modal */}
      {showEvaluationForm && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Evaluar Competencias - {selectedEmployee.firstName} {selectedEmployee.lastName}
                </h2>
                <button
                  onClick={() => {
                    setShowEvaluationForm(false);
                    setSelectedEmployee(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {getEmployeeCompetencies(selectedEmployee.id).length === 0 && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  Este empleado no tiene competencias asignadas todavía. Asignale competencias desde
                  <strong> RRHH &gt; Perfiles</strong> (según su puesto) antes de evaluarlo.
                </div>
              )}
              <div className="space-y-4">
                {getEmployeeCompetencies(selectedEmployee.id).map(ec => {
                  const competency = getCompetencyById(ec.competencyId);
                  
                  return (
                    <div key={ec.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900">{competency?.name}</h4>
                          <p className="text-sm text-gray-500">{competency?.description}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(ec.priority)}`}>
                          {ec.priority}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Nivel actual:</span>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(level => (
                              <button
                                key={level}
                                className={`w-8 h-8 rounded-full border-2 ${
                                  level === ec.currentLevel 
                                    ? 'bg-blue-500 border-blue-500 text-white' 
                                    : 'bg-white border-gray-300 hover:border-blue-300'
                                }`}
                              >
                                {level}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Nivel requerido:</span>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(level => (
                              <div
                                key={level}
                                className={`w-2 h-2 rounded-full ${
                                  level <= ec.requiredLevel ? 'bg-green-500' : 'bg-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowEvaluationForm(false);
                    setSelectedEmployee(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  Guardar Evaluación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Missing ChevronUp component
const ChevronUp = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);
