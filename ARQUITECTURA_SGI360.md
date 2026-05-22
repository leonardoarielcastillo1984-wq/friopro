# ARQUITECTURA ENTERPRISE SGI360
*Última actualización: Mayo 2026*

---

## 🗺️ MAPA GENERAL

```
INTERNET
    │
    ├──► 🟢 PRODUCCIÓN — 46.62.145.171 (www.logismart.ar)
    │
    └──► 🟡 TESTING    — 46.62.253.81  (test.logismart.ar)
```

---

## 🟢 PRODUCCIÓN — 46.62.145.171

### Acceso
- **Dominio:** https://www.logismart.ar
- **IP:** 46.62.145.171
- **SSH:** `ssh root@46.62.145.171` (pass: en vault)
- **SSL:** válido hasta 16/08/2026 (auto-renovación certbot)

### Stack
| Componente | Imagen | Puerto interno | Notas |
|---|---|---|---|
| sgi-web | friopro-web | :3000 (→ Nginx) | Next.js 14 |
| sgi-api | friopro-api | :3002 (→ Nginx) | Fastify |
| sgi-postgres | postgres:15 | :5432 (interno) | DB principal |
| sgi-redis | redis:7 | :6379 (interno) | Cache/Jobs |
| onlyoffice | onlyoffice | :8080 | Editor documentos |

### Nginx (/etc/nginx/sites-enabled/logismart)
```
location /api/auth/  → proxy :3002/api/auth/  (SIN rewrite)
location /api/       → rewrite + proxy :3002
location /uploads/   → alias /data/docker/volumes/friopro_api_uploads/_data/
location /           → proxy :3000
```

### Seguridad
- **UFW:** activo — permite 22, 80, 443, 8080
- **fail2ban:** activo — SSH maxretry=3, ban=24h
- **Redis/PG:** solo accesibles internamente (UFW bloquea 5432, 6379 externamente)
- **Restart policy:** `unless-stopped` en todos los contenedores

### Backups automáticos
- **Frecuencia:** 2x día (03:00 y 15:00)
- **Ubicación:** `/root/friopro/backups-prod/`
- **Contenido:** pg_dump, uploads, nginx+SSL, docker-compose
- **Retención:** automática (ver script)
- **Último backup:** exitoso ✅

### Comandos útiles
```bash
# Ver contenedores
docker ps

# Logs API
docker logs sgi-api --since=1h

# Deploy producción (requiere confirmación)
/root/friopro/scripts/deploy-production.sh --AUTORIZADO

# Backup manual
/root/friopro/backups-prod/scripts/backup-production.sh
```

---

## 🟡 TESTING — 46.62.253.81

### Acceso
- **Dominio:** http://test.logismart.ar (HTTP por ahora)
- **IP:** 46.62.253.81
- **SSH:** `ssh root@46.62.253.81` (pass: mykCpXh0wDfk)
- **SSL:** pendiente — requiere actualizar DNS primero

### ⚠️ DNS PENDIENTE
Actualizar en panel DNS: `test.logismart.ar` → `46.62.253.81`  
(actualmente apunta a producción 46.62.145.171)

### Stack
| Componente | Puerto interno | Puerto externo |
|---|---|---|
| sgi-web-testing | :3000 | 127.0.0.1:4001 |
| sgi-api-testing | :4002 | 0.0.0.0:4002 |
| sgi-postgres-testing | :5432 | 0.0.0.0:5433 |
| sgi-redis-testing | :6379 | 0.0.0.0:6380 |

### Activar SSL (después de actualizar DNS)
```bash
/root/friopro/scripts/ssl-testing.sh
```

### Deploy testing
```bash
/root/friopro/scripts/deploy-testing.sh
```

### Aislamiento
- DB independiente: `sgi_testing` (NO datos reales)
- Uploads independientes
- Redis independiente
- Variables .env separadas (NEXTAUTH_URL, CORS_ORIGIN, etc.)

---

## 🔴 REGLAS ABSOLUTAS

1. **NUNCA** tocar producción sin confirmación explícita del usuario
2. **NUNCA** `docker system prune` sin verificar imágenes commiteadas
3. **NUNCA** exponer Redis o PostgreSQL públicamente
4. Todo cambio se prueba primero en **testing**
5. Siempre backup antes de cambios críticos en producción

---

## 📁 VOLÚMENES DOCKER PRODUCCIÓN

| Volumen | Contenido |
|---|---|
| friopro_postgres_data | DB PostgreSQL producción |
| friopro_api_uploads | Archivos subidos por usuarios |
| friopro_redis_data | Cache Redis |

---

## 🔑 VARIABLES DE ENTORNO

Archivo en servidor: `/root/friopro/.env`  
**NUNCA commitear al repo.**

Variables clave:
- `DATABASE_URL` — conexión PostgreSQL
- `JWT_SECRET` / `AUTH_SECRET` — autenticación
- `GROQ_API_KEY` — IA (Groq llama-3.1-8b-instant)
- `SMTP_*` — email (Gmail)
- `MERCADOPAGO_ACCESS_TOKEN` — pagos

---

## 🔄 RECOVERY RUNBOOK

### Escenario: Producción caída

1. **SSH al servidor:** `ssh root@46.62.145.171`
2. **Ver estado:** `docker ps`
3. **Reiniciar servicio:** `docker restart sgi-api` o `sgi-web`
4. **Si todo caído:** `cd /root/friopro && docker compose up -d`
5. **Verificar:** `curl http://localhost:3002/health`

### Escenario: DB corrupta

1. **Parar API:** `docker stop sgi-api`
2. **Ver último backup:** `ls -lt /root/friopro/backups-prod/pg/`
3. **Restaurar:**
   ```bash
   gunzip -c /root/friopro/backups-prod/pg/sgi_prod_pg_YYYYMMDD_HHMMSS.sql.gz | \
   docker exec -i sgi-postgres psql -U sgi
   ```
4. **Reiniciar API:** `docker start sgi-api`

### Escenario: Servidor no responde

1. Reiniciar desde panel Hetzner
2. Al levantár: todos los contenedores arrancan solos (`restart: unless-stopped`)
3. Verificar nginx: `systemctl status nginx`

---

## 📊 MONITOREO (PENDIENTE DE IMPLEMENTAR)

- [ ] Prometheus + Grafana + Node Exporter + cAdvisor
- [ ] Alertas: caída nginx, Docker, PostgreSQL, Redis, disco, RAM, CPU
- [ ] Dashboard métricas sistema

---

## ☁️ DR / AWS (PENDIENTE)

- [ ] S3 bucket para backups externos
- [ ] Script sync backups producción → S3
- [ ] DNS failover documentado
- [ ] Recovery desde S3 documentado
