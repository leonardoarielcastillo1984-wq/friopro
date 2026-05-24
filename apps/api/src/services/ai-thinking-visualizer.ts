export interface ThinkingStep {
  id: string;
  phase: 'analyzing' | 'reasoning' | 'processing' | 'generating' | 'finalizing';
  title: string;
  description: string;
  progress: number;
  duration?: number;
  completed: boolean;
  timestamp: Date;
}

export interface AIThinkingSession {
  id: string;
  query: string;
  intent: string;
  provider: 'groq' | 'openai';
  model: string;
  steps: ThinkingStep[];
  startTime: Date;
  endTime?: Date;
  totalDuration?: number;
  deepAnalysis: boolean;
}

export class AIThinkingVisualizer {
  private activeSessions: Map<string, AIThinkingSession> = new Map();

  async startThinkingSession(query: string, intent: string, provider: 'groq' | 'openai', model: string): Promise<string> {
    const sessionId = this.generateSessionId();
    const session: AIThinkingSession = {
      id: sessionId,
      query,
      intent,
      provider,
      model,
      steps: [],
      startTime: new Date(),
      deepAnalysis: provider === 'openai'
    };

    this.activeSessions.set(sessionId, session);
    
    // Iniciar pasos de thinking según el tipo de consulta
    this.generateThinkingSteps(session);
    
    return sessionId;
  }

  private generateThinkingSteps(session: AIThinkingSession): void {
    const baseSteps: ThinkingStep[] = [
      {
        id: '1',
        phase: 'analyzing',
        title: 'Analizando intención',
        description: this.getAnalyzingDescription(session.intent),
        progress: 0,
        completed: false,
        timestamp: new Date()
      }
    ];

    // Agregar pasos específicos según la intención
    const intentSteps = this.getIntentSpecificSteps(session.intent);
    
    // Agregar pasos de procesamiento general
    const processingSteps: ThinkingStep[] = [
      {
        id: 'processing-1',
        phase: 'processing',
        title: 'Procesando datos',
        description: 'Consultando bases de datos y módulos SGI360...',
        progress: 0,
        completed: false,
        timestamp: new Date()
      },
      {
        id: 'reasoning-1',
        phase: 'reasoning',
        title: 'Razonamiento estratégico',
        description: session.deepAnalysis ? 'Ejecutando análisis profundo con GPT-4.1...' : 'Procesando con modelo rápido...',
        progress: 0,
        completed: false,
        timestamp: new Date()
      },
      {
        id: 'generating-1',
        phase: 'generating',
        title: 'Generando respuesta',
        description: 'Construyendo respuesta contextual y visualizaciones...',
        progress: 0,
        completed: false,
        timestamp: new Date()
      },
      {
        id: 'finalizing-1',
        phase: 'finalizing',
        title: 'Finalizando análisis',
        description: 'Validando calidad y preparando visualizaciones...',
        progress: 0,
        completed: false,
        timestamp: new Date()
      }
    ];

    session.steps = [...baseSteps, ...intentSteps, ...processingSteps];
  }

  private getAnalyzingDescription(intent: string): string {
    const descriptions: Record<string, string> = {
      financial: 'Analizando KPIs financieros y métricas de rendimiento...',
      operational: 'Evaluando operaciones y estado actual del sistema...',
      strategic: 'Procesando datos estratégicos y proyecciones...',
      risk: 'Identificando riesgos y evaluando matriz de impacto...',
      hr: 'Analizando datos de recursos humanos y competencias...',
      projects: 'Consultando estado de proyectos y cronogramas...',
      compliance: 'Verificando cumplimiento normativo y auditorías...',
      general: 'Procesando consulta general y contexto empresarial...'
    };
    
    return descriptions[intent] || descriptions.general;
  }

  private getIntentSpecificSteps(intent: string): ThinkingStep[] {
    const stepMap: Record<string, ThinkingStep[]> = {
      financial: [
        {
          id: 'fin-1',
          phase: 'analyzing',
          title: 'Consultando datos financieros',
          description: 'Accediendo a revenue, márgenes y cash flow...',
          progress: 0,
          completed: false,
          timestamp: new Date()
        },
        {
          id: 'fin-2',
          phase: 'processing',
          title: 'Calculando métricas',
          description: 'Computando KPIs financieros y tendencias...',
          progress: 0,
          completed: false,
          timestamp: new Date()
        }
      ],
      risk: [
        {
          id: 'risk-1',
          phase: 'analyzing',
          title: 'Evaluando riesgos',
          description: 'Analizando matriz de riesgos y controles...',
          progress: 0,
          completed: false,
          timestamp: new Date()
        },
        {
          id: 'risk-2',
          phase: 'reasoning',
          title: 'Análisis de impacto',
          description: 'Evaluando probabilidad e impacto de riesgos...',
          progress: 0,
          completed: false,
          timestamp: new Date()
        }
      ],
      projects: [
        {
          id: 'proj-1',
          phase: 'analyzing',
          title: 'Consultando proyectos',
          description: 'Accediendo a timelines y estados de proyectos...',
          progress: 0,
          completed: false,
          timestamp: new Date()
        },
        {
          id: 'proj-2',
          phase: 'processing',
          title: 'Análisis de cronogramas',
          description: 'Evaluando hitos críticos y dependencias...',
          progress: 0,
          completed: false,
          timestamp: new Date()
        }
      ],
      hr: [
        {
          id: 'hr-1',
          phase: 'analyzing',
          title: 'Analizando personal',
          description: 'Consultando competencias y matriz de polivalencia...',
          progress: 0,
          completed: false,
          timestamp: new Date()
        },
        {
          id: 'hr-2',
          phase: 'processing',
          title: 'Evaluando gaps',
          description: 'Identificando brechas de competencias...',
          progress: 0,
          completed: false,
          timestamp: new Date()
        }
      ]
    };

    return stepMap[intent] || [];
  }

  async updateStepProgress(sessionId: string, stepId: string, progress: number): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const step = session.steps.find(s => s.id === stepId);
    if (step) {
      step.progress = Math.min(100, Math.max(0, progress));
      if (step.progress >= 100) {
        step.completed = true;
        step.duration = Date.now() - step.timestamp.getTime();
      }
    }
  }

  async completeStep(sessionId: string, stepId: string): Promise<void> {
    await this.updateStepProgress(sessionId, stepId, 100);
  }

  async nextStep(sessionId: string): Promise<ThinkingStep | null> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    const currentStepIndex = session.steps.findIndex(s => !s.completed);
    if (currentStepIndex === -1) return null;

    const currentStep = session.steps[currentStepIndex];
    await this.completeStep(sessionId, currentStep.id);

    // Iniciar siguiente paso si existe
    if (currentStepIndex + 1 < session.steps.length) {
      const nextStep = session.steps[currentStepIndex + 1];
      nextStep.timestamp = new Date();
      return nextStep;
    }

    // Si no hay más pasos, finalizar sesión
    await this.endSession(sessionId);
    return null;
  }

  async endSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.endTime = new Date();
    session.totalDuration = session.endTime.getTime() - session.startTime.getTime();

    // Marcar todos los pasos como completos
    session.steps.forEach(step => {
      if (!step.completed) {
        step.completed = true;
        step.progress = 100;
        step.duration = Date.now() - step.timestamp.getTime();
      }
    });
  }

  getSession(sessionId: string): AIThinkingSession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  getActiveSessionSteps(sessionId: string): ThinkingStep[] {
    const session = this.activeSessions.get(sessionId);
    return session ? session.steps : [];
  }

  getCurrentStep(sessionId: string): ThinkingStep | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    return session.steps.find(s => !s.completed) || null;
  }

  getSessionProgress(sessionId: string): number {
    const session = this.activeSessions.get(sessionId);
    if (!session) return 0;

    const completedSteps = session.steps.filter(s => s.completed).length;
    return session.steps.length > 0 ? (completedSteps / session.steps.length) * 100 : 0;
  }

  private generateSessionId(): string {
    return `thinking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Método para simular el progreso automático de pasos
  async simulateProgress(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    for (const step of session.steps) {
      if (step.completed) continue;

      // Simular progreso gradual
      const progressInterval = setInterval(async () => {
        const currentProgress = step.progress;
        const increment = Math.random() * 20 + 10; // 10-30% increment
        
        await this.updateStepProgress(sessionId, step.id, currentProgress + increment);
        
        if (step.progress >= 100) {
          clearInterval(progressInterval);
          await this.nextStep(sessionId);
        }
      }, Math.random() * 1000 + 500); // 500-1500ms intervals

      break; // Solo procesar el paso actual
    }
  }

  // Limpiar sesiones antiguas
  cleanupOldSessions(maxAge: number = 300000): void { // 5 minutos por defecto
    const now = Date.now();
    
    for (const [sessionId, session] of this.activeSessions.entries()) {
      const sessionAge = now - session.startTime.getTime();
      if (sessionAge > maxAge) {
        this.activeSessions.delete(sessionId);
      }
    }
  }
}
