/**
 * Database Monitor Service - Monitors database performance and sends alerts
 */

import { sendEmail, notificationEmail } from './email.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class DatabaseMonitor {
  private static instance: DatabaseMonitor;
  private lastSlowQueryAlert: Date | null = null;
  private slowQueries: Array<{ query: string; duration: number; timestamp: Date }> = [];
  private readonly SLOW_QUERY_THRESHOLD = 5000; // 5 seconds
  private readonly ALERT_COOLDOWN = 60 * 60 * 1000; // 1 hour
  private readonly MAX_SLOW_QUERIES = 10;

  static getInstance(): DatabaseMonitor {
    if (!DatabaseMonitor.instance) {
      DatabaseMonitor.instance = new DatabaseMonitor();
    }
    return DatabaseMonitor.instance;
  }

  // Monitor database performance
  async checkDatabasePerformance(): Promise<void> {
    try {
      console.log(`[DATABASE_MONITOR] Checking database performance...`);
      
      // Check slow queries (this would need to be implemented in Prisma middleware)
      await this.checkSlowQueries();
      
      // Check database connection health
      await this.checkDatabaseHealth();
      
    } catch (error) {
      console.error('[DATABASE_MONITOR] Error checking database performance:', error);
    }
  }

  private async checkSlowQueries(): Promise<void> {
    // This would typically query pg_stat_statements or similar
    // For now, we'll check if we have accumulated slow queries
    if (this.slowQueries.length > 0) {
      await this.sendSlowQueryAlert();
    }
  }

  private async checkDatabaseHealth(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Simple health check query
      await prisma.$queryRaw`SELECT 1 as health_check`;
      
      const duration = Date.now() - startTime;
      
      if (duration > this.SLOW_QUERY_THRESHOLD) {
        this.addSlowQuery('Database health check', duration);
        console.log(`[DATABASE_MONITOR] Slow health query detected: ${duration}ms`);
      }
    } catch (error) {
      console.error('[DATABASE_MONITOR] Database health check failed:', error);
      this.addSlowQuery('Database health check failed', -1);
    }
  }

  // Method to be called from Prisma middleware
  logSlowQuery(query: string, duration: number): void {
    if (duration > this.SLOW_QUERY_THRESHOLD) {
      this.addSlowQuery(query, duration);
    }
  }

  private addSlowQuery(query: string, duration: number): void {
    const slowQuery = {
      query: query.length > 200 ? query.substring(0, 200) + '...' : query,
      duration,
      timestamp: new Date()
    };

    this.slowQueries.push(slowQuery);
    
    // Keep only the most recent slow queries
    if (this.slowQueries.length > this.MAX_SLOW_QUERIES) {
      this.slowQueries = this.slowQueries.slice(-this.MAX_SLOW_QUERIES);
    }

    console.log(`[DATABASE_MONITOR] Slow query logged: ${duration}ms`);
  }

  private async sendSlowQueryAlert(): Promise<void> {
    // Check cooldown to avoid spamming alerts
    const now = new Date();
    if (this.lastSlowQueryAlert && (now.getTime() - this.lastSlowQueryAlert.getTime()) < this.ALERT_COOLDOWN) {
      console.log(`[DATABASE_MONITOR] Slow query alert cooldown active, skipping notification`);
      return;
    }

    try {
      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_USER || 'leonardoarielcastillo@hotmail.com';
      const appUrl = process.env.CORS_ORIGIN || 'http://localhost:3000';
      
      const recentSlowQueries = this.slowQueries.slice(-5); // Show last 5 slow queries
      const queryDetails = recentSlowQueries
        .map((q, index) => `${index + 1}. ${q.query} (${q.duration}ms)`)
        .join('\n');
      
      const emailPayload = notificationEmail({
        userEmail: adminEmail,
        title: '⚠️ Alerta de Rendimiento - Base de Datos Lenta',
        message: `Se han detectado consultas lentas en la base de datos:\\n\\n` +
          `<strong>Consultas lentas recientes:</strong>\\n${queryDetails}\\n\\n` +
          `<strong>Umbral de alerta:</strong> ${this.SLOW_QUERY_THRESHOLD}ms\\n` +
          `<strong>Total de consultas lentas:</strong> ${this.slowQueries.length}\\n` +
          `<strong>Última detección:</strong> ${new Date().toLocaleString('es-AR')}\\n\\n` +
          `Acciones recomendadas:\\n` +
          `• Revisar índices de las tablas afectadas\\n` +
          `• Optimizar las consultas identificadas\\n` +
          `• Considerar cache para consultas frecuentes\\n` +
          `• Monitorear carga del servidor de base de datos`,
        actionLabel: 'Ver rendimiento de BD',
        actionUrl: `${appUrl}/admin/database`,
        type: 'warning',
      });
      
      const emailResult = await sendEmail(emailPayload);
      if (emailResult.success) {
        console.log(`[DATABASE_MONITOR] Slow query alert sent to ${adminEmail}`);
        this.lastSlowQueryAlert = now;
        // Clear old queries after sending alert
        this.slowQueries = [];
      } else {
        console.error(`[DATABASE_MONITOR] Error sending slow query alert: ${emailResult.error}`);
      }
    } catch (emailError) {
      console.error(`[DATABASE_MONITOR] Error sending slow query notification: ${emailError}`);
    }
  }

  // Start monitoring with interval
  startMonitoring(intervalMinutes: number = 15): void {
    console.log(`[DATABASE_MONITOR] Starting monitoring with ${intervalMinutes} minute intervals`);
    
    // Check immediately on start
    this.checkDatabasePerformance();
    
    // Set up recurring check
    setInterval(() => {
      this.checkDatabasePerformance();
    }, intervalMinutes * 60 * 1000);
  }
}

// Export singleton instance
export const databaseMonitor = DatabaseMonitor.getInstance();
