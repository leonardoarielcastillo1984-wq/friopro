#!/bin/bash
set -e
BASE="$1"
if [ -z "$BASE" ]; then echo "Uso: migrate_proyectos.sh <ruta_app_(app)>"; exit 1; fi
cd "$BASE"

echo "[1] Crear estructura /proyectos"
mkdir -p "proyectos/[id]" "proyectos/pmo"

echo "[2] Copiar archivos nativos de SGI360 (project360 -> proyectos)"
cp "project360/page.tsx"           "proyectos/page.tsx"
cp "project360/board-card.tsx"     "proyectos/board-card.tsx"
cp "project360/components.tsx"     "proyectos/components.tsx"
cp "project360/components-new.tsx" "proyectos/components-new.tsx"
cp "project360/[id]/page.tsx"      "proyectos/[id]/page.tsx"
cp "project360/pmo/page.tsx"       "proyectos/pmo/page.tsx"

echo "[3] Reescribir SOLO enlaces de ruta frontend (apiFetch y /api/ quedan intactos)"
FILES=(
  "proyectos/page.tsx"
  "proyectos/board-card.tsx"
  "proyectos/[id]/page.tsx"
  "proyectos/pmo/page.tsx"
  "proyectos/components.tsx"
  "proyectos/components-new.tsx"
)
for f in "${FILES[@]}"; do
  sed -i 's#href="/project360/pmo"#href="/proyectos/pmo"#g' "$f"
  sed -i 's#href="/project360"#href="/proyectos"#g' "$f"
  sed -i 's#href={`/project360/${#href={`/proyectos/${#g' "$f"
done

echo "[4] Verificacion: enlaces frontend reescritos"
grep -rnE 'href="/proyectos|href=\{`/proyectos/\$\{' "proyectos/" || true
echo "[4b] Verificacion: apiFetch sigue en /project360 (API, correcto)"
grep -rn "apiFetch('/project360" "proyectos/" | head -3 || true

echo "MIGRATION DONE"
