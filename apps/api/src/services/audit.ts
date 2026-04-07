import { PrismaClient, AuditLog, AuditAction } from '@prisma/client';

const prisma = new PrismaClient();

// Types for audit logging
export interface AuditLogInput {
  tenantId: string;
  entityType: string;
  entityId: string;
  entityCode?: string;
  action: AuditAction;
  userId: string;
  fieldName?: string;
  oldValue?: string | number | boolean | object;
  newValue?: string | number | boolean | object;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditTrailFilter {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditTrailResponse {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  entityCode?: string;
  action: AuditAction;
  userId: string;
  userName?: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  description?: string;
  createdAt: Date;
}

/**
 * Create audit log entry
 */
export async function logAuditEvent(input: AuditLogInput): Promise<AuditLog> {
  try {
    // Serialize complex objects to JSON strings
    const oldValue = input.oldValue ? JSON.stringify(input.oldValue) : null;
    const newValue = input.newValue ? JSON.stringify(input.newValue) : null;

    const auditLog = await prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        entityType: input.entityType,
        entityId: input.entityId,
        entityCode: input.entityCode,
        action: input.action,
        userId: input.userId,
        fieldName: input.fieldName,
        oldValue,
        newValue,
        description: input.description,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });

    return auditLog;
  } catch (error) {
    console.error('Error logging audit event:', error);
    // Don't throw - audit logging should never fail the main operation
    throw error;
  }
}

/**
 * Get audit trail for a specific entity
 */
export async function getEntityAuditTrail(
  tenantId: string,
  entityType: string,
  entityId: string,
  limit: number = 100,
  offset: number = 0
): Promise<AuditTrailResponse[]> {
  const logs = await prisma.auditLog.findMany({
    where: {
      tenantId,
      entityType,
      entityId,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
    skip: offset,
  });

  return logs.map((log) => ({
    id: log.id,
    tenantId: log.tenantId,
    entityType: log.entityType,
    entityId: log.entityId,
    entityCode: log.entityCode || undefined,
    action: log.action,
    userId: log.userId,
    userName: log.user.email,
    fieldName: log.fieldName || undefined,
    oldValue: log.oldValue || undefined,
    newValue: log.newValue || undefined,
    description: log.description || undefined,
    createdAt: log.createdAt,
  }));
}

/**
 * Get audit logs with flexible filtering
 */
export async function getAuditLogs(
  tenantId: string,
  filters: AuditTrailFilter = {}
): Promise<AuditTrailResponse[]> {
  const {
    entityType,
    entityId,
    userId,
    action,
    startDate,
    endDate,
    limit = 100,
    offset = 0,
  } = filters;

  // Build where clause
  const where: any = { tenantId };

  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (userId) where.userId = userId;
  if (action) where.action = action;

  // Date range filter
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
    skip: offset,
  });

  return logs.map((log) => ({
    id: log.id,
    tenantId: log.tenantId,
    entityType: log.entityType,
    entityId: log.entityId,
    entityCode: log.entityCode || undefined,
    action: log.action,
    userId: log.userId,
    userName: log.user.email,
    fieldName: log.fieldName || undefined,
    oldValue: log.oldValue || undefined,
    newValue: log.newValue || undefined,
    description: log.description || undefined,
    createdAt: log.createdAt,
  }));
}

/**
 * Get audit log count
 */
export async function getAuditLogCount(
  tenantId: string,
  filters: AuditTrailFilter = {}
): Promise<number> {
  const {
    entityType,
    entityId,
    userId,
    action,
    startDate,
    endDate,
  } = filters;

  const where: any = { tenantId };

  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (userId) where.userId = userId;
  if (action) where.action = action;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  return prisma.auditLog.count({ where });
}

/**
 * Get audit summary by user
 */
export async function getAuditSummaryByUser(
  tenantId: string,
  startDate?: Date,
  endDate?: Date
): Promise<
  Array<{
    userId: string;
    userName: string;
    totalActions: number;
    creates: number;
    updates: number;
    deletes: number;
    lastActionAt: Date;
  }>
> {
  const where: any = { tenantId };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  // Group by user and summarize
  const summary = new Map<
    string,
    {
      userId: string;
      userName: string;
      totalActions: number;
      creates: number;
      updates: number;
      deletes: number;
      lastActionAt: Date;
    }
  >();

  for (const log of logs) {
    const key = log.userId;
    if (!summary.has(key)) {
      summary.set(key, {
        userId: log.userId,
        userName: log.user.email,
        totalActions: 0,
        creates: 0,
        updates: 0,
        deletes: 0,
        lastActionAt: log.createdAt,
      });
    }

    const entry = summary.get(key)!;
    entry.totalActions++;

    if (log.action === 'CREATE') entry.creates++;
    else if (log.action === 'UPDATE') entry.updates++;
    else if (log.action === 'DELETE') entry.deletes++;

    if (log.createdAt > entry.lastActionAt) {
      entry.lastActionAt = log.createdAt;
    }
  }

  return Array.from(summary.values()).sort(
    (a, b) => b.lastActionAt.getTime() - a.lastActionAt.getTime()
  );
}

/**
 * Get audit summary by entity type
 */
export async function getAuditSummaryByEntityType(
  tenantId: string,
  startDate?: Date,
  endDate?: Date
): Promise<
  Array<{
    entityType: string;
    totalChanges: number;
    creates: number;
    updates: number;
    deletes: number;
  }>
> {
  const where: any = { tenantId };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const logs = await prisma.auditLog.findMany({
    where,
  });

  // Group by entity type and summarize
  const summary = new Map<
    string,
    {
      entityType: string;
      totalChanges: number;
      creates: number;
      updates: number;
      deletes: number;
    }
  >();

  for (const log of logs) {
    const key = log.entityType;
    if (!summary.has(key)) {
      summary.set(key, {
        entityType: log.entityType,
        totalChanges: 0,
        creates: 0,
        updates: 0,
        deletes: 0,
      });
    }

    const entry = summary.get(key)!;
    entry.totalChanges++;

    if (log.action === 'CREATE') entry.creates++;
    else if (log.action === 'UPDATE') entry.updates++;
    else if (log.action === 'DELETE') entry.deletes++;
  }

  return Array.from(summary.values());
}

/**
 * Helper to compare and detect field changes
 */
export function detectChanges<T extends Record<string, any>>(
  oldData: T,
  newData: T
): Array<{ field: string; oldValue: any; newValue: any }> {
  const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

  // Get all unique keys from both objects
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

  for (const key of allKeys) {
    const oldValue = oldData[key];
    const newValue = newData[key];

    // Skip fields that haven't changed
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      // Skip internal/timestamp fields (createdAt, id, etc.)
      if (!['id', 'createdAt', 'createdById', 'deletedAt'].includes(key)) {
        changes.push({
          field: key,
          oldValue,
          newValue,
        });
      }
    }
  }

  return changes;
}

/**
 * Generate human-readable description of a change
 */
export function generateChangeDescription(
  action: AuditAction,
  entityType: string,
  fieldName?: string,
  oldValue?: any,
  newValue?: any
): string {
  if (action === 'CREATE') {
    return `${entityType} created`;
  }

  if (action === 'DELETE') {
    return `${entityType} deleted`;
  }

  if (action === 'UPDATE' && fieldName) {
    // Truncate long values
    const formatValue = (val: any) => {
      const str = String(val);
      return str.length > 50 ? str.substring(0, 47) + '...' : str;
    };

    return `${fieldName} changed from "${formatValue(oldValue)}" to "${formatValue(newValue)}"`;
  }

  return 'Modified';
}

/**
 * Log NCR create action
 */
export async function logNCRCreate(
  tenantId: string,
  ncrId: string,
  ncrCode: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await logAuditEvent({
      tenantId,
      entityType: 'NCR',
      entityId: ncrId,
      entityCode: ncrCode,
      action: 'CREATE',
      userId,
      description: `Non-Conformity created: ${ncrCode}`,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error('Error logging NCR create:', error);
    // Don't throw - audit logging should never fail the main operation
  }
}

/**
 * Log NCR update action (logs each changed field)
 */
export async function logNCRUpdate(
  tenantId: string,
  ncrId: string,
  ncrCode: string,
  userId: string,
  changes: Array<{ field: string; oldValue: any; newValue: any }>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    for (const change of changes) {
      await logAuditEvent({
        tenantId,
        entityType: 'NCR',
        entityId: ncrId,
        entityCode: ncrCode,
        action: 'UPDATE',
        userId,
        fieldName: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
        description: generateChangeDescription(
          'UPDATE',
          'NCR',
          change.field,
          change.oldValue,
          change.newValue
        ),
        ipAddress,
        userAgent,
      });
    }
  } catch (error) {
    console.error('Error logging NCR update:', error);
  }
}

/**
 * Log NCR delete action
 */
export async function logNCRDelete(
  tenantId: string,
  ncrId: string,
  ncrCode: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await logAuditEvent({
      tenantId,
      entityType: 'NCR',
      entityId: ncrId,
      entityCode: ncrCode,
      action: 'DELETE',
      userId,
      description: `Non-Conformity deleted: ${ncrCode}`,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error('Error logging NCR delete:', error);
  }
}

/**
 * Log Risk create action
 */
export async function logRiskCreate(
  tenantId: string,
  riskId: string,
  riskCode: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await logAuditEvent({
      tenantId,
      entityType: 'Risk',
      entityId: riskId,
      entityCode: riskCode,
      action: 'CREATE',
      userId,
      description: `Risk created: ${riskCode}`,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error('Error logging Risk create:', error);
  }
}

/**
 * Log Risk update action
 */
export async function logRiskUpdate(
  tenantId: string,
  riskId: string,
  riskCode: string,
  userId: string,
  changes: Array<{ field: string; oldValue: any; newValue: any }>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    for (const change of changes) {
      await logAuditEvent({
        tenantId,
        entityType: 'Risk',
        entityId: riskId,
        entityCode: riskCode,
        action: 'UPDATE',
        userId,
        fieldName: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
        description: generateChangeDescription(
          'UPDATE',
          'Risk',
          change.field,
          change.oldValue,
          change.newValue
        ),
        ipAddress,
        userAgent,
      });
    }
  } catch (error) {
    console.error('Error logging Risk update:', error);
  }
}

/**
 * Log Risk delete action
 */
export async function logRiskDelete(
  tenantId: string,
  riskId: string,
  riskCode: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await logAuditEvent({
      tenantId,
      entityType: 'Risk',
      entityId: riskId,
      entityCode: riskCode,
      action: 'DELETE',
      userId,
      description: `Risk deleted: ${riskCode}`,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error('Error logging Risk delete:', error);
  }
}

/**
 * Log Indicator create action
 */
export async function logIndicatorCreate(
  tenantId: string,
  indicatorId: string,
  indicatorCode: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await logAuditEvent({
      tenantId,
      entityType: 'Indicator',
      entityId: indicatorId,
      entityCode: indicatorCode,
      action: 'CREATE',
      userId,
      description: `Indicator created: ${indicatorCode}`,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error('Error logging Indicator create:', error);
  }
}

/**
 * Log Indicator update action
 */
export async function logIndicatorUpdate(
  tenantId: string,
  indicatorId: string,
  indicatorCode: string,
  userId: string,
  changes: Array<{ field: string; oldValue: any; newValue: any }>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    for (const change of changes) {
      await logAuditEvent({
        tenantId,
        entityType: 'Indicator',
        entityId: indicatorId,
        entityCode: indicatorCode,
        action: 'UPDATE',
        userId,
        fieldName: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
        description: generateChangeDescription(
          'UPDATE',
          'Indicator',
          change.field,
          change.oldValue,
          change.newValue
        ),
        ipAddress,
        userAgent,
      });
    }
  } catch (error) {
    console.error('Error logging Indicator update:', error);
  }
}

/**
 * Log Indicator delete action
 */
export async function logIndicatorDelete(
  tenantId: string,
  indicatorId: string,
  indicatorCode: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await logAuditEvent({
      tenantId,
      entityType: 'Indicator',
      entityId: indicatorId,
      entityCode: indicatorCode,
      action: 'DELETE',
      userId,
      description: `Indicator deleted: ${indicatorCode}`,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error('Error logging Indicator delete:', error);
  }
}
