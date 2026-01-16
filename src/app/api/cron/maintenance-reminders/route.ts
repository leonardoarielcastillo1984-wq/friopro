import { NextResponse } from "next/server";

import { getAccessState } from "@/lib/access";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

function asDateOnly(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDate(d: Date) {
  return d.toLocaleDateString();
}

function buildEmail({
  appName,
  clientName,
  technicianName,
  equipmentLabel,
  date,
}: {
  appName: string;
  clientName: string;
  technicianName: string;
  equipmentLabel: string;
  date: Date;
}) {
  return {
    subject: `Recordatorio de mantenimiento – ${equipmentLabel}`,
    body: `Hola ${clientName},\n\nEste es un recordatorio automático de ${appName}, a pedido de su técnico ${technicianName}.\nSe sugiere realizar el mantenimiento del equipo ${equipmentLabel} alrededor del ${formatDate(date)}.\nPara coordinar, comuníquese con su técnico.\n\n— ${appName}`,
  };
}

function buildMessage({
  appName,
  clientName,
  technicianName,
  equipmentLabel,
  date,
}: {
  appName: string;
  clientName: string;
  technicianName: string;
  equipmentLabel: string;
  date: Date;
}) {
  return `Hola ${clientName}. ${appName} te recuerda que tu técnico ${technicianName} sugiere mantenimiento del equipo ${equipmentLabel} alrededor del ${formatDate(date)}. Para coordinar, contactalo. — ${appName}`;
}

export async function POST(req: Request) {
  const rawSecret = req.headers.get("x-cron-secret") ?? "";
  const rawExpected =
    process.env.CRON_SECRET ||
    (process.env.NODE_ENV !== "production" ? "change-me" : "");

  const normalize = (v: string) => {
    const trimmed = v.trim();
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1).trim();
    }
    return trimmed;
  };

  const secret = normalize(rawSecret);
  const expected = normalize(rawExpected);

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const now = new Date();
  const today = asDateOnly(now);

  const plans = await prisma.maintenancePlan.findMany({
    where: {
      lastNotifiedAt: null,
      OR: [{ notifyEmail: true }, { notifyMessage: true }],
    },
    include: {
      equipment: {
        include: {
          client: true,
          user: true,
        },
      },
    },
    take: 500,
  });

  const appName = process.env.APP_NAME ?? "FríoPro";
  const messageProvider = process.env.MESSAGE_PROVIDER ?? "mock";

  let processed = 0;

  for (const p of plans) {
    const threshold = new Date(today);
    threshold.setDate(threshold.getDate() + p.daysBefore);

    // nextDate within window [today, today+daysBefore]
    const nd = asDateOnly(p.nextDate);
    if (nd < today || nd > threshold) continue;

    const equipment = p.equipment;
    const client = equipment.client;
    const technician = equipment.user;

    const techAccess = await getAccessState(technician.id);
    if (techAccess.mode !== "FULL" || techAccess.planCode !== "PRO_PLUS") {
      continue;
    }

    const equipmentLabel = `${equipment.type}${equipment.brand ? ` • ${equipment.brand}` : ""}${equipment.model ? ` ${equipment.model}` : ""}`;
    const clientName = client?.name ?? "cliente";
    const technicianName = technician?.name ?? technician.email;

    const logs: Array<Promise<any>> = [];
    let okToMarkNotified = true;

    if (p.notifyEmail) {
      const to = client?.email ?? "";
      if (!to) {
        logs.push(
          prisma.notificationLog.create({
            data: {
              userId: technician.id,
              clientId: client?.id ?? null,
              equipmentId: equipment.id,
              channel: "EMAIL",
              to: "",
              content: "",
              status: "SKIPPED",
              error: "CLIENT_EMAIL_MISSING",
            },
          }),
        );
      } else {
        const email = buildEmail({
          appName,
          clientName,
          technicianName,
          equipmentLabel,
          date: p.nextDate,
        });

        const r = await sendEmail({
          to,
          subject: email.subject,
          text: email.body,
        });

        const warning = (r as any)?.warning as string | undefined;
        const status = r.ok ? (warning ? "SKIPPED" : "SENT") : "FAILED";
        if (!r.ok) okToMarkNotified = false;

        logs.push(
          prisma.notificationLog.create({
            data: {
              userId: technician.id,
              clientId: client?.id ?? null,
              equipmentId: equipment.id,
              channel: "EMAIL",
              to,
              content: `${email.subject}\n\n${email.body}`,
              status,
              error: r.ok ? warning ?? null : (r as any).error,
            },
          }),
        );
      }
    }

    if (p.notifyMessage) {
      const to = client?.phone ?? "";
      if (!to) {
        logs.push(
          prisma.notificationLog.create({
            data: {
              userId: technician.id,
              clientId: client?.id ?? null,
              equipmentId: equipment.id,
              channel: "MESSAGE",
              to: "",
              content: "",
              status: "SKIPPED",
              error: "CLIENT_PHONE_MISSING",
            },
          }),
        );
      } else {
        const msg = buildMessage({
          appName,
          clientName,
          technicianName,
          equipmentLabel,
          date: p.nextDate,
        });

        const status = messageProvider === "mock" ? "SENT" : "SENT";

        logs.push(
          prisma.notificationLog.create({
            data: {
              userId: technician.id,
              clientId: client?.id ?? null,
              equipmentId: equipment.id,
              channel: "MESSAGE",
              to,
              content: msg,
              status,
            },
          }),
        );
      }
    }

    await Promise.all(logs);

    if (okToMarkNotified) {
      await prisma.maintenancePlan.update({
        where: { id: p.id },
        data: { lastNotifiedAt: now },
      });
      processed += 1;
    }
  }

  return NextResponse.json({ ok: true, processed });
}
