#!/usr/bin/env python3
import re, sys

path = "/root/friopro/apps/api/prisma/schema.prisma"
with open(path, "r", encoding="utf-8") as f:
    src = f.read()

orig = src

# 1) Repuntar relacion user dentro del modelo Siniestro360TenantMembership: PlatformUser -> Siniestro360User
block_re = re.compile(r"(model Siniestro360TenantMembership \{.*?\n\})", re.S)
m = block_re.search(src)
if not m:
    print("ERROR: no encontre model Siniestro360TenantMembership"); sys.exit(1)
block = m.group(1)
new_block = block.replace(
    "user   PlatformUser @relation(fields: [userId], references: [id])",
    "user   Siniestro360User @relation(fields: [userId], references: [id], onDelete: Cascade)",
)
if new_block == block:
    print("ERROR: no pude repuntar la relacion user en membership"); sys.exit(1)
src = src.replace(block, new_block)

# 2) Quitar back-relation en PlatformUser (variante con 7 espacios, linea 579)
backrel = "  siniestro360Memberships       Siniestro360TenantMembership[]\n"
if backrel not in src:
    print("ERROR: no encontre la back-relation de PlatformUser con ese espaciado"); sys.exit(1)
src = src.replace(backrel, "", 1)

# 3) Agregar modelo Siniestro360User (si no existe)
if "model Siniestro360User {" not in src:
    model = '''

// -- SINIESTROS360 Identity (independiente: tabla de usuarios propia) --
model Siniestro360User {
  id           String  @id @default(uuid()) @db.Uuid
  tenantId     String  @db.Uuid
  email        String
  name         String?
  firstName    String?
  lastName     String?
  phone        String?
  passwordHash String?
  avatarUrl    String?
  status       String  @default("ACTIVE")

  createdAt DateTime  @default(now()) @db.Timestamptz
  updatedAt DateTime  @updatedAt @db.Timestamptz
  deletedAt DateTime? @db.Timestamptz

  memberships Siniestro360TenantMembership[]

  @@unique([tenantId, email])
  @@index([tenantId])
  @@index([status])
  @@map("siniestro360_users")
}
'''
    src = src.rstrip() + "\n" + model

if src == orig:
    print("ERROR: ningun cambio aplicado"); sys.exit(1)

with open(path, "w", encoding="utf-8") as f:
    f.write(src)
print("OK: schema parcheado para SINIESTROS360")
