/**
 * Health Monitor Service - Monitors API health and sends alerts
 */

import { sendEmail, notificationEmail } from './email.js';

export class HealthMonitor {
  private static instance: HealthMonitor;
  private lastServiceAlert: Date | null = null;
  private consecutiveFailures = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private readonly ALERT_COOLDOWN = 30 * 60 * 1000; // 30 minutes
  private readonly HEALTH_CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutes

  static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  // Check API health by making a simple request
  async checkApiHealth(): Promise<void> {
    try {
      const response = await fetch('http://localhost:3002/health', {
        method: 'GET',
        timeout: 10000 // 10 seconds timeout
      });

      if (response.ok) {
        this.consecutiveFailures = 0;
        console.log(`[HEALTH_MONITOR] API health check passed`);
      } else {
        this.handleHealthFailure();
      }
    } catch (error) {
      this.handleHealthFailure();
    }
  }

  private handleHealthFailure(): void {
    this.consecutiveFailures++;
    console.log(`[HEALTH_MONITOR] API health check failed (${this.consecutiveFailures}/${this.MAX_CONSECUTIVE_FAILURES})`);

    if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      this.sendServiceAlert();
    }
  }

  private async sendServiceAlert(): Promise<void> {
    // Check cooldown to avoid spamming alerts
    const now = new Date();
    if (this.lastServiceAlert && (now.getTime() - this.lastServiceAlert.getTime()) < this.ALERT_COOLDOWN) {
      console.log(`[HEALTH_MONITOR] Service alert cooldown active, skipping notification`);
      return;
    }

    try {
      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_USER || 'leonardoarielcastillo@hotmail.com';
      const appUrl = process.env.CORS_ORIGIN || 'http://localhost:3000';
      
      const emailPayload = notificationEmail({
        userEmail: adminEmail,
        title: '🚨 Alerta Crítica - Servicio Caído',
        message: `La API de SGI 360 no está respondiendo:\\n\\n` +
          `<strong>Estado:</strong> CRÍTICO - Fuera de línea\\n` +
          `<strong>Fallos consecutivos:</strong> ${this.consecutiveFailures}\\n` +
          `<strong>Última verificación:</strong> ${new Date().toLocaleString('es-AR')}\\n` +
          `<strong>Endpoint afectado:</strong> http://localhost:3002\\n\\n` +
          `Acciones recomendadas:\\n` +
          `• Verificar estado del contenedor sgi-api\\n` +
          `• Revisar logs del servicio\\n` +
          `• Reiniciar el servicio si es necesario\\n` +
          `• Verificar recursos del servidor (CPU, memoria)`,
        actionLabel: 'Ver estado del sistema',
        actionUrl: `${appUrl}/admin/system`,
        type: 'error',
      });
      
      const emailResult = await sendEmail(emailPayload);
      if (emailResult.success) {
        console.log(`[HEALTH_MONITOR] Service alert sent to ${adminEmail}`);
        this.lastServiceAlert = now;
      } else {
        console.error(`[HEALTH_MONITOR] Error sending service alert: ${emailResult.error}`);
      }
    } catch (emailError) {
      console.error(`[HEALTH_MONITOR] Error sending service notification: ${emailError}`);
    }
  }

  // Start monitoring with interval
  startMonitoring(): void {
    console.log(`[HEALTH_MONITOR] Starting API health monitoring with ${this.HEALTH_CHECK_INTERVAL/1000} second intervals`);
    
    // Check immediately on start
    this.checkApiHealth();
    
    // Set up recurring check
    setInterval(() => {
      this.checkApiHealth();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  // Create a simple health endpoint if it doesn't exist
  static setupHealthEndpoint(app: any): void {
    app.get('/health', async (request: any, reply: any) => {
      try {
        // Basic health check - return 200 if service is running
        return reply.send({ 
          status: 'healthy', 
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        });
      } catch (error) {
        return reply.code(500).send({ 
          status: 'unhealthy', 
          error: error.message 
        });
      }
    });
  }
}

// Export singleton instance
export const healthMonitor = HealthMonitor.getInstance();
