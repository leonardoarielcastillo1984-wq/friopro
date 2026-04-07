'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { 
  ArrowLeft, Briefcase, Plus, Search, Edit2, Trash2, Users, X, 
  Star, ChevronDown, ChevronRight, Linkedin, ExternalLink, Download, 
  RefreshCw, TrendingUp, Award, BookOpen, BarChart3, Target
} from 'lucide-react';
import Link from 'next/link';

// Enhanced interfaces for ISO 9001 compliance
interface Position {
  id: string;
  name: string;
  code?: string;
  category?: string;
  level?: string;
  mission?: string;
  keyFunctions?: string[];
  objective?: string;
  responsibilities?: string[];
  requirements?: string[];
  authority?: AuthorityLevel;
  relationships?: DepartmentRelationship[];
  kpis?: KPI[];
  evaluationMethod?: EvaluationCriteria;
  trainingPlan?: TrainingRequirement[];
  competencies?: PositionCompetency[];
  linkedinProfile?: LinkedInProfile;
  _count?: { employees: number };
}

interface AuthorityLevel {
  decisionMaking: string[];
  budgetControl: string;
  teamSize: string;
  reporting: string[];
}

interface DepartmentRelationship {
  department: string;
  relationship: 'reports_to' | 'manages' | 'collaborates' | 'supports';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  purpose: string;
}

interface KPI {
  id: string;
  name: string;
  description: string;
  target: number;
  current: number;
  unit: string;
  category: 'quality' | 'productivity' | 'efficiency' | 'safety' | 'customer';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  formula: string;
}

interface EvaluationCriteria {
  frequency: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  methods: ('self_eval' | 'manager_eval' | 'peer_eval' | 'subordinate_eval')[];
  weightings: Record<string, number>;
  objectives: string[];
}

interface TrainingRequirement {
  competencyId: string;
  requiredLevel: number;
  currentLevel: number;
  gap: number;
  priority: 'high' | 'medium' | 'low';
  suggestedActions: string[];
  estimatedHours: number;
  deadline?: string;
}

interface Competency {
  id: string;
  name: string;
  category: 'technical' | 'behavioral' | 'leadership';
  description?: string;
  levels: CompetencyLevel[];
}

interface CompetencyLevel {
  level: number;
  name: string;
  description: string;
  behaviors: string[];
}

interface PositionCompetency {
  id: string;
  positionId: string;
  competencyId: string;
  requiredLevel: number;
  currentLevel?: number;
  competency: Competency;
}

interface LinkedInProfile {
  publicUrl: string;
  headline: string;
  summary: string;
  experience: LinkedInExperience[];
  skills: string[];
  recommendations: LinkedInRecommendation[];
  certifications: LinkedInCertification[];
  education: LinkedInEducation[];
}

interface LinkedInExperience {
  title: string;
  company: string;
  startDate: string;
  endDate?: string;
  description: string;
  location?: string;
}

interface LinkedInRecommendation {
  name: string;
  position: string;
  company: string;
  text: string;
  date: string;
}

interface LinkedInCertification {
  name: string;
  issuingOrganization: string;
  issueDate: string;
  credentialUrl?: string;
}

interface LinkedInEducation {
  schoolName: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate?: string;
}

export default function PerfilesPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [showForm, setShowForm] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [expandedPosition, setExpandedPosition] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'competencies' | 'kpis' | 'evaluation' | 'linkedin'>('basic');
  const [showLinkedInImport, setShowLinkedInImport] = useState(false);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [importingLinkedIn, setImportingLinkedIn] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: '',
    level: '',
    mission: '',
    objective: '',
    responsibilities: [] as string[],
    requirements: [] as string[],
    keyFunctions: [] as string[],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load all data with fallback
      try {
        const positionsRes = await apiFetch<{ positions: Position[] }>('/hr/positions');
        setPositions(positionsRes.positions || []);
      } catch (err) {
        // Use mock data if API fails
        setPositions(getMockPositions());
      }

      try {
        const competenciesRes = await apiFetch<{ competencies: Competency[] }>('/hr/competencies');
        setCompetencies(competenciesRes.competencies || []);
      } catch (err) {
        setCompetencies(getMockCompetencies());
      }

      try {
        const employeesRes = await apiFetch<{ employees: any[] }>('/hr/employees');
        setEmployees(employeesRes.employees || []);
      } catch (err) {
        setEmployees([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const getMockPositions = (): Position[] => [
    {
      id: '1',
      name: 'Desarrollador Senior',
      code: 'DEV-001',
      category: 'Técnico',
      level: 'Senior',
      mission: 'Liderar el desarrollo de aplicaciones web escalables y mantener la calidad del código.',
      keyFunctions: [
        'Desarrollar y mantener aplicaciones web',
        'Revisar código del equipo',
        'Diseñar arquitecturas técnicas',
        'Mentorar desarrolladores junior'
      ],
      objective: 'Asegurar la entrega de soluciones técnicas de alta calidad que cumplan con los requisitos del negocio.',
      responsibilities: [
        'Escribir código limpio y mantenible',
        'Participar en reuniones de planificación',
        'Colaborar con el equipo de UX/UI',
        'Mantener documentación técnica'
      ],
      requirements: [
        '5+ años de experiencia en desarrollo web',
        'Conocimiento de React y Node.js',
        'Experiencia con bases de datos SQL',
        'Inglés intermedio'
      ],
      _count: { employees: 2 }
    },
    {
      id: '2',
      name: 'Gerente de RRHH',
      code: 'RRHH-001',
      category: 'Administrativo',
      level: 'Gerencial',
      mission: 'Gestionar el talento humano y desarrollar estrategias de retención y crecimiento.',
      keyFunctions: [
        'Reclutamiento y selección',
        'Gestión de desempeño',
        'Desarrollo organizacional',
        'Relaciones laborales'
      ],
      objective: 'Construir y mantener un equipo de trabajo motivado y comprometido con los objetivos de la organización.',
      responsibilities: [
        'Diseñar políticas de RRHH',
        'Gestionar el proceso de selección',
        'Coordinar programas de capacitación',
        'Medir satisfacción del empleado'
      ],
      requirements: [
        'Título en RRHH o Psicología',
        '3+ años de experiencia en gestión',
        'Conocimiento de legislación laboral',
        'Habilidades de comunicación'
      ],
      _count: { employees: 1 }
    }
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
        { level: 3, name: 'Avanzado', description: 'Puede diseñar arquitecturas', behaviors: ['Patrones de diseño', 'Optimización'] }
      ]
    },
    {
      id: '2',
      name: 'Liderazgo',
      category: 'leadership',
      description: 'Capacidad para guiar y motivar equipos',
      levels: [
        { level: 1, name: 'Básico', description: 'Puede coordinar tareas simples', behaviors: ['Asignación de tareas', 'Seguimiento básico'] },
        { level: 2, name: 'Intermedio', description: 'Puede liderar proyectos pequeños', behaviors: ['Planificación', 'Motivación'] },
        { level: 3, name: 'Avanzado', description: 'Puede liderar equipos grandes', behaviors: ['Visión estratégica', 'Desarrollo de talento'] }
      ]
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newPosition = {
        ...formData,
        id: editingPosition?.id || Date.now().toString(),
        _count: { employees: 0 }
      };

      if (editingPosition) {
        setPositions(positions.map(p => p.id === editingPosition.id ? newPosition : p));
      } else {
        setPositions([...positions, newPosition]);
      }
      
      setShowForm(false);
      setEditingPosition(null);
      setFormData({
        name: '',
        code: '',
        category: '',
        level: '',
        mission: '',
        objective: '',
        responsibilities: [],
        requirements: [],
        keyFunctions: [],
      });
    } catch (err: any) {
      setError(err?.message || 'Error al guardar perfil');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este perfil?')) return;
    
    try {
      setPositions(positions.filter(p => p.id !== id));
    } catch (err: any) {
      setError(err?.message || 'Error al eliminar perfil');
    }
  };

  const importFromLinkedIn = async (positionId: string) => {
    if (!linkedinUrl) {
      setError('Por favor, ingresa una URL de LinkedIn válida');
      return;
    }

    try {
      setImportingLinkedIn(true);
      setError(null);

      // Mock LinkedIn data
      const mockLinkedInData: LinkedInProfile = {
        publicUrl: linkedinUrl,
        headline: 'Senior Software Engineer | Full Stack Development',
        summary: 'Experienced software engineer with expertise in full stack development...',
        experience: [
          {
            title: 'Senior Software Engineer',
            company: 'Tech Company',
            startDate: '2020-01',
            description: 'Led development of enterprise applications...',
            location: 'San Francisco, CA'
          }
        ],
        skills: ['JavaScript', 'React', 'Node.js', 'Python', 'AWS'],
        recommendations: [
          {
            name: 'John Doe',
            position: 'CTO',
            company: 'Tech Company',
            text: 'Excellent developer with strong problem-solving skills...',
            date: '2023-06'
          }
        ],
        certifications: [
          {
            name: 'AWS Certified Solutions Architect',
            issuingOrganization: 'Amazon Web Services',
            issueDate: '2022-03'
          }
        ],
        education: [
          {
            schoolName: 'University of Technology',
            degree: 'Bachelor of Science',
            fieldOfStudy: 'Computer Science',
            startDate: '2015-09',
            endDate: '2019-05'
          }
        ]
      };

      // Update position with LinkedIn data
      setPositions(positions.map(p => 
        p.id === positionId ? { ...p, linkedinProfile: mockLinkedInData } : p
      ));

      setShowLinkedInImport(false);
      setLinkedinUrl('');
    } catch (err: any) {
      setError(err?.message || 'Error al importar perfil de LinkedIn');
    } finally {
      setImportingLinkedIn(false);
    }
  };

  const filteredPositions = positions.filter(position => {
    const matchesSearch = `${position.name} ${position.code} ${position.category}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || position.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['ALL', ...Array.from(new Set(positions.map(p => p.category).filter(Boolean)))];

  const renderCompetencyMatrix = (position: Position) => {
    // Mock employee data with competency levels
    const mockEmployees = [
      {
        id: '1',
        name: 'Juan Pérez',
        positionId: position.id,
        positionName: position.name,
        competencies: [
          { name: 'Programación', currentLevel: 4, requiredLevel: 5 },
          { name: 'Liderazgo', currentLevel: 2, requiredLevel: 3 }
        ]
      },
      {
        id: '2', 
        name: 'María García',
        positionId: position.id,
        positionName: position.name,
        competencies: [
          { name: 'Programación', currentLevel: 3, requiredLevel: 5 },
          { name: 'Liderazgo', currentLevel: 4, requiredLevel: 3 }
        ]
      },
      {
        id: '3',
        name: 'Carlos Rodríguez',
        positionId: position.id,
        positionName: position.name,
        competencies: [
          { name: 'Programación', currentLevel: 2, requiredLevel: 5 },
          { name: 'Liderazgo', currentLevel: 1, requiredLevel: 3 }
        ]
      }
    ];

    const mockCompetencies = getMockCompetencies();

    return (
      <div className="space-y-6">
        {/* Employee Competency Matrix */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">Matriz de Competencias del Personal</h4>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Brechas identificadas:</span>
              <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                {mockEmployees.filter(emp => 
                  emp.competencies.some(comp => comp.currentLevel < comp.requiredLevel)
                ).length}
              </span>
            </div>
          </div>
          
          {/* Employee Matrix Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Empleado
                  </th>
                  {mockCompetencies.map(comp => (
                    <th key={comp.id} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {comp.name}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {mockEmployees.map(employee => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                        <div className="text-sm text-gray-500">{employee.positionName}</div>
                      </div>
                    </td>
                    {employee.competencies.map((comp, index) => {
                      const gap = comp.requiredLevel - comp.currentLevel;
                      const percentage = (comp.currentLevel / comp.requiredLevel) * 100;
                      
                      return (
                        <td key={index} className="px-4 py-4 whitespace-nowrap text-center">
                          <div className="flex flex-col items-center space-y-1">
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-medium text-gray-900">
                                {comp.currentLevel}/{comp.requiredLevel}
                              </span>
                              {gap > 0 && (
                                <span className={`px-1 py-0.5 rounded text-xs font-medium ${
                                  gap >= 2 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  -{gap}
                                </span>
                              )}
                            </div>
                            <div className="w-16 bg-gray-200 rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                  percentage >= 100 ? 'bg-green-500' : 
                                  percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        Ver Plan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Position Competency Requirements */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Requisitos de Competencias del Puesto</h4>
          <div className="space-y-3">
            {mockCompetencies.map(comp => (
              <div key={comp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-gray-900">{comp.name}</p>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      comp.category === 'technical' ? 'bg-blue-100 text-blue-800' :
                      comp.category === 'behavioral' ? 'bg-green-100 text-green-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {comp.category === 'technical' ? 'Técnica' : 
                       comp.category === 'behavioral' ? 'Comportamental' : 
                       'Liderazgo'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{comp.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">Nivel Req.</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(level => (
                        <div
                          key={level}
                          className={`w-2 h-2 rounded-full ${
                            level <= 3 ? 'bg-blue-500' : 'bg-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Training Needs Summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Resumen de Necesidades de Capacitación</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-red-900">Críticas</span>
                <span className="text-lg font-bold text-red-600">3</span>
              </div>
              <p className="text-xs text-red-700">Brechas ≥ 2 niveles</p>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-yellow-900">Moderadas</span>
                <span className="text-lg font-bold text-yellow-600">2</span>
              </div>
              <p className="text-xs text-yellow-700">Brechas de 1 nivel</p>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-green-900">Cumplidas</span>
                <span className="text-lg font-bold text-green-600">1</span>
              </div>
              <p className="text-xs text-green-700">Sin brechas</p>
            </div>
          </div>

          {/* Priority Actions */}
          <div>
            <h5 className="font-medium text-gray-900 mb-2">Acciones Prioritarias</h5>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-red-50 rounded border-l-4 border-red-500">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Carlos Rodríguez - Programación</p>
                  <p className="text-xs text-gray-600">Brecha crítica: Nivel 2/5 (-3)</p>
                </div>
                <button className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium">
                  Asignar Capacitación
                </button>
              </div>
              
              <div className="flex items-center justify-between p-2 bg-yellow-50 rounded border-l-4 border-yellow-500">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Juan Pérez - Programación</p>
                  <p className="text-xs text-gray-600">Brecha moderada: Nivel 4/5 (-1)</p>
                </div>
                <button className="px-3 py-1 bg-yellow-600 text-white rounded text-xs font-medium">
                  Planificar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderKPIs = (position: Position) => {
    const mockKPIs: KPI[] = [
      {
        id: '1',
        name: 'Productividad',
        description: 'Tareas completadas por semana',
        target: 50,
        current: 42,
        unit: 'tareas',
        category: 'productivity',
        frequency: 'weekly',
        formula: 'COUNT(tareas_completadas) / 7'
      },
      {
        id: '2',
        name: 'Calidad',
        description: 'Porcentaje de código sin errores',
        target: 95,
        current: 88,
        unit: '%',
        category: 'quality',
        frequency: 'monthly',
        formula: '(1 - (errores / total_lineas)) * 100'
      }
    ];
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockKPIs.map(kpi => (
          <div key={kpi.id} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{kpi.name}</h4>
                <p className="text-sm text-gray-500">{kpi.description}</p>
              </div>
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                kpi.category === 'quality' ? 'bg-green-100 text-green-800' :
                kpi.category === 'productivity' ? 'bg-blue-100 text-blue-800' :
                kpi.category === 'efficiency' ? 'bg-purple-100 text-purple-800' :
                kpi.category === 'safety' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {kpi.category}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Progreso</span>
                <span className="text-sm font-medium">
                  {kpi.current} / {kpi.target} {kpi.unit}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min((kpi.current / kpi.target) * 100, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{kpi.frequency}</span>
                <span>{Math.round((kpi.current / kpi.target) * 100)}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderEvaluationMethod = (position: Position) => {
    const mockEvaluation: EvaluationCriteria = {
      frequency: 'quarterly',
      methods: ['self_eval', 'manager_eval', 'peer_eval'],
      weightings: {
        'self_eval': 20,
        'manager_eval': 50,
        'peer_eval': 30
      },
      objectives: [
        'Evaluar desempeño técnico',
        'Medir habilidades blandas',
        'Identificar áreas de mejora',
        'Definir plan de desarrollo'
      ]
    };

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="font-semibold text-gray-900 mb-4">Método de Evaluación</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Frecuencia</p>
            <p className="text-gray-900 capitalize">{mockEvaluation.frequency}</p>
          </div>
          
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Métodos</p>
            <div className="flex flex-wrap gap-2">
              {mockEvaluation.methods.map(method => (
                <span key={method} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                  {method === 'self_eval' ? 'Autoevaluación' :
                   method === 'manager_eval' ? 'Evaluación Jefe' :
                   method === 'peer_eval' ? 'Evaluación Pares' :
                   'Evaluación Subordinados'}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Objetivos de Evaluación</p>
          <ul className="list-disc list-inside space-y-1">
            {mockEvaluation.objectives.map((objective, index) => (
              <li key={index} className="text-sm text-gray-600">{objective}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  const renderLinkedInProfile = (position: Position) => {
    const linkedinProfile = position.linkedinProfile;
    if (!linkedinProfile) return null;

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Linkedin className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold text-gray-900">Perfil de LinkedIn</h4>
                <a
                  href={linkedinProfile.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Ver en LinkedIn
                </a>
              </div>
              <p className="text-gray-700 font-medium">{linkedinProfile.headline}</p>
            </div>
          </div>
          
          {linkedinProfile.summary && (
            <div className="mb-4">
              <h5 className="font-medium text-gray-900 mb-2">Resumen</h5>
              <p className="text-gray-600 text-sm">{linkedinProfile.summary}</p>
            </div>
          )}
        </div>

        {linkedinProfile.skills.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h5 className="font-semibold text-gray-900 mb-3">Habilidades</h5>
            <div className="flex flex-wrap gap-2">
              {linkedinProfile.skills.map((skill, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPositionCard = (position: Position) => {
    const isExpanded = expandedPosition === position.id;
    const employeeCount = position._count?.employees || 0;
    
    return (
      <div key={position.id} className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold text-gray-900">{position.name}</h3>
                {position.code && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                    {position.code}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                {position.category && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-4 w-4" />
                    {position.category}
                  </span>
                )}
                {position.level && (
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4" />
                    {position.level}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {employeeCount} empleados
                </span>
              </div>

              {position.mission && (
                <p className="text-gray-700 text-sm mb-3">
                  <span className="font-medium">Misión:</span> {position.mission}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpandedPosition(isExpanded ? null : position.id)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              <button
                onClick={() => {
                  setEditingPosition(position);
                  setFormData({
                    name: position.name,
                    code: position.code || '',
                    category: position.category || '',
                    level: position.level || '',
                    mission: position.mission || '',
                    objective: position.objective || '',
                    responsibilities: position.responsibilities || [],
                    requirements: position.requirements || [],
                    keyFunctions: position.keyFunctions || [],
                  });
                  setShowForm(true);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(position.id)}
                className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {position.keyFunctions && position.keyFunctions.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium text-gray-900 mb-2">Funciones Clave</h4>
              <ul className="list-disc list-inside space-y-1">
                {position.keyFunctions.slice(0, isExpanded ? undefined : 3).map((func, index) => (
                  <li key={index} className="text-sm text-gray-600">{func}</li>
                ))}
              </ul>
            </div>
          )}

          {isExpanded && (
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center gap-4 mb-6 border-b">
                {(['basic', 'competencies', 'kpis', 'evaluation', 'linkedin'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab === 'basic' ? 'Información Básica' :
                     tab === 'competencies' ? 'Matriz de Competencias' :
                     tab === 'kpis' ? 'Indicadores KPI' :
                     tab === 'evaluation' ? 'Evaluación' :
                     'LinkedIn'}
                  </button>
                ))}
              </div>

              {activeTab === 'basic' && (
                <div className="space-y-4">
                  {position.objective && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Objetivo del Puesto</h4>
                      <p className="text-gray-700">{position.objective}</p>
                    </div>
                  )}
                  
                  {position.responsibilities && position.responsibilities.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Responsabilidades</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {position.responsibilities.map((resp, index) => (
                          <li key={index} className="text-gray-600">{resp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {position.requirements && position.requirements.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Requisitos</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {position.requirements.map((req, index) => (
                          <li key={index} className="text-gray-600">{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'competencies' && renderCompetencyMatrix(position)}
              {activeTab === 'kpis' && renderKPIs(position)}
              {activeTab === 'evaluation' && renderEvaluationMethod(position)}
              {activeTab === 'linkedin' && (
                <div>
                  {position.linkedinProfile ? (
                    renderLinkedInProfile(position)
                  ) : (
                    <div className="text-center py-12">
                      <Linkedin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Sin perfil de LinkedIn</h3>
                      <p className="text-gray-600 mb-4">Importa el perfil desde LinkedIn para enriquecer la información del puesto</p>
                      <button
                        onClick={() => setShowLinkedInImport(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
                      >
                        <Linkedin className="h-4 w-4" />
                        Importar de LinkedIn
                      </button>
                    </div>
                  )}
                </div>
              )}
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
          <p className="text-gray-600">Cargando perfiles de puestos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error al cargar perfiles</h1>
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
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/rrhh" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Volver a RRHH
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Perfiles de Puestos</h1>
                <p className="text-sm text-gray-500">Gestión de roles y competencias ISO 9001</p>
              </div>
            </div>

            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nuevo Perfil
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar perfiles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
          </div>
          
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'ALL' ? 'Todas las categorías' : cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {filteredPositions.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron perfiles</h3>
            <p className="text-gray-600">Crea tu primer perfil de puesto para comenzar</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPositions.map(renderPositionCard)}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingPosition ? 'Editar Perfil' : 'Nuevo Perfil'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingPosition(null);
                    setFormData({
                      name: '',
                      code: '',
                      category: '',
                      level: '',
                      mission: '',
                      objective: '',
                      responsibilities: [],
                      requirements: [],
                      keyFunctions: [],
                    });
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del Puesto *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Código
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoría
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nivel
                  </label>
                  <input
                    type="text"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Misión del Puesto
                </label>
                <textarea
                  value={formData.mission}
                  onChange={(e) => setFormData({ ...formData, mission: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Objetivo del Puesto
                </label>
                <textarea
                  value={formData.objective}
                  onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Funciones Clave
                </label>
                <textarea
                  value={formData.keyFunctions.join('\n')}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    keyFunctions: e.target.value.split('\n').filter(f => f.trim()) 
                  })}
                  rows={3}
                  placeholder="Una función por línea"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Responsabilidades
                </label>
                <textarea
                  value={formData.responsibilities.join('\n')}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    responsibilities: e.target.value.split('\n').filter(r => r.trim()) 
                  })}
                  rows={3}
                  placeholder="Una responsabilidad por línea"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Requisitos
                </label>
                <textarea
                  value={formData.requirements.join('\n')}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    requirements: e.target.value.split('\n').filter(r => r.trim()) 
                  })}
                  rows={3}
                  placeholder="Un requisito por línea"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingPosition(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingPosition ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LinkedIn Import Modal */}
      {showLinkedInImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Linkedin className="h-5 w-5 text-blue-600" />
                  Importar Perfil de LinkedIn
                </h2>
                <button
                  onClick={() => {
                    setShowLinkedInImport(false);
                    setLinkedinUrl('');
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL del Perfil de LinkedIn
                </label>
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Ingresa la URL pública del perfil de LinkedIn
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-blue-900 mb-2">¿Qué se importará?</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Experiencia laboral</li>
                  <li>• Habilidades y competencias</li>
                  <li>• Certificaciones</li>
                  <li>• Educación</li>
                  <li>• Recomendaciones</li>
                </ul>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowLinkedInImport(false);
                    setLinkedinUrl('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => importFromLinkedIn(editingPosition?.id || '')}
                  disabled={importingLinkedIn}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {importingLinkedIn ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Importando...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Importar
                    </>
                  )}
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
