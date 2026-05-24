/**
 * AI SEMANTIC SEARCH ENGINE
 * SGI360 Command Center - Búsqueda semántica con pgvector
 * 
 * Permite búsqueda contextual y semántica en:
 * - Documentos y normativas
 * - Conversaciones IA
 * - Historial de acciones
 * - Memorias contextuales
 * - Insights aprendidos
 */

import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

interface SemanticSearchRequest {
  query: string;
  tenantId: string;
  filters?: {
    type?: 'document' | 'conversation' | 'action' | 'memory' | 'insight';
    dateRange?: { from: Date; to: Date };
    modules?: string[];
    userId?: string;
  };
  limit?: number;
  threshold?: number;
}

interface SemanticSearchResult {
  id: string;
  type: string;
  title: string;
  content: string;
  similarity: number;
  metadata: any;
  url?: string;
  createdAt: Date;
}

export class AISemanticSearchEngine {
  private prisma: PrismaClient;
  private openai: OpenAI;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }

  /**
   * Genera embedding para un texto usando OpenAI
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        dimensions: 1536
      });

      return response.data[0].embedding;
    } catch (error: any) {
      console.error('[Semantic Search] Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Almacena embedding en la base de datos
   */
  async storeEmbedding(
    tenantId: string,
    entityType: string,
    entityId: string,
    content: string,
    metadata?: any
  ): Promise<void> {
    try {
      const embedding = await this.generateEmbedding(content);

      await (this.prisma as any).aIEmbedding.create({
        data: {
          tenantId,
          entityType,
          entityId,
          content,
          embedding,
          metadata: metadata || {},
          createdAt: new Date()
        }
      });
    } catch (error: any) {
      console.error('[Semantic Search] Error storing embedding:', error);
    }
  }

  /**
   * Búsqueda semántica principal
   */
  async semanticSearch(request: SemanticSearchRequest): Promise<SemanticSearchResult[]> {
    try {
      // Generar embedding para la consulta
      const queryEmbedding = await this.generateEmbedding(request.query);

      // Construir consulta SQL con pgvector
      const sql = this.buildSemanticSearchQuery(request);
      
      // Ejecutar búsqueda vectorial
      const results = await this.prisma.$queryRawUnsafe(sql, queryEmbedding);

      // Formatear resultados
      return this.formatSearchResults(results as any[], request.threshold || 0.7);
      
    } catch (error: any) {
      console.error('[Semantic Search] Error in semantic search:', error);
      return [];
    }
  }

  /**
   * Construye consulta SQL para búsqueda semántica
   */
  private buildSemanticSearchQuery(request: SemanticSearchRequest): string {
    const { tenantId, filters, limit = 10 } = request;
    
    let whereConditions = [`e.tenantId = '${tenantId}'`];
    
    if (filters?.type) {
      whereConditions.push(`e.entityType = '${filters.type}'`);
    }
    
    if (filters?.dateRange) {
      const from = filters.dateRange.from.toISOString();
      const to = filters.dateRange.to.toISOString();
      whereConditions.push(`e.createdAt >= '${from}' AND e.createdAt <= '${to}'`);
    }
    
    if (filters?.userId) {
      whereConditions.push(`e.metadata->>'userId' = '${filters.userId}'`);
    }

    const whereClause = whereConditions.join(' AND ');
    
    return `
      SELECT 
        e.id,
        e.entityType as type,
        e.entityId,
        e.content,
        e.metadata,
        e.createdAt,
        1 - (e.embedding <=> $1::vector) as similarity
      FROM "AIEmbedding" e
      WHERE ${whereClause}
        AND 1 - (e.embedding <=> $1::vector) > 0.5
      ORDER BY similarity DESC
      LIMIT ${limit}
    `;
  }

  /**
   * Formatea resultados de búsqueda
   */
  private formatSearchResults(
    results: any[], 
    threshold: number
  ): SemanticSearchResult[] {
    return results
      .filter(result => result.similarity >= threshold)
      .map(result => ({
        id: result.entityId,
        type: result.type,
        title: this.extractTitle(result),
        content: result.content,
        similarity: parseFloat(result.similarity),
        metadata: result.metadata,
        url: this.buildEntityUrl(result),
        createdAt: new Date(result.createdAt)
      }));
  }

  /**
   * Extrae título del contenido
   */
  private extractTitle(result: any): string {
    const content = result.content;
    const lines = content.split('\n');
    
    // Buscar primera línea significativa
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 10 && trimmed.length < 100) {
        return trimmed.replace(/^#+\s*/, ''); // Remover markdown headers
      }
    }
    
    // Si no encuentra, usar metadata
    if (result.metadata?.title) {
      return result.metadata.title;
    }
    
    // Último recurso: primeras 50 caracteres
    return content.substring(0, 50) + (content.length > 50 ? '...' : '');
  }

  /**
   * Construye URL para la entidad
   */
  private buildEntityUrl(result: any): string {
    const baseUrl = process.env.WEB_BASE_URL || 'https://www.logismart.ar';
    
    switch (result.type) {
      case 'document':
        return `${baseUrl}/documents/${result.entityId}`;
      case 'conversation':
        return `${baseUrl}/command-center?conversation=${result.entityId}`;
      case 'action':
        return `${baseUrl}/command-center?action=${result.entityId}`;
      case 'ncr':
        return `${baseUrl}/quality/ncr/${result.entityId}`;
      case 'project':
        return `${baseUrl}/projects/${result.entityId}`;
      case 'audit':
        return `${baseUrl}/audit/${result.entityId}`;
      default:
        return `${baseUrl}/search?q=${result.entityId}`;
    }
  }

  /**
   * Indexa contenido existente para búsqueda semántica
   */
  async indexExistingContent(tenantId: string): Promise<void> {
    console.log(`[Semantic Search] Starting content indexing for tenant ${tenantId}`);

    try {
      // Indexar documentos
      await this.indexDocuments(tenantId);
      
      // Indexar conversaciones
      await this.indexConversations(tenantId);
      
      // Indexar acciones
      await this.indexActions(tenantId);
      
      // Indexar memorias
      await this.indexMemories(tenantId);
      
      console.log(`[Semantic Search] Content indexing completed for tenant ${tenantId}`);
    } catch (error: any) {
      console.error('[Semantic Search] Error indexing content:', error);
    }
  }

  /**
   * Indexa documentos del tenant
   */
  private async indexDocuments(tenantId: string): Promise<void> {
    const documents = await this.prisma.document.findMany({
      where: { tenantId },
      take: 100 // Limitar para no sobrecargar
    });

    for (const doc of documents) {
      const content = `${doc.title}\n\n${doc.description || ''}\n\n${doc.content || ''}`;
      
      await this.storeEmbedding(
        tenantId,
        'document',
        doc.id,
        content,
        {
          title: doc.title,
          type: doc.type,
          status: doc.status
        }
      );
    }
  }

  /**
   * Indexa conversaciones IA
   */
  private async indexConversations(tenantId: string): Promise<void> {
    const conversations = await (this.prisma as any).aIConversation.findMany({
      where: { tenantId },
      include: {
        messages: true
      },
      take: 50
    });

    for (const conv of conversations) {
      const content = conv.messages
        .map((msg: any) => `${msg.role}: ${msg.content}`)
        .join('\n');
      
      await this.storeEmbedding(
        tenantId,
        'conversation',
        conv.id,
        content,
        {
          title: conv.title,
          messageCount: conv.messages.length,
          userId: conv.userId
        }
      );
    }
  }

  /**
   * Indexa acciones ejecutadas
   */
  private async indexActions(tenantId: string): Promise<void> {
    const actions = await (this.prisma as any).aIAction.findMany({
      where: { tenantId },
      take: 50
    });

    for (const action of actions) {
      const content = `${action.type}: ${action.description}\n\n${JSON.stringify(action.payload)}`;
      
      await this.storeEmbedding(
        tenantId,
        'action',
        action.id,
        content,
        {
          type: action.type,
          status: action.status,
          userId: action.userId,
          module: action.module
        }
      );
    }
  }

  /**
   * Indexa memorias contextuales
   */
  private async indexMemories(tenantId: string): Promise<void> {
    const memories = await (this.prisma as any).aIMemory.findMany({
      where: { tenantId },
      take: 100
    });

    for (const memory of memories) {
      const content = `${memory.type}: ${memory.key}\n\n${JSON.stringify(memory.value)}`;
      
      await this.storeEmbedding(
        tenantId,
        'memory',
        memory.id,
        content,
        {
          type: memory.type,
          key: memory.key,
          lastUpdated: memory.lastUpdated
        }
      );
    }
  }

  /**
   * Encuentra contenido similar
   */
  async findSimilarContent(
    entityId: string,
    entityType: string,
    tenantId: string,
    limit: number = 5
  ): Promise<SemanticSearchResult[]> {
    try {
      // Obtener embedding original
      const original = await (this.prisma as any).aIEmbedding.findFirst({
        where: {
          entityId,
          entityType,
          tenantId
        }
      });

      if (!original) {
        return [];
      }

      // Buscar contenido similar
      const results = await this.prisma.$queryRawUnsafe(`
        SELECT 
          e.id,
          e.entityType as type,
          e.entityId,
          e.content,
          e.metadata,
          e.createdAt,
          1 - (e.embedding <=> $1::vector) as similarity
        FROM "AIEmbedding" e
        WHERE e.tenantId = $2
          AND e.entityId != $3
          AND e.entityType = $4
          AND 1 - (e.embedding <=> $1::vector) > 0.6
        ORDER BY similarity DESC
        LIMIT $5
      `, original.embedding, tenantId, entityId, entityType, limit);

      return this.formatSearchResults(results as any[], 0.6);
      
    } catch (error: any) {
      console.error('[Semantic Search] Error finding similar content:', error);
      return [];
    }
  }

  /**
   * Actualiza embedding de una entidad
   */
  async updateEmbedding(
    entityId: string,
    entityType: string,
    tenantId: string,
    newContent: string,
    metadata?: any
  ): Promise<void> {
    try {
      // Eliminar embedding anterior
      await (this.prisma as any).aIEmbedding.deleteMany({
        where: {
          entityId,
          entityType,
          tenantId
        }
      });

      // Crear nuevo embedding
      await this.storeEmbedding(tenantId, entityType, entityId, newContent, metadata);
      
    } catch (error: any) {
      console.error('[Semantic Search] Error updating embedding:', error);
    }
  }

  /**
   * Obtiene estadísticas de indexación
   */
  async getIndexStats(tenantId: string): Promise<any> {
    try {
      const stats = await this.prisma.$queryRawUnsafe(`
        SELECT 
          entityType,
          COUNT(*) as total,
          AVG(1 - (embedding <=> embedding)) as avg_similarity
        FROM "AIEmbedding"
        WHERE tenantId = $1
        GROUP BY entityType
      `, tenantId);

      return stats;
    } catch (error: any) {
      console.error('[Semantic Search] Error getting index stats:', error);
      return {};
    }
  }

  /**
   * Limpia embeddings antiguos
   */
  async cleanupOldEmbeddings(tenantId: string, daysOld: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await this.prisma.$executeRawUnsafe(`
        DELETE FROM "AIEmbedding"
        WHERE tenantId = $1 AND createdAt < $2
      `, tenantId, cutoffDate);

      console.log(`[Semantic Search] Cleaned up ${result} old embeddings`);
    } catch (error: any) {
      console.error('[Semantic Search] Error cleaning up embeddings:', error);
    }
  }
}

export default AISemanticSearchEngine;
