#!/usr/bin/env python3
# Parche idempotente del host para el módulo Ausencias y Disponibilidad:
#  1) Anexa los 11 modelos nuevos a schema.prisma (extraídos del schema local en /tmp/local_schema.prisma).
#  2) Agrega el import y el register de absencesRoutes en app.ts.
# No sobrescribe modelos existentes. Crea backups .bak_absences.
import sys

API = '/root/friopro/apps/api'
SCHEMA = f'{API}/prisma/schema.prisma'
APP = f'{API}/src/app.ts'
LOCAL_SCHEMA = '/tmp/local_schema.prisma'
MARKER = '// ===================== AUSENCIAS Y DISPONIBILIDAD'
changed = []

# 1) schema.prisma
schema = open(SCHEMA, encoding='utf-8').read()
if 'model AbsenceType' not in schema:
    ls = open(LOCAL_SCHEMA, encoding='utf-8').read()
    idx = ls.find(MARKER)
    if idx == -1:
        print('MARKER_NOT_FOUND_IN_LOCAL'); sys.exit(1)
    block = ls[idx:].rstrip() + '\n'
    open(SCHEMA + '.bak_absences', 'w', encoding='utf-8').write(schema)
    if not schema.endswith('\n'):
        schema += '\n'
    open(SCHEMA, 'w', encoding='utf-8').write(schema + '\n' + block)
    changed.append('schema.prisma')

# 2) app.ts
app_src = open(APP, encoding='utf-8').read()
if 'absencesRoutes' not in app_src:
    imp = "import { objectivesRoutes } from './routes/objectives.js';"
    reg = "await app.register(objectivesRoutes, { prefix: '/objectives' });"
    if imp not in app_src:
        print('APP_IMPORT_ANCHOR_NOT_FOUND'); sys.exit(1)
    if reg not in app_src:
        print('APP_REGISTER_ANCHOR_NOT_FOUND'); sys.exit(1)
    open(APP + '.bak_absences', 'w', encoding='utf-8').write(app_src)
    app_src = app_src.replace(imp, imp + "\nimport { absencesRoutes } from './routes/absences.js';", 1)
    app_src = app_src.replace(reg, reg + "\n  await app.register(absencesRoutes, { prefix: '/absences' });", 1)
    open(APP, 'w', encoding='utf-8').write(app_src)
    changed.append('app.ts')

print('PATCHED:' + ','.join(changed) if changed else 'NO_CHANGE')
