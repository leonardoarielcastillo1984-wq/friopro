import re

filepath = 'apps/web/src/app/(app)/rrhh/competencias/page.tsx'

with open(filepath, 'r') as f:
    content = f.read()

# Check if already modified
if "'matrix'" in content and 'Ver en Matriz' in content:
    print('Already has matrix tab')
    exit(0)

# 1. Add 'matrix' to useState type
content = content.replace(
    "useState<'competencies' | 'employees'>('competencies')",
    "useState<'competencies' | 'employees' | 'matrix'>('competencies')"
)

# 2. Add Ver en Matriz button after Empleados button
old_pattern = "          </button>\n        </div>\n      </div>\n\n      {activeTab === 'competencies' && ("
new_pattern = """          </button>
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
        </div>
      </div>

      {activeTab === 'competencies' && ("""

content = content.replace(old_pattern, new_pattern)

# 3. Add matrix content after employees section
old_end = """      )}
    </div>
  </div>
</div>"""
new_end = """      )}
      {activeTab === 'matrix' && (
        <div className="mt-6">
          <iframe
            src="/rrhh/competencias/matriz"
            style={{ width: '100%', height: '80vh', border: 'none' }}
          />
        </div>
      )}
    </div>
  </div>
</div>"""

content = content.replace(old_end, new_end)

with open(filepath, 'w') as f:
    f.write(content)

print('Done!')
