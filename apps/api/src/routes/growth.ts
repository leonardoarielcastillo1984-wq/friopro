import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { sendEmail, notificationEmail } from '../services/email.js';

const prismaDirect = new PrismaClient();

const APP_URL = process.env.CORS_ORIGIN?.split(',')[0]?.trim() || 'https://logismart.ar';
const REWARD_DAYS = 30;

// Token HMAC para baja de emails — evita que cualquiera desuscriba a otro.
function unsubscribeToken(email: string) {
  const secret = process.env.JWT_SECRET || 'growth-unsub';
  return crypto.createHmac('sha256', secret).update(email.toLowerCase().trim()).digest('hex').slice(0, 24);
}
export function unsubscribeUrl(email: string) {
  return `${APP_URL}/api/leads/unsubscribe?email=${encodeURIComponent(email)}&t=${unsubscribeToken(email)}`;
}

/** Recompensa del referido: extiende trial/licencia del tenant referente. */
export async function applyReferralReward(referrerId: string) {
  const t = await prismaDirect.tenant.findUnique({
    where: { id: referrerId },
    select: { licenseEndAt: true, demoExpiresAt: true },
  });
  if (!t) return;
  const base = t.licenseEndAt ?? t.demoExpiresAt ?? new Date();
  const next = new Date(Math.max(base.getTime(), Date.now()) + REWARD_DAYS * 86400e3);
  await prismaDirect.tenant.update({
    where: { id: referrerId },
    data: t.licenseEndAt ? { licenseEndAt: next } : { demoExpiresAt: next },
  });
}

/** Genera (o reutiliza) el código de referido de un tenant. */
export async function ensureReferralCode(tenantId: string, tenantName: string) {
  const t = await prismaDirect.tenant.findUnique({ where: { id: tenantId }, select: { referralCode: true } });
  if (t?.referralCode) return t.referralCode;
  const base = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 8) || 'sgi';
  for (let i = 0; i < 5; i++) {
    const code = `${base}${crypto.randomBytes(3).toString('hex')}`;
    const clash = await prismaDirect.tenant.findFirst({ where: { referralCode: code } });
    if (!clash) {
      await prismaDirect.tenant.update({ where: { id: tenantId }, data: { referralCode: code } });
      return code;
    }
  }
  return crypto.randomBytes(6).toString('hex');
}

/** Vincula un registro nuevo al código de referido usado (REGISTERED + reward). */
export async function linkReferralOnRegister(code: string | undefined, newTenantId: string, email: string, log: { info: (m: string) => void; error: (m: string) => void }) {
  if (!code) return;
  try {
    const referrer = await prismaDirect.tenant.findFirst({ where: { referralCode: code } });
    if (!referrer || referrer.id === newTenantId) return;

    // Si hubo un click previo del mismo código sin referido, lo reclamamos
    const pending = await prismaDirect.referral.findFirst({
      where: { code, referredId: null },
      orderBy: { createdAt: 'asc' },
    });
    if (pending) {
      await prismaDirect.referral.update({
        where: { id: pending.id },
        data: { referredId: newTenantId, referredEmail: email, status: 'REGISTERED' },
      });
    } else {
      await prismaDirect.referral.create({
        data: { code, referrerId: referrer.id, referredId: newTenantId, referredEmail: email, status: 'REGISTERED' },
      });
    }
    await applyReferralReward(referrer.id);
    await prismaDirect.referral.updateMany({
      where: { referredId: newTenantId, status: 'REGISTERED' },
      data: { status: 'REWARDED', rewardedAt: new Date() },
    });

    // Doble incentivo: el referido suma 7 días extra a su trial
    const trial = await prismaDirect.tenantSubscription.findFirst({
      where: { tenantId: newTenantId, status: 'TRIAL' },
      orderBy: { endsAt: 'desc' },
    });
    if (trial?.endsAt) {
      await prismaDirect.tenantSubscription.update({
        where: { id: trial.id },
        data: { endsAt: new Date(trial.endsAt.getTime() + 7 * 86400e3) },
      });
    }
    log.info(`[REFERRAL] ${code}: referrer=${referrer.id} premiado por nuevo tenant ${newTenantId}`);
  } catch (e: any) {
    log.error(`[REFERRAL] Error vinculando código ${code}: ${e?.message}`);
  }
}

export const growthRoutes: FastifyPluginAsync = async (app) => {

  // ── POST /track — evento de funnel (público, liviano, nunca falla al cliente) ──
  const trackSchema = z.object({
    event: z.string().min(2).max(40).regex(/^[A-Z_]+$/),
    page: z.string().max(200).optional(),
    meta: z.record(z.any()).optional(),
  });
  const handleTrack = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = trackSchema.safeParse(req.body || {});
      if (!parsed.success) return reply.code(204).send();
      const d = parsed.data;
      await prismaDirect.growthEvent.create({
        data: { event: d.event, page: d.page, meta: d.meta, ip: req.ip },
      });
      return reply.code(204).send();
    } catch {
      return reply.code(204).send(); // tracking nunca rompe UX
    }
  };
  app.post('/track', handleTrack);
  app.post('/api/track', handleTrack);

  // ── POST /referrals/click — landing con ?ref=CODE registra el click ──
  const clickSchema = z.object({ code: z.string().min(4).max(40) });
  const handleRefClick = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = clickSchema.safeParse(req.body || {});
      if (!parsed.success) return reply.code(204).send();
      const referrer = await prismaDirect.tenant.findFirst({ where: { referralCode: parsed.data.code } });
      if (!referrer) return reply.code(204).send();
      // Un click "abierto" por código: el primero sin referido se reclama al registrar
      const open = await prismaDirect.referral.findFirst({ where: { code: parsed.data.code, referredId: null } });
      if (!open) {
        await prismaDirect.referral.create({ data: { code: parsed.data.code, referrerId: referrer.id } });
      }
      await prismaDirect.growthEvent.create({ data: { event: 'REFERRAL_CLICK', page: parsed.data.code, ip: req.ip } }).catch(() => {});
      return reply.send({ ok: true });
    } catch {
      return reply.code(204).send();
    }
  };
  app.post('/referrals/click', handleRefClick);
  app.post('/api/referrals/click', handleRefClick);

  // ── GET /referral/link — link + stats del tenant autenticado ──
  const handleReferralLink = async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = (req as any).auth;
    const tenantId = auth?.tenantId || (req as any).db?.tenantId;
    if (!tenantId) return reply.code(401).send({ error: 'No autenticado' });
    const tenant = await prismaDirect.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    const code = await ensureReferralCode(tenantId, tenant?.name || 'sgi');
    const stats = await prismaDirect.referral.groupBy({
      by: ['status'], where: { referrerId: tenantId }, _count: { _all: true },
    });
    const count = (s: string) => stats.find((x) => x.status === s)?._count._all ?? 0;
    return reply.send({
      code,
      url: `${APP_URL}/register?ref=${code}`,
      shareText: `Te recomiendo SGI360 para gestionar tu sistema de calidad/seguridad — 30 días de prueba gratis con mi link: ${APP_URL}/register?ref=${code}`,
      clicks: count('CLICKED') + count('REGISTERED') + count('REWARDED'),
      registered: count('REGISTERED') + count('REWARDED'),
      rewarded: count('REWARDED'),
      rewardDays: REWARD_DAYS,
    });
  };
  app.get('/referral/link', handleReferralLink);
  app.get('/api/referral/link', handleReferralLink);

  // ── GET /leads/unsubscribe — baja de emails de marketing ──
  const handleUnsub = async (req: FastifyRequest, reply: FastifyReply) => {
    const q = (req.query as any) || {};
    const email = String(q.email || '').toLowerCase().trim();
    const token = String(q.t || '');
    const html = (msg: string) => `<!doctype html><html lang="es"><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#F9FAFB;"><div style="text-align:center;max-width:420px;padding:32px;background:#fff;border-radius:16px;border:1px solid #E5E7EB;"><h1 style="font-size:20px;color:#111827;">${msg}</h1><p style="color:#6B7280;font-size:14px;">No vas a recibir más correos de marketing de LOGISMART.</p></div></body></html>`;
    if (!email || token !== unsubscribeToken(email)) {
      reply.header('Content-Type', 'text/html; charset=utf-8');
      return reply.code(400).send(html('Link inválido'));
    }
    await prismaDirect.marketingLead.updateMany({
      where: { email }, data: { unsubscribedAt: new Date() },
    });
    await prismaDirect.growthEvent.create({ data: { event: 'UNSUBSCRIBE', page: 'leads', ip: req.ip } }).catch(() => {});
    reply.header('Content-Type', 'text/html; charset=utf-8');
    return reply.send(html('Listo — te diste de baja'));
  };
  app.get('/leads/unsubscribe', handleUnsub);
  app.get('/api/leads/unsubscribe', handleUnsub);

  // ── GET /growth/stats — dashboard del funnel (SUPER_ADMIN) ──
  const handleGrowthStats = async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = (req as any).auth;
    if (!auth || auth.globalRole !== 'SUPER_ADMIN') return reply.code(403).send({ error: 'Forbidden' });
    const days = Math.min(parseInt(String((req.query as any)?.days || '30'), 10) || 30, 365);
    const since = new Date(Date.now() - days * 86400e3);

    const [events, leads, leadsBySource, referrals, totalTenants] = await Promise.all([
      prismaDirect.growthEvent.groupBy({ by: ['event'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
      prismaDirect.marketingLead.count({ where: { createdAt: { gte: since } } }),
      prismaDirect.marketingLead.groupBy({ by: ['source'], where: { createdAt: { gte: since } }, _count: { _all: true }, orderBy: { _count: { source: 'desc' } } }),
      prismaDirect.referral.groupBy({ by: ['status'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
      prismaDirect.tenant.count({ where: { createdAt: { gte: since } } }),
    ]);
    const ev = (n: string) => events.find((e) => e.event === n)?._count._all ?? 0;
    const rf = (s: string) => referrals.find((r) => r.status === s)?._count._all ?? 0;

    // Serie diaria de eventos clave (para sparkline)
    const daily = await prismaDirect.$queryRawUnsafe<{ d: string; page_views: bigint; leads: bigint; tenants: bigint }[]>(`
      SELECT to_char(d.day, 'YYYY-MM-DD') AS d,
        COALESCE(ev.n, 0) AS page_views, COALESCE(ld.n, 0) AS leads, COALESCE(tn.n, 0) AS tenants
      FROM generate_series((now() - interval '${days} days')::date, now()::date, '1 day') AS d(day)
      LEFT JOIN (SELECT date_trunc('day', "createdAt") dd, count(*) n FROM "growth_events" WHERE event='PAGE_VIEW' GROUP BY 1) ev ON ev.dd = d.day
      LEFT JOIN (SELECT date_trunc('day', "createdAt") dd, count(*) n FROM "marketing_leads" GROUP BY 1) ld ON ld.dd = d.day
      LEFT JOIN (SELECT date_trunc('day', "createdAt") dd, count(*) n FROM "Tenant" GROUP BY 1) tn ON tn.dd = d.day
      ORDER BY d.day`);
    const recentLeads = await prismaDirect.marketingLead.findMany({
      orderBy: { createdAt: 'desc' }, take: 15,
      select: { email: true, nombre: true, empresa: true, source: true, createdAt: true },
    });

    return reply.send({
      days,
      funnel: {
        pageViews: ev('PAGE_VIEW'),
        toolViews: ev('TOOL_VIEW'),
        leads,
        registerStarted: ev('REGISTER_STARTED'),
        registerCompleted: ev('REGISTER_COMPLETED'),
        newTenants: totalTenants,
      },
      leadsBySource: leadsBySource.map((l) => ({ source: l.source, count: l._count._all })),
      referrals: { clicked: rf('CLICKED'), registered: rf('REGISTERED'), rewarded: rf('REWARDED') },
      daily: daily.map((r) => ({ d: r.d, pageViews: Number(r.page_views), leads: Number(r.leads), tenants: Number(r.tenants) })),
      recentLeads,
    });
  };
  app.get('/growth/stats', handleGrowthStats);
  app.get('/api/growth/stats', handleGrowthStats);
};
