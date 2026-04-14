/**
 * System Monitor Service - Monitors system resources and sends alerts
 */

import { sendEmail, notificationEmail } from './email.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class SystemMonitor {
  private static instance: SystemMonitor;
  private lastDiskAlert: Date | null = null;
  private readonly DISK_ALERT_THRESHOLD = 20; // 20%
  private readonly ALERT_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours

  static getInstance(): SystemMonitor {
    if (!SystemMonitor.instance) {
      SystemMonitor.instance = new SystemMonitor();
    }
    return SystemMonitor.instance;
  }

  // Check disk space and send alert if needed
  async checkDiskSpace(): Promise<void> {
    try {
      // Get disk usage using df command
      const { stdout } = await execAsync('df -h /');
      const lines = stdout.split('\n');
      
      // Skip header line and get the root filesystem line
      const dataLine = lines[1];
      if (!dataLine) return;

      const parts = dataLine.trim().split(/\s+/);
      const usedPercent = parseInt(parts[4].replace('%', ''));
      
      console.log(`[SYSTEM_MONITOR] Disk usage: ${usedPercent}%`);

      if (usedPercent > (100 - this.DISK_ALERT_THRESHOLD)) {
        await this.sendDiskSpaceAlert(usedPercent);
      }
    } catch (error) {
      console.error('[SYSTEM_MONITOR] Error checking disk space:', error);
    }
  }

  private async sendDiskSpaceAlert(usedPercent: number): Promise<void> {
    // Check cooldown to avoid spamming alerts
    const now = new Date();
    if (this.lastDiskAlert && (now.getTime() - this.lastDiskAlert.getTime()) < this.ALERT_COOLDOWN) {
      console.log(`[SYSTEM_MONITOR] Disk alert cooldown active, skipping notification`);
      return;
    }

    try {
      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_USER || 'leonardoarielcastillo@hotmail.com';
      const appUrl = process.env.CORS_ORIGIN || 'http://localhost:3000';
      
      const emailPayload = notificationEmail({
        userEmail: adminEmail,
        title: '⚠️ Alerta Crítica - Espacio en Disco Bajo',
        message: `El espacio en disco del servidor está críticamente bajo:\n\n` +
          `<strong>Uso actual:</strong> ${usedPercent}%\n` +
          `<strong>Umbral de alerta:</strong> ${100 - this.DISK_ALERT_THRESHOLD}%\n` +
          `<strong>Estado:</strong> ${usedPercent > 95 ? 'CRÍTICO - Acción inmediata requerida' : 'ADVERTENCIA - Planificar limpieza'}\n\n` +
          `Recomendaciones:\n` +
          `• Limpiar archivos temporales y logs antiguos\n` +
          `• Revisar uploads y archivos grandes\n` +
          `• Considerar expandir almacenamiento`,
        actionLabel: 'Ver estado del sistema',
        actionUrl: `${appUrl}/admin/system`,
        type: 'error',
      });
      
      const emailResult = await sendEmail(emailPayload);
      if (emailResult.success) {
        console.log(`[SYSTEM_MONITOR] Disk space alert sent to ${adminEmail}`);
        this.lastDiskAlert = now;
      } else {
        console.error(`[SYSTEM_MONITOR] Error sending disk alert: ${emailResult.error}`);
      }
    } catch (emailError) {
      console.error(`[SYSTEM_MONITOR] Error sending disk space notification: ${emailError}`);
    }
  }

  // Start monitoring with interval
  startMonitoring(intervalMinutes: number = 30): void {
    console.log(`[SYSTEM_MONITOR] Starting monitoring with ${intervalMinutes} minute intervals`);
    
    // Check immediately on start
    this.checkDiskSpace();
    
    // Set up recurring check
    setInterval(() => {
      this.checkDiskSpace();
    }, intervalMinutes * 60 * 1000);
  }
}

// Export singleton instance
export const systemMonitor = SystemMonitor.getInstance();
