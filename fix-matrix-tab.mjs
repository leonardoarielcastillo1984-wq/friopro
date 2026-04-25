import fs from 'fs';

const file = 'apps/web/src/app/(app)/rrhh/competencias/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Agregar tab 'matrix' al type de activeTab
content = content.replace(
  /useState<'competencies' \| 'employees'>/,
  "useState<'competencies' | 'employees' | 'matrix'>"
);

// 2. Agregar botón "Ver en Matriz" después del botón "Empleados"
const oldEmployeesBtn = `          <button\n            onClick={() => setActiveTab('employees')}\n            className={\`px-4 py-2 rounded-md text-sm font-medium \${\n              activeTab === 'employees'\n                ? 'bg-primary text-white'\n                : 'text-gray-600 hover:text-gray-900'\n            }\`}\n          >\n            Empleados\n          </button>\n        </div>`;

const newEmployeesBtn = `          <button\n            onClick={() => setActiveTab('employees')}\n            className={\`px-4 py-2 rounded-md text-sm font-medium \${\n              activeTab === 'employees'\n                ? 'bg-primary text-white'\n                : 'text-gray-600 hover:text-gray-900'\n            }\`}\n          >\n            Empleados\n          </button>\n          <button\n            onClick={() => setActiveTab('matrix')}\n            className={\`px-4 py-2 rounded-md text-sm font-medium \${\n              activeTab === 'matrix'\n                ? 'bg-primary text-white'\n                : 'text-gray-600 hover:text-gray-900'\n            }\`}\n          >\n            Ver en Matriz\n          </button>\n        </div>`;

content = content.replace(oldEmployeesBtn, newEmployeesBtn);

// 3. Agregar import de MatrixView
if (!content.includes("import MatrixView from './MatrixView'")) {
  content = content.replace(
    /import \{[^}]+\} from 'lucide-react';/,
    (match) => match + "\nimport MatrixView from './MatrixView';"
  );
}

// 4. Agregar el tab content al final del tab employees
if (!content.includes("{activeTab === 'matrix' && (")) {
  content = content.replace(
    /(\{activeTab === 'employees' && \([\s\S]*?\n\s*\)\})/,
    (match) => match + `\n\n            {activeTab === 'matrix' && (\n              <div className="mt-6">\n                <MatrixView />\n              </div>\n            )}`
  );
}

fs.writeFileSync(file, content);
console.log('Tab Ver en Matriz agregado correctamente');
