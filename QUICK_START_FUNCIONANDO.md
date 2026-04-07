# 🚀 QUICK START - SGI 360 FUNCIONANDO

**ESTO FUNCIONA - PROBADO Y VALIDADO - 25 MAR 2026**

---

## ⚡ PASOS RÁPIDOS (5 MINUTOS)

### Terminal 1 - Servicios (ejecutar UNA SOLA VEZ)

```bash
brew services start postgresql@16
brew services start redis
```

### Terminal 2 - API (puerto 3002)

```bash
cd ~/Desktop/APP/SGI\ 360/apps/api
npm run dev
```

**Deberías ver:**
```
{"level":30,"msg":"SGI 360 API running on port 3002"}
```

### Terminal 3 - Frontend (puerto 3000)

```bash
cd ~/Desktop/APP/SGI\ 360/apps/web
npm run dev
```

**Deberías ver:**
```
✓ Ready in XXXms
- Local: http://localhost:3000
```

### Navegador - Login

**URL:** http://localhost:3000/login

**Email:** admin@sgi360.com
**Contraseña:** Admin123!

✅ Entra al Dashboard correctamente

---

## 🔧 CUANDO ALGO FALLA

### Error: "Puerto 3002 ya en uso"
```bash
pkill -9 -f "npm run dev"
sleep 2
# Reintentar npm run dev
```

### Error: "Database connection refused"
```bash
brew services restart postgresql@16
```

### Error: "Redis connection refused"
```bash
brew services restart redis
```

### Error: "Login falla - Base de datos vacía"
```bash
cd ~/Desktop/APP/SGI\ 360/apps/api
npx ts-node src/scripts/seedUsers.ts
# Responder: y
```

---

## ✅ CHECKLIST

- [ ] PostgreSQL corriendo
- [ ] Redis corriendo
- [ ] API en puerto 3002
- [ ] Frontend en puerto 3000
- [ ] Login funciona
- [ ] Dashboard accesible

---

ESTADO: ✅ FUNCIONANDO 100%
ÚLTIMA PRUEBA: 2026-03-25
