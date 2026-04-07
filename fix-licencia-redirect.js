#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Buscando archivos con "Seleccionar Plan"...');

// Rutas donde podría estar el botón
const searchPaths = [
  '/apps/web/src/app/(app)/planes/page.tsx',
  '/apps/web/src/app/(app)/admin/page.tsx', 
  '/apps/web/src/components/plans/',
  '/apps/web/src/components/'
];

const baseDir = __dirname;
let foundFiles = [];

// Buscar archivos que contengan "Seleccionar Plan" o "panel-general"
function searchInDirectory(dir, searchTerm) {
  if (!fs.existsSync(dir)) return [];
  
  const results = [];
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      results.push(...searchInDirectory(fullPath, searchTerm));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.jsx')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes(searchTerm)) {
          results.push(fullPath);
        }
      } catch (error) {
        // Ignorar errores de lectura
      }
    }
  }
  
  return results;
}

// Buscar archivos con "Seleccionar Plan"
const webDir = path.join(baseDir, 'apps/web/src');
if (fs.existsSync(webDir)) {
  foundFiles = searchInDirectory(webDir, 'Seleccionar Plan');
}

if (foundFiles.length === 0) {
  // Buscar "panel-general" como alternativa
  foundFiles = searchInDirectory(webDir, 'panel-general');
}

if (foundFiles.length === 0) {
  console.log('❌ No se encontraron archivos con "Seleccionar Plan" o "panel-general"');
  console.log('📁 Buscando manualmente en rutas comunes...');
  
  const commonPaths = [
    path.join(webDir, 'app/(app)/planes/page.tsx'),
    path.join(webDir, 'app/(app)/admin/page.tsx'),
    path.join(webDir, 'components/plans/PlanCard.tsx'),
    path.join(webDir, 'components/plans/PlanSelection.tsx')
  ];
  
  for (const filePath of commonPaths) {
    if (fs.existsSync(filePath)) {
      console.log(`📄 Encontrado: ${filePath}`);
      foundFiles.push(filePath);
    }
  }
}

if (foundFiles.length === 0) {
  console.log('❌ No se pudieron encontrar los archivos automáticamente.');
  console.log('🔍 Por favor, busca manualmente el archivo que contiene el botón "Seleccionar Plan"');
  console.log('📂 Posibles ubicaciones:');
  console.log('   - apps/web/src/app/(app)/planes/page.tsx');
  console.log('   - apps/web/src/app/(app)/admin/page.tsx');
  console.log('   - apps/web/src/components/plans/PlanCard.tsx');
  process.exit(1);
}

console.log(`✅ Encontrados ${foundFiles.length} archivos:`);
foundFiles.forEach(file => console.log(`   - ${file}`));

// Procesar cada archivo
let modifiedFiles = 0;

for (const filePath of foundFiles) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Reemplazar redirección a panel-general por licencia/planes
    if (content.includes('panel-general')) {
      content = content.replace(
        /router\.push\(['"`]\/panel-general['"`]\)/g,
        "router.push('/licencia/planes')"
      );
      modified = true;
      console.log(`🔄 Reemplazado 'panel-general' por 'licencia/planes' en ${filePath}`);
    }
    
    // Buscar y reemplazar otras redirecciones incorrectas
    const incorrectPatterns = [
      { pattern: /router\.push\(['"`]\/admin['"`]\)/g, replacement: "router.push('/licencia/planes')" },
      { pattern: /router\.push\(['"`]\/dashboard['"`]\)/g, replacement: "router.push('/licencia/planes')" },
      { pattern: /router\.push\(['"`]\/['"`]\)/g, replacement: "router.push('/licencia/planes')" }
    ];
    
    for (const { pattern, replacement } of incorrectPatterns) {
      if (pattern.test(content)) {
        content = content.replace(pattern, replacement);
        modified = true;
        console.log(`🔄 Reemplazado redirección incorrecta en ${filePath}`);
      }
    }
    
    // Si se modificó el archivo, guardarlo
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      modifiedFiles++;
      console.log(`✅ Guardado: ${filePath}`);
    } else {
      console.log(`⚪ No se necesitó modificar: ${filePath}`);
    }
    
  } catch (error) {
    console.log(`❌ Error procesando ${filePath}:`, error.message);
  }
}

console.log(`\n🎉 Proceso completado!`);
console.log(`📊 Archivos modificados: ${modifiedFiles}/${foundFiles.length}`);

if (modifiedFiles > 0) {
  console.log(`\n✨ Cambios aplicados:`);
  console.log(`   - Redirección de "Seleccionar Plan" ahora va a /licencia/planes`);
  console.log(`   - Los usuarios serán dirigidos al módulo de licencia centralizado`);
  console.log(`\n🚀 Ahora prueba el flujo:`);
  console.log(`   1. Inicia la aplicación web`);
  console.log(`   2. Haz clic en "Seleccionar Plan"`);
  console.log(`   3. Debería redirigir a /licencia/planes`);
  console.log(`   4. Completa el proceso de pago con MercadoPago`);
} else {
  console.log(`\n⚠️ No se realizaron cambios automáticos.`);
  console.log(`🔍 Revisa manualmente los archivos encontrados y busca:`);
  console.log(`   - router.push('/panel-general')`);
  console.log(`   - router.push('/admin')`);
  console.log(`   - Reemplaza por: router.push('/licencia/planes')`);
}

console.log(`\n📁 Módulo licencia creado en:`);
console.log(`   - /licencia (panel principal)`);
console.log(`   - /licencia/planes (selección y pago)`);
console.log(`   - /licencia/pagos (historial)`);
console.log(`   - /licencia/facturas (facturas)`);
