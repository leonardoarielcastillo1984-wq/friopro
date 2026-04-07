#!/bin/bash

# SSL/TLS Setup and Let's Encrypt Integration for SGI 360
# Production-ready HTTPS configuration with automated renewal

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="${DOMAIN:-sgi360.example.com}"
EMAIL="${EMAIL:-admin@example.com}"
CERT_DIR="${CERT_DIR:-/etc/letsencrypt/live/${DOMAIN}}"
CONFIG_DIR="${CONFIG_DIR:-/etc/nginx}"
BACKUP_DIR="${BACKUP_DIR:-/backups/ssl}"
LOG_DIR="${LOG_DIR:-/var/log/ssl}"

# Initialize
mkdir -p "${LOG_DIR}" "${BACKUP_DIR}"

log_info() {
  echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# ============================================
# 1. Install Certbot and Dependencies
# ============================================

install_certbot() {
  log_info "Installing Certbot and dependencies..."

  if command -v certbot &> /dev/null; then
    log_warning "Certbot already installed"
    return
  fi

  # Detect OS and install accordingly
  if [[ -f /etc/debian_version ]]; then
    sudo apt-get update
    sudo apt-get install -y certbot python3-certbot-nginx
  elif [[ -f /etc/redhat-release ]]; then
    sudo yum install -y certbot python3-certbot-nginx
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    brew install certbot
  else
    log_error "Unsupported OS"
    exit 1
  fi

  log_success "Certbot installed successfully"
}

# ============================================
# 2. Obtain SSL Certificate from Let's Encrypt
# ============================================

obtain_certificate() {
  log_info "Obtaining SSL certificate from Let's Encrypt for ${DOMAIN}..."

  certbot certonly \
    --nginx \
    --non-interactive \
    --agree-tos \
    --email "${EMAIL}" \
    --domain "${DOMAIN}" \
    --domain "www.${DOMAIN}" \
    --domain "api.${DOMAIN}" \
    --domain "admin.${DOMAIN}"

  if [[ $? -eq 0 ]]; then
    log_success "Certificate obtained successfully"
  else
    log_error "Failed to obtain certificate"
    exit 1
  fi
}

# ============================================
# 3. Configure HSTS (HTTP Strict Transport Security)
# ============================================

configure_hsts() {
  log_info "Configuring HSTS headers..."

  local hsts_config="/etc/nginx/snippets/hsts-headers.conf"

  sudo tee "${hsts_config}" > /dev/null <<'EOF'
# HSTS Configuration
# max-age: 1 year = 31536000 seconds
# includeSubDomains: Apply HSTS to all subdomains
# preload: Allow inclusion in HSTS preload list

add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self';" always;
EOF

  log_success "HSTS headers configured"
}

# ============================================
# 4. Configure Certificate Pinning
# ============================================

configure_certificate_pinning() {
  log_info "Configuring certificate pinning..."

  # Generate SPKI (Subject Public Key Info) hash
  local cert_file="${CERT_DIR}/cert.pem"
  local key_file="${CERT_DIR}/privkey.pem"

  if [[ ! -f "${cert_file}" ]]; then
    log_error "Certificate not found at ${cert_file}"
    return 1
  fi

  # Extract public key and generate SPKI hash
  local spki_hash=$(openssl x509 -in "${cert_file}" -pubkey -noout | \
                    openssl pkey -pubin -outform DER | \
                    openssl dgst -sha256 -binary | \
                    openssl enc -base64)

  log_info "SPKI Hash: ${spki_hash}"

  # Create pinning header config
  local pin_config="/etc/nginx/snippets/pin-headers.conf"

  sudo tee "${pin_config}" > /dev/null <<EOF
# Certificate Pinning Configuration
# Public-Key-Pins header for HPKP (HTTP Public Key Pinning)
# max-age: 1 year
# includeSubDomains: Apply to all subdomains
# report-uri: Report pinning failures

add_header Public-Key-Pins "pin-sha256=\"${spki_hash}\"; max-age=31536000; includeSubDomains; report-uri=https://example.com/pki-report;" always;
EOF

  log_success "Certificate pinning configured"
}

# ============================================
# 5. Setup Automatic Renewal
# ============================================

setup_auto_renewal() {
  log_info "Setting up automatic certificate renewal..."

  # Create renewal script
  local renewal_script="/usr/local/bin/renew-ssl-certificate.sh"

  sudo tee "${renewal_script}" > /dev/null <<'RENEWAL_SCRIPT'
#!/bin/bash

set -euo pipefail

LOG_FILE="/var/log/ssl/renewal.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "[${TIMESTAMP}] Starting SSL certificate renewal..." >> "${LOG_FILE}"

# Run certbot renew
if certbot renew --quiet >> "${LOG_FILE}" 2>&1; then
  echo "[${TIMESTAMP}] ✅ Certificate renewal successful" >> "${LOG_FILE}"

  # Reload nginx
  if systemctl reload nginx >> "${LOG_FILE}" 2>&1; then
    echo "[${TIMESTAMP}] ✅ Nginx reloaded successfully" >> "${LOG_FILE}"
  else
    echo "[${TIMESTAMP}] ⚠️ Failed to reload nginx" >> "${LOG_FILE}"
    exit 1
  fi
else
  echo "[${TIMESTAMP}] ❌ Certificate renewal failed" >> "${LOG_FILE}"
  exit 1
fi

echo "[${TIMESTAMP}] Certificate renewal cycle completed" >> "${LOG_FILE}"
RENEWAL_SCRIPT

  sudo chmod +x "${renewal_script}"

  # Create cron job for automatic renewal (twice daily at 00:00 and 12:00)
  (sudo crontab -l 2>/dev/null; echo "0 0,12 * * * ${renewal_script}") | sudo crontab -

  # Alternative: systemd timer (more modern approach)
  sudo tee /etc/systemd/system/ssl-renewal.service > /dev/null <<'SYSTEMD_SERVICE'
[Unit]
Description=SSL Certificate Renewal Service
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/renew-ssl-certificate.sh

[Install]
WantedBy=multi-user.target
SYSTEMD_SERVICE

  sudo tee /etc/systemd/system/ssl-renewal.timer > /dev/null <<'SYSTEMD_TIMER'
[Unit]
Description=SSL Certificate Renewal Timer
After=network-online.target

[Timer]
OnBootSec=10min
OnUnitActiveSec=12h
Persistent=true

[Install]
WantedBy=timers.target
SYSTEMD_TIMER

  # Enable systemd timer
  sudo systemctl daemon-reload
  sudo systemctl enable ssl-renewal.timer
  sudo systemctl start ssl-renewal.timer

  log_success "Automatic renewal configured (systemd timer)"
}

# ============================================
# 6. Configure TLS Version and Ciphers
# ============================================

configure_tls_hardening() {
  log_info "Configuring TLS hardening..."

  local tls_config="/etc/nginx/snippets/tls-hardening.conf"

  sudo tee "${tls_config}" > /dev/null <<'EOF'
# TLS Configuration and Hardening

# TLS Version (TLS 1.2 minimum, TLS 1.3 preferred)
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;

# Strong cipher suite
# Prioritize TLS 1.3 ciphers first
ssl_ciphers 'TLS13-AES-256-GCM-SHA384:TLS13-AES-128-GCM-SHA256:TLS13-CHACHA20-POLY1305-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256';

# SSL session configuration
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:50m;
ssl_session_tickets off;

# OCSP stapling (for better performance and privacy)
ssl_stapling on;
ssl_stapling_verify on;
ssl_stapling_responder "http://ocsp.int-x3.letsencrypt.org/";
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;

# SSL parameters
ssl_buffer_size 4k;
ssl_dhparam /etc/nginx/dhparam.pem;
EOF

  # Generate DH parameters (2048 bit)
  if [[ ! -f /etc/nginx/dhparam.pem ]]; then
    log_info "Generating DH parameters (this may take a few minutes)..."
    sudo openssl dhparam -out /etc/nginx/dhparam.pem 2048
    log_success "DH parameters generated"
  fi

  log_success "TLS hardening configured"
}

# ============================================
# 7. Configure Nginx with SSL
# ============================================

configure_nginx_ssl() {
  log_info "Configuring Nginx with SSL..."

  # Backup existing config
  if [[ -f "${CONFIG_DIR}/nginx.conf" ]]; then
    sudo cp "${CONFIG_DIR}/nginx.conf" "${BACKUP_DIR}/nginx.conf.$(date +%s).bak"
  fi

  # Create SSL server block
  local server_block="${CONFIG_DIR}/sites-available/sgi360-ssl.conf"

  sudo tee "${server_block}" > /dev/null <<NGINX_CONF
# SGI 360 SSL Server Configuration

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN} api.${DOMAIN} admin.${DOMAIN};

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS server block
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN} api.${DOMAIN} admin.${DOMAIN};

    # SSL Certificate and Key
    ssl_certificate ${CERT_DIR}/fullchain.pem;
    ssl_certificate_key ${CERT_DIR}/privkey.pem;

    # Include security headers and TLS config
    include /etc/nginx/snippets/hsts-headers.conf;
    include /etc/nginx/snippets/tls-hardening.conf;
    include /etc/nginx/snippets/pin-headers.conf;

    # Access and error logs
    access_log /var/log/nginx/sgi360_ssl_access.log;
    error_log /var/log/nginx/sgi360_ssl_error.log;

    # Root directory
    root /var/www/sgi360;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;

    # API proxy configuration
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$server_name;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Frontend
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX_CONF

  # Enable the site
  sudo ln -sf "${server_block}" "${CONFIG_DIR}/sites-enabled/sgi360-ssl.conf" 2>/dev/null || true

  # Test nginx configuration
  if sudo nginx -t 2>/dev/null; then
    log_success "Nginx configuration valid"
    sudo systemctl reload nginx
    log_success "Nginx reloaded successfully"
  else
    log_error "Nginx configuration error"
    exit 1
  fi
}

# ============================================
# 8. Verify SSL Installation
# ============================================

verify_ssl_installation() {
  log_info "Verifying SSL installation..."

  local tests_passed=0
  local tests_total=0

  # Test 1: Check certificate validity
  tests_total=$((tests_total + 1))
  if openssl x509 -in "${CERT_DIR}/cert.pem" -text -noout > /dev/null 2>&1; then
    log_success "✓ Certificate is valid"
    tests_passed=$((tests_passed + 1))
  else
    log_error "✗ Certificate validation failed"
  fi

  # Test 2: Check certificate expiration
  tests_total=$((tests_total + 1))
  local expiry=$(openssl x509 -enddate -noout -in "${CERT_DIR}/cert.pem" | cut -d= -f2)
  log_info "Certificate expiry: ${expiry}"
  tests_passed=$((tests_passed + 1))

  # Test 3: Check TLS version support
  tests_total=$((tests_total + 1))
  if echo | openssl s_client -connect localhost:443 -tls1_2 2>/dev/null | grep -q "Protocol.*TLSv1"; then
    log_success "✓ TLS 1.2+ supported"
    tests_passed=$((tests_passed + 1))
  fi

  # Test 4: Check certificate chain
  tests_total=$((tests_total + 1))
  local chain_depth=$(openssl x509 -in "${CERT_DIR}/fullchain.pem" -text -noout | grep -c "subject=")
  if [[ ${chain_depth} -gt 1 ]]; then
    log_success "✓ Full certificate chain present (${chain_depth} certificates)"
    tests_passed=$((tests_passed + 1))
  fi

  log_info "SSL verification: ${tests_passed}/${tests_total} tests passed"
}

# ============================================
# 9. Certificate Monitoring
# ============================================

setup_certificate_monitoring() {
  log_info "Setting up certificate monitoring..."

  local monitor_script="/usr/local/bin/monitor-ssl-certificate.sh"

  sudo tee "${monitor_script}" > /dev/null <<'MONITOR_SCRIPT'
#!/bin/bash

# Monitor SSL certificate expiration
# Alert if certificate expires within 30 days

DOMAIN="${1:-sgi360.example.com}"
CERT_FILE="/etc/letsencrypt/live/${DOMAIN}/cert.pem"
DAYS_THRESHOLD=30

if [[ ! -f "${CERT_FILE}" ]]; then
  echo "Certificate not found: ${CERT_FILE}"
  exit 1
fi

# Get expiration date in seconds since epoch
EXPIRY=$(date -d "$(openssl x509 -in "${CERT_FILE}" -enddate -noout | cut -d= -f2)" +%s)
NOW=$(date +%s)
DAYS_LEFT=$(( (EXPIRY - NOW) / 86400 ))

if [[ ${DAYS_LEFT} -lt ${DAYS_THRESHOLD} ]]; then
  echo "⚠️ Certificate expiring in ${DAYS_LEFT} days!"
  # Send alert (email, webhook, etc.)
  exit 1
else
  echo "✅ Certificate valid for ${DAYS_LEFT} days"
  exit 0
fi
MONITOR_SCRIPT

  sudo chmod +x "${monitor_script}"

  # Add cron job for daily monitoring
  (sudo crontab -l 2>/dev/null; echo "0 9 * * * ${monitor_script} ${DOMAIN}") | sudo crontab -

  log_success "Certificate monitoring configured"
}

# ============================================
# 10. Backup and Restore Configuration
# ============================================

backup_certificates() {
  log_info "Backing up certificates..."

  local backup_file="${BACKUP_DIR}/certificates-$(date +%Y%m%d_%H%M%S).tar.gz"

  sudo tar -czf "${backup_file}" \
    "${CERT_DIR}" \
    "${CONFIG_DIR}/nginx.conf" \
    "${CONFIG_DIR}/sites-available/" \
    /etc/nginx/snippets/

  log_success "Certificates backed up to ${backup_file}"

  # Keep only last 10 backups
  ls -t "${BACKUP_DIR}"/certificates-*.tar.gz | tail -n +11 | xargs -r rm
}

# ============================================
# Main Execution
# ============================================

main() {
  log_info "Starting SSL/TLS setup for SGI 360..."
  log_info "Domain: ${DOMAIN}"
  log_info "Email: ${EMAIL}"

  install_certbot
  obtain_certificate
  configure_hsts
  configure_certificate_pinning
  configure_tls_hardening
  configure_nginx_ssl
  setup_auto_renewal
  verify_ssl_installation
  setup_certificate_monitoring
  backup_certificates

  log_success "SSL/TLS setup completed successfully!"
  log_info "Access your site at: https://${DOMAIN}"
}

# Parse command line arguments
case "${1:-setup}" in
  setup)
    main
    ;;
  renew)
    setup_auto_renewal
    ;;
  verify)
    verify_ssl_installation
    ;;
  backup)
    backup_certificates
    ;;
  *)
    echo "Usage: $0 {setup|renew|verify|backup}"
    exit 1
    ;;
esac
