#!/bin/bash
IP=$(docker inspect -f "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}" sgi-api)
API="http://$IP:3002"
PW="TestAisl99x"
FAIL=0; OKC=0

ok()   { echo "  OK   $1"; OKC=$((OKC+1)); }
fail() { echo "  FAIL $1"; FAIL=$((FAIL+1)); }
check(){ local l="$1" e="$2" a="$3"; [ "$a" = "$e" ] && ok "$l (HTTP $a)" || fail "$l — esperado $e, obtenido $a"; }
jq_tok(){ python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get(\"token\",\"\"))" 2>/dev/null; }

echo
echo "========================================"
echo "  VALIDACION AISLAMIENTO MULTI-MODULO"
echo "========================================"

# ── SETUP ─────────────────────────────────────────────────────────────────
echo
echo "[ SETUP ] Creando usuarios de prueba..."
F_RES=$(curl -s -X POST "$API/flota360/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"companyName\":\"FlotaAisl\",\"name\":\"Flota User\",\"email\":\"aislf@test.com\",\"password\":\"$PW\"}")
F_TOKEN=$(echo "$F_RES" | jq_tok)
[ -n "$F_TOKEN" ] && ok "Signup FLOTA360" || fail "Signup FLOTA360: $F_RES"

S_RES=$(curl -s -X POST "$API/siniestros360/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"companyName\":\"SiniAisl\",\"name\":\"Sini User\",\"email\":\"aisls@test.com\",\"password\":\"$PW\"}")
S_TOKEN=$(echo "$S_RES" | jq_tok)
[ -n "$S_TOKEN" ] && ok "Signup SINIESTROS360" || fail "Signup SINIESTROS360: $S_RES"

P_RES=$(curl -s -X POST "$API/project360/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"companyName\":\"ProjAisl\",\"name\":\"Proj User\",\"email\":\"aislp@test.com\",\"password\":\"$PW\"}")
P_TOKEN=$(echo "$P_RES" | jq_tok)
[ -n "$P_TOKEN" ] && ok "Signup PROJECT360" || fail "Signup PROJECT360: $P_RES"

echo "  TOKEN_FLOTA_LEN=${#F_TOKEN}  TOKEN_SINI_LEN=${#S_TOKEN}  TOKEN_PROJ_LEN=${#P_TOKEN}"

# ── CASO A: login correcto ────────────────────────────────────────────────
echo
echo "[ CASO A ] Login correcto en modulo propio"
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/flota360/auth/login" \
  -H "Content-Type: application/json" -d "{\"email\":\"aislf@test.com\",\"password\":\"$PW\"}")
check "FLOTA360 login propio" 200 "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/siniestros360/auth/login" \
  -H "Content-Type: application/json" -d "{\"email\":\"aisls@test.com\",\"password\":\"$PW\"}")
check "SINIESTROS360 login propio" 200 "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/project360/auth/login" \
  -H "Content-Type: application/json" -d "{\"email\":\"aislp@test.com\",\"password\":\"$PW\"}")
check "PROJECT360 login propio" 200 "$c"

# ── CASO B: /me con token correcto ────────────────────────────────────────
echo
echo "[ CASO B ] /me con token correcto"
c=$(curl -s -o /dev/null -w "%{http_code}" "$API/flota360/auth/me" \
  -H "Authorization: Bearer $F_TOKEN")
check "FLOTA360 /me token correcto" 200 "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" "$API/siniestros360/auth/me" \
  -H "Authorization: Bearer $S_TOKEN")
check "SINIESTROS360 /me token correcto" 200 "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" "$API/project360/auth/me" \
  -H "Authorization: Bearer $P_TOKEN")
check "PROJECT360 /me token correcto" 200 "$c"

# ── CASO C: login cruzado debe fallar ─────────────────────────────────────
echo
echo "[ CASO C ] Login cruzado debe fallar (email modulo X en modulo Y)"
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/siniestros360/auth/login" \
  -H "Content-Type: application/json" -d "{\"email\":\"aislf@test.com\",\"password\":\"$PW\"}")
check "Email FLOTA en SINIESTROS360 (401)" 401 "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/flota360/auth/login" \
  -H "Content-Type: application/json" -d "{\"email\":\"aisls@test.com\",\"password\":\"$PW\"}")
check "Email SINIESTROS en FLOTA360 (401)" 401 "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/project360/auth/login" \
  -H "Content-Type: application/json" -d "{\"email\":\"aislf@test.com\",\"password\":\"$PW\"}")
check "Email FLOTA en PROJECT360 (401)" 401 "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/flota360/auth/login" \
  -H "Content-Type: application/json" -d "{\"email\":\"aislp@test.com\",\"password\":\"$PW\"}")
check "Email PROJECT en FLOTA360 (401)" 401 "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/siniestros360/auth/login" \
  -H "Content-Type: application/json" -d "{\"email\":\"aislp@test.com\",\"password\":\"$PW\"}")
check "Email PROJECT en SINIESTROS360 (401)" 401 "$c"

# ── CASO D: token cruzado en /me debe fallar ──────────────────────────────
echo
echo "[ CASO D ] Token cruzado en /me debe fallar"
c=$(curl -s -o /dev/null -w "%{http_code}" "$API/siniestros360/auth/me" \
  -H "Authorization: Bearer $F_TOKEN")
check "Token FLOTA en SINIESTROS360 /me (401)" 401 "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" "$API/flota360/auth/me" \
  -H "Authorization: Bearer $S_TOKEN")
check "Token SINIESTROS en FLOTA360 /me (401)" 401 "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" "$API/project360/auth/me" \
  -H "Authorization: Bearer $F_TOKEN")
check "Token FLOTA en PROJECT360 /me (401)" 401 "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" "$API/flota360/auth/me" \
  -H "Authorization: Bearer $P_TOKEN")
check "Token PROJECT en FLOTA360 /me (401)" 401 "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" "$API/siniestros360/auth/me" \
  -H "Authorization: Bearer $P_TOKEN")
check "Token PROJECT en SINIESTROS360 /me (401)" 401 "$c"

# ── CASO E: sin token = 401 ───────────────────────────────────────────────
echo
echo "[ CASO E ] Sin token = 401"
c=$(curl -s -o /dev/null -w "%{http_code}" "$API/flota360/auth/me")
check "FLOTA360 /me sin token (401)" 401 "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" "$API/siniestros360/auth/me")
check "SINIESTROS360 /me sin token (401)" 401 "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" "$API/project360/auth/me")
check "PROJECT360 /me sin token (401)" 401 "$c"

# ── CASO F: password incorrecta ───────────────────────────────────────────
echo
echo "[ CASO F ] Password incorrecta = 401 (o 400 si valida longitud)"
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/flota360/auth/login" \
  -H "Content-Type: application/json" -d "{\"email\":\"aislf@test.com\",\"password\":\"incorrectaAAA\"}")
[ "$c" = "401" ] || [ "$c" = "400" ] && ok "FLOTA360 password incorrecta rechazada ($c)" || fail "FLOTA360 password incorrecta (esperado 401/400, obtenido $c)"
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/siniestros360/auth/login" \
  -H "Content-Type: application/json" -d "{\"email\":\"aisls@test.com\",\"password\":\"incorrectaAAA\"}")
check "SINIESTROS360 password incorrecta (401)" 401 "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/project360/auth/login" \
  -H "Content-Type: application/json" -d "{\"email\":\"aislp@test.com\",\"password\":\"incorrectaAAA\"}")
check "PROJECT360 password incorrecta (401)" 401 "$c"

# ── CLEANUP ───────────────────────────────────────────────────────────────
echo
echo "[ CLEANUP ]"
docker exec sgi-postgres psql -U sgi -d sgi -q -c "
  DELETE FROM flota360_password_resets WHERE email IN ('aislf@test.com','aisls@test.com','aislp@test.com');
  DELETE FROM flota360_users WHERE email='aislf@test.com';
  DELETE FROM siniestro360_users WHERE email='aisls@test.com';
  DELETE FROM p360_password_resets WHERE email='aislp@test.com';
  DELETE FROM p360_users WHERE email='aislp@test.com';
  DELETE FROM p360_workspaces WHERE \"tenantId\" IN (SELECT id FROM \"Tenant\" WHERE slug LIKE 'p360-projaisl%');
  DELETE FROM \"Tenant\" WHERE slug LIKE 'p360-projaisl%' OR slug LIKE 'flotaaisl%' OR slug LIKE 'siniaisl%';
" 2>/dev/null && ok "Cleanup OK" || echo "  WARN cleanup parcial"

# ── RESULTADO ─────────────────────────────────────────────────────────────
echo
echo "========================================"
printf "  RESULTADO: OK=%-3s  FAIL=%s\n" "$OKC" "$FAIL"
echo "========================================"
if [ "$FAIL" -eq 0 ]; then
  echo "  AISLAMIENTO COMPLETO - todos los modulos son independientes"
else
  echo "  HAY FALLOS - ver arriba"
fi
echo
