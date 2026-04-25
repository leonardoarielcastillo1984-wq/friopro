const fs = require('fs');

const file = 'apps/web/src/app/(app)/rrhh/competencias/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add 'matrix' to activeTab type - search for the pattern with flexible spacing
content = content.replace(
  /useState<'competencies'\s*\|\s*'employees'>/,
  "useState<'competencies' | 'employees' | 'matrix'>"
);

// 2. Find the Empleados button and add Ver en Matriz after it
// Using a more flexible regex to handle varying whitespace
const empleadosPattern = /(            Empleados\n          <\/button>)(\n        <\/div>)/;
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
          </button>
        </div>`;

content = content.replace(empleadosPattern, matrixBtn);

// 3. Add matrix tab content at the end - find the last tab content and add after it
// Look for the closing of the employees tab content
const employeesTabEndPattern = /(\{activeTab === 'employees' && \([\s\S]*?\n\s*\)\}\n\s*<\/div>\n\s*<\/div>\n\s*<\/div>)(\n\s*\);)/;
const matrixContent = `\n            {activeTab === 'matrix' && (
              <div className="mt-6">
                <MatrixView />
              </div>
            )}`;

// Try a simpler approach - find a good insertion point
if (content.includes("{activeTab === 'matrix' && (")) {
  console.log('Matrix tab already exists');
} else {
  // Find the end of employees tab and add matrix after it
  const endOfEmployees = /\{activeTab === 'employees' && \([\s\S]*?\n\s*\)\}\n\s*<\/div>\n\s*<\/div>/;
  const match = content.match(endOfEmployees);
  if (match) {
    const insertPos = match.index + match[0].length;
    content = content.slice(0, insertPos) + matrixContent + content.slice(insertPos);
    console.log('Matrix tab content added');
  } else {
    console.log('WARNING: Could not find insertion point for matrix tab');
  }
}

fs.writeFileSync(file, content);
console.log('Done! Check the file for changes.');
