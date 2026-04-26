'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import ComboSelect from '@/components/ComboSelect';
import {
  Shield, AlertTriangle, Users, Calendar, Clock, CheckCircle, XCircle,
  Filter, Search, Plus, Eye, Edit, Trash2, FileText, Download, Upload,
  RefreshCw, Zap, Target, Activity, MapPin, Phone, Radio, Megaphone,
  TrendingUp, TrendingDown, BarChart3, Settings, Play, Pause, X
} from 'lucide-react';

interface DrillScenario {
  id: string;
  name: string;
  description: string;
  type: 'FIRE' | 'EARTHQUAKE' | 'FLOOD' | 'CHEMICAL_SPILL' | 'MEDICAL_EMERGENCY' | 'SECURITY_BREACH' | 'EVACUATION' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: 'NATURAL_DISASTER' | 'INDUSTRIAL_ACCIDENT' | 'MEDICAL' | 'SECURITY' | 'ENVIRONMENTAL';
  objectives: string[];
  scope: {
    areas: string[];
    departments: string[];
    participants: number;
    external_agencies: string[];
  };
  schedule: {
    plannedDate: string;
    duration: number; // hours
    start_time: string;
    end_time: string;
  };
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'POSTPONED';
  coordinator: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  evaluators: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  resources: {
    equipment: Array<{
      name: string;
      quantity: number;
      status: 'AVAILABLE' | 'ASSIGNED' | 'USED';
    }>;
    personnel: Array<{
      role: string;
      required: number;
      assigned: number;
    }>;
    facilities: Array<{
      name: string;
      location: string;
      capacity: number;
    }>;
  };
  procedures: Array<{
    id: string;
    step: number;
    action: string;
    responsible: string;
    estimated_time: number;
    dependencies: string[];
  }>;
  evaluation_criteria: Array<{
    criteria: string;
    weight: number;
    measurement_method: string;
    target_value: number;
  }>;
  results?: {
    completion_rate: number;
    participant_satisfaction: number;
    objectives_achieved: number;
    issues_identified: number;
    lessons_learned: string[];
    recommendations: string[];
    improvement_actions: Array<{
      action: string;
      responsible: string;
      due_date: string;
      status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    }>;
  };
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface ContingencyPlan {
  id: string;
  name: string;
  description: string;
  type: 'BUSINESS_CONTINUITY' | 'DISASTER_RECOVERY' | 'CRISIS_MANAGEMENT' | 'EMERGENCY_RESPONSE';
  scope: {
    business_units: string[];
    critical_processes: string[];
    systems: string[];
    facilities: string[];
  };
  risk_assessment: {
    identified_risks: Array<{
      risk: string;
      probability: 'LOW' | 'MEDIUM' | 'HIGH';
      impact: 'LOW' | 'MEDIUM' | 'HIGH';
      mitigation_strategy: string;
    }>;
    recovery_objectives: {
      rto: number; // Recovery Time Objective (hours)
      rpo: number; // Recovery Point Objective (hours)
      mtd: number; // Maximum Tolerable Downtime (hours)
    };
  };
  response_teams: Array<{
    team_name: string;
    leader: string;
    members: string[];
    responsibilities: string[];
    contact_info: {
      primary_phone: string;
      secondary_phone: string;
      email: string;
    };
  }>;
  communication_plan: {
    internal_channels: Array<{
      channel: string;
      purpose: string;
      frequency: string;
      responsible: string;
    }>;
    external_contacts: Array<{
      organization: string;
      contact_person: string;
      phone: string;
      email: string;
      purpose: string;
    }>;
    escalation_procedures: Array<{
      level: number;
      trigger_conditions: string[];
      contacts: string[];
      time_threshold: number; // hours
    }>;
  };
  recovery_procedures: Array<{
    process_name: string;
    recovery_steps: Array<{
      step: number;
      action: string;
      responsible: string;
      estimated_time: number;
      prerequisites: string[];
    }>;
    alternate_procedures: Array<{
      condition: string;
      alternative_steps: string[];
    }>;
    validation_criteria: string[];
  }>;
  testing_schedule: {
    last_test_date?: string;
    next_test_date: string;
    test_frequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUALLY' | 'ANNUALLY';
    test_types: Array<{
      type: string;
      last_performed?: string;
      next_scheduled: string;
      status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
    }>;
  };
  documentation: {
    plan_version: string;
    approval_date: string;
    next_review_date: string;
    attachments: Array<{
      name: string;
      type: string;
      upload_date: string;
    }>;
  };
  status: 'ACTIVE' | 'IN_REVIEW' | 'DRAFT' | 'ARCHIVED';
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface EmergencyResource {
  id: string;
  name: string;
  type: 'EQUIPMENT' | 'SUPPLIES' | 'FACILITY' | 'VEHICLE' | 'COMMUNICATION' | 'MEDICAL';
  description: string;
  location: string;
  quantity: number;
  available_quantity: number;
  unit: string;
  maintenance_status: 'OPERATIONAL' | 'MAINTENANCE_REQUIRED' | 'OUT_OF_SERVICE';
  last_inspection: string;
  next_inspection: string;
  responsible_person: string;
  contact_info: {
    phone: string;
    email: string;
  };
  usage_history: Array<{
    date: string;
    drill_id?: string;
    incident_id?: string;
    quantity_used: number;
    purpose: string;
  }>;
  specifications?: {
    capacity?: string;
    dimensions?: string;
    weight?: string;
    power_requirements?: string;
    certifications?: string[];
  };
  created_at: string;
  updated_at: string;
}

interface SimulationStats {
  total_drills: number;
  drills_this_year: number;
  completed_drills: number;
  scheduled_drills: number;
  overdue_drills: number;
  avg_participant_satisfaction: number;
  avg_completion_rate: number;
  total_contingency_plans: number;
  active_plans: number;
  plans_requiring_review: number;
  tested_this_period: number;
  emergency_resources: number;
  resources_maintenance_required: number;
  critical_resources_unavailable: number;
}

export default function SimulacrosPage() {
  const [drills, setDrills] = useState<DrillScenario[]>([]);
  const [contingencyPlans, setContingencyPlans] = useState<ContingencyPlan[]>([]);
  const [emergencyResources, setEmergencyResources] = useState<EmergencyResource[]>([]);
  const [stats, setStats] = useState<SimulationStats>({
    total_drills: 0,
    drills_this_year: 0,
    completed_drills: 0,
    scheduled_drills: 0,
    overdue_drills: 0,
    avg_participant_satisfaction: 0,
    avg_completion_rate: 0,
    total_contingency_plans: 0,
    active_plans: 0,
    plans_requiring_review: 0,
    tested_this_period: 0,
    emergency_resources: 0,
    resources_maintenance_required: 0,
    critical_resources_unavailable: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'drills' | 'plans' | 'resources'>('drills');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemType, setNewItemType] = useState('FIRE');
  const [newItemSeverity, setNewItemSeverity] = useState('MEDIUM');
  
  // Estados para Planes de Contingencia
  const [planSearchQuery, setPlanSearchQuery] = useState('');
  const [planFilterType, setPlanFilterType] = useState<string>('all');
  const [planFilterStatus, setPlanFilterStatus] = useState<string>('all');
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanDescription, setNewPlanDescription] = useState('');
  const [newPlanType, setNewPlanType] = useState('EMERGENCY_RESPONSE');
  const [newPlanCategory, setNewPlanCategory] = useState('OPERATIONAL');
  
  // Estados para Recursos de Emergencia
  const [resources, setResources] = useState<any[]>([]);
  const [resourceSearchQuery, setResourceSearchQuery] = useState('');
  const [resourceFilterType, setResourceFilterType] = useState<string>('all');
  const [resourceFilterStatus, setResourceFilterStatus] = useState<string>('all');
  const [showCreateResourceModal, setShowCreateResourceModal] = useState(false);
  const [newResourceName, setNewResourceName] = useState('');
  const [newResourceDescription, setNewResourceDescription] = useState('');
  const [newResourceType, setNewResourceType] = useState('EQUIPMENT');
  const [newResourceCategory, setNewResourceCategory] = useState('FIRE_SAFETY');
  const [newResourceQuantity, setNewResourceQuantity] = useState(1);
  const [newResourceLocation, setNewResourceLocation] = useState('');
  const [drillTypeOptions, setDrillTypeOptions] = useState([
    { value: 'FIRE', label: 'Incendio' },
    { value: 'EARTHQUAKE', label: 'Terremoto' },
    { value: 'FLOOD', label: 'Inundación' },
    { value: 'CHEMICAL', label: 'Derrame Químico' },
    { value: 'MEDICAL', label: 'Emergencia Médica' }
  ]);
  const [planTypeOptions, setPlanTypeOptions] = useState([
    { value: 'EMERGENCY_RESPONSE', label: 'Respuesta a Emergencias' },
    { value: 'BUSINESS_CONTINUITY', label: 'Continuidad del Negocio' },
    { value: 'DISASTER_RECOVERY', label: 'Recuperación ante Desastres' },
    { value: 'CRISIS_MANAGEMENT', label: 'Gestión de Crisis' },
    { value: 'COMMUNICATION', label: 'Comunicación' }
  ]);
  const [resourceTypeOptions, setResourceTypeOptions] = useState([
    { value: 'EQUIPMENT', label: 'Equipo' },
    { value: 'SUPPLY', label: 'Suministro' },
    { value: 'PERSONNEL', label: 'Personal' },
    { value: 'FACILITY', label: 'Instalación' },
    { value: 'EXTERNAL', label: 'Contacto Externo' }
  ]);

  const handleCreateDrill = async () => {
    if (!newItemName.trim()) {
      alert('Por favor ingresa un nombre');
      return;
    }
    try {
      const response = await apiFetch('/emergency/drills', {
        method: 'POST',
        json: {
          name: newItemName,
          description: newItemDescription,
          type: newItemType,
          severity: newItemSeverity,
          status: 'PLANNED'
        }
      });
      setDrills([...drills, response as DrillScenario]);
      setShowCreateModal(false);
      setNewItemName('');
      setNewItemDescription('');
    } catch (error) {
      alert('Error: ' + (error as any).message);
    }
  };

  const handleStartDrill = async (drillId: string) => {
    if (!confirm('¿Está seguro de que desea iniciar este simulacro?')) {
      return;
    }
    try {
      const response = await apiFetch(`/emergency/drills/${drillId}/start`, {
        method: 'POST'
      }) as any;
      
      if (response.success) {
        alert('Simulacro iniciado correctamente');
        loadSimulationData(); // Recargar lista
      }
    } catch (error) {
      console.error('Error starting drill:', error);
      alert('Error al iniciar el simulacro');
    }
  };

  const handleDeleteDrill = async (drillId: string) => {
    if (!confirm('¿Está seguro de que desea eliminar este simulacro? Esta acción no se puede deshacer.')) {
      return;
    }
    try {
      await apiFetch(`/emergency/drills/${drillId}`, {
        method: 'DELETE'
      });
      
      alert('Simulacro eliminado correctamente');
      loadSimulationData(); // Recargar lista
    } catch (error) {
      console.error('Error deleting drill:', error);
      alert('Error al eliminar el simulacro');
    }
  };

  // Funciones para Planes de Contingencia
  const handleCreatePlan = async () => {
    if (!newPlanName.trim()) {
      alert('Por favor ingresa un nombre');
      return;
    }
    try {
      const response = await apiFetch('/emergency/contingency-plans', {
        method: 'POST',
        json: {
          name: newPlanName,
          description: newPlanDescription,
          type: newPlanType,
          category: newPlanCategory,
          status: 'DRAFT'
        }
      }) as any;
      
      if (response.success) {
        setContingencyPlans([...contingencyPlans, response.plan]);
        setShowCreatePlanModal(false);
        setNewPlanName('');
        setNewPlanDescription('');
      }
    } catch (error) {
      alert('Error: ' + (error as any).message);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('¿Está seguro de que desea eliminar este plan de contingencia? Esta acción no se puede deshacer.')) {
      return;
    }
    try {
      await apiFetch(`/emergency/contingency-plans/${planId}`, {
        method: 'DELETE'
      });
      
      alert('Plan de contingencia eliminado correctamente');
      loadSimulationData(); // Recargar lista
    } catch (error) {
      console.error('Error deleting plan:', error);
      alert('Error al eliminar el plan de contingencia');
    }
  };

  // Funciones para Recursos de Emergencia
  const handleCreateResource = async () => {
    if (!newResourceName.trim()) {
      alert('Por favor ingresa un nombre');
      return;
    }
    try {
      const response = await apiFetch('/emergency/resources', {
        method: 'POST',
        json: {
          name: newResourceName,
          description: newResourceDescription,
          type: newResourceType,
          category: newResourceCategory,
          quantity: newResourceQuantity,
          location: newResourceLocation
        }
      }) as any;
      
      // Backend returns resource directly, not wrapped in success object
      if (response && response.id) {
        setResources([...resources, response]);
        setShowCreateResourceModal(false);
        setNewResourceName('');
        setNewResourceDescription('');
        setNewResourceQuantity(1);
        setNewResourceLocation('');
        alert('Recurso creado correctamente');
      } else {
        alert('Error: Respuesta inesperada del servidor');
      }
    } catch (error) {
      alert('Error: ' + (error as any).message);
    }
  };

  const handleDeleteResource = async (resourceId: string) => {
    if (!confirm('¿Está seguro de que desea eliminar este recurso? Esta acción no se puede deshacer.')) {
      return;
    }
    try {
      await apiFetch(`/emergency/resources/${resourceId}`, {
        method: 'DELETE'
      });
      
      alert('Recurso eliminado correctamente');
      loadSimulationData(); // Recargar lista
    } catch (error) {
      console.error('Error deleting resource:', error);
      alert('Error al eliminar el recurso');
    }
  };

  useEffect(() => {
    loadSimulationData();
  }, []);

  const loadSimulationData = async () => {
    try {
      setLoading(true);
      const [drillsData, plansData, resourcesData, statsData] = await Promise.all([
        apiFetch('/emergency/drills'),
        apiFetch('/emergency/contingency-plans'),
        apiFetch('/emergency/resources'),
        apiFetch('/emergency/stats')
      ]) as any;
      
      setDrills(drillsData.drills || []);
      setContingencyPlans(plansData.plans || []);
      setResources(resourcesData.resources || []);
      setStats(statsData.stats || stats);
    } catch (error) {
      console.error('Error loading simulation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'FIRE': return 'text-red-600 bg-red-50';
      case 'EARTHQUAKE': return 'text-orange-600 bg-orange-50';
      case 'FLOOD': return 'text-blue-600 bg-blue-50';
      case 'CHEMICAL_SPILL': return 'text-purple-600 bg-purple-50';
      case 'MEDICAL_EMERGENCY': return 'text-green-600 bg-green-50';
      case 'SECURITY_BREACH': return 'text-gray-600 bg-gray-50';
      case 'EVACUATION': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'FIRE': return 'Incendio';
      case 'EARTHQUAKE': return 'Sismo';
      case 'FLOOD': return 'Inundación';
      case 'CHEMICAL_SPILL': return 'Derrame Químico';
      case 'MEDICAL_EMERGENCY': return 'Emergencia Médica';
      case 'SECURITY_BREACH': return 'Brecha de Seguridad';
      case 'EVACUATION': return 'Evacuación';
      default: return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNED': return 'text-blue-600 bg-blue-50';
      case 'IN_PROGRESS': return 'text-yellow-600 bg-yellow-50';
      case 'COMPLETED': return 'text-green-600 bg-green-50';
      case 'CANCELLED': return 'text-red-600 bg-red-50';
      case 'POSTPONED': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PLANNED': return 'Planificado';
      case 'IN_PROGRESS': return 'En Progreso';
      case 'COMPLETED': return 'Completado';
      case 'CANCELLED': return 'Cancelado';
      case 'POSTPONED': return 'Postergado';
      default: return status;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-600 bg-red-50';
      case 'HIGH': return 'text-orange-600 bg-orange-50';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50';
      case 'LOW': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const isOverdue = (drill: DrillScenario) => {
    if (drill.status === 'COMPLETED' || drill.status === 'CANCELLED') {
      return false;
    }
    return new Date(drill.schedule.plannedDate) < new Date();
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'Crítica';
      case 'HIGH': return 'Alta';
      case 'MEDIUM': return 'Media';
      case 'LOW': return 'Baja';
      default: return severity;
    }
  };

  const getPlanTypeLabel = (type: string) => {
    switch (type) {
      case 'EMERGENCY_RESPONSE': return 'Respuesta a Emergencias';
      case 'BUSINESS_CONTINUITY': return 'Continuidad del Negocio';
      case 'DISASTER_RECOVERY': return 'Recuperación ante Desastres';
      case 'CRISIS_MANAGEMENT': return 'Gestión de Crisis';
      case 'COMMUNICATION': return 'Comunicación';
      default: return type;
    }
  };

  const getPlanStatusLabel = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'Borrador';
      case 'ACTIVE': return 'Activo';
      case 'UNDER_REVIEW': return 'En Revisión';
      case 'ARCHIVED': return 'Archivado';
      default: return status;
    }
  };

  const getPlanStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'text-gray-600 bg-gray-50';
      case 'ACTIVE': return 'text-green-600 bg-green-50';
      case 'UNDER_REVIEW': return 'text-yellow-600 bg-yellow-50';
      case 'ARCHIVED': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Funciones helper para Recursos de Emergencia
  const getResourceTypeLabel = (type: string) => {
    switch (type) {
      case 'EQUIPMENT': return 'Equipo';
      case 'SUPPLY': return 'Suministro';
      case 'PERSONNEL': return 'Personal';
      case 'FACILITY': return 'Instalación';
      case 'EXTERNAL': return 'Contacto Externo';
      default: return type;
    }
  };

  const getResourceCategoryLabel = (category: string) => {
    switch (category) {
      case 'FIRE_SAFETY': return 'Seguridad contra Incendios';
      case 'MEDICAL': return 'Médico';
      case 'EVACUATION': return 'Evacuación';
      case 'COMMUNICATION': return 'Comunicación';
      case 'POWER': return 'Energía';
      case 'INFRASTRUCTURE': return 'Infraestructura';
      default: return category;
    }
  };

  const getResourceStatusLabel = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'Disponible';
      case 'IN_USE': return 'En Uso';
      case 'MAINTENANCE': return 'Mantenimiento';
      case 'UNAVAILABLE': return 'No Disponible';
      default: return status;
    }
  };

  const getResourceStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'text-green-600 bg-green-50';
      case 'IN_USE': return 'text-blue-600 bg-blue-50';
      case 'MAINTENANCE': return 'text-yellow-600 bg-yellow-50';
      case 'UNAVAILABLE': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const filteredPlans = contingencyPlans.filter(plan => {
    if (planSearchQuery && !plan.name.toLowerCase().includes(planSearchQuery.toLowerCase()) &&
        !plan.description?.toLowerCase().includes(planSearchQuery.toLowerCase())) {
      return false;
    }
    if (planFilterType !== 'all' && plan.type !== planFilterType) return false;
    if (planFilterStatus !== 'all' && plan.status !== planFilterStatus) return false;
    return true;
  });

  const filteredResources = resources.filter(resource => {
    if (resourceSearchQuery && !resource.name.toLowerCase().includes(resourceSearchQuery.toLowerCase()) &&
        !resource.description?.toLowerCase().includes(resourceSearchQuery.toLowerCase())) {
      return false;
    }
    if (resourceFilterType !== 'all' && resource.type !== resourceFilterType) return false;
    if (resourceFilterStatus !== 'all' && resource.status !== resourceFilterStatus) return false;
    return true;
  });

  const filteredDrills = drills.filter(drill => {
    if (searchQuery && !drill.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !drill.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterType !== 'all' && drill.type !== filterType) return false;
    if (filterStatus !== 'all' && drill.status !== filterStatus) return false;
    if (filterSeverity !== 'all' && drill.severity !== filterSeverity) return false;
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
          <h1 className="text-2xl font-bold text-gray-900">Simulacros y Planes de Contingencia</h1>
          <p className="text-gray-600">Gestión de simulacros, planes de emergencia y recursos de contingencia</p>
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
            onClick={() => {
              if (activeTab === 'plans') {
                setShowCreatePlanModal(true);
              } else if (activeTab === 'resources') {
                setShowCreateResourceModal(true);
              } else {
                setShowCreateModal(true);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            {activeTab === 'plans' ? 'Nuevo Plan' : activeTab === 'resources' ? 'Nuevo Recurso' : 'Nuevo Simulacro'}
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Simulacros Este Año</p>
              <p className="text-2xl font-bold text-gray-900">{stats.drills_this_year}</p>
            </div>
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Simulacros Vencidos</p>
              <p className="text-2xl font-bold text-red-900">{stats.overdue_drills}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Planes Activos</p>
              <p className="text-2xl font-bold text-green-900">{stats.active_plans}</p>
            </div>
            <Target className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Recursos Críticos</p>
              <p className="text-2xl font-bold text-purple-900">{stats.critical_resources_unavailable}</p>
            </div>
            <Activity className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="flex items-center gap-6 p-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('drills')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
              activeTab === 'drills' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Shield className="w-4 h-4" />
            Simulacros
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
              activeTab === 'plans' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            Planes de Contingencia
          </button>
          <button
            onClick={() => setActiveTab('resources')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
              activeTab === 'resources' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Activity className="w-4 h-4" />
            Recursos de Emergencia
          </button>
        </div>

        {/* Filters */}
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-[300px]">
              <Search className="w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar simulacros..."
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
              <option value="FIRE">Incendio</option>
              <option value="EARTHQUAKE">Sismo</option>
              <option value="FLOOD">Inundación</option>
              <option value="CHEMICAL_SPILL">Derrame Químico</option>
              <option value="MEDICAL_EMERGENCY">Emergencia Médica</option>
              <option value="SECURITY_BREACH">Brecha de Seguridad</option>
              <option value="EVACUATION">Evacuación</option>
            </select>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los estados</option>
              <option value="PLANNED">Planificado</option>
              <option value="IN_PROGRESS">En Progreso</option>
              <option value="COMPLETED">Completado</option>
              <option value="CANCELLED">Cancelado</option>
              <option value="POSTPONED">Postergado</option>
            </select>
            
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todas las severidades</option>
              <option value="CRITICAL">Crítica</option>
              <option value="HIGH">Alta</option>
              <option value="MEDIUM">Media</option>
              <option value="LOW">Baja</option>
            </select>
          </div>
        </div>

        {/* Content based on active tab */}
        <div className="p-4">
          {activeTab === 'drills' && (
            <div className="space-y-4">
              {filteredDrills.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No hay simulacros programados</h3>
                  <p className="text-gray-600">
                    {searchQuery || filterType !== 'all' || filterStatus !== 'all' || filterSeverity !== 'all'
                      ? 'No se encontraron simulacros con los filtros seleccionados'
                      : 'Comienza programando tu primer simulacro'}
                  </p>
                </div>
              ) : (
                filteredDrills.map(drill => (
                  <div key={drill.id} className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{drill.name}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(drill.type)}`}>
                            {getTypeLabel(drill.type)}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(drill.status)}`}>
                            {getStatusLabel(drill.status)}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(drill.severity)}`}>
                            {getSeverityLabel(drill.severity)}
                          </span>
                          {isOverdue(drill) && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                              Vencido
                            </span>
                          )}
                        </div>
                        
                        <p className="text-gray-600 mb-3">{drill.description}</p>
                        
                        <div className="flex items-center gap-6 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(drill.schedule.plannedDate).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{drill.schedule.duration}h</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>{drill.scope?.participants ?? 0} participantes</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>{drill.scope?.areas?.join(', ') || 'Sin áreas'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            <span>{drill.coordinator?.name || 'Sin coordinador'}</span>
                          </div>
                        </div>

                        {/* Objectives */}
                        {drill.objectives?.length > 0 && (
                          <div className="mt-3">
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Objetivos:</h4>
                            <ul className="text-sm text-gray-600 list-disc list-inside">
                              {drill.objectives.slice(0, 3).map((objective, index) => (
                                <li key={index}>{objective}</li>
                              ))}
                              {drill.objectives.length > 3 && (
                                <li className="text-gray-400">+{drill.objectives.length - 3} más...</li>
                              )}
                            </ul>
                          </div>
                        )}

                        {/* Results for completed drills */}
                        {drill.status === 'COMPLETED' && drill.results && (
                          <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                            <h4 className="text-sm font-medium text-green-800 mb-2">Resultados:</h4>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-green-700">Tasa Completación:</span>
                                <span className="font-medium text-green-900 ml-1">{drill.results.completion_rate.toFixed(1)}%</span>
                              </div>
                              <div>
                                <span className="text-green-700">Satisfacción:</span>
                                <span className="font-medium text-green-900 ml-1">{drill.results.participant_satisfaction.toFixed(1)}/5</span>
                              </div>
                              <div>
                                <span className="text-green-700">Objetivos Logrados:</span>
                                <span className="font-medium text-green-900 ml-1">{drill.results.objectives_achieved}/{drill.objectives.length}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Link 
                          href={`/simulacros/${drill.id}`}
                          className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link 
                          href={`/simulacros/${drill.id}/gestionar`}
                          className="p-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg"
                          title="Gestionar resultados, acciones, participantes, IA y alertas"
                        >
                          <Settings className="w-4 h-4" />
                        </Link>
                        <button 
                          onClick={() => handleDeleteDrill(drill.id)}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                          title="Eliminar simulacro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'plans' && (
            <div className="space-y-4">
              {/* Plan Filters */}
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className="flex items-center gap-2 flex-1 min-w-[300px]">
                  <Search className="w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Buscar planes..."
                    value={planSearchQuery}
                    onChange={(e) => setPlanSearchQuery(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={planFilterType}
                  onChange={(e) => setPlanFilterType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Todos los tipos</option>
                  <option value="EMERGENCY_RESPONSE">Respuesta a Emergencias</option>
                  <option value="BUSINESS_CONTINUITY">Continuidad del Negocio</option>
                  <option value="DISASTER_RECOVERY">Recuperación ante Desastres</option>
                  <option value="CRISIS_MANAGEMENT">Gestión de Crisis</option>
                  <option value="COMMUNICATION">Comunicación</option>
                </select>
                <select
                  value={planFilterStatus}
                  onChange={(e) => setPlanFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Todos los estados</option>
                  <option value="DRAFT">Borrador</option>
                  <option value="ACTIVE">Activo</option>
                  <option value="UNDER_REVIEW">En Revisión</option>
                  <option value="ARCHIVED">Archivado</option>
                </select>
              </div>

              {/* Plans List */}
              {filteredPlans.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No hay planes de contingencia</h3>
                  <p className="text-gray-600">
                    {planSearchQuery || planFilterType !== 'all' || planFilterStatus !== 'all'
                      ? 'No se encontraron planes con los filtros seleccionados'
                      : 'Comienza creando tu primer plan de contingencia'}
                  </p>
                </div>
              ) : (
                filteredPlans.map(plan => (
                  <div key={plan.id} className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getPlanStatusColor(plan.status)}`}>
                            {getPlanStatusLabel(plan.status)}
                          </span>
                          <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                            {getPlanTypeLabel(plan.type)}
                          </span>
                        </div>
                        
                        <p className="text-gray-600 mb-3">{plan.description}</p>
                        
                        <div className="flex items-center gap-6 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>{plan.coverage?.areas?.join(', ') || 'Área Principal'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>{plan.coverage?.departments?.join(', ') || 'Seguridad'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>Versión {plan.version || '1.0'}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Link 
                          href={`/simulacros/planes/${plan.id}`}
                          className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button 
                          onClick={() => handleDeletePlan(plan.id)}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                          title="Eliminar plan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'resources' && (
            <div className="space-y-6">
              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar recursos..."
                    value={resourceSearchQuery}
                    onChange={(e) => setResourceSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={resourceFilterType}
                  onChange={(e) => setResourceFilterType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Todos los tipos</option>
                  <option value="EQUIPMENT">Equipo</option>
                  <option value="SUPPLY">Suministro</option>
                  <option value="PERSONNEL">Personal</option>
                  <option value="FACILITY">Instalación</option>
                  <option value="EXTERNAL">Contacto Externo</option>
                </select>
                <select
                  value={resourceFilterStatus}
                  onChange={(e) => setResourceFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Todos los estados</option>
                  <option value="AVAILABLE">Disponible</option>
                  <option value="IN_USE">En Uso</option>
                  <option value="MAINTENANCE">Mantenimiento</option>
                  <option value="UNAVAILABLE">No Disponible</option>
                </select>
              </div>

              {/* Resources List */}
              {filteredResources.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No hay recursos de emergencia</h3>
                  <p className="text-gray-600">Comienza creando tu primer recurso de emergencia</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredResources.map((resource) => (
                    <div
                      key={resource.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-gray-900">{resource.name}</h3>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getResourceStatusColor(resource.status)}`}>
                              {getResourceStatusLabel(resource.status)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{resource.description || 'Sin descripción'}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Target className="w-4 h-4" />
                              {getResourceTypeLabel(resource.type)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {resource.location || 'Sin ubicación'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Activity className="w-4 h-4" />
                              Cantidad: {resource.quantity}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/simulacros/recursos/${resource.id}`}
                            className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDeleteResource(resource.id)}
                            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                            title="Eliminar recurso"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal para crear simulacro */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Nuevo Simulacro</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Simulacro de Incendio"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={newItemDescription}
                  onChange={(e) => setNewItemDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Descripción del simulacro..."
                />
              </div>

              <ComboSelect
                label="Tipo"
                options={drillTypeOptions}
                value={newItemType}
                onChange={setNewItemType}
                onAddCustom={(newOption) => {
                  const optionValue = typeof newOption === 'string' ? newOption : newOption.value;
                  const optionLabel = typeof newOption === 'string' ? newOption : newOption.label;
                  setDrillTypeOptions([...drillTypeOptions, { value: optionValue, label: optionLabel }]);
                  setNewItemType(optionValue);
                }}
                allowCustom={true}
              />

              <ComboSelect
                label="Severidad"
                options={[
                  { value: 'LOW', label: 'Baja' },
                  { value: 'MEDIUM', label: 'Media' },
                  { value: 'HIGH', label: 'Alta' },
                  { value: 'CRITICAL', label: 'Crítica' }
                ]}
                value={newItemSeverity}
                onChange={setNewItemSeverity}
                allowCustom={false}
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateDrill}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para crear Plan de Contingencia */}
      {showCreatePlanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Nuevo Plan de Contingencia</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Plan de Respuesta a Incendios"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={newPlanDescription}
                  onChange={(e) => setNewPlanDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Descripción del plan de contingencia..."
                />
              </div>

              <ComboSelect
                label="Tipo"
                options={planTypeOptions}
                value={newPlanType}
                onChange={setNewPlanType}
                onAddCustom={(newOption) => {
                  const optionValue = typeof newOption === 'string' ? newOption : newOption.value;
                  const optionLabel = typeof newOption === 'string' ? newOption : newOption.label;
                  setPlanTypeOptions([...planTypeOptions, { value: optionValue, label: optionLabel }]);
                  setNewPlanType(optionValue);
                }}
                allowCustom={true}
              />

              <ComboSelect
                label="Categoría"
                options={[
                  { value: 'OPERATIONAL', label: 'Operacional' },
                  { value: 'TECHNOLOGICAL', label: 'Tecnológica' },
                  { value: 'INFRASTRUCTURE', label: 'Infraestructura' },
                  { value: 'HEALTH_SAFETY', label: 'Salud y Seguridad' },
                  { value: 'ENVIRONMENTAL', label: 'Ambiental' }
                ]}
                value={newPlanCategory}
                onChange={setNewPlanCategory}
                allowCustom={false}
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowCreatePlanModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreatePlan}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para crear Recurso de Emergencia */}
      {showCreateResourceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Nuevo Recurso de Emergencia</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={newResourceName}
                  onChange={(e) => setNewResourceName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Extintor de CO2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={newResourceDescription}
                  onChange={(e) => setNewResourceDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Descripción del recurso..."
                />
              </div>

              <ComboSelect
                label="Tipo"
                options={resourceTypeOptions}
                value={newResourceType}
                onChange={setNewResourceType}
                onAddCustom={(newOption) => {
                  const optionValue = typeof newOption === 'string' ? newOption : newOption.value;
                  const optionLabel = typeof newOption === 'string' ? newOption : newOption.label;
                  setResourceTypeOptions([...resourceTypeOptions, { value: optionValue, label: optionLabel }]);
                  setNewResourceType(optionValue);
                }}
                allowCustom={true}
              />

              <ComboSelect
                label="Categoría"
                options={[
                  { value: 'FIRE_SAFETY', label: 'Seguridad contra Incendios' },
                  { value: 'MEDICAL', label: 'Médico' },
                  { value: 'EVACUATION', label: 'Evacuación' },
                  { value: 'COMMUNICATION', label: 'Comunicación' },
                  { value: 'POWER', label: 'Energía' },
                  { value: 'INFRASTRUCTURE', label: 'Infraestructura' }
                ]}
                value={newResourceCategory}
                onChange={setNewResourceCategory}
                allowCustom={false}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                <input
                  type="number"
                  value={newResourceQuantity}
                  onChange={(e) => setNewResourceQuantity(parseInt(e.target.value) || 1)}
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                <input
                  type="text"
                  value={newResourceLocation}
                  onChange={(e) => setNewResourceLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Planta baja, pasillo principal"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowCreateResourceModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateResource}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
