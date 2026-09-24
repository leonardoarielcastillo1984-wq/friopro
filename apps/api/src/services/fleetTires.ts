// ═══════════════════════════════════════════════════════════════
// FLOTA 360 — Desgaste de neumáticos por odómetro + acople
//
// Cuando el odómetro de un vehículo sube, las cubiertas montadas
// acumulan esos km en `kmAcumulados` (base del desgaste y de la
// proyección de vida útil). Si el vehículo está acoplado en un
// ConjuntoOperativo (tractor ↔ semi), el otro vehículo recorre los
// mismos km: se propaga el delta a su odómetro y a sus cubiertas.
//
// Reglas:
//  - Solo se acumula el DELTA positivo (nuevo − anterior). Si el
//    odómetro baja o no cambia, no se acumula nada.
//  - Si el vehículo no tenía odómetro previo, no se puede conocer
//    el delta → no se inventa desgaste.
//  - La propagación es por delta (no por valor absoluto): el semi
//    puede tener un kilometraje propio distinto del tractor.
// ═══════════════════════════════════════════════════════════════

/**
 * Punto de entrada único: actualiza el odómetro del vehículo a `kmNuevo`,
 * acumula el delta en sus cubiertas montadas y lo propaga al acoplado.
 * Reemplaza al `vehiculo.update({ currentOdometer })` suelto.
 * Devuelve el delta aplicado (0 si no hubo avance o no había previo).
 */
export async function syncOdometroYDesgaste(
  prisma: any,
  tenantId: string,
  vehiculoId: string,
  kmNuevo: number,
): Promise<number> {
  if (!kmNuevo || kmNuevo <= 0) return 0;
  try {
    const v = await prisma.vehiculo.findFirst({
      where: { id: vehiculoId, tenantId },
      select: { currentOdometer: true },
    });
    if (!v) return 0;
    const previo = v.currentOdometer ?? null;
    const delta = previo != null && kmNuevo > previo ? kmNuevo - previo : 0;

    // Actualizar odómetro del vehículo (siempre que el nuevo sea mayor o no haya previo)
    if (previo == null || kmNuevo > previo) {
      await prisma.vehiculo.updateMany({
        where: { id: vehiculoId, tenantId },
        data: { currentOdometer: kmNuevo },
      });
    }

    if (delta > 0) await aplicarDeltaKmFlota(prisma, tenantId, vehiculoId, delta);
    return delta;
  } catch {
    return 0;
  }
}

/**
 * Suma `deltaKm` a las cubiertas montadas del vehículo y propaga al acoplado.
 * Usar cuando el caller ya actualizó el odómetro y conoce el delta.
 */
export async function aplicarDeltaKmFlota(
  prisma: any,
  tenantId: string,
  vehiculoId: string,
  deltaKm: number,
  opts?: { propagarAcoplado?: boolean },
): Promise<void> {
  if (!deltaKm || deltaKm <= 0) return;
  try {
    // 1) Cubiertas montadas en este vehículo
    await prisma.$executeRaw`
      UPDATE flota_neumaticos n
      SET "kmAcumulados" = COALESCE(n."kmAcumulados", 0) + ${deltaKm}
      WHERE n."tenantId" = ${tenantId}::uuid
        AND EXISTS (
          SELECT 1 FROM flota_neumatico_posiciones p
          WHERE p."neumaticoId" = n.id AND p."vehiculoId" = ${vehiculoId}::uuid AND p.activo = true
        )
    `;

    // 2) Propagar al vehículo acoplado (tractor ↔ semi)
    if (opts?.propagarAcoplado === false) return;
    const conj = await prisma.conjuntoOperativo.findFirst({
      where: { tenantId, estado: 'ACOPLADO', OR: [{ tractorId: vehiculoId }, { semiId: vehiculoId }] },
      select: { tractorId: true, semiId: true },
    });
    if (!conj) return;
    const partnerId = conj.tractorId === vehiculoId ? conj.semiId : conj.tractorId;
    if (!partnerId) return;

    // Odómetro del acoplado += delta (si no tenía, arranca en delta)
    await prisma.$executeRaw`
      UPDATE flota_vehiculos
      SET "currentOdometer" = COALESCE("currentOdometer", 0) + ${deltaKm}
      WHERE id = ${partnerId}::uuid AND "tenantId" = ${tenantId}::uuid
    `;
    // Cubiertas del acoplado += delta
    await prisma.$executeRaw`
      UPDATE flota_neumaticos n
      SET "kmAcumulados" = COALESCE(n."kmAcumulados", 0) + ${deltaKm}
      WHERE n."tenantId" = ${tenantId}::uuid
        AND EXISTS (
          SELECT 1 FROM flota_neumatico_posiciones p
          WHERE p."neumaticoId" = n.id AND p."vehiculoId" = ${partnerId}::uuid AND p.activo = true
        )
    `;
  } catch {
    // No bloquear el flujo principal por un error de acumulación
  }
}
