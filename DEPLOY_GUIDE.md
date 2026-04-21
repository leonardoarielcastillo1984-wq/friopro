# Guía de Deploy Seguro - Testing y Producción

## Objetivo
Mantener paridad funcional entre Testing y Producción con el mismo código, pero con bases de datos separadas y configuraciones específicas por entorno.

## Arquitectura

### Testing (http://46.62.253.81:4000)
- Frontend: `sgi-web-test` (puerto 3001 interno, expuesto vía nginx en 4000)
- Backend: `sgi-api-test` (puerto 4002)
- Base de datos: `sgi_test` (usuario: `sgi_test`)
- Nginx proxy: `sgi-nginx-testing` (redirige /api → sgi-api-test)
- Archivo de configuración: `docker-compose.test.yml`

### Producción (https://logismart.ar)
- Frontend: `sgi-web` (puerto 3000 expuesto al host)
- Backend: `sgi-api` (puerto 3002)
- Base de datos: `sgi` (usuario: `sgi`)
- Nginx proxy: nginx del sistema (redirige /api → backend)
- Archivo de configuración: `docker-compose.prod.yml`

## Configuración del Frontend

### Variable de Entorno Única
El frontend usa únicamente rutas relativas:
```bash
NEXT_PUBLIC_API_URL=/api
```

Esta configuración está en:
- `apps/web/Dockerfile` (ARG por defecto)
- `docker-compose.test.yml` (testing)
- `docker-compose.prod.yml` (producción)

## Configuración de Nginx

### Testing (Contenedor Docker)
Archivo: `nginx-testing.conf`
```nginx
location /api/ {
    proxy_pass http://sgi-api-test:3002/api/;
    # ... headers
}
```

### Producción (Nginx del Sistema)
Archivo: `/etc/nginx/sites-available/logismart`
```nginx
# Rutas de autenticación - van al backend (API)
location /api/auth/ {
    proxy_pass http://127.0.0.1:3002;
    # ... headers
}

# Otras rutas /api/ - quitar /api/ y pasar al backend
location /api/ {
    rewrite ^/api/(.*)$ /$1 break;
    proxy_pass http://127.0.0.1:3002;
    # ... headers
}
```

## Proceso de Deploy

### Deploy a Testing
```bash
# 1. Actualizar código en /root/friopro
cd /root/friopro
git pull

# 2. Reconstruir imágenes (si hay cambios en el código)
docker compose -f docker-compose.test.yml build --no-cache

# 3. Reiniciar contenedores
docker compose -f docker-compose.test.yml up -d

# 4. Verificar login
# URL: http://46.62.253.81:4000
# Credenciales: admin@sgi360.com / Admin123!
```

### Deploy a Producción
```bash
# 1. Actualizar código en /root/friopro
cd /root/friopro
git pull

# 2. Reconstruir imágenes (si hay cambios en el código)
docker compose -f docker-compose.prod.yml build --no-cache

# 3. Reiniciar contenedores
docker compose -f docker-compose.prod.yml up -d

# 4. Recargar nginx (si hay cambios en configuración)
nginx -t && systemctl reload nginx

# 5. Verificar login
# URL: https://logismart.ar
# Credenciales: admin@sgi360.com / Admin123!
```

## Reglas de Seguridad

### Datos
- **Nunca** mezclar bases de datos entre entornos
- Testing usa `sgi_test`, Producción usa `sgi`
- Cada entorno tiene su usuario de base de datos separado
- Los datos de producción nunca se tocan durante deploys

### Configuraciones
- El mismo código funciona en ambos entornos
- Las URLs del API son relativas (`/api`), no absolutas
- Nginx redirige `/api` al backend correcto según entorno
- No se necesitan rebuilds específicos por entorno

### Deploy
- El deploy actualiza solo código y funcionalidades
- Los datos, contraseñas y documentos de clientes nunca se modifican
- El deploy es reversible: se puede hacer rollback con `git checkout` y `docker compose up -d`

## Sincronización de Datos (Testing)

Si necesitas sincronizar datos de producción a testing:

```bash
# 1. Hacer backup de producción
docker exec sgi-postgres pg_dump -U sgi sgi > production_backup.sql

# 2. Transferir al servidor de testing
scp production_backup.sql root@46.62.253.81:/root/

# 3. Restaurar en testing
docker exec -i sgi-postgres-test psql -U sgi_test -d sgi_test < /root/production_backup.sql
```

**IMPORTANTE:** Solo hacer esto cuando sea necesario para probar funcionalidades específicas. No hacer esto rutinariamente.

## Verificación Post-Deploy

### Testing
1. Verificar login: http://46.62.253.81:4000
2. Verificar que las llamadas API van a http://46.62.253.81:4002
3. Verificar que los datos son los de la base de datos de testing

### Producción
1. Verificar login: https://logismart.ar
2. Verificar que las llamadas API usan /api (rutas relativas)
3. Verificar que los datos son los de la base de datos de producción
4. Verificar que SSL funciona correctamente

## Troubleshooting

### Error 502 Bad Gateway
- Verificar que los contenedores estén corriendo: `docker ps`
- Verificar que los puertos estén expuestos correctamente
- Verificar configuración de nginx

### Error 500 Internal Server Error
- Verificar logs del API: `docker logs sgi-api` o `docker logs sgi-api-test`
- Verificar que la base de datos esté accesible
- Verificar configuración de CORS

### Login no funciona
- Verificar que `/api/auth/` vaya al backend (127.0.0.1:3002)
- Verificar logs del API para ver errores específicos
- Verificar que las cookies se estén estableciendo correctamente
