/**
 * AI STRATEGIC SIMULATION ENGINE
 * SGI360 Command Center - Simulación estratégica y análisis de escenarios
 * 
 * Permite simular y analizar:
 * - Escenarios de negocio hipotéticos
 * - Impacto de decisiones estratégicas
 * - Proyecciones financieras y operativas
 * - Análisis de riesgos y oportunidades
 * - Optimización de recursos
 * - Modelado de "what-if"
 */

import { PrismaClient } from '@prisma/client';
import { AIOrchestrator } from './ai-orchestrator';

interface SimulationScenario {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  type: 'financial' | 'operational' | 'risk' | 'opportunity' | 'resource';
  parameters: Record<string, any>;
  assumptions: Array<{
    variable: string;
    value: any;
    confidence: 'high' | 'medium' | 'low';
  }>;
  timeframe: number; // meses
  status: 'draft' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}

interface SimulationResult {
  scenarioId: string;
  outcomes: Array<{
    metric: string;
    baseline: number;
    projected: number;
    variance: number;
    variancePercent: number;
    trend: 'improving' | 'declining' | 'stable';
    confidence: number;
  }>;
  risks: Array<{
    type: string;
    probability: number;
    impact: number;
    description: string;
    mitigation: string;
  }>;
  opportunities: Array<{
    type: string;
    potential: number;
    description: string;
    requirements: string[];
  }>;
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    expectedImpact: string;
    timeline: string;
    resources: string[];
  }>;
  charts: Array<{
    type: 'line' | 'bar' | 'pie' | 'scatter';
    title: string;
    data: any;
    description: string;
  }>;
  summary: string;
  confidence: number;
}

export class AIStrategicSimulationEngine {
  private prisma: PrismaClient;
  private aiOrchestrator: AIOrchestrator;

  constructor(prisma: PrismaClient, aiOrchestrator: AIOrchestrator) {
    this.prisma = prisma;
    this.aiOrchestrator = aiOrchestrator;
  }

  /**
   * Crea un nuevo escenario de simulación
   */
  async createScenario(
    tenantId: string,
    scenarioData: Omit<SimulationScenario, 'id' | 'tenantId' | 'createdAt' | 'status'>
  ): Promise<SimulationScenario> {
    try {
      const scenario = await (this.prisma as any).aISimulation.create({
        data: {
          tenantId,
          name: scenarioData.name,
          description: scenarioData.description,
          type: scenarioData.type,
          parameters: scenarioData.parameters,
          assumptions: scenarioData.assumptions,
          timeframe: scenarioData.timeframe,
          status: 'draft',
          createdAt: new Date()
        }
      });

      return {
        id: scenario.id,
        ...scenarioData,
        tenantId,
        createdAt: scenario.createdAt,
        status: 'draft'
      };

    } catch (error: any) {
      console.error('[Strategic Simulation] Error creating scenario:', error);
      throw new Error('Error al crear escenario de simulación');
    }
  }

  /**
   * Ejecuta una simulación estratégica
   */
  async runSimulation(scenarioId: string): Promise<SimulationResult> {
    try {
      // Obtener escenario
      const scenario = await (this.prisma as any).aISimulation.findUnique({
        where: { id: scenarioId }
      });

      if (!scenario) {
        throw new Error('Escenario no encontrado');
      }

      // Actualizar estado
      await (this.prisma as any).aISimulation.update({
        where: { id: scenarioId },
        data: { status: 'running' }
      });

      // Obtener datos base del tenant
      const baseData = await this.getTenantBaseData(scenario.tenantId);

      // Ejecutar simulación según tipo
      let result: SimulationResult;
      
      switch (scenario.type) {
        case 'financial':
          result = await this.runFinancialSimulation(scenario, baseData);
          break;
        case 'operational':
          result = await this.runOperationalSimulation(scenario, baseData);
          break;
        case 'risk':
          result = await this.runRiskSimulation(scenario, baseData);
          break;
        case 'opportunity':
          result = await this.runOpportunitySimulation(scenario, baseData);
          break;
        case 'resource':
          result = await this.runResourceSimulation(scenario, baseData);
          break;
        default:
          throw new Error('Tipo de simulación no soportado');
      }

      // Guardar resultado
      await (this.prisma as any).aISimulationResult.create({
        data: {
          scenarioId,
          outcomes: result.outcomes,
          risks: result.risks,
          opportunities: result.opportunities,
          recommendations: result.recommendations,
          charts: result.charts,
          summary: result.summary,
          confidence: result.confidence,
          createdAt: new Date()
        }
      });

      // Actualizar estado del escenario
      await (this.prisma as any).aISimulation.update({
        where: { id: scenarioId },
        data: { 
          status: 'completed',
          completedAt: new Date()
        }
      });

      return result;

    } catch (error: any) {
      console.error('[Strategic Simulation] Error running simulation:', error);
      
      // Actualizar estado a fallido
      await (this.prisma as any).aISimulation.update({
        where: { id: scenarioId },
        data: { status: 'failed' }
      });

      throw error;
    }
  }

  /**
   * Simulación financiera
   */
  private async runFinancialSimulation(
    scenario: any,
    baseData: any
  ): Promise<SimulationResult> {
    try {
      const prompt = `
        Como experto en análisis financiero y estrategia de negocio, simula el siguiente escenario:

        ESCENARIO: ${scenario.name}
        DESCRIPCIÓN: ${scenario.description}
        PARÁMETROS: ${JSON.stringify(scenario.parameters, null, 2)}
        SUPUESTOS: ${JSON.stringify(scenario.assumptions, null, 2)}
        PERIODO: ${scenario.timeframe} meses

        DATOS BASE ACTUALES:
        - Ingresos mensuales: ${baseData.monthlyRevenue}
        - Costos operativos: ${baseData.operationalCosts}
        - Margen actual: ${baseData.currentMargin}%
        - Crecimiento histórico: ${baseData.historicalGrowth}%
        - Número de proyectos activos: ${baseData.activeProjects}
        - Tamaño del equipo: ${baseData.teamSize}

        Analiza y proyecta:
        1. Impacto en ingresos y costos
        2. Flujo de caja proyectado
        3. ROI y punto de equilibrio
        4. Riesgos financieros
        5. Oportunidades de optimización

        Responde en formato JSON con la estructura:
        {
          "outcomes": [
            {
              "metric": "nombre_métrica",
              "baseline": valor_actual,
              "projected": valor_proyectado,
              "variance": diferencia_absoluta,
              "variancePercent": diferencia_porcentual,
              "trend": "improving|declining|stable",
              "confidence": 0.85
            }
          ],
          "risks": [...],
          "opportunities": [...],
          "recommendations": [...],
          "charts": [...],
          "summary": "resumen ejecutivo",
          "confidence": 0.80
        }
      `;

      const aiResponse = await this.aiOrchestrator.processQuery(
        prompt,
        scenario.tenantId,
        'system',
        'ADMIN'
      );

      // Parsear respuesta y formatear
      const result = this.parseSimulationResponse(aiResponse.summary);
      
      // Generar charts específicos para simulación financiera
      result.charts = [
        {
          type: 'line',
          title: 'Proyección de Ingresos vs Costos',
          data: this.generateFinancialProjectionChart(baseData, scenario.parameters),
          description: 'Comparación mensual de ingresos proyectados vs costos'
        },
        {
          type: 'bar',
          title: 'Análisis de Rentabilidad',
          data: this.generateProfitabilityChart(baseData, scenario.parameters),
          description: 'Margen de rentabilidad proyectado por período'
        }
      ];

      return result;

    } catch (error: any) {
      console.error('[Strategic Simulation] Error in financial simulation:', error);
      throw error;
    }
  }

  /**
   * Simulación operativa
   */
  private async runOperationalSimulation(
    scenario: any,
    baseData: any
  ): Promise<SimulationResult> {
    try {
      const prompt = `
        Como experto en operaciones y gestión de procesos, simula el siguiente escenario operativo:

        ESCENARIO: ${scenario.name}
        DESCRIPCIÓN: ${scenario.description}
        PARÁMETROS: ${JSON.stringify(scenario.parameters, null, 2)}
        SUPUESTOS: ${JSON.stringify(scenario.assumptions, null, 2)}
        PERIODO: ${scenario.timeframe} meses

        DATOS OPERATIVOS ACTUALES:
        - Proyectos activos: ${baseData.activeProjects}
        - Tamaño del equipo: ${baseData.teamSize}
        - Productividad actual: ${baseData.productivity}%
        - Tiempo promedio de proyecto: ${baseData.avgProjectDuration} días
        - Tasa de éxito de proyectos: ${baseData.projectSuccessRate}%
        - NCRs mensuales: ${baseData.monthlyNCRs}

        Analiza y proyecta:
        1. Impacto en productividad y eficiencia
        2. Capacidad de proyectos adicionales
        3. Calidad y tasa de éxito
        4. Optimización de recursos
        5. Mejoras en procesos

        Responde en formato JSON con la estructura especificada.
      `;

      const aiResponse = await this.aiOrchestrator.processQuery(
        prompt,
        scenario.tenantId,
        'system',
        'ADMIN'
      );

      const result = this.parseSimulationResponse(aiResponse.summary);
      
      result.charts = [
        {
          type: 'bar',
          title: 'Capacidad de Proyectos',
          data: this.generateCapacityChart(baseData, scenario.parameters),
          description: 'Proyección de capacidad de proyectos por equipo'
        },
        {
          type: 'line',
          title: 'Tendencia de Productividad',
          data: this.generateProductivityChart(baseData, scenario.parameters),
          description: 'Evolución de la productividad esperada'
        }
      ];

      return result;

    } catch (error: any) {
      console.error('[Strategic Simulation] Error in operational simulation:', error);
      throw error;
    }
  }

  /**
   * Simulación de riesgos
   */
  private async runRiskSimulation(
    scenario: any,
    baseData: any
  ): Promise<SimulationResult> {
    try {
      const prompt = `
        Como experto en gestión de riesgos y seguridad, simula el siguiente escenario de riesgo:

        ESCENARIO: ${scenario.name}
        DESCRIPCIÓN: ${scenario.description}
        PARÁMETROS: ${JSON.stringify(scenario.parameters, null, 2)}
        SUPUESTOS: ${JSON.stringify(scenario.assumptions, null, 2)}
        PERIODO: ${scenario.timeframe} meses

        DATOS DE RIESGO ACTUALES:
        - NCRs abiertas: ${baseData.openNCRs}
        - Riesgos identificados: ${baseData.identifiedRisks}
        - Incidentes de seguridad: ${baseData.securityIncidents}
        - Cumplimiento normativo: ${baseData.complianceScore}%
        - Auditorías pendientes: ${baseData.pendingAudits}

        Analiza y proyecta:
        1. Probabilidad e impacto de riesgos
        2. Efectos en cadena potenciales
        3. Medidas de mitigación efectivas
        4. Costos de no mitigación
        5. Plan de contingencia

        Responde en formato JSON con la estructura especificada.
      `;

      const aiResponse = await this.aiOrchestrator.processQuery(
        prompt,
        scenario.tenantId,
        'system',
        'ADMIN'
      );

      const result = this.parseSimulationResponse(aiResponse.summary);
      
      result.charts = [
        {
          type: 'scatter',
          title: 'Matriz de Riesgos',
          data: this.generateRiskMatrixChart(scenario.parameters),
          description: 'Distribución de riesgos por probabilidad vs impacto'
        },
        {
          type: 'pie',
          title: 'Categorías de Riesgo',
          data: this.generateRiskCategoriesChart(scenario.parameters),
          description: 'Riesgos por categoría de impacto'
        }
      ];

      return result;

    } catch (error: any) {
      console.error('[Strategic Simulation] Error in risk simulation:', error);
      throw error;
    }
  }

  /**
   * Simulación de oportunidades
   */
  private async runOpportunitySimulation(
    scenario: any,
    baseData: any
  ): Promise<SimulationResult> {
    try {
      const prompt = `
        Como experto en desarrollo de negocio y estrategia, simula el siguiente escenario de oportunidad:

        ESCENARIO: ${scenario.name}
        DESCRIPCIÓN: ${scenario.description}
        PARÁMETROS: ${JSON.stringify(scenario.parameters, null, 2)}
        SUPUESTOS: ${JSON.stringify(scenario.assumptions, null, 2)}
        PERIODO: ${scenario.timeframe} meses

        DATOS DE MERCADO ACTUALES:
        - Cuota de mercado actual: ${baseData.marketShare}%
        - Tasa de crecimiento del mercado: ${baseData.marketGrowth}%
        - Competidores principales: ${baseData.mainCompetitors}
        - Satisfacción del cliente: ${baseData.customerSatisfaction}%
        - Retención de clientes: ${baseData.customerRetention}%

        Analiza y proyecta:
        1. Potencial de mercado y crecimiento
        2. Ventaja competitiva sostenible
        3. Inversión requerida y ROI
        4. Barreras de entrada y riesgos
        5. Estrategia de implementación

        Responde en formato JSON con la estructura especificada.
      `;

      const aiResponse = await this.aiOrchestrator.processQuery(
        prompt,
        scenario.tenantId,
        'system',
        'ADMIN'
      );

      const result = this.parseSimulationResponse(aiResponse.summary);
      
      result.charts = [
        {
          type: 'line',
          title: 'Proyección de Cuota de Mercado',
          data: this.generateMarketShareChart(baseData, scenario.parameters),
          description: 'Evolución esperada de la cuota de mercado'
        },
        {
          type: 'bar',
          title: 'Análisis Competitivo',
          data: this.generateCompetitiveAnalysisChart(baseData, scenario.parameters),
          description: 'Comparación con competidores principales'
        }
      ];

      return result;

    } catch (error: any) {
      console.error('[Strategic Simulation] Error in opportunity simulation:', error);
      throw error;
    }
  }

  /**
   * Simulación de recursos
   */
  private async runResourceSimulation(
    scenario: any,
    baseData: any
  ): Promise<SimulationResult> {
    try {
      const prompt = `
        Como experto en gestión de recursos y optimización, simula el siguiente escenario de recursos:

        ESCENARIO: ${scenario.name}
        DESCRIPCIÓN: ${scenario.description}
        PARÁMETROS: ${JSON.stringify(scenario.parameters, null, 2)}
        SUPUESTOS: ${JSON.stringify(scenario.assumptions, null, 2)}
        PERIODO: ${scenario.timeframe} meses

        DATOS DE RECURSOS ACTUALES:
        - Personal actual: ${baseData.teamSize} personas
        - Costo de personal: ${baseData.personnelCosts}
        - Utilización actual: ${baseData.utilizationRate}%
        - Habilidades disponibles: ${baseData.availableSkills}
        - Tasa de rotación: ${baseData.turnoverRate}%
        - Capacitaciones mensuales: ${baseData.monthlyTrainings}

        Analiza y proyecta:
        1. Necesidades de personal vs disponibilidad
        2. Optimización de utilización
        3. Brechas de habilidades
        4. Costos de contratación vs outsourcing
        5. Plan de desarrollo de talento

        Responde en formato JSON con la estructura especificada.
      `;

      const aiResponse = await this.aiOrchestrator.processQuery(
        prompt,
        scenario.tenantId,
        'system',
        'ADMIN'
      );

      const result = this.parseSimulationResponse(aiResponse.summary);
      
      result.charts = [
        {
          type: 'bar',
          title: 'Demanda vs Oferta de Recursos',
          data: this.generateResourceDemandChart(baseData, scenario.parameters),
          description: 'Proyección de necesidades de personal'
        },
        {
          type: 'pie',
          title: 'Distribución de Habilidades',
          data: this.generateSkillsDistributionChart(baseData, scenario.parameters),
          description: 'Análisis de competencias requeridas'
        }
      ];

      return result;

    } catch (error: any) {
      console.error('[Strategic Simulation] Error in resource simulation:', error);
      throw error;
    }
  }

  /**
   * Parsea respuesta de IA y la formatea
   */
  private parseSimulationResponse(aiResponse: string): SimulationResult {
    try {
      // Intentar parsear JSON directamente
      if (aiResponse.trim().startsWith('{')) {
        return JSON.parse(aiResponse);
      }

      // Extraer JSON de la respuesta
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Si no hay JSON, crear estructura básica
      return {
        scenarioId: '',
        outcomes: [],
        risks: [],
        opportunities: [],
        recommendations: [],
        charts: [],
        summary: aiResponse,
        confidence: 0.5
      };

    } catch (error: any) {
      console.error('[Strategic Simulation] Error parsing AI response:', error);
      return {
        scenarioId: '',
        outcomes: [],
        risks: [],
        opportunities: [],
        recommendations: [],
        charts: [],
        summary: 'Error procesando la simulación',
        confidence: 0
      };
    }
  }

  /**
   * Obtiene datos base del tenant
   */
  private async getTenantBaseData(tenantId: string): Promise<any> {
    try {
      // Obtener datos financieros
      const monthlyRevenue = await this.getMonthlyRevenue(tenantId);
      const operationalCosts = await this.getOperationalCosts(tenantId);

      // Obtener datos operativos
      const activeProjects = await this.getActiveProjectsCount(tenantId);
      const teamSize = await this.getTeamSize(tenantId);

      // Obtener datos de calidad
      const openNCRs = await this.getOpenNCRsCount(tenantId);
      const projectSuccessRate = await this.getProjectSuccessRate(tenantId);

      return {
        monthlyRevenue,
        operationalCosts,
        currentMargin: monthlyRevenue > 0 ? ((monthlyRevenue - operationalCosts) / monthlyRevenue) * 100 : 0,
        historicalGrowth: 5.0, // Default
        activeProjects,
        teamSize,
        productivity: 85.0, // Default
        avgProjectDuration: 30, // Default
        projectSuccessRate,
        monthlyNCRs: openNCRs,
        openNCRs,
        identifiedRisks: 10, // Default
        securityIncidents: 0, // Default
        complianceScore: 95.0, // Default
        pendingAudits: 2, // Default
        marketShare: 15.0, // Default
        marketGrowth: 8.0, // Default
        mainCompetitors: 5, // Default
        customerSatisfaction: 90.0, // Default
        customerRetention: 85.0, // Default
        utilizationRate: 75.0, // Default
        personnelCosts: operationalCosts * 0.6, // Default
        availableSkills: ['technical', 'management'], // Default
        turnoverRate: 10.0, // Default
        monthlyTrainings: 3 // Default
      };

    } catch (error: any) {
      console.error('[Strategic Simulation] Error getting base data:', error);
      throw error;
    }
  }

  /**
   * Métodos auxiliares para obtener datos del tenant
   */
  private async getMonthlyRevenue(tenantId: string): Promise<number> {
    // Implementar lógica real
    return 50000; // Default
  }

  private async getOperationalCosts(tenantId: string): Promise<number> {
    // Implementar lógica real
    return 35000; // Default
  }

  private async getActiveProjectsCount(tenantId: string): Promise<number> {
    try {
      return await (this.prisma as any).project360?.count?.({
        where: { 
          tenantId,
          status: { in: ['PLANNING', 'IN_PROGRESS'] }
        }
      }) || 0;
    } catch {
      return 5; // Default
    }
  }

  private async getTeamSize(tenantId: string): Promise<number> {
    try {
      return await this.prisma.platformUser.count({
        where: { tenantId, active: true }
      });
    } catch {
      return 10; // Default
    }
  }

  private async getOpenNCRsCount(tenantId: string): Promise<number> {
    try {
      return await this.prisma.nonConformity.count({
        where: { 
          tenantId,
          status: { in: ['OPEN', 'IN_PROGRESS'] }
        }
      });
    } catch {
      return 3; // Default
    }
  }

  private async getProjectSuccessRate(tenantId: string): Promise<number> {
    try {
      const total = await (this.prisma as any).project360?.count?.({ where: { tenantId } }) || 0;
      const completed = await (this.prisma as any).project360?.count?.({
        where: { 
          tenantId,
          status: 'COMPLETED'
        }
      }) || 0;
      
      return total > 0 ? (completed / total) * 100 : 85.0;
    } catch {
      return 85.0; // Default
    }
  }

  /**
   * Generadores de datos para charts
   */
  private generateFinancialProjectionChart(baseData: any, parameters: any): any {
    const months = 12;
    const data = [];
    
    for (let i = 1; i <= months; i++) {
      const revenueGrowth = parameters.revenueGrowth || 0.05;
      const costGrowth = parameters.costGrowth || 0.03;
      
      data.push({
        month: `Mes ${i}`,
        ingresos: baseData.monthlyRevenue * Math.pow(1 + revenueGrowth, i),
        costos: baseData.operationalCosts * Math.pow(1 + costGrowth, i)
      });
    }
    
    return data;
  }

  private generateProfitabilityChart(baseData: any, parameters: any): any {
    return [
      { periodo: 'Actual', margen: baseData.currentMargin },
      { periodo: '3 meses', margen: baseData.currentMargin * 1.1 },
      { periodo: '6 meses', margen: baseData.currentMargin * 1.15 },
      { periodo: '12 meses', margen: baseData.currentMargin * 1.25 }
    ];
  }

  private generateCapacityChart(baseData: any, parameters: any): any {
    return [
      { equipo: 'Actual', capacidad: baseData.activeProjects, utilizacion: 75 },
      { equipo: 'Optimizado', capacidad: baseData.activeProjects * 1.3, utilizacion: 85 },
      { equipo: 'Expandido', capacidad: baseData.activeProjects * 1.5, utilizacion: 80 }
    ];
  }

  private generateProductivityChart(baseData: any, parameters: any): any {
    const data = [];
    for (let i = 0; i <= 12; i += 3) {
      data.push({
        mes: `Mes ${i}`,
        productividad: baseData.productivity * (1 + (parameters.productivityImprovement || 0.02) * i)
      });
    }
    return data;
  }

  private generateRiskMatrixChart(parameters: any): any {
    return [
      { probabilidad: 0.8, impacto: 0.9, riesgo: 'Crítico', count: 2 },
      { probabilidad: 0.6, impacto: 0.7, riesgo: 'Alto', count: 3 },
      { probabilidad: 0.4, impacto: 0.5, riesgo: 'Medio', count: 5 },
      { probabilidad: 0.2, impacto: 0.3, riesgo: 'Bajo', count: 8 }
    ];
  }

  private generateRiskCategoriesChart(parameters: any): any {
    return [
      { categoria: 'Operacional', valor: 35 },
      { categoria: 'Financiero', valor: 25 },
      { categoria: 'Tecnológico', valor: 20 },
      { categoria: 'Regulatorio', valor: 15 },
      { categoria: 'Reputacional', valor: 5 }
    ];
  }

  private generateMarketShareChart(baseData: any, parameters: any): any {
    const data = [];
    for (let i = 0; i <= 12; i += 3) {
      data.push({
        periodo: `Mes ${i}`,
        cuota: baseData.marketShare * (1 + (parameters.marketGrowthRate || 0.05) * i)
      });
    }
    return data;
  }

  private generateCompetitiveAnalysisChart(baseData: any, parameters: any): any {
    return [
      { empresa: 'Nosotros', cuota: baseData.marketShare, crecimiento: 12 },
      { empresa: 'Competidor A', cuota: 25, crecimiento: 5 },
      { empresa: 'Competidor B', cuota: 20, crecimiento: 8 },
      { empresa: 'Competidor C', cuota: 15, crecimiento: 3 }
    ];
  }

  private generateResourceDemandChart(baseData: any, parameters: any): any {
    return [
      { skill: 'Técnico', demanda: 8, oferta: 6 },
      { skill: 'Gestión', demanda: 4, oferta: 5 },
      { skill: 'Análisis', demanda: 6, oferta: 4 },
      { skill: 'Comunicación', demanda: 3, oferta: 7 }
    ];
  }

  private generateSkillsDistributionChart(baseData: any, parameters: any): any {
    return [
      { habilidad: 'Técnica', porcentaje: 40 },
      { habilidad: 'Gestión', porcentaje: 25 },
      { habilidad: 'Análisis', porcentaje: 20 },
      { habilidad: 'Comunicación', porcentaje: 15 }
    ];
  }

  /**
   * Obtiene escenarios de un tenant
   */
  async getScenarios(tenantId: string): Promise<SimulationScenario[]> {
    try {
      const scenarios = await (this.prisma as any).aISimulation.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' }
      });

      return scenarios.map((scenario: any) => ({
        id: scenario.id,
        tenantId: scenario.tenantId,
        name: scenario.name,
        description: scenario.description,
        type: scenario.type,
        parameters: scenario.parameters,
        assumptions: scenario.assumptions,
        timeframe: scenario.timeframe,
        status: scenario.status,
        createdAt: scenario.createdAt,
        completedAt: scenario.completedAt
      }));

    } catch (error: any) {
      console.error('[Strategic Simulation] Error getting scenarios:', error);
      return [];
    }
  }

  /**
   * Obtiene resultado de una simulación
   */
  async getSimulationResult(scenarioId: string): Promise<SimulationResult | null> {
    try {
      const result = await (this.prisma as any).aISimulationResult.findUnique({
        where: { scenarioId }
      });

      if (!result) return null;

      return {
        scenarioId: result.scenarioId,
        outcomes: result.outcomes || [],
        risks: result.risks || [],
        opportunities: result.opportunities || [],
        recommendations: result.recommendations || [],
        charts: result.charts || [],
        summary: result.summary,
        confidence: result.confidence
      };

    } catch (error: any) {
      console.error('[Strategic Simulation] Error getting simulation result:', error);
      return null;
    }
  }

  /**
   * Elimina un escenario y sus resultados
   */
  async deleteScenario(scenarioId: string): Promise<boolean> {
    try {
      await (this.prisma as any).aISimulationResult.deleteMany({
        where: { scenarioId }
      });

      await (this.prisma as any).aISimulation.delete({
        where: { id: scenarioId }
      });

      return true;

    } catch (error: any) {
      console.error('[Strategic Simulation] Error deleting scenario:', error);
      return false;
    }
  }

  /**
   * Compara múltiples escenarios
   */
  async compareScenarios(scenarioIds: string[]): Promise<any> {
    try {
      const results = await Promise.all(
        scenarioIds.map(id => this.getSimulationResult(id))
      );

      const validResults = results.filter(r => r !== null);

      if (validResults.length < 2) {
        throw new Error('Se necesitan al menos 2 escenarios válidos para comparar');
      }

      // Generar comparación
      const comparison = {
        scenarios: validResults.map(r => ({
          scenarioId: r!.scenarioId,
          summary: r!.summary,
          confidence: r!.confidence,
          totalOutcomes: r!.outcomes.length,
          totalRisks: r!.risks.length,
          totalOpportunities: r!.opportunities.length
        })),
        metrics: this.compareMetrics(validResults as SimulationResult[]),
        recommendations: this.generateComparisonRecommendations(validResults as SimulationResult[])
      };

      return comparison;

    } catch (error: any) {
      console.error('[Strategic Simulation] Error comparing scenarios:', error);
      throw error;
    }
  }

  /**
   * Compara métricas entre escenarios
   */
  private compareMetrics(results: SimulationResult[]): any {
    const metrics: Record<string, any> = {};

    // Agrupar métricas por nombre
    const metricGroups: Record<string, any[]> = {};
    
    results.forEach(result => {
      result.outcomes.forEach(outcome => {
        if (!metricGroups[outcome.metric]) {
          metricGroups[outcome.metric] = [];
        }
        metricGroups[outcome.metric].push(outcome);
      });
    });

    // Generar comparación
    Object.entries(metricGroups).forEach(([metric, outcomes]) => {
      metrics[metric] = {
        best: outcomes.reduce((best, current) => 
          current.projected > best.projected ? current : best
        ),
        worst: outcomes.reduce((worst, current) => 
          current.projected < worst.projected ? current : worst
        ),
        average: outcomes.reduce((sum, o) => sum + o.projected, 0) / outcomes.length,
        scenarios: outcomes.map((o, i) => ({
          scenarioIndex: i,
          value: o.projected,
          variance: o.variancePercent
        }))
      };
    });

    return metrics;
  }

  /**
   * Genera recomendaciones de comparación
   */
  private generateComparisonRecommendations(results: SimulationResult[]): string[] {
    const recommendations: string[] = [];

    // Encontrar el escenario con mayor confianza
    const bestScenario = results.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    recommendations.push(
      `El escenario "${bestScenario.scenarioId}" tiene la mayor confianza (${(bestScenario.confidence * 100).toFixed(1)}%).`
    );

    // Analizar riesgos
    const totalRisks = results.reduce((sum, r) => sum + r.risks.length, 0);
    if (totalRisks > 0) {
      recommendations.push(
        `Se identificaron ${totalRisks} riesgos en total. Considera estrategias de mitigación combinadas.`
      );
    }

    // Analizar oportunidades
    const totalOpportunities = results.reduce((sum, r) => sum + r.opportunities.length, 0);
    if (totalOpportunities > 0) {
      recommendations.push(
        `Hay ${totalOpportunities} oportunidades identificadas. Evalúa sinergias entre escenarios.`
      );
    }

    return recommendations;
  }
}

export default AIStrategicSimulationEngine;
