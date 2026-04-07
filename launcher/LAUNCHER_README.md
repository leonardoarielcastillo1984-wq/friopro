# 🚀 SGI 360 Launcher - Guía de Uso

## ¿Qué es esto?

Este launcher es una **solución todo-en-uno** que automatiza completamente el inicio de la aplicación SGI 360. No necesitas abrir ninguna terminal ni ejecutar comandos manuales.

## 📋 Requisitos Previos

Antes de usar este launcher, asegúrate de tener instalado:

- **Node.js** (v18+): https://nodejs.org
- **Docker Desktop**: https://www.docker.com/products/docker-desktop
- **npm** (viene con Node.js)

## 🎯 Cómo Usar

### 📦 OPCIÓN 1: Script Automático (Recomendado)

```bash
cd "/Users/leonardocastillo/Desktop/APP/SGI 360"
bash launcher/start-all.sh
```

**¡Eso es todo!** El script automáticamente:
1. ✅ Inicia Docker (PostgreSQL + Redis)
2. ✅ Instala dependencias
3. ✅ Ejecuta migraciones de BD
4. ✅ Inicia servidor API (puerto 3002)
5. ✅ Inicia servidor Web (puerto 3000)
6. ✅ Abre el navegador automáticamente en login

---

## 🌐 URLs Disponibles

Una vez iniciado:

| URL | Descripción |
|-----|------------|
| http://localhost:3000 | Home |
| http://localhost:3000/login | Login |
| http://localhost:3000/dashboard | Dashboard |
| http://localhost:3000/audit | Motor IA Auditora |
| http://localhost:3002 | API REST |

---

## 🔐 Credenciales de Prueba

```
📧 Email:    test@example.com
🔑 Password: Test123!@#
```

---

## 🛑 Cómo Detener

```bash
bash launcher/stop.sh
```

---

## 🚀 Lo que se Inicia

### Docker Containers
- **PostgreSQL** (BD): puerto 5432
  - Usuario: sgi360
  - Contraseña: sgi360_dev_pass

- **Redis** (Cache): puerto 6379

### Servidores
- **API** (Fastify): puerto 3002
- **Web** (Next.js): puerto 3000

---

## 🔍 Troubleshooting

### Error: "Docker no está instalado"
👉 Descarga: https://www.docker.com/products/docker-desktop

### Error: "El puerto 3000 ya está en uso"
```bash
bash launcher/stop.sh
# o manualmente:
lsof -ti:3000 | xargs kill -9
```

### Ver logs
```bash
tail -f launcher/logs/api.log
tail -f launcher/logs/web.log
tail -f launcher/logs/docker.log
```

### Reiniciar limpio
```bash
bash launcher/stop.sh
sleep 2
bash launcher/start-all.sh
```

---

## 💡 Comandos Útiles

```bash
# Ver qué está corriendo en Docker
docker ps

# Ver logs de PostgreSQL
docker logs sgi360-postgres

# Ver logs de Redis
docker logs sgi360-redis

# Entrar a la BD
docker exec -it sgi360-postgres psql -U sgi360 -d sgi360_db

# Limpiar completamente
docker-compose -f launcher/docker-compose.yml down -v
```

---

## 📚 Documentación

Para detalles del Motor de IA Auditora:
```
/IA_AUDITOR_IMPLEMENTATION_GUIDE.md
```

---

**¡Listo! Ejecuta: `bash launcher/start-all.sh` 🎉**
