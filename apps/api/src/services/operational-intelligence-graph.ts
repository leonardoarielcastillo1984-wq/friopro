/**
 * OPERATIONAL INTELLIGENCE GRAPH
 * FASE 7 — Cognitive Enterprise
 * 
 * Knowledge Graph organizacional vivo usando PostgreSQL relacional.
 * Relaciona: personas, procesos, riesgos, auditorías, NCRs, CAPAs, proveedores, clientes, activos.
 * (Alternativa a Neo4j - usa relaciones SQL con campos JSONB para flexibilidad)
 */

import { PrismaClient } from '@prisma/client';

// ============================================================
// TYPES
// ============================================================

export interface GraphNode {
  id: string;
  type: 'PERSON' | 'PROCESS' | 'RISK' | 'AUDIT' | 'NCR' | 'CAPA' | 'SUPPLIER' | 'CUSTOMER' | 'ASSET' | 'DOCUMENT' | 'PROJECT';
  label: string;
  properties: Record<string, any>;
  tenantId: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
  properties: Record<string, any>;
}

export interface GraphPath {
  nodes: GraphNode[];
  edges: GraphEdge[];
  totalWeight: number;
}

export interface EntityRelations {
  entity: GraphNode;
  directRelations: Array<{ entity: GraphNode; edge: GraphEdge }>;
  indirectRelations: Array<{ entity: GraphNode; path: GraphPath }>;
  influence: number;
}

// ============================================================
// OPERATIONAL INTELLIGENCE GRAPH
// ============================================================

export class OperationalIntelligenceGraph {
  private db: any;

  constructor(prisma: PrismaClient) {
    this.db = prisma as any;
  }

  /**
   * Build complete organizational graph for tenant
   */
  async buildGraph(tenantId: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    const [personNodes, processNodes, riskNodes, auditNodes, ncrNodes, capaNodes, 
           supplierNodes, customerNodes, assetNodes, documentNodes, projectNodes] = await Promise.all([
      this.getPersonNodes(tenantId),
      this.getProcessNodes(tenantId),
      this.getRiskNodes(tenantId),
      this.getAuditNodes(tenantId),
      this.getNCRNodes(tenantId),
      this.getCAPANodes(tenantId),
      this.getSupplierNodes(tenantId),
      this.getCustomerNodes(tenantId),
      this.getAssetNodes(tenantId),
      this.getDocumentNodes(tenantId),
      this.getProjectNodes(tenantId),
    ]);

    const nodes = [
      ...personNodes,
      ...processNodes,
      ...riskNodes,
      ...auditNodes,
      ...ncrNodes,
      ...capaNodes,
      ...supplierNodes,
      ...customerNodes,
      ...assetNodes,
      ...documentNodes,
      ...projectNodes,
    ];

    // Build edges based on relationships
    const edges = await this.buildEdges(tenantId, nodes);

    return { nodes, edges };
  }

  /**
   * Find paths between two entities
   */
  async findPaths(
    tenantId: string,
    sourceId: string,
    targetId: string,
    maxDepth: number = 3
  ): Promise<GraphPath[]> {
    const { nodes, edges } = await this.buildGraph(tenantId);
    
    const adjacencyList = this.buildAdjacencyList(nodes, edges);
    const paths: GraphPath[] = [];

    this.dfsPaths(sourceId, targetId, [], [], 0, maxDepth, adjacencyList, paths);

    return paths.sort((a, b) => a.totalWeight - b.totalWeight);
  }

  /**
   * Get entity with all relations
   */
  async getEntityRelations(tenantId: string, entityId: string): Promise<EntityRelations | null> {
    const { nodes, edges } = await this.buildGraph(tenantId);
    
    const entity = nodes.find(n => n.id === entityId);
    if (!entity) return null;

    // Direct relations
    const directRelations = edges
      .filter(e => e.source === entityId || e.target === entityId)
      .map(e => {
        const relatedId = e.source === entityId ? e.target : e.source;
        const relatedEntity = nodes.find(n => n.id === relatedId);
        return { entity: relatedEntity!, edge: e };
      });

    // Calculate influence (centrality-like metric)
    const influence = this.calculateInfluence(entityId, edges);

    return {
      entity,
      directRelations,
      indirectRelations: [], // Would need more complex path finding
      influence,
    };
  }

  /**
   * Detect communities (clusters of highly connected entities)
   */
  async detectCommunities(tenantId: string): Promise<Array<{ id: string; nodes: GraphNode[]; density: number }>> {
    const { nodes, edges } = await this.buildGraph(tenantId);
    
    // Simple community detection based on node types
    const communities: Record<string, GraphNode[]> = {};
    
    for (const node of nodes) {
      if (!communities[node.type]) {
        communities[node.type] = [];
      }
      communities[node.type].push(node);
    }

    return Object.entries(communities).map(([type, communityNodes]) => ({
      id: `${type}_community`,
      nodes: communityNodes,
      density: this.calculateDensity(communityNodes, edges),
    }));
  }

  /**
   * Find influential entities (high connectivity)
   */
  async findInfluentialEntities(tenantId: string, limit: number = 10): Promise<Array<{ entity: GraphNode; score: number }>> {
    const { nodes, edges } = await this.buildGraph(tenantId);
    
    const scores = nodes.map(node => ({
      entity: node,
      score: this.calculateInfluence(node.id, edges),
    }));

    return scores.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  // ============================================================
  // NODE BUILDERS
  // ============================================================

  private async getPersonNodes(tenantId: string): Promise<GraphNode[]> {
    const employees = await this.db.employee?.findMany?.({
      where: { tenantId, deletedAt: null },
      select: { id: true, name: true, position: true, area: true, status: true },
    }) || [];

    return employees.map((e: any) => ({
      id: `PERSON_${e.id}`,
      type: 'PERSON' as const,
      label: e.name,
      properties: { position: e.position, area: e.area, status: e.status },
      tenantId,
    }));
  }

  private async getProcessNodes(tenantId: string): Promise<GraphNode[]> {
    // Would need a Process model
    return [];
  }

  private async getRiskNodes(tenantId: string): Promise<GraphNode[]> {
    const risks = await this.db.risk?.findMany?.({
      where: { tenantId },
      select: { id: true, title: true, level: true, category: true, status: true },
    }) || [];

    return risks.map((r: any) => ({
      id: `RISK_${r.id}`,
      type: 'RISK' as const,
      label: r.title,
      properties: { level: r.level, category: r.category, status: r.status },
      tenantId,
    }));
  }

  private async getAuditNodes(tenantId: string): Promise<GraphNode[]> {
    const audits = await this.db.audit?.findMany?.({
      where: { tenantId },
      select: { id: true, title: true, type: true, status: true, plannedDate: true },
    }) || [];

    return audits.map((a: any) => ({
      id: `AUDIT_${a.id}`,
      type: 'AUDIT' as const,
      label: a.title,
      properties: { type: a.type, status: a.status, plannedDate: a.plannedDate },
      tenantId,
    }));
  }

  private async getNCRNodes(tenantId: string): Promise<GraphNode[]> {
    const ncrs = await (this.db.nonConformityReport || this.db.ncr)?.findMany?.({
      where: { tenantId },
      select: { id: true, title: true, severity: true, status: true, type: true },
    }) || [];

    return ncrs.map((n: any) => ({
      id: `NCR_${n.id}`,
      type: 'NCR' as const,
      label: n.title,
      properties: { severity: n.severity, status: n.status, type: n.type },
      tenantId,
    }));
  }

  private async getCAPANodes(tenantId: string): Promise<GraphNode[]> {
    const capas = await (this.db.capa || this.db.correctiveAction)?.findMany?.({
      where: { tenantId },
      select: { id: true, title: true, status: true, priority: true },
    }) || [];

    return capas.map((c: any) => ({
      id: `CAPA_${c.id}`,
      type: 'CAPA' as const,
      label: c.title,
      properties: { status: c.status, priority: c.priority },
      tenantId,
    }));
  }

  private async getSupplierNodes(tenantId: string): Promise<GraphNode[]> {
    const suppliers = await this.db.supplier?.findMany?.({
      where: { tenantId },
      select: { id: true, name: true, status: true, riskLevel: true },
    }) || [];

    return suppliers.map((s: any) => ({
      id: `SUPPLIER_${s.id}`,
      type: 'SUPPLIER' as const,
      label: s.name,
      properties: { status: s.status, riskLevel: s.riskLevel },
      tenantId,
    }));
  }

  private async getCustomerNodes(tenantId: string): Promise<GraphNode[]> {
    const customers = await this.db.customer?.findMany?.({
      where: { tenantId },
      select: { id: true, name: true, status: true },
    }) || [];

    return customers.map((c: any) => ({
      id: `CUSTOMER_${c.id}`,
      type: 'CUSTOMER' as const,
      label: c.name,
      properties: { status: c.status },
      tenantId,
    }));
  }

  private async getAssetNodes(tenantId: string): Promise<GraphNode[]> {
    const vehicles = await this.db.vehiculo?.findMany?.({
      where: { tenantId },
      select: { id: true, dominio: true, status: true, tipo: true },
    }) || [];

    return vehicles.map((v: any) => ({
      id: `ASSET_${v.id}`,
      type: 'ASSET' as const,
      label: v.dominio,
      properties: { status: v.status, type: v.tipo },
      tenantId,
    }));
  }

  private async getDocumentNodes(tenantId: string): Promise<GraphNode[]> {
    const documents = await this.db.document?.findMany?.({
      where: { tenantId },
      select: { id: true, title: true, type: true, status: true },
    }) || [];

    return documents.map((d: any) => ({
      id: `DOCUMENT_${d.id}`,
      type: 'DOCUMENT' as const,
      label: d.title,
      properties: { type: d.type, status: d.status },
      tenantId,
    }));
  }

  private async getProjectNodes(tenantId: string): Promise<GraphNode[]> {
    const projects = await this.db.project360?.findMany?.({
      where: { tenantId, deletedAt: null },
      select: { id: true, name: true, status: true, progress: true },
    }) || [];

    return projects.map((p: any) => ({
      id: `PROJECT_${p.id}`,
      type: 'PROJECT' as const,
      label: p.name,
      properties: { status: p.status, progress: p.progress },
      tenantId,
    }));
  }

  // ============================================================
  // EDGE BUILDERS
  // ============================================================

  private async buildEdges(tenantId: string, nodes: GraphNode[]): Promise<GraphEdge[]> {
    const edges: GraphEdge[] = [];
    let edgeId = 0;

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Person-Project edges (assigned to)
    const projectAssignments = await this.db.project360?.findMany?.({
      where: { tenantId, deletedAt: null },
      select: { id: true, members: { select: { employeeId: true } } },
    }) || [];

    for (const project of projectAssignments) {
      for (const member of project.members || []) {
        const source = `PERSON_${member.employeeId}`;
        const target = `PROJECT_${project.id}`;
        if (nodeMap.has(source) && nodeMap.has(target)) {
          edges.push({
            id: `e${edgeId++}`,
            source,
            target,
            type: 'ASSIGNED_TO',
            weight: 1,
            properties: { role: 'MEMBER' },
          });
        }
      }
    }

    // NCR-CAPA edges (NCR caused CAPA)
    const capas = await (this.db.capa || this.db.correctiveAction)?.findMany?.({
      where: { tenantId },
      select: { id: true, nonConformityId: true },
    }) || [];

    for (const capa of capas) {
      if (capa.nonConformityId) {
        const source = `NCR_${capa.nonConformityId}`;
        const target = `CAPA_${capa.id}`;
        if (nodeMap.has(source) && nodeMap.has(target)) {
          edges.push({
            id: `e${edgeId++}`,
            source,
            target,
            type: 'GENERATED',
            weight: 3,
            properties: { causality: 'DIRECT' },
          });
        }
      }
    }

    // Risk-Asset edges (risk affects asset)
    const risks = await this.db.risk?.findMany?.({
      where: { tenantId },
      select: { id: true, affectedAssets: true },
    }) || [];

    for (const risk of risks) {
      for (const assetId of risk.affectedAssets || []) {
        const source = `RISK_${risk.id}`;
        const target = `ASSET_${assetId}`;
        if (nodeMap.has(source) && nodeMap.has(target)) {
          edges.push({
            id: `e${edgeId++}`,
            source,
            target,
            type: 'AFFECTS',
            weight: 2,
            properties: {},
          });
        }
      }
    }

    // Audit-NCR edges (audit found NCR)
    const auditFindings = await this.db.auditFinding?.findMany?.({
      where: { audit: { tenantId } },
      select: { auditId: true, ncrId: true },
    }) || [];

    for (const finding of auditFindings) {
      if (finding.ncrId) {
        const source = `AUDIT_${finding.auditId}`;
        const target = `NCR_${finding.ncrId}`;
        if (nodeMap.has(source) && nodeMap.has(target)) {
          edges.push({
            id: `e${edgeId++}`,
            source,
            target,
            type: 'IDENTIFIED',
            weight: 2,
            properties: {},
          });
        }
      }
    }

    // Document-Process edges (document applies to process)
    // Would need process data

    return edges;
  }

  // ============================================================
  // GRAPH ALGORITHMS
  // ============================================================

  private buildAdjacencyList(nodes: GraphNode[], edges: GraphEdge[]): Map<string, Array<{ target: string; edge: GraphEdge }>> {
    const adj = new Map<string, Array<{ target: string; edge: GraphEdge }>>();
    
    for (const node of nodes) {
      adj.set(node.id, []);
    }
    
    for (const edge of edges) {
      adj.get(edge.source)?.push({ target: edge.target, edge });
      adj.get(edge.target)?.push({ target: edge.source, edge }); // Undirected
    }
    
    return adj;
  }

  private dfsPaths(
    current: string,
    target: string,
    path: GraphNode[],
    pathEdges: GraphEdge[],
    depth: number,
    maxDepth: number,
    adj: Map<string, Array<{ target: string; edge: GraphEdge }>>,
    results: GraphPath[]
  ): void {
    if (current === target) {
      const totalWeight = pathEdges.reduce((sum, e) => sum + e.weight, 0);
      results.push({ nodes: [...path], edges: [...pathEdges], totalWeight });
      return;
    }

    if (depth >= maxDepth) return;

    const neighbors = adj.get(current) || [];
    for (const { target: neighborId, edge } of neighbors) {
      // Avoid cycles
      if (path.some(n => n.id === neighborId)) continue;

      const neighborNode = path.find(n => n.id === neighborId) || { id: neighborId, type: 'UNKNOWN', label: neighborId, properties: {}, tenantId: '' };
      
      path.push(neighborNode as GraphNode);
      pathEdges.push(edge);
      
      this.dfsPaths(neighborId, target, path, pathEdges, depth + 1, maxDepth, adj, results);
      
      path.pop();
      pathEdges.pop();
    }
  }

  private calculateInfluence(nodeId: string, edges: GraphEdge[]): number {
    const connected = edges.filter(e => e.source === nodeId || e.target === nodeId);
    return connected.reduce((sum, e) => sum + e.weight, 0);
  }

  private calculateDensity(nodes: GraphNode[], edges: GraphEdge[]): number {
    const nodeIds = new Set(nodes.map(n => n.id));
    const internalEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    const possibleEdges = nodes.length * (nodes.length - 1) / 2;
    return possibleEdges > 0 ? internalEdges.length / possibleEdges : 0;
  }
}

// Singleton instance
export let operationalIntelligenceGraph: OperationalIntelligenceGraph;

export function initializeOperationalIntelligenceGraph(prisma: PrismaClient): OperationalIntelligenceGraph {
  if (!operationalIntelligenceGraph) {
    operationalIntelligenceGraph = new OperationalIntelligenceGraph(prisma);
  }
  return operationalIntelligenceGraph;
}
