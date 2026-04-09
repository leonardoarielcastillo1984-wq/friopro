import { prisma } from "@/lib/prisma";

const FREE_TRIAL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AccessState =
  | {
      mode: "FULL";
      licenseId: string;
      planCode: string;
      planName: string;
      usage: { workorders: number; pdfs: number; ai: number };
      trial?: {
        daysRemaining: number;
        expiresAt: Date;
      };
      limits: {
        maxWorkOrdersPerMonth: number;
        maxEquipments: number;
        maxClients: number;
        maxPdfsPerMonth: number;
        maxAiCallsPerMonth: number;
      };
      features: { aiEnabled: boolean; pdfEnabled: boolean; qrEnabled: boolean };
    }
  | {
      mode: "READ_ONLY";
      reason:
        | "NO_LICENSE"
        | "LICENSE_SUSPENDED"
        | "LICENSE_EXPIRED"
        | "WORKORDERS_LIMIT_REACHED"
        | "TRIAL_EXPIRED";
      details?: string;
      planCode?: string;
      trial?: {
        daysRemaining: number;
        expiresAt: Date;
      };
    };

function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * DAY_MS);
}

function getTrialInfo(userCreatedAt: Date, now: Date) {
  const expiresAt = addDays(userCreatedAt, FREE_TRIAL_DAYS);
  const msRemaining = expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / DAY_MS));
  const isExpired = now.getTime() > expiresAt.getTime();
  return { expiresAt, daysRemaining, isExpired };
}

export function getPlanLimits(planCode: string) {
  if (planCode === "FREE") {
    return {
      maxClients: 2,
      maxEquipments: 2,
      maxPdfsPerMonth: 0,
      maxAiCallsPerMonth: 0,
    };
  }

  if (planCode === "PRO") {
    return {
      maxClients: 999999,
      maxEquipments: 999999,
      maxPdfsPerMonth: 20,
      maxAiCallsPerMonth: 0,
    };
  }

  // PRO_PLUS
  return {
    maxClients: 999999,
    maxEquipments: 999999,
    maxPdfsPerMonth: 50,
    maxAiCallsPerMonth: 10,
  };
}

export function getPlanFeatures(planCode: string) {
  if (planCode === "FREE") {
    return { aiEnabled: false, pdfEnabled: false, qrEnabled: false };
  }
  if (planCode === "PRO") {
    return { aiEnabled: false, pdfEnabled: true, qrEnabled: true };
  }
  // PRO_PLUS
  return { aiEnabled: true, pdfEnabled: true, qrEnabled: true };
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

export async function getAccessState(userId: string): Promise<AccessState> {
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });

  const license = await prisma.license.findFirst({
    where: {
      userId,
    },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    include: {
      plan: true,
    },
  });

  if (!license) {
    return { mode: "READ_ONLY", reason: "NO_LICENSE" };
  }

  if (license.status === "SUSPENDED") {
    return { mode: "READ_ONLY", reason: "LICENSE_SUSPENDED" };
  }

  if (license.status === "EXPIRED" || license.expiresAt < now) {
    return { mode: "READ_ONLY", reason: "LICENSE_EXPIRED" };
  }

  const trialInfo = user?.createdAt ? getTrialInfo(user.createdAt, now) : null;
  if (license.plan.code === "FREE" && trialInfo?.isExpired) {
    return {
      mode: "READ_ONLY",
      reason: "TRIAL_EXPIRED",
      planCode: "FREE",
      trial: { expiresAt: trialInfo.expiresAt, daysRemaining: trialInfo.daysRemaining },
    };
  }

  const from = startOfMonth(now);
  const to = endOfMonth(now);

  const [workorders, pdfs, ai] = await Promise.all([
    prisma.usageEvent.count({
      where: {
        licenseId: license.id,
        type: "WORKORDER_CREATED",
        createdAt: { gte: from, lt: to },
      },
    }),
    prisma.usageEvent.count({
      where: {
        licenseId: license.id,
        type: "PDF_GENERATED",
        createdAt: { gte: from, lt: to },
      },
    }),
    prisma.usageEvent.count({
      where: {
        licenseId: license.id,
        type: "AI_CALL",
        createdAt: { gte: from, lt: to },
      },
    }),
  ]);

  if (workorders >= license.plan.maxWorkOrdersPerMonth) {
    return {
      mode: "READ_ONLY",
      reason: "WORKORDERS_LIMIT_REACHED",
      details: `${workorders}/${license.plan.maxWorkOrdersPerMonth}`,
    };
  }

  const planLimits = getPlanLimits(license.plan.code);
  const planFeatures = getPlanFeatures(license.plan.code);

  return {
    mode: "FULL",
    licenseId: license.id,
    planCode: license.plan.code,
    planName: license.plan.name,
    usage: { workorders, pdfs, ai },
    trial:
      license.plan.code === "FREE" && trialInfo
        ? { expiresAt: trialInfo.expiresAt, daysRemaining: trialInfo.daysRemaining }
        : undefined,
    limits: {
      maxWorkOrdersPerMonth: license.plan.maxWorkOrdersPerMonth,
      maxEquipments: planLimits.maxEquipments,
      maxClients: planLimits.maxClients,
      maxPdfsPerMonth: planLimits.maxPdfsPerMonth,
      maxAiCallsPerMonth: planLimits.maxAiCallsPerMonth,
    },
    features: planFeatures,
  };
}

export async function assertCanCreateWorkOrder(userId: string) {
  const state = await getAccessState(userId);
  if (state.mode !== "FULL") {
    throw new Error("READ_ONLY");
  }
  return state;
}

export async function assertCanGeneratePdf(userId: string) {
  const state = await getAccessState(userId);
  if (state.mode !== "FULL" || state.features.pdfEnabled !== true) {
    throw new Error("READ_ONLY");
  }

  if (state.usage.pdfs >= state.limits.maxPdfsPerMonth) {
    throw new Error("PDF_LIMIT_REACHED");
  }

  return state;
}

export async function assertCanCallAi(userId: string) {
  const state = await getAccessState(userId);
  if (state.mode !== "FULL" || state.features.aiEnabled !== true) {
    throw new Error("READ_ONLY");
  }

  if (state.usage.ai >= state.limits.maxAiCallsPerMonth) {
    throw new Error("AI_LIMIT_REACHED");
  }

  return state;
}

export async function assertCanManageMaintenance(userId: string) {
  const state = await getAccessState(userId);
  if (state.mode !== "FULL" || state.planCode !== "PRO_PLUS") {
    throw new Error("READ_ONLY");
  }
  return state;
}

export async function assertCanCreateClient(userId: string) {
  const state = await getAccessState(userId);
  if (state.mode !== "FULL") throw new Error("READ_ONLY");

  if (state.planCode === "FREE") {
    const count = await prisma.client.count({ where: { userId } });
    if (count >= state.limits.maxClients) {
      throw new Error("FREE_CLIENT_LIMIT");
    }
  }

  return state;
}

export async function assertCanCreateEquipment(userId: string) {
  const state = await getAccessState(userId);
  if (state.mode !== "FULL") throw new Error("READ_ONLY");

  if (state.planCode === "FREE") {
    const count = await prisma.equipment.count({ where: { userId } });
    if (count >= state.limits.maxEquipments) {
      throw new Error("FREE_EQUIPMENT_LIMIT");
    }
  }

  return state;
}
