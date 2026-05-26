/**
 * ENTERPRISE EVENT ENGINE
 * SGI360 - Event-driven architecture with Redis Streams
 * 
 * Elimina dependencia de polling con eventos en tiempo real:
 * - Publish events from any module
 * - Subscribe to event streams
 * - Event history and replay
 * - Multi-tenant isolation
 */

import Redis from 'ioredis';

// ── Event Types ──────────────────────────────────────────────

export type EventType =
  | 'NCR_CREATED' | 'NCR_CLOSED' | 'NCR_ESCALATED'
  | 'CAPA_CREATED' | 'CAPA_OVERDUE' | 'CAPA_COMPLETED'
  | 'AUDIT_SCHEDULED' | 'AUDIT_COMPLETED' | 'AUDIT_FINDING'
  | 'KPI_ALERT' | 'KPI_THRESHOLD_BREACH'
  | 'MAINTENANCE_DUE' | 'MAINTENANCE_OVERDUE' | 'MAINTENANCE_COMPLETED'
  | 'DOCUMENT_EXPIRED' | 'DOCUMENT_REVISED'
  | 'TRAINING_PENDING' | 'TRAINING_COMPLETED'
  | 'PROJECT_AT_RISK' | 'PROJECT_MILESTONE' | 'PROJECT_OVERBUDGET'
  | 'FLEET_ALERT' | 'FLEET_MAINTENANCE_DUE'
  | 'RISK_ESCALATED' | 'RISK_MITIGATED'
  | 'AI_ANOMALY_DETECTED' | 'AI_RECOMMENDATION'
  | 'INSPECTION_FINDING' | 'INSPECTION_COMPLETED'
  | 'SYSTEM_ALERT';

export interface EnterpriseEvent {
  id?: string;
  type: EventType;
  tenantId: string;
  userId?: string;
  module: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  entityId?: string;
  entityType?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  acknowledged?: boolean;
}

// ── Event Engine ─────────────────────────────────────────────

export class EnterpriseEventEngine {
  private redis: any = null;
  private subscribers: Map<string, Array<(event: EnterpriseEvent) => void>> = new Map();

  constructor() {
    try {
      this.redis = new (Redis as any)(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
      this.redis.connect().catch(() => {
        console.warn('[EventEngine] Redis not available, using in-memory fallback');
        this.redis = null;
      });
    } catch {
      this.redis = null;
    }
  }

  /**
   * Publish an event to the stream
   */
  async publish(event: EnterpriseEvent): Promise<string> {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const enrichedEvent = { ...event, id: eventId, timestamp: new Date() };

    // Store in Redis Stream
    if (this.redis) {
      try {
        const streamKey = `events:${event.tenantId}`;
        await this.redis.xadd(
          streamKey,
          '*',
          'type', event.type,
          'module', event.module,
          'severity', event.severity,
          'title', event.title,
          'description', event.description,
          'entityId', event.entityId || '',
          'entityType', event.entityType || '',
          'metadata', JSON.stringify(event.metadata || {}),
          'userId', event.userId || '',
          'timestamp', enrichedEvent.timestamp.toISOString()
        );

        // Trim stream to last 1000 events per tenant
        await this.redis.xtrim(streamKey, 'MAXLEN', '~', 1000);

        // Publish to PubSub for real-time listeners
        await this.redis.publish(`events:live:${event.tenantId}`, JSON.stringify(enrichedEvent));
      } catch (err) {
        console.error('[EventEngine] Redis publish error:', err);
      }
    }

    // Notify in-memory subscribers
    const handlers = this.subscribers.get(event.type) || [];
    for (const handler of handlers) {
      try { handler(enrichedEvent); } catch {}
    }

    const tenantHandlers = this.subscribers.get(`tenant:${event.tenantId}`) || [];
    for (const handler of tenantHandlers) {
      try { handler(enrichedEvent); } catch {}
    }

    return eventId;
  }

  /**
   * Get recent events for a tenant
   */
  async getRecentEvents(tenantId: string, options?: { limit?: number; types?: EventType[]; since?: Date }): Promise<EnterpriseEvent[]> {
    const limit = options?.limit || 50;
    
    if (!this.redis) return [];

    try {
      const streamKey = `events:${tenantId}`;
      const since = options?.since ? (options.since.getTime() - 0) + '-0' : '-';
      
      const results = await this.redis.xrevrange(streamKey, '+', since, 'COUNT', limit);
      
      return results
        .map(([id, fields]: [string, string[]]) => {
          const data: Record<string, string> = {};
          for (let i = 0; i < fields.length; i += 2) {
            data[fields[i]] = fields[i + 1];
          }
          return {
            id,
            type: data.type as EventType,
            tenantId,
            module: data.module,
            severity: data.severity as any,
            title: data.title,
            description: data.description,
            entityId: data.entityId || undefined,
            entityType: data.entityType || undefined,
            metadata: data.metadata ? JSON.parse(data.metadata) : undefined,
            userId: data.userId || undefined,
            timestamp: new Date(data.timestamp),
          } as EnterpriseEvent;
        })
        .filter((e: EnterpriseEvent) => {
          if (options?.types && options.types.length > 0) {
            return options.types.includes(e.type);
          }
          return true;
        });
    } catch (err) {
      console.error('[EventEngine] Error getting events:', err);
      return [];
    }
  }

  /**
   * Get event statistics for a tenant
   */
  async getEventStats(tenantId: string): Promise<Record<string, number>> {
    const events = await this.getRecentEvents(tenantId, { limit: 200 });
    const stats: Record<string, number> = {};
    
    for (const event of events) {
      stats[event.type] = (stats[event.type] || 0) + 1;
      stats[`severity:${event.severity}`] = (stats[`severity:${event.severity}`] || 0) + 1;
      stats[`module:${event.module}`] = (stats[`module:${event.module}`] || 0) + 1;
    }
    
    stats.total = events.length;
    return stats;
  }

  /**
   * Subscribe to events (in-memory)
   */
  subscribe(key: string, handler: (event: EnterpriseEvent) => void): void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, []);
    }
    this.subscribers.get(key)!.push(handler);
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(key: string): void {
    this.subscribers.delete(key);
  }
}

export const eventEngine = new EnterpriseEventEngine();
export default EnterpriseEventEngine;
