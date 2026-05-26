/**
 * MULTI-AGENT AI SYSTEM
 * SGI360 Enterprise Conversational Operating System
 * 
 * Agentes especializados con routing inteligente:
 * - Cada agente tiene su propio contexto, prompt y herramientas
 * - El router decide qué agentes participan
 * - Las respuestas se combinan con atribución visible
 */

import { PrismaClient } from '@prisma/client';

// ── Agent Types ──────────────────────────────────────────────

export interface Agent {
  id: string;
  name: string;
  icon: string;
  color: string;
  specialization: string;
  capabilities: string[];
  systemPrompt: string;
}

export interface AgentResponse {
  agentId: string;
  agentName: string;
  agentIcon: string;
  agentColor: string;
  content: string;
  confidence: number;
  reasoning?: string[];
  dataSources?: string[];
  suggestedActions?: Array<{ type: string; label: string; payload?: any }>;
}

export interface AgentRoutingResult {
  primaryAgent: string;
  supportingAgents: string[];
  reasoning: string;
  confidence: number;
}

// ── Agent Registry ───────────────────────────────────────────

export const AGENTS: Record<string, Agent> = {
  auditor: {
    id: 'auditor',
    name: 'Auditor Agent',
    icon: 'Shield',
    color: '#8b5cf6',
    specialization: 'Auditorías, cumplimiento normativo ISO, hallazgos',
    capabilities: ['audit_analysis', 'compliance_check', 'finding_tracking', 'checklist_evaluation'],
    systemPrompt: `Eres el AGENTE AUDITOR de SGI360. Especialista en:
- Auditorías internas y externas ISO 9001/14001/45001
- Hallazgos, no conformidades, observaciones
- Cumplimiento normativo y regulatorio
- Preparación para certificaciones
- Planes de acción y seguimiento
Analiza con rigor técnico. Cita normas cuando corresponda. Prioriza riesgos de incumplimiento.`
  },

  compliance: {
    id: 'compliance',
    name: 'Compliance Agent',
    icon: 'FileText',
    color: '#3b82f6',
    specialization: 'Gestión documental, vencimientos, revisiones',
    capabilities: ['document_control', 'expiry_tracking', 'revision_management', 'regulatory_compliance'],
    systemPrompt: `Eres el AGENTE DE COMPLIANCE de SGI360. Especialista en:
- Control documental ISO
- Vencimientos de documentos, calibraciones, certificados
- Revisiones pendientes y aprobaciones
- Normativas aplicables por industria
Detecta documentos vencidos, revisiones pendientes, y riesgos regulatorios.`
  },

  risk: {
    id: 'risk',
    name: 'Risk Agent',
    icon: 'AlertTriangle',
    color: '#ef4444',
    specialization: 'Gestión de riesgos, evaluación, mitigación',
    capabilities: ['risk_assessment', 'mitigation_planning', 'trend_detection', 'impact_analysis'],
    systemPrompt: `Eres el AGENTE DE RIESGOS de SGI360. Especialista en:
- Evaluación de riesgos empresariales
- Matrices de probabilidad e impacto
- Planes de mitigación y controles
- Riesgos emergentes y tendencias
- Análisis de impacto cruzado entre módulos
Prioriza por severidad. Detecta correlaciones de riesgo. Sugiere controles.`
  },

  fleet: {
    id: 'fleet',
    name: 'Fleet Agent',
    icon: 'Truck',
    color: '#f59e0b',
    specialization: 'Gestión de flota, mantenimiento, disponibilidad',
    capabilities: ['fleet_status', 'maintenance_tracking', 'cost_analysis', 'availability_forecast'],
    systemPrompt: `Eres el AGENTE DE FLOTA de SGI360. Especialista en:
- Estado operativo de vehículos
- Mantenimiento preventivo y correctivo
- Costos por km, disponibilidad, eficiencia
- Vencimientos de documentación vehicular
- Inspecciones y hallazgos de flota
Optimiza disponibilidad. Detecta mantenimientos vencidos. Analiza costos.`
  },

  maintenance: {
    id: 'maintenance',
    name: 'Maintenance Agent',
    icon: 'Wrench',
    color: '#10b981',
    specialization: 'Mantenimiento preventivo/correctivo, infraestructura',
    capabilities: ['maintenance_scheduling', 'failure_prediction', 'cost_optimization', 'asset_lifecycle'],
    systemPrompt: `Eres el AGENTE DE MANTENIMIENTO de SGI360. Especialista en:
- Planes de mantenimiento preventivo
- Análisis de fallas recurrentes
- Optimización de costos de mantenimiento
- Ciclo de vida de activos
- Predicción de fallas
Prioriza mantenimientos críticos. Detecta patrones de falla. Optimiza intervalos.`
  },

  hr: {
    id: 'hr',
    name: 'HR Agent',
    icon: 'Users',
    color: '#ec4899',
    specialization: 'Recursos humanos, capacitaciones, competencias',
    capabilities: ['workforce_analysis', 'training_gaps', 'competency_assessment', 'retention_risk'],
    systemPrompt: `Eres el AGENTE DE RRHH de SGI360. Especialista en:
- Dotación y distribución de personal
- Brechas de competencia y capacitación
- Matriz de polivalencia
- Rotación y retención de talento
- Clima organizacional
Identifica gaps críticos. Sugiere capacitaciones. Analiza distribución.`
  },

  executive: {
    id: 'executive',
    name: 'Executive Agent',
    icon: 'Crown',
    color: '#6366f1',
    specialization: 'Visión estratégica, KPIs, decisiones de alto nivel',
    capabilities: ['strategic_analysis', 'kpi_synthesis', 'executive_summary', 'decision_support'],
    systemPrompt: `Eres el AGENTE EJECUTIVO de SGI360. Especialista en:
- Resúmenes ejecutivos de alto nivel
- Síntesis de KPIs y tendencias
- Soporte a la toma de decisiones
- Visión holística de la organización
- Priorización estratégica
Comunica de forma clara y accionable. Destaca lo más importante. Resume para directivos.`
  },

  projects: {
    id: 'projects',
    name: 'Project Agent',
    icon: 'Kanban',
    color: '#06b6d4',
    specialization: 'Gestión de proyectos, avance, presupuesto',
    capabilities: ['project_tracking', 'budget_analysis', 'timeline_management', 'resource_allocation'],
    systemPrompt: `Eres el AGENTE DE PROYECTOS de SGI360. Especialista en:
- Estado y avance de proyectos
- Desviaciones de cronograma y presupuesto
- Gestión de hitos y entregables
- Análisis de recursos y carga de trabajo
- Riesgos de proyectos
Detecta desvíos. Sugiere re-priorización. Anticipa atrasos.`
  },

  quality: {
    id: 'quality',
    name: 'Quality Agent',
    icon: 'CheckCircle',
    color: '#84cc16',
    specialization: 'Calidad, NCRs, CAPAs, mejora continua',
    capabilities: ['ncr_analysis', 'capa_tracking', 'trend_detection', 'root_cause_analysis'],
    systemPrompt: `Eres el AGENTE DE CALIDAD de SGI360. Especialista en:
- No Conformidades (NCR): análisis, tendencias, severidades
- Acciones Correctivas (CAPA): efectividad, plazos, seguimiento
- Mejora continua: indicadores de calidad
- Análisis de causa raíz
- Costos de no calidad
Detecta patrones. Evalúa efectividad de CAPAs. Prioriza por impacto.`
  },

  operations: {
    id: 'operations',
    name: 'Operations Agent',
    icon: 'Activity',
    color: '#f97316',
    specialization: 'Operaciones diarias, eficiencia, logística',
    capabilities: ['operational_efficiency', 'logistics_analysis', 'process_optimization', 'bottleneck_detection'],
    systemPrompt: `Eres el AGENTE OPERACIONAL de SGI360. Especialista en:
- Eficiencia operativa diaria
- Logística y distribución
- Cuellos de botella y demoras
- Optimización de procesos
- Coordinación entre áreas
Identifica ineficiencias. Propone mejoras operativas. Conecta áreas.`
  }
};

// ── Agent Router ─────────────────────────────────────────────

export class AgentRouter {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Decide qué agentes deben participar en una consulta
   */
  routeQuery(query: string): AgentRoutingResult {
    const q = query.toLowerCase();
    let primaryAgent = 'executive'; // Default
    const supportingAgents: string[] = [];
    let confidence = 0.7;
    let reasoning = '';

    // Fleet
    if (/flota|vehículo|vehiculo|camión|camion|unidad|dominio|patente|transporte/.test(q)) {
      primaryAgent = 'fleet';
      reasoning = 'Consulta sobre flota/vehículos';
      confidence = 0.9;
      if (/mantenimiento|taller|reparación/.test(q)) supportingAgents.push('maintenance');
      if (/hallazgo|inspección|inspeccion/.test(q)) supportingAgents.push('quality');
    }
    // Maintenance
    else if (/mantenimiento|reparación|taller|preventivo|correctivo|activo/.test(q)) {
      primaryAgent = 'maintenance';
      reasoning = 'Consulta sobre mantenimiento';
      confidence = 0.85;
      if (/flota|veh/.test(q)) supportingAgents.push('fleet');
    }
    // Quality
    else if (/ncr|no conformidad|capa|acción correctiva|calidad|defecto|reclamo/.test(q)) {
      primaryAgent = 'quality';
      reasoning = 'Consulta sobre calidad/NCR/CAPA';
      confidence = 0.9;
      if (/auditor|norma|iso/.test(q)) supportingAgents.push('auditor');
      if (/riesgo/.test(q)) supportingAgents.push('risk');
    }
    // Audit
    else if (/auditoría|auditoria|auditor|iso|norma|certificación|hallazgo.*audit/.test(q)) {
      primaryAgent = 'auditor';
      reasoning = 'Consulta sobre auditorías/compliance';
      confidence = 0.9;
      supportingAgents.push('compliance');
      if (/riesgo/.test(q)) supportingAgents.push('risk');
    }
    // Risk
    else if (/riesgo|amenaza|vulnerabilidad|impacto|probabilidad|mitigación/.test(q)) {
      primaryAgent = 'risk';
      reasoning = 'Consulta sobre gestión de riesgos';
      confidence = 0.85;
    }
    // Projects
    else if (/proyecto|avance|cronograma|presupuesto|hito|entregable|milestone/.test(q)) {
      primaryAgent = 'projects';
      reasoning = 'Consulta sobre proyectos';
      confidence = 0.85;
      if (/costo|presupuesto/.test(q)) supportingAgents.push('executive');
    }
    // HR
    else if (/empleado|personal|rrhh|capacitación|competencia|polivalencia|dotación/.test(q)) {
      primaryAgent = 'hr';
      reasoning = 'Consulta sobre recursos humanos';
      confidence = 0.85;
    }
    // Documents/Compliance
    else if (/documento|vencimiento|revisión|aprobación|normativa/.test(q)) {
      primaryAgent = 'compliance';
      reasoning = 'Consulta sobre documentos/compliance';
      confidence = 0.8;
    }
    // Operations
    else if (/operación|logística|eficiencia|proceso|cuello de botella|demora/.test(q)) {
      primaryAgent = 'operations';
      reasoning = 'Consulta sobre operaciones';
      confidence = 0.8;
    }
    // Executive / General / Dashboard
    else if (/dashboard|resumen|general|kpi|indicador|estado.*general|reporte/.test(q)) {
      primaryAgent = 'executive';
      reasoning = 'Consulta ejecutiva/general';
      confidence = 0.85;
      supportingAgents.push('quality', 'projects', 'fleet');
    }
    // Correlation queries
    else if (/relacion|correlación|impacta|afecta|conecta|vinculad/.test(q)) {
      primaryAgent = 'executive';
      reasoning = 'Consulta de correlación cross-module';
      confidence = 0.8;
      // Add all relevant agents
      supportingAgents.push('quality', 'risk', 'operations');
    }
    else {
      reasoning = 'Consulta general — agente ejecutivo';
      confidence = 0.7;
    }

    return {
      primaryAgent,
      supportingAgents: supportingAgents.filter(a => a !== primaryAgent),
      reasoning,
      confidence
    };
  }

  /**
   * Obtiene los prompts combinados de los agentes seleccionados
   */
  getAgentPrompts(routing: AgentRoutingResult): string {
    const primary = AGENTS[routing.primaryAgent];
    let combined = `AGENTE PRINCIPAL: ${primary.name}\n${primary.systemPrompt}\n`;

    for (const agentId of routing.supportingAgents) {
      const agent = AGENTS[agentId];
      if (agent) {
        combined += `\nAGENTE DE SOPORTE (${agent.name}):\n${agent.systemPrompt}\n`;
      }
    }

    return combined;
  }

  /**
   * Retorna info de agentes para mostrar en UI
   */
  getAgentBadges(routing: AgentRoutingResult): Array<{ id: string; name: string; icon: string; color: string; role: 'primary' | 'supporting' }> {
    const badges: Array<{ id: string; name: string; icon: string; color: string; role: 'primary' | 'supporting' }> = [];
    
    const primary = AGENTS[routing.primaryAgent];
    if (primary) {
      badges.push({ id: primary.id, name: primary.name, icon: primary.icon, color: primary.color, role: 'primary' });
    }

    for (const agentId of routing.supportingAgents) {
      const agent = AGENTS[agentId];
      if (agent) {
        badges.push({ id: agent.id, name: agent.name, icon: agent.icon, color: agent.color, role: 'supporting' });
      }
    }

    return badges;
  }
}

export default AgentRouter;
