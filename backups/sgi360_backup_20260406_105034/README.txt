BACKUP SGI 360 - 20260406_105034
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
Fecha: Mon Apr  6 10:50:38 -03 2026
