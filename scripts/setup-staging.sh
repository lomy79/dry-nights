#!/usr/bin/env bash
#
# setup-staging.sh — crea il progetto Supabase di STAGING e vi applica lo schema.
#
# Cosa fa:
#   1. crea un nuovo progetto Supabase (piano free) via Management API;
#   2. attende che il provisioning sia completato;
#   3. applica docs/schema.sql tramite l'endpoint query (lo stesso dell'SQL editor,
#      così non serve la connessione diretta al DB né gestire IPv4/IPv6);
#   4. stampa URL e chiave da incollare nel .env locale e nelle env "Preview" di Vercel.
#
# NESSUN segreto viene salvato su disco: token e password si passano via variabili
# d'ambiente e restano solo nella memoria del processo.
#
# Uso:
#   export SUPABASE_ACCESS_TOKEN=sbp_...        # Account -> Access Tokens (obbligatorio)
#   export SUPABASE_ORG_ID=xxxxxxxx             # Management API: GET /v1/organizations (obbligatorio)
#   export SUPABASE_REGION=eu-central-1         # opzionale (default: eu-central-1, Francoforte)
#   export STAGING_PROJECT_NAME=dry-nights-staging   # opzionale
#   export DB_PASS='...'                        # opzionale: se assente ne genera una sicura
#   ./scripts/setup-staging.sh
#
set -euo pipefail

# ---- posizione: esegui sempre dalla root del progetto ------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SCHEMA_FILE="$ROOT_DIR/docs/schema.sql"

# Carica le credenziali da .env.scripts se presente (non committato).
if [ -f "$ROOT_DIR/.env.scripts" ]; then
  set -a; . "$ROOT_DIR/.env.scripts"; set +a
fi

API="https://api.supabase.com/v1"
REGION="${SUPABASE_REGION:-eu-central-1}"
PROJECT_NAME="${STAGING_PROJECT_NAME:-dry-nights-staging}"
PLAN="free"

# ---- controlli preliminari ---------------------------------------------------
for cmd in curl jq; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "❌ Manca '$cmd'. Installalo e riprova." >&2; exit 1; }
done
: "${SUPABASE_ACCESS_TOKEN:?❌ Serve SUPABASE_ACCESS_TOKEN (Account -> Access Tokens)}"
: "${SUPABASE_ORG_ID:?❌ Serve SUPABASE_ORG_ID (GET ${API}/organizations)}"
[ -f "$SCHEMA_FILE" ] || { echo "❌ Schema non trovato: $SCHEMA_FILE" >&2; exit 1; }

# password del DB: usa quella fornita o generane una robusta
DB_PASS="${DB_PASS:-$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)}"

auth=(-H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}")

# ---- 1) crea il progetto -----------------------------------------------------
echo "▶ Creo il progetto \"$PROJECT_NAME\" (region: $REGION, piano: $PLAN)…"
create_body="$(jq -n \
  --arg name "$PROJECT_NAME" \
  --arg org  "$SUPABASE_ORG_ID" \
  --arg region "$REGION" \
  --arg pass "$DB_PASS" \
  --arg plan "$PLAN" \
  '{name:$name, organization_id:$org, region:$region, db_pass:$pass, plan:$plan}')"

create_resp="$(curl -fsS "${auth[@]}" -H "Content-Type: application/json" \
  -X POST "$API/projects" -d "$create_body")" || {
    echo "❌ Creazione fallita. Controlla token, org_id e il limite di 2 progetti del piano free." >&2
    exit 1
  }

REF="$(echo "$create_resp" | jq -r '.id')"
[ -n "$REF" ] && [ "$REF" != "null" ] || { echo "❌ Risposta inattesa: $create_resp" >&2; exit 1; }
echo "  ✓ Progetto creato. Ref: $REF"

# ---- 2) attendi il provisioning ---------------------------------------------
echo "▶ Attendo che il progetto sia ACTIVE_HEALTHY (può richiedere qualche minuto)…"
for i in $(seq 1 60); do
  status="$(curl -fsS "${auth[@]}" "$API/projects/$REF" | jq -r '.status')"
  echo "  … stato: $status"
  [ "$status" = "ACTIVE_HEALTHY" ] && break
  [ "$i" -eq 60 ] && { echo "❌ Timeout: il progetto non è diventato attivo in tempo." >&2; exit 1; }
  sleep 10
done
echo "  ✓ Progetto attivo."

# ---- 3) applica lo schema ----------------------------------------------------
echo "▶ Applico docs/schema.sql…"
query_body="$(jq -Rs '{query: .}' < "$SCHEMA_FILE")"
apply_resp="$(curl -fsS "${auth[@]}" -H "Content-Type: application/json" \
  -X POST "$API/projects/$REF/database/query" -d "$query_body")" || {
    echo "❌ Applicazione dello schema fallita. Risposta: ${apply_resp:-<vuota>}" >&2
    echo "   In alternativa incolla docs/schema.sql nell'SQL editor del progetto." >&2
    exit 1
  }
echo "  ✓ Schema applicato."

# ---- 3b) configura l'Auth (magic link + redirect URL) -----------------------
echo "▶ Configuro l'Auth di staging (magic link, redirect locale + preview Vercel)…"
PROJECT_REF="$REF" \
SITE_URL="${STAGING_SITE_URL:-http://localhost:5173}" \
REDIRECT_URLS="${STAGING_REDIRECT_URLS:-http://localhost:5173,https://*-lomy79.vercel.app}" \
  "$SCRIPT_DIR/configure-auth.sh"

# ---- 4) recupera le chiavi e stampa il riepilogo ----------------------------
echo "▶ Recupero le chiavi API…"
keys_json="$(curl -fsS "${auth[@]}" "$API/projects/$REF/api-keys")"
# preferisci la publishable (sb_publishable_...); in fallback usa la anon legacy
PUB_KEY="$(echo "$keys_json" | jq -r '
  (.[] | select(.api_key | startswith("sb_publishable_")) | .api_key) //
  (.[] | select(.name == "anon") | .api_key) // empty' | head -n1)"

PROJECT_URL="https://${REF}.supabase.co"

cat <<EOF

============================================================
✅ Staging pronto: $PROJECT_NAME
============================================================

Incolla questi valori nel tuo .env LOCALE (punta a staging) e
nelle Environment Variables "Preview" del progetto Vercel:

  VITE_SUPABASE_URL=$PROJECT_URL
  VITE_SUPABASE_PUBLISHABLE_KEY=${PUB_KEY:-<recuperala dalla dashboard: Project Settings -> API>}

Password del database (SALVALA in un password manager, non è recuperabile):

  DB password: $DB_PASS

Auth GIÀ configurata (magic link, Site URL http://localhost:5173, redirect verso
localhost e i preview *-lomy79.vercel.app). Se il tuo pattern preview di Vercel è
diverso, rilancia scripts/configure-auth.sh con REDIRECT_URLS aggiornato.

Prossimi passi:
  • Configura anche la PRODUZIONE:
      PROJECT_REF=<ref-prod> SITE_URL=https://<dominio-prod> \
      REDIRECT_URLS='https://<dominio-prod>' ./scripts/configure-auth.sh
  • Per email affidabili (magic link reale) imposta un SMTP tuo: vedi le variabili
    SMTP_* in scripts/configure-auth.sh.
  • Non committare mai questi valori: il .env è già in .gitignore.
============================================================
EOF
