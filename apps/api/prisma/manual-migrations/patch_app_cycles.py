#!/usr/bin/env python3
"""Inserta (idempotente) el import y el registro de las rutas de ciclos en app.ts."""
import sys

PATH = sys.argv[1] if len(sys.argv) > 1 else "src/app.ts"

with open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

changed = False

IMPORT_ANCHOR = "} from './routes/sgi-professional.js';"
IMPORT_LINE = "\nimport { evaluationCyclesRoutes, stakeholderEvaluationsRoutes } from './routes/stakeholderCycles.js';"
if "stakeholderCycles.js" not in content:
    if IMPORT_ANCHOR not in content:
        print("ERROR: no se encontró el anchor de import sgi-professional")
        sys.exit(1)
    content = content.replace(IMPORT_ANCHOR, IMPORT_ANCHOR + IMPORT_LINE, 1)
    changed = True

REG_ANCHOR = "await app.register(stakeholderActionRoutes, { prefix: '/stakeholders' });"
REG_LINES = (
    "\n  await app.register(evaluationCyclesRoutes, { prefix: '/evaluation-cycles' });"
    "\n  await app.register(stakeholderEvaluationsRoutes, { prefix: '/stakeholder-evaluations' });"
)
if "evaluationCyclesRoutes, { prefix: '/evaluation-cycles' }" not in content:
    if REG_ANCHOR not in content:
        print("ERROR: no se encontró el anchor de registro stakeholderActionRoutes")
        sys.exit(1)
    content = content.replace(REG_ANCHOR, REG_ANCHOR + REG_LINES, 1)
    changed = True

if changed:
    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print("OK: app.ts patcheado")
else:
    print("SKIP: app.ts ya tiene las rutas")
