import { prisma } from "@/lib/prisma";

export const SYMPTOM_CHIPS = [
  "No enfría",
  "No prende",
  "Ruido",
  "Pérdida de gas",
  "Congela",
  "Gotea",
  "Olor",
  "Corta/Arranca",
];

export function toSymptomsJson(chips: string[], other: string) {
  const clean = Array.from(
    new Set(
      chips
        .map((s) => s.trim())
        .filter(Boolean)
        .concat(other.trim() ? [other.trim()] : []),
    ),
  );
  return clean;
}

export async function getOrCreateDemoClient(userId: string) {
  const existing = await prisma.client.findFirst({
    where: { userId },
    orderBy: { id: "desc" },
  });

  if (existing) return existing;

  return prisma.client.create({
    data: { userId, name: "Demostración del cliente" },
  });
}

export async function getOrCreateDemoEquipment(userId: string, clientId: string) {
  const existing = await prisma.equipment.findFirst({
    where: { userId, clientId },
    orderBy: { id: "desc" },
  });

  if (existing) return existing;

  return prisma.equipment.create({
    data: {
      userId,
      clientId,
      type: "SPLIT_INVERTER",
      publicId: `eq-${userId.slice(0, 8)}-${Date.now()}`,
    },
  });
}
