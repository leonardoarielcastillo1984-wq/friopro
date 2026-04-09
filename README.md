# SGI 360 - Sistema de Gestión Integral

![SGI 360](https://img.shields.io/badge/SGI%20360-v1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node.js](https://img.shields.io/badge/node.js-18%2B-brightgreen.svg)

Un Sistema de Gestión Integral (SGI) moderno y completo construido con Next.js, Node.js y TypeScript, diseñado para帮助企业实现ISO 9001, ISO 14001, ISO 45001等标准认证。

## 🌟 Características Principales

### 📊 **Módulos Principales**
- **🏠 Dashboard** - Vista general con KPIs y métricas
- **👥 Clientes** - Gestión completa de clientes y encuestas
- **📄 Documentos** - Control de documentos y normativos
- **🔍 Auditorías** - Auditorías internas y análisis con IA
- **⚠️ No Conformidades** - Gestión de NCRs y acciones correctivas
- **📈 Indicadores** - KPIs y métricas de rendimiento
- **⚡ Riesgos** - Matriz de riesgos y planes de mitigación
- **🏗️ Project360** - Gestión de proyectos y planes de acción
- **👤 RRHH** - Gestión de recursos humanos
- **🚨 Simulacros** - Planes de emergencia y simulacros
- **📋 Reportes** - Generación de reportes PDF
- **⚙️ Configuración** - Administración del sistema

### 🎯 **Funcionalidades Avanzadas**
- **🤖 IA Auditora** - Análisis automático de documentos vs normativas
- **💳 Sistema de Licencias** - Planes por niveles con MercadoPago
- **🔐 Multi-tenant** - Aislamiento de datos por organización
- **📱 Responsive** - Diseño adaptativo para todos los dispositivos
- **🔔 Notificaciones** - Sistema completo de alertas y notificaciones
- **📊 Analytics** - Dashboard con estadísticas en tiempo real

## 🚀 Quick Start

### Prerrequisitos
- Node.js 18+
- PostgreSQL 14+
- Redis (opcional, para colas de trabajo)
- Docker & Docker Compose (para OLLAMA y desarrollo)

### Instalación

1. **Clonar el repositorio**
```bash
git clone https://github.com/tu-usuario/sgi-360.git
cd sgi-360
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
# API
cp apps/api/.env.example apps/api/.env
# Web
cp apps/web/.env.example apps/web/.env
```

4. **Configurar base de datos**
```bash
cd apps/api
npx prisma migrate dev
npx prisma generate
```

5. **Iniciar los servicios**
```bash
# Terminal 1 - API
cd apps/api && npm run dev

# Terminal 2 - Web
cd apps/web && npm run dev
```

6. **Acceder a la aplicación**
- Frontend: http://localhost:3000
- API: http://localhost:3002
- Admin: http://localhost:3002/api/stats
- OLLAMA: http://localhost:11434

### 🤖 OLLAMA - IA Local

El proyecto incluye OLLAMA como servicio de IA local:

**Modelos Disponibles:**
- `llama3.1` - Modelo principal para auditoría IA
- `codellama` - Para análisis de código
- `mistral` - Alternativa ligera

**Comandos OLLAMA:**
```bash
# Listar modelos disponibles
docker exec sgi-ollama ollama list

# Descargar modelo adicional
docker exec sgi-ollama ollama pull mistral

# Verificar estado
curl http://localhost:11434/api/tags
```

## 🔐 Credenciales por Defecto

### SuperAdmin
- **Email:** `admin@sgi360.com`
- **Contraseña:** `admin123`

### Cliente (Plan Básico)
- **Email:** `lcastillo@dadalogistica.com`
- **Contraseña:** `temporal123`

## 📁 Estructura del Proyecto

```
sgi-360/
├── apps/
│   ├── api/                 # Backend API (Node.js + Express)
│   │   ├── src/
│   │   │   ├── routes/      # Endpoints de la API
│   │   │   ├── plugins/     # Plugins y middleware
│   │   │   └── app.ts       # Configuración principal
│   │   ├── prisma/          # Schema de base de datos
│   │   └── uploads/         # Archivos subidos
│   └── web/                 # Frontend (Next.js)
│       ├── src/
│       │   ├── app/         # App Router
│       │   ├── components/  # Componentes React
│       │   └── lib/         # Utilidades
│       └── public/          # Archivos estáticos
├── docs/                    # Documentación
├── docker-compose.yml       # Configuración Docker
├── package.json             # Workspace configuration
└── README.md               # Este archivo
```

## 🛠️ Stack Tecnológico

### Backend
- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **TypeScript** - Tipado estático
- **Prisma** - ORM y base de datos
- **PostgreSQL** - Base de datos principal
- **Redis** - Cache y colas
- **JWT** - Autenticación
- **Zod** - Validación de datos
- **BullMQ** - Colas de trabajo
- **OLLAMA** - IA local para auditoría

### Frontend
- **Next.js 14** - Framework React
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Framework CSS
- **Lucide React** - Iconos
- **React Hook Form** - Formularios
- **Zustand** - Estado global
- **TanStack Query** - Data fetching

### Infraestructura
- **Docker** - Contenedores
- **Docker Compose** - Orquestación
- **GitHub Actions** - CI/CD
- **Vercel** - Deploy (frontend)
- **Railway/Render** - Deploy (backend)

## 📊 Planes y Licencias

### 🆓 Plan Gratuito
- Hasta 3 usuarios
- Dashboard básico
- Documentos (limitado)

### 💎 Plan Básico - $99/mes
- Hasta 10 usuarios
- Todos los módulos básicos
- Clientes y encuestas
- Reportes PDF

### 🏆 Plan Premium - $299/mes
- Usuarios ilimitados
- Todos los módulos
- IA Auditora
- Analytics avanzado
- Soporte prioritario

## 🔧 Configuración

### Variables de Entorno - API

```env
# Server
PORT=3002
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/sgi

# Auth
JWT_SECRET=your-secret-key
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=30d

# Email
EMAIL_PROVIDER=resend
RESEND_API_KEY=your-api-key

# Storage
STORAGE_BACKEND=local
STORAGE_LOCAL_PATH=./uploads

# IA
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-api-key
```

### Variables de Entorno - Web

```env
NEXT_PUBLIC_API_URL=http://localhost:3002
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 🚀 Deploy

### Producción con Docker

```bash
# Construir y levantar servicios
docker-compose up -d

# Ver logs
docker-compose logs -f
```

### Deploy Manual

1. **Backend**
```bash
cd apps/api
npm run build
npm start
```

2. **Frontend**
```bash
cd apps/web
npm run build
npm start
```

## 📝 Desarrollo

### Comandos Útiles

```bash
# API
cd apps/api
npm run dev          # Desarrollo
npm run build        # Build
npm run test         # Tests
npx prisma studio    # Admin DB

# Web
cd apps/web
npm run dev          # Desarrollo
npm run build        # Build
npm run lint         # Linting
npm run type-check   # Type checking
```

### Docker & OLLAMA

```bash
# Configurar OLLAMA con modelos
./scripts/setup-ollama.sh

# Iniciar solo OLLAMA
docker-compose up -d ollama

# Ver logs de OLLAMA
docker-compose logs -f ollama

# Listar modelos OLLAMA
docker exec sgi-ollama ollama list

# Descargar modelo adicional
docker exec sgi-ollama ollama pull mistral

# Limpiar todo
docker-compose down -v
```

### Flujo de Trabajo

1. Crear branch desde `main`
2. Desarrollar la funcionalidad
3. Hacer commit con mensajes claros
4. Abrir Pull Request
5. Revisión y merge

## 🤝 Contribuir

1. Fork del proyecto
2. Crear feature branch (`git checkout -b feature/amazing-feature`)
3. Commit cambios (`git commit -m 'Add amazing feature'`)
4. Push al branch (`git push origin feature/amazing-feature`)
5. Abrir Pull Request

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 🆘 Soporte

- � Email: support@sgi360.app
- 📖 Documentación: https://docs.sgi360.app
- 🐛 Issues: https://github.com/tu-usuario/sgi-360/issues
- 💬 Discord: https://discord.gg/sgi360

## 🙏 Agradecimientos

- Al equipo de desarrollo por su dedicación
- A la comunidad de código abierto
- A nuestros usuarios por su feedback constante

---

**SGI 360** - Transformando la gestión de calidad empresarial 🚀
- **Credenciales MercadoPago**: Para integración de pagos

## 🔧 Instalación

### 1. Clonar el repositorio
```bash
git clone <repo-url>
cd "SGI respaldo 360"
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno

**apps/api/.env:**
```env
DATABASE_URL=postgresql://sgi:sgidev123@localhost:5432/sgi_dev
JWT_SECRET=tu-secret-jwt
MERCADOPAGO_ACCESS_TOKEN=tu-token-mp
MERCADOPAGO_PUBLIC_KEY=tu-public-key-mp
```

**apps/web/.env.local:**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_MERCADOPAGO_KEY=tu-public-key-mp
```

### 4. Ejecutar migraciones de base de datos
```bash
cd apps/api
npx prisma migrate dev
```

## 🚀 Iniciar la Aplicación

### Opción 1: Script Automático (Recomendado)
```bash
bash RUN_COMPLETE.sh .
```

### Opción 2: Manual (Dos terminales)

**Terminal 1 - API:**
```bash
cd apps/api
npm run dev
# API en http://localhost:3001
```

**Terminal 2 - Frontend:**
```bash
cd apps/web
npm run dev
# Frontend en http://localhost:3000
```

## 📁 Estructura del Proyecto

```
SGI respaldo 360/
├── apps/
│   ├── api/               # Backend Fastify
│   │   ├── src/
│   │   │   ├── routes/    # Rutas API
│   │   │   ├── middleware/# Middleware
│   │   │   ├── lib/       # Utilidades
│   │   │   └── main.ts    # Entry point
│   │   ├── prisma/        # Schema base de datos
│   │   └── package.json
│   │
│   └── web/               # Frontend Next.js
│       ├── src/
│       │   ├── app/       # Páginas
│       │   ├── components/ # Componentes React
│       │   ├── lib/       # Utilidades
│       │   └── hooks/     # Hooks personalizados
│       └── package.json
│
├── infra/                 # Configuración de infraestructura
├── launcher/              # Scripts de lanzamiento
├── .git/                  # Control de versiones
├── .env                   # Variables de entorno root
├── package.json           # Dependencias root (monorepo)
└── README.md              # Este archivo
```

## 🔐 Seguridad Implementada

- ✅ **JWT Tokens**: Autenticación segura con tokens JWT
- ✅ **Password Hashing**: Argon2 para almacenamiento de contraseñas
- ✅ **Role-Based Access**: Control de acceso basado en roles
- ✅ **Audit Trail**: Registro completo de acciones
- ✅ **HTTPS Ready**: Preparado para HTTPS en producción
- ✅ **Rate Limiting**: Protección contra ataques de fuerza bruta

## 💳 Integración MercadoPago

El sistema integra MercadoPago para:
- Pagos de actualización de planes
- Gestión de preferencias de pago
- Webhooks de confirmación

**Configurar en apps/api/.env:**
```env
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxx
MERCADOPAGO_PUBLIC_KEY=APP_USR-xxxx
```

## 🗄️ Base de Datos

El proyecto usa Prisma ORM con PostgreSQL. 

### Ejecutar migraciones:
```bash
cd apps/api
npx prisma migrate dev --name descriptive_name
```

### Ver base de datos:
```bash
cd apps/api
npx prisma studio
```

## 📊 API Endpoints Principales

### Autenticación
- `POST /auth/login` - Login de usuario
- `POST /auth/register` - Registro nuevo usuario
- `POST /auth/refresh` - Renovar token JWT

### Super Admin
- `GET /super-admin/users` - Listar usuarios
- `PUT /super-admin/users/:email/reset-password` - Resetear contraseña
- `GET /super-admin/debug/check-user` - Diagnosticar usuario

### Planes y Suscripciones
- `GET /plans` - Listar planes disponibles
- `POST /subscription/upgrade` - Actualizar plan
- `GET /subscription/status` - Estado de suscripción

### Licencias
- `GET /licenses` - Listar licencias del usuario
- `POST /licenses/assign` - Asignar licencia

## 🧪 Testing

```bash
# Tests unitarios
npm run test

# Tests de integración
npm run test:integration

# Coverage
npm run test:coverage
```

## 🐛 Debugging

### Ver logs en tiempo real:
```bash
tail -f /tmp/sgi-api.log    # API logs
tail -f /tmp/sgi-web.log    # Frontend logs
```

### Endpoint de diagnostico:
```bash
curl http://localhost:3001/super-admin/debug/check-user?email=usuario@example.com
```

## 📦 Build para Producción

### API:
```bash
cd apps/api
npm run build
npm run start
```

### Frontend:
```bash
cd apps/web
npm run build
npm run start
```

## 🌍 Variables de Entorno

### apps/api/.env
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/db
JWT_SECRET=secret-key-seguro
JWT_EXPIRES_IN=7d
MERCADOPAGO_ACCESS_TOKEN=token
MERCADOPAGO_PUBLIC_KEY=key
NODE_ENV=development
PORT=3001
```

### apps/web/.env.local
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_MERCADOPAGO_KEY=key
NEXT_PUBLIC_APP_NAME=SGI 360
```

## 📝 Commits y Versionado

El proyecto usa Git para control de versiones. Antes de hacer commit:

```bash
# Ver cambios
git status
git diff

# Hacer commit
git add .
git commit -m "descriptive message"

# Push a GitHub
git push origin main
```

## 🤖 IA y ML

El proyecto incluye soporte para:
- OLLAMA: Para procesamiento local de lenguaje natural
- Auditoría inteligente: Análisis de patrones de uso
- Reportes asistidos: Generación automática de insights

Archivos relacionados: `/infra/ai/` y `/apps/api/src/lib/ai/`

## 📞 Documentación

Para más información consulta:
- `START_HERE.md` - Guía rápida de inicio
- `/infra/README.md` - Documentación de infraestructura

## 📜 Licencia

Este proyecto es propietario y confidencial.

---

**Última actualización**: Abril 2026
**Estado**: ✅ Producción Ready
