#!/usr/bin/env python3
"""Inserta (idempotente) la relación evaluations en Stakeholder y los modelos
EvaluationCycle + StakeholderEvaluation en el schema.prisma del host."""
import sys
import re

PATH = sys.argv[1] if len(sys.argv) > 1 else "prisma/schema.prisma"

with open(PATH, "r", encoding="utf-8") as f:
    content = f.read()


def _model_span(text, model_name):
    m = re.search(r'model ' + re.escape(model_name) + r'\s*\{', text)
    if not m:
        return None
    start = m.start()
    end = text.index('}', start)
    return start, end


def add_enterprise_fields(text):
    """Agrega (idempotente) responsible en EvaluationCycle y criticality en StakeholderEvaluation.
    Usa regex sobre el nombre de campo (insensible a la alineación de espacios)."""
    changed = False
    # responsible en EvaluationCycle (tras la línea de endDate)
    span = _model_span(text, 'EvaluationCycle')
    if span:
        s, e = span
        block = text[s:e]
        if 'responsible' not in block:
            new_block, n = re.subn(r'(\n\s*endDate\s+DateTime\?[^\n]*)', r'\1\n  responsible String?', block, count=1)
            if n:
                text = text[:s] + new_block + text[e:]
                changed = True
    # criticality en StakeholderEvaluation (tras la línea de interest)
    span = _model_span(text, 'StakeholderEvaluation')
    if span:
        s, e = span
        block = text[s:e]
        if 'criticality' not in block:
            new_block, n = re.subn(r'(\n\s*interest\s+Int\?[^\n]*)', r'\1\n  criticality         Int?', block, count=1)
            if n:
                text = text[:s] + new_block + text[e:]
                changed = True
    return text, changed


if "model EvaluationCycle" in content:
    content, changed = add_enterprise_fields(content)
    if changed:
        with open(PATH, "w", encoding="utf-8") as f:
            f.write(content)
        print("OK: campos enterprise (responsible/criticality) agregados")
    else:
        print("SKIP: modelos y campos ya presentes")
    sys.exit(0)

OLD = '''  ncrs NonConformity[] @relation("NcrStakeholder")

  @@index([tenantId])
  @@index([complianceStatus])
  @@map("stakeholders")
}'''

NEW = '''  ncrs NonConformity[] @relation("NcrStakeholder")
  evaluations StakeholderEvaluation[]

  @@index([tenantId])
  @@index([complianceStatus])
  @@map("stakeholders")
}

// Ciclo / período de evaluación del SGI (ej: "SGI 2026")
model EvaluationCycle {
  id        String    @id @default(uuid()) @db.Uuid
  tenantId  String    @db.Uuid
  name      String
  year      Int
  status    String    @default("ACTIVE") // DRAFT, ACTIVE, CLOSED
  startDate DateTime? @db.Timestamptz
  endDate   DateTime? @db.Timestamptz
  createdAt DateTime  @default(now()) @db.Timestamptz
  updatedAt DateTime  @updatedAt @db.Timestamptz

  evaluations StakeholderEvaluation[]

  @@unique([tenantId, year])
  @@index([tenantId])
  @@map("evaluation_cycles")
}

// Evaluación de una parte interesada dentro de un ciclo (histórico por período)
model StakeholderEvaluation {
  id                  String    @id @default(uuid()) @db.Uuid
  tenantId            String    @db.Uuid
  stakeholderId       String    @db.Uuid
  cycleId             String    @db.Uuid
  complianceStatus    String?
  complianceLevel     Int?
  evaluationDate      DateTime? @db.Timestamptz
  complianceEvidence  String?
  indicatorNote       String?
  indicatorId         String?   @db.Uuid
  requiresAction      Boolean   @default(false)
  actionItemId        String?   @db.Uuid
  influence           Int?
  interest            Int?
  observations        String?
  needs               String?
  expectations        String?
  requirements        String?
  reviewFrequency     String?
  nextEvaluationDate  DateTime? @db.Timestamptz
  followUpResponsible String?
  createdAt           DateTime  @default(now()) @db.Timestamptz
  updatedAt           DateTime  @updatedAt @db.Timestamptz

  stakeholder Stakeholder     @relation(fields: [stakeholderId], references: [id], onDelete: Cascade)
  cycle       EvaluationCycle @relation(fields: [cycleId], references: [id], onDelete: Cascade)

  @@unique([stakeholderId, cycleId])
  @@index([tenantId])
  @@index([cycleId])
  @@index([stakeholderId])
  @@map("stakeholder_evaluations")
}'''

if OLD not in content:
    print("ERROR: no se encontró el bloque del modelo Stakeholder esperado")
    sys.exit(1)

content = content.replace(OLD, NEW, 1)
with open(PATH, "w", encoding="utf-8") as f:
    f.write(content)
print("OK: modelos insertados")
