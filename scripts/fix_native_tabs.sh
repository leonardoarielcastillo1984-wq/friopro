#!/bin/bash
set -e
ROOT="$1"   # ruta a apps/web/src
if [ -z "$ROOT" ]; then echo "Uso: fix_native_tabs.sh <apps/web/src>"; exit 1; fi
cd "$ROOT"

TABS=(AnalysisTab AprobacionesTab BudgetTab BusinessCaseTab CashflowTab ContratosTab GanttTab HistoryTab LessonsLearnedTab MilestonesTab MotorRelacionalTab OperationalSizingTab PipelineTab ProjectCopilot PropuestasTab SimulationTab)

echo "[1] Reescribir API de pestañas nativas /project360 -> /project360-v1"
for t in "${TABS[@]}"; do
  f="components/project360/$t.tsx"
  [ -f "$f" ] || { echo "  (falta $f)"; continue; }
  sed -i "s#apiFetch('/project360/#apiFetch('/project360-v1/#g" "$f"
  sed -i 's#apiFetch(`/project360/#apiFetch(`/project360-v1/#g' "$f"
  sed -i 's#/project360-v1-v1/#/project360-v1/#g' "$f"
done

echo "[2] Corregir members -> employees en /proyectos/[id]"
ID="app/(app)/proyectos/[id]/page.tsx"
[ -f "$ID" ] && sed -i "s#apiFetch('/project360-v1/members')#apiFetch('/project360-v1/employees')#g" "$ID"

echo "=== VERIFICACION: ninguna pestaña debe quedar en /project360/ (sin -v1) ==="
for t in "${TABS[@]}"; do
  grep -nE "apiFetch\(\`?'?/project360/" "components/project360/$t.tsx" 2>/dev/null && echo "  ^ PENDIENTE en $t" || true
done
echo "-- endpoints de pestañas ahora --"
grep -rhoE "/project360-v1/[a-zA-Z/-]+" components/project360/*.tsx | sort -u | head -40
echo "-- members en [id] --"
grep -nE "/project360-v1/(members|employees)" "$ID" || true
echo "FIX DONE"
