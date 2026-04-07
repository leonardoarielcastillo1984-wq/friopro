import 'dotenv/config';
import { execSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const scripts = [
  'src/scripts/seedPlans.ts',
  'src/scripts/seedUsers.ts',
  'src/scripts/seedDemoData.ts',
  'src/scripts/seedDepartments.ts',
];

for (const script of scripts) {
  console.log(`\n== Running ${script} ==`);
  execSync(`node --import tsx ${script}`, { cwd: root, stdio: 'inherit' });
}

console.log('\n== All seeds completed ==');
