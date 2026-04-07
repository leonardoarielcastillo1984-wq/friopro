/**
 * WebSocket Plugin for Real-time Notifications
 * Manages Socket.io connections for real-time events:
 * - User login notifications
 * - Security alerts
 * - Department updates
 * - Document changes
 */

import fastifyPlugin from 'fastify-plugin';
import socketIO from '@fastify/socket.io';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

interface AuthenticatedSocket {
  userId: string;
  email: string;
  role: string;
  department: string;
}

interface RealTimeEvent {
  type: string;
  data: any;
  timestamp: Date;
  userId?: string;
}

// Event types
export const EVENT_TYPES = {
  // Authentication events
  USER_LOGIN: 'user:login',
  USER_LOGOUT: 'user:logout',
  LOGIN_FAILED: 'auth:login_failed',
  SESSION_EXPIRED: 'auth:session_expired',

  // Security events
  SECURITY_ALERT: 'security:alert',
  SUSPICIOUS_ACTIVITY: 'security:suspicious_activity',
  UNAUTHORIZED_ACCESS: 'security:unauthorized_access',
  PASSWORD_CHANGED: 'security:password_changed',

  // 2FA events
  TWO_FA_ENABLED: '2fa:enabled',
  TWO_FA_DISABLED: '2fa:disabled',
  TWO_FA_VERIFICATION: '2fa:verification',

  // Department events
  DEPARTMENT_CREATED: 'department:created',
  DEPARTMENT_UPDATED: 'department:updated',
  DEPARTMENT_DELETED: 'department:deleted',
  DEPARTMENT_MEMBER_ADDED: 'department:member_added',
  DEPARTMENT_MEMBER_REMOVED: 'department:member_removed',

  // Document events
  DOCUMENT_UPLOADED: 'document:uploaded',
  DOCUMENT_UPDATED: 'document:updated',
  DOCUMENT_DELETED: 'document:deleted',
  DOCUMENT_SHARED: 'document:shared',

  // System events
  SYSTEM_NOTIFICATION: 'system:notification',
  MAINTENANCE_ALERT: 'system:maintenance',
};

// Rooms for event filtering
export const ROOM_TYPES = {
  ADMIN: 'admin',
  SECURITY: 'security',
  DEPARTMENT: 'department',
  USER: 'user',
  PUBLIC: 'public',
};

/**
 * WebSocket Plugin - Initialize Socket.io for real-time communication
 */
export const websocketPlugin = fastifyPlugin(
  async (fastify: FastifyInstance, opts) => {
    const prisma = fastify.prisma as PrismaClient;

    // Initialize Socket.io
    await fastify.register(socketIO, {
      cors: {
        origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(
          ','
        ),
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      serveClient: false,
      pingInterval: 10000,
      pingTimeout: 5000,
      maxHttpBufferSize: 1e6,
    });

    // In-memory user connections map
    const userConnections = new Map<string, Set<string>>();
    const socketToUser = new Map<string, AuthenticatedSocket>();

    /**
     * Authenticate WebSocket connection
     */
    fastify.io.on('connection', async (socket) => {
      console.log(`[WebSocket] New connection: ${socket.id}`);

      // Require authentication
      socket.on('authenticate', async (data, callback) => {
        try {
          const { token } = data;

          if (!token) {
            socket.disconnect(true);
            callback({ error: 'No token provided' });
            return;
          }

          // Verify JWT token
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');

          if (typeof decoded === 'object' && 'userId' in decoded) {
            const user = await prisma.user.findUnique({
              where: { id: decoded.userId },
              select: {
                id: true,
                email: true,
                role: true,
                department: { select: { id: true } },
              },
            });

            if (!user) {
              socket.disconnect(true);
              callback({ error: 'User not found' });
              return;
            }

            // Store authenticated user info
            const authSocket: AuthenticatedSocket = {
              userId: user.id,
              email: user.email,
              role: user.role,
              department: user.department?.id || '',
            };

            socketToUser.set(socket.id, authSocket);

            // Track user connections
            if (!userConnections.has(user.id)) {
              userConnections.set(user.id, new Set());
            }
            userConnections.get(user.id)!.add(socket.id);

            // Join user-specific room
            socket.join(`${ROOM_TYPES.USER}:${user.id}`);

            // Join role-based rooms
            socket.join(`${ROOM_TYPES.ADMIN}:${user.role}`);

            // Join department room if applicable
            if (user.department?.id) {
              socket.join(`${ROOM_TYPES.DEPARTMENT}:${user.department.id}`);
            }

            // Join security room for security alerts
            if (user.role === 'ADMIN' || user.role === 'SECURITY_OFFICER') {
              socket.join(ROOM_TYPES.SECURITY);
            }

            console.log(
              `[WebSocket] User authenticated: ${user.email} (${socket.id})`
            );

            callback({ success: true, userId: user.id });

            // Emit user login notification to admins
            broadcastEvent(fastify.io, {
              type: EVENT_TYPES.USER_LOGIN,
              data: {
                userId: user.id,
                email: user.email,
                timestamp: new Date(),
              },
              timestamp: new Date(),
              userId: user.id,
            });
          }
        } catch (error) {
          console.error('[WebSocket] Authentication error:', error);
          socket.disconnect(true);
          callback({ error: 'Authentication failed' });
        }
      });

      /**
       * Handle disconnection
       */
      socket.on('disconnect', async () => {
        const user = socketToUser.get(socket.id);

        if (user) {
          console.log(`[WebSocket] User disconnected: ${user.email}`);

          // Remove from user connections
          const connections = userConnections.get(user.userId);
          if (connections) {
            connections.delete(socket.id);
            if (connections.size === 0) {
              userConnections.delete(user.userId);

              // Emit user logout notification
              broadcastEvent(fastify.io, {
                type: EVENT_TYPES.USER_LOGOUT,
                data: {
                  userId: user.userId,
                  email: user.email,
                  timestamp: new Date(),
                },
                timestamp: new Date(),
                userId: user.userId,
              });
            }
          }

          socketToUser.delete(socket.id);
        }
      });

      /**
       * Handle errors
       */
      socket.on('error', (error) => {
        console.error(`[WebSocket] Socket error (${socket.id}):`, error);
      });
    });

    /**
     * Broadcast event to all connected clients
     */
    fastify.decorate(
      'broadcastEvent',
      (event: RealTimeEvent, room?: string) => {
        if (room) {
          fastify.io.to(room).emit('event', event);
        } else {
          fastify.io.emit('event', event);
        }

        // Log event
        console.log(
          `[WebSocket] Event broadcasted: ${event.type} to ${room || 'all'}`
        );
      }
    );

    /**
     * Send event to specific user
     */
    fastify.decorate('sendToUser', (userId: string, event: RealTimeEvent) => {
      fastify.io.to(`${ROOM_TYPES.USER}:${userId}`).emit('event', event);
    });

    /**
     * Get connected users count
     */
    fastify.decorate('getConnectedUsersCount', () => {
      return userConnections.size;
    });

    /**
     * Check if user is connected
     */
    fastify.decorate('isUserConnected', (userId: string) => {
      return userConnections.has(userId);
    });

    fastify.log.info('WebSocket plugin loaded');
  }
);

/**
 * Broadcast event to Socket.io clients
 */
function broadcastEvent(io: any, event: RealTimeEvent) {
  io.emit('event', event);
}

export default websocketPlugin;
