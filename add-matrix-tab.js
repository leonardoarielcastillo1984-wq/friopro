const fs = require('fs');

const file = 'apps/web/src/app/(app)/rrhh/competencias/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add 'matrix' to activeTab type
content = content.replace(
  "useState<'competencies' | 'employees'>",
  "useState<'competencies' | 'employees' | 'matrix'>"
);

// 2. Find "Empleados" button and add "Ver en Matriz" after it
const empleadosBtn = "            Empleados\n          </button>";
const matrixBtn = `            Empleados
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={\`px-4 py-2 rounded-md text-sm font-medium \${
              activeTab === 'matrix'
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:text-gray-900'
            }\`}
          >
            Ver en Matriz
          </button>`;

content = content.replace(empleadosBtn, matrixBtn);

// 3. Add MatrixView import
if (!content.includes("import MatrixView from './MatrixView'")) {
  content = content.replace(
    "import { useRouter } from 'next/router';",
    "import { useRouter } from 'next/router';\nimport MatrixView from './MatrixView';"
  );
}

// 4. Add matrix tab content
const employeesTabEnd = "            )}\n          </div>\n        </div>\n      </div>\n    </div>";
const matrixContent = `            )}
          </div>
        </div>
      </div>
    </div>

    {activeTab === 'matrix' && (
      <div className="mt-6">
        <MatrixView />
      </div>
    )}`;

content = content.replace(employeesTabEnd, matrixContent);

fs.writeFileSync(file, content);
console.log('Tab added successfully!');
