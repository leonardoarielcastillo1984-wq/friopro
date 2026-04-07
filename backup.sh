#!/bin/bash
# SGI 360 - Script de Backup Completo
# Crea backup de: BD, uploads, .env y código

echo "🔒 Creando backup de SGI 360..."
echo ""

# Fecha para el nombre del backup
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/Users/leonardocastillo/Desktop/APP/SGI respaldo 360/backups"
BACKUP_NAME="sgi360_backup_$DATE"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

# Crear directorio de backups
mkdir -p "$BACKUP_PATH"

echo "📁 Directorio de backup: $BACKUP_PATH"
echo ""

# 1. Backup de la Base de Datos
echo "🗄️  Backup de PostgreSQL..."
cd "/Users/leonardocastillo/Desktop/APP/SGI respaldo 360"
docker exec sgi360-postgres pg_dump -U sgi -d sgi_dev > "$BACKUP_PATH/database.sql"
if [ $? -eq 0 ]; then
    echo "✅ Base de datos exportada"
else
    echo "❌ Error al exportar base de datos"
fi

# 2. Backup de Uploads
echo "📄 Backup de archivos uploads..."
cp -r "/Users/leonardocastillo/Desktop/APP/SGI respaldo 360/apps/api/uploads" "$BACKUP_PATH/"
if [ $? -eq 0 ]; then
    echo "✅ Archivos de uploads copiados"
else
    echo "⚠️  No se encontraron archivos en uploads"
fi

# 3. Backup de configuración .env
echo "⚙️  Backup de archivos .env..."
cp "/Users/leonardocastillo/Desktop/APP/SGI respaldo 360/apps/api/.env" "$BACKUP_PATH/env_api.txt"
cp "/Users/leonardocastillo/Desktop/APP/SGI respaldo 360/.env" "$BACKUP_PATH/env_root.txt" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Configuración guardada"
fi

# 4. Lista de documentos en BD
echo "📋 Exportando lista de documentos..."
cd "/Users/leonardocastillo/Desktop/APP/SGI respaldo 360/apps/api"
npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const docs = await prisma.document.findMany({ select: { id: true, title: true, filePath: true, status: true } });
  console.log(JSON.stringify(docs, null, 2));
  await prisma.\$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
" > "$BACKUP_PATH/documentos_lista.json" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Lista de documentos exportada"
fi

# 5. Crear archivo README del backup
cat > "$BACKUP_PATH/README.txt" << EOF
BACKUP SGI 360 - $DATE
================================

Este backup contiene:

1. database.sql         - Backup completo de PostgreSQL
2. uploads/             - Todos los archivos subidos (.docx, etc.)
3. env_api.txt          - Variables de entorno de la API
4. env_root.txt         - Variables de entorno del proyecto
5. documentos_lista.json - Lista de documentos registrados en BD

PARA RESTAURAR:
---------------

1. Base de datos:
   docker exec -i sgi360-postgres psql -U sgi -d sgi_dev < database.sql

2. Archivos:
   Copiar contenido de uploads/ a apps/api/uploads/

3. Variables de entorno:
   Copiar env_api.txt a apps/api/.env

CONTACTO:
---------
Backup creado automáticamente por SGI 360
Fecha: $(date)
EOF

# 6. Crear tar.gz comprimido
echo "📦 Comprimiendo backup..."
cd "$BACKUP_DIR"
tar -czf "$BACKUP_NAME.tar.gz" "$BACKUP_NAME"
if [ $? -eq 0 ]; then
    echo "✅ Backup comprimido: $BACKUP_NAME.tar.gz"
    # Eliminar directorio temporal
    rm -rf "$BACKUP_NAME"
else
    echo "⚠️  No se pudo comprimir, backup disponible en: $BACKUP_PATH"
fi

echo ""
echo "🎉 BACKUP COMPLETADO!"
echo "📂 Ubicación: $BACKUP_DIR/$BACKUP_NAME.tar.gz"
echo ""

# Mostrar tamaño del backup
ls -lh "$BACKUP_DIR/$BACKUP_NAME.tar.gz" 2>/dev/null || echo "Tamaño: $(du -sh $BACKUP_PATH 2>/dev/null | cut -f1)"
