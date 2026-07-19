#!/bin/bash
set -e
DIR="/root/friopro/apps/web/src/app/(app)/proyectos"
cd "$DIR"

FILES=(
  "page.tsx"
  "board-card.tsx"
  "components.tsx"
  "components-new.tsx"
  "[id]/page.tsx"
  "pmo/page.tsx"
)

for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue
  # 1) API: backend nativo vive en /project360-v1 (no tocar /api/ ni /project360-v1 existente)
  sed -i "s#apiFetch('/project360/#apiFetch('/project360-v1/#g" "$f"
  sed -i 's#apiFetch(`/project360/#apiFetch(`/project360-v1/#g' "$f"
  # corregir doble si ya estaba en -v1
  sed -i 's#/project360-v1-v1/#/project360-v1/#g' "$f"
  # 2) Rutas frontend -> /proyectos
  sed -i 's#href="/project360/pmo"#href="/proyectos/pmo"#g' "$f"
  sed -i 's#href="/project360"#href="/proyectos"#g' "$f"
  sed -i 's#href={`/project360/${#href={`/proyectos/${#g' "$f"
done

echo "=== VERIFICACION ==="
echo "-- API correcta (/project360-v1) --"
grep -rhoE "apiFetch\(\`?'?/project360[a-z0-9/_-]*" . | sort -u
echo "-- enlaces frontend (/proyectos) --"
grep -rhoE 'href="/proyectos[a-z/]*"|href=\{`/proyectos/' . | sort -u
echo "-- NO debe quedar API a /project360/ sin -v1 --"
grep -rnE "apiFetch\(\`?'?/project360/" . || echo "OK: ninguna"
echo "-- NO debe quedar href frontend a /project360 --"
grep -rnE 'href="/project360"|href=\{`/project360/' . || echo "OK: ninguna"
echo "REWRITE DONE"
