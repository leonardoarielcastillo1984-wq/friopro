# ARQUITECTURA ENTERPRISE SGI360
*Última actualización: Agosto 2026 — Migrado a AWS*

---

## 🗺️ MAPA GENERAL

```
INTERNET
    │
    ├──► 🟢 PRODUCCIÓN — 54.94.33.5 (AWS sa-east-1, São Paulo)
    │         logismart.ar / www.logismart.ar / docs.logismart.ar
    │
    └──► 🟡 TESTING    — 18.191.206.203 (AWS us-east-2, Ohio)
              test.logismart.ar
```

---

## 🟢 PRODUCCIÓN — 54.94.33.5

### Acceso
- **Dominio:** https://logismart.ar
- **IP:** 54.94.33.5 (AWS EC2 t3.large, sa-east-1)
- **SSH:** `ssh -i ~/Downloads/sgi360-sa-east-1.pem ubuntu@54.94.33.5`
- **SSL:** wildcard `*.logismart.ar` (Let's Encrypt, auto-renovación certbot)

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
- **UFW:** activo — permite 22, 80, 443
- **fail2ban:** activo — SSH maxretry=3, ban=24h
- **AWS Security Group:** solo puertos 22, 80, 443
- **Redis/PG:** solo accesibles internamente
- **Monitor containers:** cron cada 5min con alerta por email
- **Grafana + Prometheus:** stack de monitoreo activo

### Backups automáticos
- **Frecuencia:** diaria (03:00 UTC = 00:00 Argentina)
- **Ubicación:** `s3://sgi360-backups-prod/prod/YYYYMMDD_HHMMSS/`
- **Contenido:** sgi_prod.dump, uploads.tar.gz, config.tar.gz
- **Retención:** 30 días en S3

### Comandos útiles
```bash
# Acceso al servidor
ssh -i ~/Downloads/sgi360-sa-east-1.pem ubuntu@54.94.33.5

# Ver contenedores
docker ps

# Logs API
docker logs sgi-api --since=1h

# Backup manual
bash /home/ubuntu/backup-prod.sh

# Deploy (desde local, con confirmación)
git push origin main
ssh -i ~/Downloads/sgi360-sa-east-1.pem ubuntu@54.94.33.5 "cd /home/ubuntu/friopro && git fetch origin main -q && git checkout origin/main -- apps/api/src/plugins/auth.ts && docker compose -f /home/ubuntu/docker-compose.prod.yml build sgi-api && docker compose -f /home/ubuntu/docker-compose.prod.yml up -d sgi-api"
```

---

## 🟡 TESTING — 18.191.206.203

### Acceso
- **Dominio:** https://test.logismart.ar
- **IP:** 18.191.206.203 (AWS EC2 t3.medium, us-east-2 Ohio)
- **SSH:** `ssh -i ~/Downloads/logismart-prod.pem ubuntu@18.191.206.203`
- **SSL:** wildcard `*.logismart.ar` (Let's Encrypt, activo)

### Stack
| Componente | Puerto interno | Notas |
|---|---|---|
| sgi-web | :3000 (→ Nginx) | SGI360 testing |
| sgi-api | :3002 (→ Nginx) | SGI360 testing |
| sgi-postgres | :5432 (interno) | DB testing |
| sgi-redis | :6379 (interno) | Cache testing |
| seg360-api | interno | Seg360 app |
| seg360-web | interno | Seg360 app |
| flota360-api | interno | Flota360 app |
| flota360-web | interno | Flota360 app |

### Deploy testing
```bash
git push origin main
ssh -i ~/Downloads/logismart-prod.pem ubuntu@18.191.206.203 "cd /home/ubuntu/friopro && git fetch origin main -q && git checkout origin/main -- apps/web && docker compose -f /home/ubuntu/docker-compose.testing.yml build sgi-web && docker compose -f /home/ubuntu/docker-compose.testing.yml up -d sgi-web"
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

Archivo en servidor: `/home/ubuntu/friopro/.env`  
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

1. **SSH al servidor:** `ssh -i ~/Downloads/sgi360-sa-east-1.pem ubuntu@54.94.33.5`
2. **Ver estado:** `docker ps`
3. **Reiniciar servicio:** `docker restart sgi-api` o `sgi-web`
4. **Si todo caído:** `docker compose -f /home/ubuntu/docker-compose.prod.yml up -d`
5. **Verificar:** `curl http://localhost:3002/health`

### Escenario: DB corrupta

1. **Descargar último backup desde S3:**
   ```bash
   aws s3 ls s3://sgi360-backups-prod/prod/ --region sa-east-1 | tail -5
   aws s3 cp s3://sgi360-backups-prod/prod/FECHA/sgi_prod.dump /tmp/ --region sa-east-1
   ```
2. **Restaurar:**
   ```bash
   docker stop sgi-api
   docker exec sgi-postgres pg_restore -U sgi -d sgi -c /tmp/sgi_prod.dump
   docker start sgi-api
   ```

### Escenario: Servidor no responde

1. Reiniciar desde AWS Console → EC2 → sgi360-prod → Reboot
2. Al levantar: containers arrancan solos (cron @reboot)
3. Verificar nginx: `systemctl status nginx`

---

## 📊 MONITOREO (ACTIVO)

- [x] Prometheus + Grafana + Loki + Node Exporter + cAdvisor + Alertmanager
- [x] Monitor de containers cada 5 min — alerta email si algo cae
- [x] Cron de renovación SSL (lunes 09:00 UTC)
- [x] Backups diarios BD + uploads + config → S3

---

## ☁️ INFRAESTRUCTURA AWS

| Recurso | Detalle |
|---|---|
| EC2 Prod | t3.large, sa-east-1, Ubuntu 24.04, 100GB gp3 |
| EC2 Testing | t3.medium, us-east-2, Ubuntu 24.04 |
| S3 Backup | `sgi360-backups-prod` (sa-east-1) |
| IAM | `sgi360-backup-bot` (solo S3) |
| DNS | Cloudflare → AWS IPs (proxied) |
| SSL | Let's Encrypt wildcard *.logismart.ar |
