#!/bin/bash
set -e

FILE="apps/web/src/app/(app)/rrhh/competencias/page.tsx"

# Verificar si el archivo existe
if [ ! -f "$FILE" ]; then
    echo "ERROR: File not found: $FILE"
    exit 1
fi

# Hacer backup
cp "$FILE" "$FILE.bak"

# 1. Corregir el type de activeTab para incluir 'matrix'
sed -i "s/useState<'competencies' | 'employees'>/useState<'competencies' | 'employees' | 'matrix'>/g" "$FILE"

# 2. Agregar boton Ver en Matriz despues de Empleados
sed -i '/<button/{N;N;N;N;N;N;N;N;N;N;N;N;N;N;N;s/<button\n            onClick={() => setActiveTab('\''employees'\'')}\n            className={`px-4 py-2 rounded-md text-sm font-medium ${\n              activeTab === '\''employees'\''\n                ? '\''bg-primary text-white'\''\n                : '\''text-gray-600 hover:text-gray-900'\''\n            }`}\n          >\n            Empleados\n          <\/button>\n        <\/div>/<button\n            onClick={() => setActiveTab('\''employees'\'')}\n            className={`px-4 py-2 rounded-md text-sm font-medium ${\n              activeTab === '\''employees'\''\n                ? '\''bg-primary text-white'\''\n                : '\''text-gray-600 hover:text-gray-900'\''\n            }`}\n          >\n            Empleados\n          <\/button>\n          <button\n            onClick={() => setActiveTab('\''matrix'\'')}\n            className={`px-4 py-2 rounded-md text-sm font-medium ${\n              activeTab === '\''matrix'\''\n                ? '\''bg-primary text-white'\''\n                : '\''text-gray-600 hover:text-gray-900'\''\n            }`}\n          >\n            Ver en Matriz\n          <\/button>\n        <\/div>/}' "$FILE"

echo "Done. Check $FILE for changes."
