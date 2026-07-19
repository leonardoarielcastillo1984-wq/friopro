import type { FastifyPluginAsync } from 'fastify';
const plugin: FastifyPluginAsync = async (app) => {};
export default plugin;

export function signP360Token(_payload: any): string { return ''; }
export function verifyP360Token(_token: string): any { return {}; }
export async function provisionP360Workspace(_prisma: any, _tenantId: string, _userId: string, _companyName?: string): Promise<{ workspace: any; member: any }> {
  return { workspace: {}, member: {} };
}
