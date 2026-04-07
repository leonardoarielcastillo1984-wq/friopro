/**
 * Elasticsearch Plugin for Full-Text Search
 * Provides full-text search capabilities across:
 * - Documents
 * - Departments
 * - Users
 * - Audit logs
 */

import fastifyPlugin from 'fastify-plugin';
import { Client } from '@elastic/elasticsearch';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

interface SearchResult {
  id: string;
  type: string;
  title: string;
  content?: string;
  score: number;
}

interface IndexConfig {
  name: string;
  type: string;
}

/**
 * Elasticsearch Plugin
 */
export const elasticsearchPlugin = fastifyPlugin(
  async (fastify: FastifyInstance) => {
    const prisma = fastify.prisma as PrismaClient;

    // Initialize Elasticsearch client
    const elasticsearchUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
    const elasticsearchUser = process.env.ELASTICSEARCH_USER || 'elastic';
    const elasticsearchPassword =
      process.env.ELASTICSEARCH_PASSWORD || 'elastic123!@#';

    const client = new Client({
      node: elasticsearchUrl,
      auth: {
        username: elasticsearchUser,
        password: elasticsearchPassword,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Verify connection
    try {
      await client.info();
      fastify.log.info('Connected to Elasticsearch');
    } catch (error) {
      fastify.log.warn('Elasticsearch connection failed:', error);
    }

    // Initialize indices on startup
    await initializeIndices(client);

    /**
     * Full-text search across all indices
     */
    async function searchAll(query: string, limit: number = 20) {
      try {
        const response = await client.search({
          index: 'sgi360-*',
          body: {
            query: {
              multi_match: {
                query,
                fields: ['title^2', 'content', 'description', 'tags'],
                fuzziness: 'AUTO',
              },
            },
            size: limit,
            highlight: {
              fields: {
                content: {},
                title: {},
              },
            },
          },
        });

        return response.hits.hits.map((hit: any) => ({
          id: hit._id,
          type: hit._index.split('-')[1],
          score: hit._score,
          ...hit._source,
          highlight: hit.highlight,
        }));
      } catch (error) {
        fastify.log.error('Search error:', error);
        return [];
      }
    }

    /**
     * Search documents
     */
    async function searchDocuments(
      query: string,
      filters: Record<string, any> = {},
      limit: number = 20,
      offset: number = 0
    ) {
      try {
        const must = [
          {
            multi_match: {
              query,
              fields: ['title^2', 'content', 'description'],
              fuzziness: 'AUTO',
            },
          },
        ];

        // Add filters
        if (filters.department) {
          must.push({ term: { 'department.id': filters.department } });
        }
        if (filters.status) {
          must.push({ term: { status: filters.status } });
        }
        if (filters.dateFrom) {
          must.push({
            range: {
              createdAt: {
                gte: filters.dateFrom,
              },
            },
          });
        }

        const response = await client.search({
          index: 'sgi360-documents',
          body: {
            query: {
              bool: {
                must,
              },
            },
            size: limit,
            from: offset,
            sort: [{ _score: 'desc' }, { createdAt: 'desc' }],
            highlight: {
              fields: {
                content: {
                  number_of_fragments: 3,
                  fragment_size: 150,
                },
                title: {},
              },
            },
          },
        });

        return {
          total: response.hits.total,
          results: response.hits.hits.map((hit: any) => ({
            id: hit._id,
            score: hit._score,
            ...hit._source,
            highlight: hit.highlight,
          })),
        };
      } catch (error) {
        fastify.log.error('Document search error:', error);
        return { total: 0, results: [] };
      }
    }

    /**
     * Search users
     */
    async function searchUsers(query: string, limit: number = 20) {
      try {
        const response = await client.search({
          index: 'sgi360-users',
          body: {
            query: {
              multi_match: {
                query,
                fields: ['name^2', 'email', 'department'],
                fuzziness: 'AUTO',
              },
            },
            size: limit,
          },
        });

        return response.hits.hits.map((hit: any) => ({
          id: hit._id,
          ...hit._source,
        }));
      } catch (error) {
        fastify.log.error('User search error:', error);
        return [];
      }
    }

    /**
     * Search audit logs
     */
    async function searchAuditLogs(
      query: string,
      filters: Record<string, any> = {},
      limit: number = 50
    ) {
      try {
        const must = [
          {
            multi_match: {
              query,
              fields: ['action', 'description', 'details'],
              fuzziness: 'AUTO',
            },
          },
        ];

        if (filters.userId) {
          must.push({ term: { userId: filters.userId } });
        }
        if (filters.action) {
          must.push({ term: { action: filters.action } });
        }
        if (filters.dateFrom) {
          must.push({
            range: {
              timestamp: {
                gte: filters.dateFrom,
              },
            },
          });
        }

        const response = await client.search({
          index: 'sgi360-auditlogs',
          body: {
            query: {
              bool: {
                must,
              },
            },
            size: limit,
            sort: [{ timestamp: 'desc' }],
          },
        });

        return response.hits.hits.map((hit: any) => ({
          id: hit._id,
          ...hit._source,
        }));
      } catch (error) {
        fastify.log.error('Audit log search error:', error);
        return [];
      }
    }

    /**
     * Index a document
     */
    async function indexDocument(
      index: string,
      id: string,
      data: Record<string, any>
    ) {
      try {
        await client.index({
          index,
          id,
          body: data,
        });
      } catch (error) {
        fastify.log.error(`Error indexing ${index}:`, error);
      }
    }

    /**
     * Delete from index
     */
    async function deleteFromIndex(index: string, id: string) {
      try {
        await client.delete({
          index,
          id,
        });
      } catch (error) {
        fastify.log.error(`Error deleting from ${index}:`, error);
      }
    }

    /**
     * Bulk index operations
     */
    async function bulkIndex(operations: any[]) {
      try {
        await client.bulk({
          body: operations,
        });
      } catch (error) {
        fastify.log.error('Bulk index error:', error);
      }
    }

    /**
     * Get index stats
     */
    async function getIndexStats(index: string) {
      try {
        const stats = await client.indices.stats({ index });
        return stats.indices[index];
      } catch (error) {
        fastify.log.error('Error getting index stats:', error);
        return null;
      }
    }

    // Decorate fastify with search methods
    fastify.decorate('search', {
      all: searchAll,
      documents: searchDocuments,
      users: searchUsers,
      auditLogs: searchAuditLogs,
    });

    // Decorate fastify with index methods
    fastify.decorate('elasticsearch', {
      client,
      index: indexDocument,
      delete: deleteFromIndex,
      bulk: bulkIndex,
      stats: getIndexStats,
    });

    fastify.log.info('Elasticsearch plugin loaded');
  }
);

/**
 * Initialize Elasticsearch indices
 */
async function initializeIndices(client: Client) {
  const indices = [
    {
      name: 'sgi360-documents',
      settings: {
        number_of_shards: 2,
        number_of_replicas: 1,
      },
      mappings: {
        properties: {
          id: { type: 'keyword' },
          title: {
            type: 'text',
            analyzer: 'standard',
            fields: { keyword: { type: 'keyword' } },
          },
          content: { type: 'text', analyzer: 'standard' },
          description: { type: 'text' },
          status: { type: 'keyword' },
          department: {
            type: 'object',
            properties: {
              id: { type: 'keyword' },
              name: { type: 'text' },
            },
          },
          createdAt: { type: 'date' },
          updatedAt: { type: 'date' },
          tags: { type: 'keyword' },
        },
      },
    },
    {
      name: 'sgi360-users',
      settings: {
        number_of_shards: 1,
        number_of_replicas: 1,
      },
      mappings: {
        properties: {
          id: { type: 'keyword' },
          name: { type: 'text' },
          email: { type: 'keyword' },
          role: { type: 'keyword' },
          department: { type: 'text' },
          createdAt: { type: 'date' },
        },
      },
    },
    {
      name: 'sgi360-auditlogs',
      settings: {
        number_of_shards: 3,
        number_of_replicas: 1,
      },
      mappings: {
        properties: {
          id: { type: 'keyword' },
          userId: { type: 'keyword' },
          action: { type: 'keyword' },
          description: { type: 'text' },
          details: { type: 'object', enabled: false },
          timestamp: { type: 'date' },
          ipAddress: { type: 'ip' },
        },
      },
    },
  ];

  for (const index of indices) {
    try {
      const exists = await client.indices.exists({ index: index.name });

      if (!exists) {
        await client.indices.create({
          index: index.name,
          body: {
            settings: index.settings,
            mappings: index.mappings,
          },
        });

        console.log(`✓ Index created: ${index.name}`);
      }
    } catch (error) {
      console.error(`Error initializing index ${index.name}:`, error);
    }
  }
}

export default elasticsearchPlugin;
