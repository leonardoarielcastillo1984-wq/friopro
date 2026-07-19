#!/usr/bin/env python3
# Patch idempotente del schema.prisma del host: gestión/medición de Objetivos SGI360.
import sys

P = "/root/friopro/apps/api/prisma/schema.prisma"
s = open(P, encoding="utf-8").read()
changed = False

# 1) SgiObjective: nuevos campos + progressLogs + índices
if "primaryIndicatorId" not in s:
    anchor = (
        "  contextYear       Int?\n\n"
        "  @@index([tenantId])\n"
        "  @@index([year])\n"
        "  @@index([policyId])\n"
        "  @@index([processId])\n"
        '  @@map("sgi_objectives")'
    )
    add = (
        "  contextYear       Int?\n\n"
        "  // Gestion, medicion y trazabilidad avanzada (aditivo Jul 2026)\n"
        "  primaryIndicatorId String?    @db.Uuid\n"
        '  primaryIndicator   Indicator? @relation("ObjectivePrimaryIndicator", fields: [primaryIndicatorId], references: [id], onDelete: SetNull)\n'
        "  baselineValue      Float?\n"
        '  progressMethod     String?    @default("MANUAL")\n'
        "  lastProgressNote   String?\n"
        "  responsiblePositionId String?   @db.Uuid\n"
        '  responsiblePosition   Position? @relation("ObjectiveResponsiblePosition", fields: [responsiblePositionId], references: [id], onDelete: SetNull)\n'
        "  involvedProcessIds String[] @default([])\n"
        "  policyIds          String[] @default([])\n\n"
        "  progressLogs ObjectiveProgressLog[]\n\n"
        "  @@index([tenantId])\n"
        "  @@index([year])\n"
        "  @@index([policyId])\n"
        "  @@index([processId])\n"
        "  @@index([primaryIndicatorId])\n"
        "  @@index([responsiblePositionId])\n"
        '  @@map("sgi_objectives")'
    )
    if anchor not in s:
        print("ANCHOR_SGI_NOT_FOUND"); sys.exit(1)
    s = s.replace(anchor, add, 1); changed = True

# 2) Modelo ObjectiveProgressLog
if "model ObjectiveProgressLog" not in s:
    marker = '  @@map("sgi_objectives")\n}\n'
    model = (
        '  @@map("sgi_objectives")\n}\n\n'
        "model ObjectiveProgressLog {\n"
        "  id               String       @id @default(uuid()) @db.Uuid\n"
        "  tenantId         String       @db.Uuid\n"
        "  objectiveId      String       @db.Uuid\n"
        "  objective        SgiObjective @relation(fields: [objectiveId], references: [id], onDelete: Cascade)\n"
        "  userId           String?      @db.Uuid\n"
        "  userName         String?\n"
        "  previousProgress Int?\n"
        "  newProgress      Int?\n"
        "  previousStatus   String?\n"
        "  newStatus        String?\n"
        "  kpiValue         Float?\n"
        "  justification    String?\n"
        '  source           String       @default("MANUAL")\n'
        "  evidenceUrl      String?\n"
        "  evidenceName     String?\n"
        "  createdAt        DateTime     @default(now()) @db.Timestamptz\n\n"
        "  @@index([tenantId])\n"
        "  @@index([objectiveId])\n"
        '  @@map("objective_progress_logs")\n'
        "}\n"
    )
    if marker not in s:
        print("MARKER_SGI_MAP_NOT_FOUND"); sys.exit(1)
    s = s.replace(marker, model, 1); changed = True

# 3) Indicator: relacion inversa
if "objectivesPrimary" not in s:
    ind_anchor = "  actionProjects ActionProject[]\n\n  @@unique([tenantId, code])"
    ind_add = (
        "  actionProjects ActionProject[]\n\n"
        '  objectivesPrimary SgiObjective[] @relation("ObjectivePrimaryIndicator")\n\n'
        "  @@unique([tenantId, code])"
    )
    if ind_anchor not in s:
        print("ANCHOR_INDICATOR_NOT_FOUND"); sys.exit(1)
    s = s.replace(ind_anchor, ind_add, 1); changed = True

# 4) Position: relacion inversa
if "objectivesResponsible" not in s:
    pos_anchor = "  positionCompetencies PositionCompetency[]\n"
    pos_add = (
        "  positionCompetencies PositionCompetency[]\n"
        '  objectivesResponsible SgiObjective[]      @relation("ObjectiveResponsiblePosition")\n'
    )
    if pos_anchor not in s:
        print("ANCHOR_POSITION_NOT_FOUND"); sys.exit(1)
    s = s.replace(pos_anchor, pos_add, 1); changed = True

open(P, "w", encoding="utf-8").write(s)
print("PATCHED" if changed else "NO_CHANGE")
