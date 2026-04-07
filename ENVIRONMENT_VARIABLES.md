# Environment Variables Documentation

Complete reference for all environment variables used in SGI 360 application.

## Table of Contents

1. [Application Environment](#application-environment)
2. [Database Configuration](#database-configuration)
3. [Redis Configuration](#redis-configuration)
4. [JWT & Authentication](#jwt--authentication)
5. [API Configuration](#api-configuration)
6. [Frontend Configuration](#frontend-configuration)
7. [Email Configuration](#email-configuration)
8. [AWS S3 Configuration](#aws-s3-configuration)
9. [2FA Configuration](#2fa-configuration)
10. [Logging & Monitoring](#logging--monitoring)
11. [Docker Registry](#docker-registry)

## Application Environment

### NODE_ENV
- **Type**: `string`
- **Values**: `development`, `staging`, `production`
- **Default**: `development`
- **Description**: Application environment mode that affects logging, caching, and optimization
- **Example**: `NODE_ENV=production`

### LOG_LEVEL
- **Type**: `string`
- **Values**: `debug`, `info`, `warn`, `error`
- **Default**: `info`
- **Description**: Minimum severity level for logs to output
- **Example**: `LOG_LEVEL=debug`

### LOG_FORMAT
- **Type**: `string`
- **Values**: `json`, `text`
- **Default**: `json`
- **Description**: Format of log output
- **Example**: `LOG_FORMAT=json`

---

## Database Configuration

### DATABASE_URL
- **Type**: `string` (PostgreSQL connection string)
- **Format**: `postgresql://[user[:password]@][host][:port][/database][?params]`
- **Required**: Yes (for api service)
- **Description**: Full PostgreSQL connection string for primary database
- **Example**: `postgresql://sgi:password@postgres:5432/sgi_prod`

### DB_USER
- **Type**: `string`
- **Required**: Yes
- **Description**: PostgreSQL username
- **Example**: `DB_USER=sgi`

### DB_PASSWORD
- **Type**: `string`
- **Required**: Yes
- **Security**: Must be strong password in production
- **Description**: PostgreSQL password
- **Example**: `DB_PASSWORD=secure-password-123`

### DB_NAME
- **Type**: `string`
- **Default**: `sgi_prod` (production), `sgi_staging` (staging)
- **Description**: Database name to create/use
- **Example**: `DB_NAME=sgi_prod`

### DB_PORT
- **Type**: `number`
- **Default**: `5432`
- **Description**: PostgreSQL server port
- **Example**: `DB_PORT=5432`

### DB_HOST
- **Type**: `string`
- **Default**: `postgres` (Docker), `localhost` (local)
- **Description**: PostgreSQL server hostname or IP
- **Example**: `DB_HOST=postgres`

---

## Redis Configuration

### REDIS_URL
- **Type**: `string` (Redis connection string)
- **Format**: `redis://[:password@]host[:port][/db]`
- **Required**: Yes (for api service)
- **Description**: Redis connection string for caching and sessions
- **Example**: `REDIS_URL=redis://:password@redis:6379`

### REDIS_PASSWORD
- **Type**: `string`
- **Required**: Yes
- **Security**: Must be strong in production
- **Description**: Redis server password
- **Example**: `REDIS_PASSWORD=redis-secure-password`

### REDIS_PORT
- **Type**: `number`
- **Default**: `6379`
- **Description**: Redis server port
- **Example**: `REDIS_PORT=6379`

### REDIS_HOST
- **Type**: `string`
- **Default**: `redis` (Docker), `localhost` (local)
- **Description**: Redis server hostname
- **Example**: `REDIS_HOST=redis`

---

## JWT & Authentication

### JWT_SECRET
- **Type**: `string`
- **Required**: Yes
- **Minimum Length**: 32 characters
- **Security**: Must be cryptographically random
- **Description**: Secret key for signing JWT tokens
- **Generation**: `openssl rand -base64 32`
- **Example**: `JWT_SECRET=your-secret-key-here-min-32-chars-long`

### JWT_EXPIRY
- **Type**: `string` (duration)
- **Default**: `24h`
- **Values**: `30m`, `1h`, `24h`, `7d`, etc.
- **Description**: How long JWT tokens remain valid
- **Example**: `JWT_EXPIRY=24h`

### JWT_REFRESH_EXPIRY
- **Type**: `string` (duration)
- **Default**: `7d`
- **Description**: How long refresh tokens remain valid
- **Example**: `JWT_REFRESH_EXPIRY=7d`

### JWT_ALGORITHM
- **Type**: `string`
- **Default**: `HS256`
- **Values**: `HS256`, `HS384`, `HS512`, `RS256`
- **Description**: Algorithm used for JWT signing
- **Example**: `JWT_ALGORITHM=HS256`

---

## API Configuration

### API_URL
- **Type**: `string` (Full URL)
- **Required**: Yes
- **Description**: Public URL where API is accessible
- **Used By**: CORS configuration, frontend requests
- **Example**: `API_URL=https://api.sgi360.com`

### API_PORT
- **Type**: `number`
- **Default**: `3001`
- **Description**: Port number for API server
- **Example**: `API_PORT=3001`

### API_HOST
- **Type**: `string`
- **Default**: `0.0.0.0` (all interfaces)
- **Description**: Host address to bind API server
- **Example**: `API_HOST=0.0.0.0`

### CORS_ORIGIN
- **Type**: `string` (comma-separated URLs or regex)
- **Default**: Derived from FRONTEND_URL
- **Description**: Allowed origins for CORS
- **Example**: `CORS_ORIGIN=http://localhost:3000,https://app.sgi360.com`

---

## Frontend Configuration

### FRONTEND_URL
- **Type**: `string` (Full URL)
- **Required**: Yes
- **Description**: Public URL where frontend is accessible
- **Used By**: API CORS configuration
- **Example**: `FRONTEND_URL=https://sgi360.com`

### NEXT_PUBLIC_API_URL
- **Type**: `string` (Full URL)
- **Required**: Yes
- **Description**: API endpoint used by frontend
- **Note**: NEXT_PUBLIC_ prefix makes it available in browser
- **Example**: `NEXT_PUBLIC_API_URL=https://api.sgi360.com`

### FRONTEND_API_URL
- **Type**: `string` (Docker internal URL)
- **Description**: Internal API URL for Docker services
- **Example**: `FRONTEND_API_URL=http://api:3001`

### WEB_PORT
- **Type**: `number`
- **Default**: `3000`
- **Description**: Port for Next.js server
- **Example**: `WEB_PORT=3000`

### NEXT_TELEMETRY_DISABLED
- **Type**: `boolean`
- **Default**: `1` (disabled)
- **Description**: Disable Next.js telemetry collection
- **Example**: `NEXT_TELEMETRY_DISABLED=1`

---

## Email Configuration

### SMTP_HOST
- **Type**: `string`
- **Required**: Yes
- **Description**: SMTP server hostname
- **Examples**:
  - Gmail: `smtp.gmail.com`
  - SendGrid: `smtp.sendgrid.net`
  - Resend: `smtp.resend.com`
- **Example**: `SMTP_HOST=smtp.gmail.com`

### SMTP_PORT
- **Type**: `number`
- **Default**: `587` (TLS) or `465` (SSL)
- **Description**: SMTP server port
- **Example**: `SMTP_PORT=587`

### SMTP_USER
- **Type**: `string`
- **Required**: Yes
- **Description**: SMTP authentication username/email
- **Example**: `SMTP_USER=noreply@sgi360.com`

### SMTP_PASSWORD
- **Type**: `string`
- **Required**: Yes
- **Security**: Treat as sensitive credential
- **Description**: SMTP authentication password/API key
- **Example**: `SMTP_PASSWORD=your-app-password`

### SMTP_FROM
- **Type**: `string` (Email address)
- **Required**: Yes
- **Description**: "From" email address for outgoing emails
- **Example**: `SMTP_FROM=noreply@sgi360.com`

### SMTP_FROM_NAME
- **Type**: `string`
- **Default**: `SGI 360`
- **Description**: "From" display name for emails
- **Example**: `SMTP_FROM_NAME=SGI 360 System`

### SMTP_TLS
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Use TLS encryption for SMTP
- **Example**: `SMTP_TLS=true`

---

## AWS S3 Configuration

### AWS_REGION
- **Type**: `string`
- **Default**: `us-east-1`
- **Description**: AWS region for S3 and other services
- **Common Values**: `us-east-1`, `us-west-2`, `eu-west-1`
- **Example**: `AWS_REGION=us-east-1`

### AWS_ACCESS_KEY_ID
- **Type**: `string`
- **Required**: Yes (for file uploads)
- **Security**: Treat as sensitive credential
- **Description**: AWS IAM access key
- **Example**: `AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE`

### AWS_SECRET_ACCESS_KEY
- **Type**: `string`
- **Required**: Yes (for file uploads)
- **Security**: Treat as sensitive credential
- **Description**: AWS IAM secret access key
- **Example**: `AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`

### S3_BUCKET
- **Type**: `string`
- **Required**: Yes (for file uploads)
- **Description**: S3 bucket name for file uploads
- **Example**: `S3_BUCKET=sgi-360-uploads-prod`

### S3_REGION
- **Type**: `string`
- **Default**: Derives from AWS_REGION
- **Description**: Specific S3 region (usually matches AWS_REGION)
- **Example**: `S3_REGION=us-east-1`

### FILE_UPLOAD_LIMIT
- **Type**: `string` (size)
- **Default**: `50MB`
- **Description**: Maximum file upload size
- **Example**: `FILE_UPLOAD_LIMIT=50MB`

---

## 2FA Configuration

### TWO_FA_ISSUER
- **Type**: `string`
- **Default**: `SGI360`
- **Description**: Issuer name displayed in authenticator apps
- **Example**: `TWO_FA_ISSUER=SGI360`

### TWO_FA_WINDOW_SIZE
- **Type**: `number`
- **Default**: `1`
- **Range**: `0-2` (typically)
- **Description**: Time window for TOTP validation (in 30-second intervals)
  - 0 = only current time window
  - 1 = current + previous and next windows
- **Example**: `TWO_FA_WINDOW_SIZE=1`

### TWO_FA_BACKUP_CODES_COUNT
- **Type**: `number`
- **Default**: `10`
- **Range**: `5-20`
- **Description**: Number of backup codes to generate
- **Example**: `TWO_FA_BACKUP_CODES_COUNT=10`

### TWO_FA_MAX_ATTEMPTS
- **Type**: `number`
- **Default**: `5`
- **Description**: Maximum failed 2FA attempts before lockout
- **Example**: `TWO_FA_MAX_ATTEMPTS=5`

### TWO_FA_LOCKOUT_DURATION
- **Type**: `string` (duration)
- **Default**: `15m`
- **Description**: Duration of account lockout after max attempts
- **Example**: `TWO_FA_LOCKOUT_DURATION=15m`

---

## Logging & Monitoring

### SENTRY_DSN
- **Type**: `string` (URL)
- **Required**: Optional
- **Description**: Sentry error tracking DSN for production error monitoring
- **Example**: `SENTRY_DSN=https://key@sentry.io/project-id`

### DATADOG_API_KEY
- **Type**: `string`
- **Required**: Optional
- **Description**: Datadog API key for monitoring and metrics
- **Example**: `DATADOG_API_KEY=your-datadog-api-key`

### SLACK_WEBHOOK
- **Type**: `string` (URL)
- **Required**: Optional
- **Description**: Slack webhook URL for notifications
- **Example**: `SLACK_WEBHOOK=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX`

### SLACK_CHANNEL
- **Type**: `string`
- **Default**: `#deployments`
- **Description**: Slack channel for notifications
- **Example**: `SLACK_CHANNEL=#deployments`

---

## Docker Registry

### DOCKER_REGISTRY
- **Type**: `string` (Registry URL)
- **Description**: Docker registry hostname
- **Examples**:
  - Docker Hub: `docker.io`
  - Azure: `myregistry.azurecr.io`
  - AWS ECR: `123456789012.dkr.ecr.us-east-1.amazonaws.com`
- **Example**: `DOCKER_REGISTRY=myregistry.azurecr.io`

### DOCKER_USERNAME
- **Type**: `string`
- **Required**: Yes (for registry authentication)
- **Security**: Treat as sensitive credential
- **Description**: Registry authentication username
- **Example**: `DOCKER_USERNAME=myusername`

### DOCKER_PASSWORD
- **Type**: `string`
- **Required**: Yes (for registry authentication)
- **Security**: Treat as sensitive credential
- **Description**: Registry authentication password/token
- **Example**: `DOCKER_PASSWORD=mytoken`

### API_TAG
- **Type**: `string`
- **Default**: `latest`
- **Description**: Docker tag for API image
- **Example**: `API_TAG=v1.0.0`

### WEB_TAG
- **Type**: `string`
- **Default**: `latest`
- **Description**: Docker tag for frontend image
- **Example**: `WEB_TAG=v1.0.0`

---

## Environment Configuration Examples

### Development (.env.development)
```bash
NODE_ENV=development
LOG_LEVEL=debug
DATABASE_URL=postgresql://sgi:sgi@localhost:5432/sgi_dev
REDIS_URL=redis://:redis@localhost:6379
JWT_SECRET=dev-secret-key-min-32-characters-long
API_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Staging (.env.staging)
```bash
NODE_ENV=staging
LOG_LEVEL=debug
DATABASE_URL=postgresql://sgi_staging:password@staging-db.example.com:5432/sgi_staging
REDIS_URL=redis://:password@staging-redis.example.com:6379
JWT_SECRET=staging-secret-key-min-32-characters-long
API_URL=https://staging-api.sgi360.com
NEXT_PUBLIC_API_URL=https://staging-api.sgi360.com
```

### Production (.env.production)
```bash
NODE_ENV=production
LOG_LEVEL=info
DATABASE_URL=postgresql://sgi_prod:secure-password@prod-db.example.com:5432/sgi_prod
REDIS_URL=redis://:secure-password@prod-redis.example.com:6379
JWT_SECRET=production-secret-key-min-32-characters-long
API_URL=https://api.sgi360.com
NEXT_PUBLIC_API_URL=https://api.sgi360.com
```

---

## Security Best Practices

1. **Never commit .env files**: Add to `.gitignore`
2. **Use strong secrets**: Minimum 32 characters for JWT_SECRET
3. **Rotate secrets regularly**: Especially in production
4. **Use environment-specific values**: Different secrets per environment
5. **Encrypt sensitive variables**: In CI/CD systems
6. **Audit access**: Log who accesses secrets
7. **Use IAM roles**: Instead of long-lived credentials when possible

## Validation Rules

All environment variables are validated on application startup. Missing or invalid values will cause the application to fail with clear error messages.

Run validation without starting:
```bash
npm run validate:env
```

## Variable Precedence

Variables are loaded in this order (later overrides earlier):
1. System environment variables
2. `.env` file (auto-detected based on NODE_ENV)
3. Command-line arguments

---

For more information, see:
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Security Guidelines](./SECURITY_GUIDELINES.md)
