import re

with open('apps/web/src/app/(app)/rrhh/competencias/page.tsx', 'r') as f:
    content = f.read()

# 1. Add 'matrix' to activeTab type
content = re.sub(
    r"useState<'competencies'\s*\|\s*'employees'>",
    "useState<'competencies' | 'employees' | 'matrix'>",
    content
)

# 2. Add Matrix button after Employees button
old_btn = """          <button
            onClick={() => setActiveTab('employees')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              activeTab === 'employees'
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Empleados
          </button>
        </div>"""

new_btn = """          <button
            onClick={() => setActiveTab('employees')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              activeTab === 'employees'
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Empleados
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              activeTab === 'matrix'
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Ver en Matriz
          </button>
        </div>"""

if old_btn in content:
    content = content.replace(old_btn, new_btn)
    print("Button added successfully")
else:
    print("WARNING: Could not find Employees button to replace")

with open('apps/web/src/app/(app)/rrhh/competencias/page.tsx', 'w') as f:
    f.write(content)

print("Done")
