# 🚀 COMIENZA AQUÍ - SGI 360

## ⚡ La Forma Más Rápida (Recomendado - Con Docker)

Si tienes **Docker Desktop** instalado en tu Mac:

```bash
cd ~/Desktop/APP/"SGI 360"
bash LANZAR_CON_DOCKER.sh
```

**Eso es TODO.** Docker hará:
- ✅ Crear base de datos PostgreSQL
- ✅ Aplicar todas las migraciones (incluyendo los simulacros)
- ✅ Iniciar servidor API (puerto 3001)
- ✅ Iniciar servidor Web (puerto 3000)

Luego abre: **http://localhost:3000**

---

## 🛠️ Alternativa: Sin Docker (npm)

Si prefieres NO usar Docker:

```bash
cd ~/Desktop/APP/"SGI 360"
bash LANZAR_SERVIDOR_COMPLETO.sh
```

**Esto hará:**
- ✅ Instalar dependencias
- ✅ Generar cliente Prisma
- ✅ Aplicar migración de base de datos
- ✅ Iniciar API en background
- ✅ Iniciar Web en background

Luego abre: **http://localhost:3000**

---

## 📋 Opción Detallada: Paso a Paso

Si quieres hacerlo manualmente:

### 1. Instalar dependencias
```bash
cd ~/Desktop/APP/"SGI 360"
npm install
```

### 2. Aplicar migración
```bash
cd apps/api
npm run prisma:generate
npm run prisma:migrate
```

### 3. Lanzar API (terminal 1)
```bash
cd ~/Desktop/APP/"SGI 360"/apps/api
npm run dev
```

### 4. Lanzar Web (terminal 2)
```bash
cd ~/Desktop/APP/"SGI 360"/apps/web
npm run dev
```

### 5. Abrir navegador
```
http://localhost:3000
```

---

## ✨ Qué Cambió - Data Persistence

✅ Creas simulacro → recarga página → **¡sigue ahí!**
✅ Los datos están en PostgreSQL, no en memoria temporal
✅ Eye icon funciona para ver detalles
✅ Puedes agregar valores custom en dropdowns

---

## 🧪 Prueba Rápida

1. Login
2. Simulacros → "Nuevo Simulacro"
3. Llena: Nombre, Tipo, Severidad
4. Click "Crear"
5. Recarga página (F5)
6. ✅ ¡Sigue ahí! = Éxito

---

## 🛑 Detener Servidores

```bash
cd ~/Desktop/APP/"SGI 360"
bash DETENER_SERVIDORES.sh
```

---

## 📊 URLs

| Servicio | URL |
|----------|-----|
| 🌐 Web | http://localhost:3000 |
| 🔌 API | http://localhost:3001 |
| 🗄️ DB | localhost:5432/sgi_dev |

---

## 🐛 Problemas?

**Puerto en uso:**
```bash
lsof -i :3000
kill -9 PID
```

**DB no responde:**
- Docker: Abre Docker Desktop
- npm: Instala PostgreSQL

**Error Prisma:**
```bash
cd apps/api
npm run prisma:generate
npm run prisma:migrate
```

---

**¡A Comenzar! 🚀**
