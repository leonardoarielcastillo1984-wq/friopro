# 📜 Scripts Ejecutables - SGI 360

Estos scripts simplifican el inicio y gestión de la aplicación.

## 🚀 Uso rápido

### Primera vez del día
```bash
./start.sh
```
Luego iniciá los servicios manualmente en terminales separadas.

### Desarrollo diario
```bash
./dev.sh
```
Inicia API y Web automáticamente.

### Detener todo
```bash
./stop.sh
```

### Reset completo
```bash
./reset.sh          # Reset normal
./reset.sh --deep   # Reset + limpieza de node_modules
```

### Producción con Docker
```bash
./prod.sh
```

---

## 📋 Descripción de scripts

### `./start.sh`
- Inicia PostgreSQL y Redis con Docker
- Prepara la base de datos (migraciones + seed)
- Muestra instrucciones para iniciar API y Web
- **Uso**: Primera vez del día o después de un `./stop.sh`

### `./dev.sh`
- Verifica que la infra esté corriendo
- Inicia API y Web en paralelo
- Maneja la detención con Ctrl+C
- **Uso**: Desarrollo diario (después de `./start.sh`)

### `./stop.sh`
- Detiene contenedores Docker
- Libera puertos 3000 y 3001
- **Uso**: Cuando terminás de trabajar

### `./reset.sh`
- Detiene todo
- Limpia volúmenes Docker
- Reinicia desde cero
- **Uso**: Cuando hay problemas graves

### `./prod.sh`
- Construye imágenes Docker
- Inicia producción completa
- **Uso**: Para despliegue en producción

---

## 🔧 Flujo de trabajo recomendado

### Desarrollo
```bash
# 1. Iniciar infraestructura (una vez por día)
./start.sh

# 2. Iniciar servicios (cuando quieras trabajar)
./dev.sh

# 3. Cuando termines
./stop.sh
```

### Problemas
```bash
# Si algo falla, intentá reset normal
./reset.sh

# Si sigue fallando, reset profundo
./reset.sh --deep
```

### Producción
```bash
# Configurar .env.prod primero
# Luego:
./prod.sh
```

---

## 🌐 Accesos

- **Web**: http://localhost:3000
- **API**: http://localhost:3001
- **Docs**: http://localhost:3001/docs

## 🔐 Credenciales demo

- `admin@sgi360.com` / `Admin123!` (Super Admin)
- `usuario@demo.com` / `User123!` (Usuario Demo)
