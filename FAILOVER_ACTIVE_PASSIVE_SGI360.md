# FAILOVER ACTIVE-PASSIVE SGI360
## Arquitectura Enterprise de Alta Disponibilidad

---

## RESUMEN EJECUTIVO

| Item | Valor |
|------|-------|
| **Objetivo RTO** | ≤ 10 minutos |
| **Objetivo RPO** | ≤ 15 minutos (último backup PG) |
| **Modelo** | Active-Passive (un master activo a la vez) |
| **Producción** | Hetzner 46.62.145.171 (principal) |
| **Failover** | AWS EC2 18.229.103.94 (warm standby) |
| **Monitor** | Testing 46.62.253.81 (watchdog externo) |
| **Backups** | AWS S3 `sgi360-backups-prod` (sa-east-1) |

---

## ARQUITECTURA

```
┌─────────────────────────────────────────────────────────┐
│                    INTERNET / CLIENTES                   │
└──────────────────────────┬──────────────────────────────┘
                           │ DNS logismart.ar
                           ▼
          ┌────────────────────────────────┐
          │  NORMAL: 46.62.145.171        │
          │  FAILOVER: 18.229.103.94      │
          └────────────────────────────────┘

🟢 PRODUCCIÓN (Hetzner 46.62.145.171)          🟡 MONITOR (46.62.253.81)
├── sgi-api (port 3002)                         └── watchdog.sh (cada 1 min)
├── sgi-web (port 3000)                             ├── detecta caída
├── sgi-postgres                                    ├── dispara failover
├── sgi-redis                                       └── detecta recuperación
└── nginx + SSL logismart.ar
         │ pg_dump cada 15min
         │ uploads sync cada 5min
         ▼
☁️ AWS S3 (sgi360-backups-prod)
         │ restore en failover
         ▼
🔵 AWS EC2 (18.229.103.94) — WARM STANDBY
├── sgi-api-failover
├── sgi-web-failover
├── sgi-postgres-failover
├── sgi-redis-failover
└── nginx + SSL
```

---

## COMPONENTES INSTALADOS

### Producción (46.62.145.171)
- **Backups PG failover**: `/root/friopro/failover/scripts/pg-backup-15min.sh` (cron `*/15 * * * *`)
- **Sync uploads**: `/root/friopro/failover/scripts/uploads-sync.sh` (cron `*/5 * * * *`)
- **AWS CLI**: `/usr/local/bin/aws` con credenciales en `/root/.aws/`
- **Estado último backup**: `/root/friopro/failover/state/last_pg_backup`

### Testing / Monitor (46.62.253.81)
- **Watchdog**: `/root/friopro/failover/scripts/watchdog.sh` (cron `* * * * *`)
- **Failover**: `/root/friopro/failover/scripts/failover-main.sh`
- **Failback**: `/root/friopro/failover/scripts/failback-main.sh`
- **Logs**: `/root/friopro/failover/logs/`
- **Estado**: `/root/friopro/failover/state/failover-active` (existe = en failover)

### AWS EC2 (18.229.103.94 / i-09073bb1efa38bfe0)
- **Tipo**: t3.medium (2 vCPU, 4GB RAM), 30GB gp3
- **OS**: Debian 12
- **Docker**: 29.5 instalado
- **Imágenes**: `friopro-api` y `friopro-web` pre-buildeadas
- **Compose**: `/root/friopro/docker-compose.failover.yml`
- **Key SSH**: `/root/friopro/failover/sgi360-failover-key.pem`

---

## FLUJO DE FAILOVER AUTOMÁTICO

```
Minuto 0:   Hetzner cae
Minuto 1:   Watchdog detecta fallo #1 → alerta email
Minuto 2:   Watchdog detecta fallo #2
Minuto 3:   Watchdog detecta fallo #3 → DISPARA FAILOVER

Failover-main.sh ejecuta:
  [+0:00] Arranca EC2 si está parada (~25s)
  [+0:30] Descarga último PG backup desde S3
  [+1:00] Levanta postgres + redis en EC2
  [+1:30] Restaura base de datos
  [+3:00] Restaura uploads desde S3
  [+4:00] Levanta api + web
  [+5:30] Healthchecks (5 intentos x 20s)
  [+6:30] Si OK: intenta cambio DNS automático
          Si DNS automático falla: envía email con instrucciones manuales
  
Total estimado: 6-8 minutos de downtime
```

---

## CAMBIO DE DNS MANUAL (si automático falla)

Cuando recibas el email de alerta:

1. Ir a **https://dns.hetzner.com**
2. Zona `logismart.ar`
3. Registro A `www` → cambiar a `18.229.103.94` TTL=60
4. Registro A `@` → cambiar a `18.229.103.94` TTL=60
5. Guardar

**Tiempo**: 30 segundos + ~1 min propagación (TTL 60)

---

## FLUJO DE FAILBACK (retorno a Hetzner)

Cuando Hetzner vuelve:
1. Watchdog detecta 3 checks consecutivos OK (3 minutos)
2. `failback-main.sh` ejecuta:
   - Exporta DB desde AWS → S3
   - Sincroniza uploads → S3
   - Valida Hetzner con healthcheck
   - Cambia DNS de vuelta a 46.62.145.171
   - Para containers en AWS
   - Apaga EC2 (ahorra costo)
3. **Split-brain protection**: solo se ejecuta si Hetzner pasa healthcheck

---

## PROTECCIÓN SPLIT-BRAIN

- **Un solo master**: el archivo `failover-active` controla el estado
- **No hay doble escritura**: AWS solo arranca cuando Hetzner falla 3 veces
- **Failback validado**: Hetzner debe responder 200 antes de retornar DNS
- **Lock files**: `/root/friopro/failover/locks/` evita ejecuciones paralelas

---

## BACKUPS Y SINCRONIZACIÓN

| Recurso | Frecuencia | Destino S3 |
|---------|-----------|------------|
| PostgreSQL dump | Cada 15 min | `failover/pg/latest.sql.gz` + histórico |
| Uploads | Cada 5 min | `failover/uploads/` (sync incremental) |
| Config nginx+SSL | Diario 2am | `config/nginx_ssl_*.tar.gz` |

**Retención**: 30 días en S3 (lifecycle policy activa)

---

## COMANDOS OPERACIONALES

### Ver estado del sistema
```bash
# Desde testing (monitor)
cat /root/friopro/failover/state/failover-active  # vacío = producción activa
tail -50 /root/friopro/failover/logs/watchdog.log
tail -50 /root/friopro/failover/logs/failover.log

# Último backup PG
cat /root/friopro/failover/state/last_pg_backup
aws s3 ls s3://sgi360-backups-prod/failover/pg/ | tail -5
```

### Forzar failover manual
```bash
ssh root@46.62.253.81
bash /root/friopro/failover/scripts/failover-main.sh
```

### Forzar failback manual
```bash
ssh root@46.62.253.81
bash /root/friopro/failover/scripts/failback-main.sh
```

### Ver containers en AWS
```bash
ssh -i /root/friopro/failover/sgi360-failover-key.pem admin@18.229.103.94
docker ps
docker logs sgi-api-failover --tail 50
```

---

## ALERTAS CONFIGURADAS

| Evento | Canal | Asunto |
|--------|-------|--------|
| Producción no responde (1/3) | Email | `[SGI360] ALERTA produccion` |
| Failover iniciado | Email | `[SGI360] FAILOVER INICIADO` |
| Failover completado | Email | `[SGI360] FAILOVER EXITOSO` |
| Failover fallido | Email | `[SGI360] FAILOVER FALLIDO` |
| DNS manual requerido | Email | `[SGI360] ACCION MANUAL: CAMBIAR DNS` |
| Failback iniciado | Email | `[SGI360] FAILBACK INICIADO` |
| Failback completado | Email | `[SGI360] FAILBACK EXITOSO` |
| Failback abortado | Email | `[SGI360] FAILBACK ABORTADO` |

Destinatario: `leonardoarielcastillo1984@gmail.com`

---

## COSTOS AWS ESTIMADOS

| Recurso | Costo/mes (aprox) |
|---------|-------------------|
| EC2 t3.medium (parada) | ~$2 USD |
| EC2 t3.medium (corriendo durante failover) | ~$0.05/hora |
| Elastic IP (asignada) | ~$3.60 USD |
| S3 almacenamiento (~500MB) | ~$0.01 USD |
| S3 transferencia | ~$0.01 USD |
| **Total en standby** | **~$6 USD/mes** |
| **Total durante failover activo** | **~$10 USD/mes** |

---

## TROUBLESHOOTING

### Watchdog no dispara failover
```bash
# Ver logs
tail -100 /root/friopro/failover/logs/watchdog.log
# Ver contador de fallos
cat /root/friopro/failover/state/fail-count
# Ejecutar manualmente
bash /root/friopro/failover/scripts/watchdog.sh
```

### Failover falla en healthcheck
```bash
# Ver logs en EC2
ssh -i /root/friopro/failover/sgi360-failover-key.pem admin@18.229.103.94
docker logs sgi-api-failover --tail 50
docker logs sgi-postgres-failover --tail 20
```

### PostgreSQL no levanta en AWS
```bash
# Restaurar manualmente
docker exec sgi-postgres-failover psql -U sgi -c '\l'
aws s3 cp s3://sgi360-backups-prod/failover/pg/latest.sql.gz /tmp/
gunzip -c /tmp/latest.sql.gz | docker exec -i sgi-postgres-failover psql -U sgi sgi_failover
```

### DNS no cambia automáticamente
- Ir a https://dns.hetzner.com
- Cambiar manualmente: A `www` y `@` → `18.229.103.94` TTL=60

---

## RECURSOS AWS

| Recurso | ID |
|---------|-----|
| EC2 Instance | `i-09073bb1efa38bfe0` |
| Elastic IP | `18.229.103.94` |
| Allocation ID | `eipalloc-078c799991652992a` |
| Security Group | `sg-0b95b5446f2e0c79e` |
| S3 Bucket | `sgi360-backups-prod` |
| Route53 Zone | `Z01727821FIS88WT964FM` |
| Región | `sa-east-1` (São Paulo) |

---

*Documentación generada el 21/05/2026*
