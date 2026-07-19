---
description: Deploy seguro a producción con verificación de build
---

# Deploy Seguro a Producción

Este workflow garantiza que el build de Next.js se complete correctamente antes de deployar.

## Pasos

### 0. Guarda de rutas críticas (PREVIENE REGRESIONES)
Verifica que el sidebar apunte a las rutas correctas ANTES de gastar tiempo en un build.
Corre sobre el source del HOST del server (que es lo que se buildeará).
Bash puro — no requiere node en el host. Y auto-corrige el caso conocido.
```bash
cd /root/friopro
SB=apps/web/src/components/layout/Sidebar.tsx
HREF=$(grep -oE "label: ['\"]Proyectos['\"][^}]*href: ['\"][^'\"]*['\"]" "$SB" | grep -oE "href: ['\"][^'\"]*['\"]" | grep -oE "/[a-zA-Z0-9/_-]+")
echo "Proyectos href actual: $HREF"
if [ "$HREF" = "/project360" ] || [ "$HREF" = "/project360/projects" ]; then
  echo "⚠️  Proyectos apunta a '$HREF' (producto standalone). Auto-corrigiendo a /proyectos..."
  sed -i "s|\(label: ['\"]Proyectos['\"], icon: BarChart3, href: \)['\"][^'\"]*['\"]|\1'/proyectos'|" "$SB"
  HREF=$(grep -oE "label: ['\"]Proyectos['\"][^}]*href: ['\"][^'\"]*['\"]" "$SB" | grep -oE "/[a-zA-Z0-9/_-]+$")
fi
if [ "$HREF" != "/proyectos" ]; then
  echo "❌ Proyectos apunta a '$HREF', debe ser /proyectos. Corregir Sidebar.tsx antes de deployar."
  exit 1
fi
echo "✅ Proyectos → /proyectos OK"
```
> Nota: /proyectos = módulo INTERNO de SGI. /project360 = producto STANDALONE (redirige a /proyect360-landing). El sidebar SIEMPRE debe usar /proyectos.
> Para chequeo local (con node disponible): `node scripts/check-critical-routes.mjs`

### 1. Limpiar caché de builds anteriores
```bash
cd /root/friopro
docker builder prune -f --filter unused-for=24h
docker compose down web
docker volume rm friopro_web_build_cache 2>/dev/null || true
```

### 2. Build con verificación
```bash
docker compose build --no-cache web 2>&1 | tee /tmp/build.log
if grep -q "error\|ERROR\|failed\|FAILED" /tmp/build.log; then
  echo "❌ Build falló - revisar /tmp/build.log"
  exit 1
fi
```

### 3. Verificar chunks generados
```bash
docker run --rm friopro-web ls -la /app/apps/web/.next/static/chunks/ | head -10
if [ $? -ne 0 ]; then
  echo "❌ Chunks no encontrados - build corrupto"
  exit 1
fi
```

### 3b. Verificar rutas críticas EN EL BUNDLE construido
Confirma que el build realmente compiló la ruta correcta (atrapa builds stale por caché).
```bash
docker run --rm friopro-web sh -c 'grep -rho "\"/proyectos\"" /app/apps/web/.next/static/chunks/*.js | head -1' | grep -q "/proyectos"
if [ $? -ne 0 ]; then
  echo "❌ El bundle NO contiene la ruta /proyectos - build stale o roto. Rebuild con --no-cache."
  exit 1
fi
echo "✅ Bundle contiene /proyectos"
```

### 4. Iniciar servicio
```bash
docker compose up -d web
sleep 10
```

### 5. Healthcheck
```bash
curl -f http://localhost:3000/login -o /dev/null -w '%{http_code}' | grep -qE '200|307|308'
if [ $? -eq 0 ]; then
  echo "✅ Deploy exitoso"
else
  echo "❌ Healthcheck falló - haciendo rollback"
  docker compose down web
  exit 1
fi
```

### Comando completo (una línea)
```bash
cd /root/friopro && docker builder prune -f && docker compose down web && docker compose build --no-cache web && docker compose up -d web && sleep 10 && curl -f http://localhost:3000/login -o /dev/null && echo "✅ OK" || echo "❌ Falló"
```
