#!/usr/bin/env bash
#
# configure-auth.sh — configura Supabase Auth di UN progetto (prod o staging):
# magic link via email, Site URL e redirect URL ammessi (uri_allow_list).
#
# È riutilizzabile: lancialo una volta per il progetto di produzione e una per
# quello di staging, cambiando PROJECT_REF, SITE_URL e REDIRECT_URLS.
#
# L'app fa login con MAGIC LINK e reindirizza a `window.location.origin`: quel-
# l'origin DEVE comparire in REDIRECT_URLS, altrimenti il link ricade sul Site URL.
#
# Uso (esempio produzione):
#   export SUPABASE_ACCESS_TOKEN=sbp_...
#   PROJECT_REF=abcd1234 \
#   SITE_URL=https://dry-nights.vercel.app \
#   REDIRECT_URLS='https://dry-nights.vercel.app' \
#   ./scripts/configure-auth.sh
#
# Uso (esempio staging: locale + preview di Vercel):
#   PROJECT_REF=efgh5678 \
#   SITE_URL=http://localhost:5173 \
#   REDIRECT_URLS='http://localhost:5173,https://*-lomy79.vercel.app' \
#   ./scripts/configure-auth.sh
#
# SMTP custom (opzionale ma consigliato in produzione — vedi nota in fondo):
#   SMTP_HOST=... SMTP_PORT=587 SMTP_USER=... SMTP_PASS=... \
#   SMTP_ADMIN_EMAIL=no-reply@tuodominio.it SMTP_SENDER_NAME='Notti serene' \
#   ...gli altri parametri... ./scripts/configure-auth.sh
#
set -euo pipefail

API="https://api.supabase.com/v1"

command -v curl >/dev/null 2>&1 || { echo "❌ Manca 'curl'." >&2; exit 1; }
command -v jq   >/dev/null 2>&1 || { echo "❌ Manca 'jq'." >&2; exit 1; }

: "${SUPABASE_ACCESS_TOKEN:?❌ Serve SUPABASE_ACCESS_TOKEN}"
: "${PROJECT_REF:?❌ Serve PROJECT_REF (il ref del progetto da configurare)}"
: "${SITE_URL:?❌ Serve SITE_URL (es. https://dry-nights.vercel.app o http://localhost:5173)}"
: "${REDIRECT_URLS:?❌ Serve REDIRECT_URLS (lista separata da virgole per uri_allow_list)}"

DISABLE_SIGNUP="${AUTH_DISABLE_SIGNUP:-false}"   # true = solo utenti già esistenti possono entrare
OTP_EXP="${MAGICLINK_EXP:-3600}"                 # scadenza del magic link in secondi (1h)
auth=(-H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}")

# ---- costruisci il body ------------------------------------------------------
body="$(jq -n \
  --arg site "$SITE_URL" \
  --arg allow "$REDIRECT_URLS" \
  --argjson disable "$DISABLE_SIGNUP" \
  --argjson otp "$OTP_EXP" \
  '{
     site_url: $site,
     uri_allow_list: $allow,
     external_email_enabled: true,
     disable_signup: $disable,
     mailer_otp_exp: $otp
   }')"

# SMTP custom: incluso solo se SMTP_HOST è impostato
if [ -n "${SMTP_HOST:-}" ]; then
  : "${SMTP_PORT:?❌ Con SMTP_HOST serve anche SMTP_PORT}"
  : "${SMTP_USER:?❌ Con SMTP_HOST serve anche SMTP_USER}"
  : "${SMTP_PASS:?❌ Con SMTP_HOST serve anche SMTP_PASS}"
  : "${SMTP_ADMIN_EMAIL:?❌ Con SMTP_HOST serve anche SMTP_ADMIN_EMAIL}"
  body="$(echo "$body" | jq \
    --arg h "$SMTP_HOST" --arg p "$SMTP_PORT" --arg u "$SMTP_USER" \
    --arg pass "$SMTP_PASS" --arg admin "$SMTP_ADMIN_EMAIL" \
    --arg sender "${SMTP_SENDER_NAME:-Notti serene}" \
    '. + {smtp_host:$h, smtp_port:$p, smtp_user:$u, smtp_pass:$pass,
          smtp_admin_email:$admin, smtp_sender_name:$sender}')"
  echo "▶ Includo la configurazione SMTP custom ($SMTP_HOST)."
else
  echo "⚠ Nessun SMTP custom: uso il mailer integrato di Supabase (rate limit stretto,"
  echo "  adatto solo ai test — vedi nota in fondo allo script)."
fi

# ---- applica ----------------------------------------------------------------
echo "▶ Configuro l'Auth del progetto $PROJECT_REF…"
echo "  • Site URL:      $SITE_URL"
echo "  • Redirect URLs: $REDIRECT_URLS"
echo "  • Registrazioni: $([ "$DISABLE_SIGNUP" = "true" ] && echo 'BLOCCATE' || echo 'aperte')"

curl -fsS "${auth[@]}" -H "Content-Type: application/json" \
  -X PATCH "$API/projects/$PROJECT_REF/config/auth" -d "$body" >/dev/null

echo "✓ Auth configurata."

# ---- NOTA SUL MAILER --------------------------------------------------------
# Il servizio email integrato di Supabase è pensato SOLO per i test: poche email
# all'ora e alta probabilità di finire in spam. Per un uso reale del magic link
# configura un SMTP tuo (es. Resend, Brevo, SendGrid — tutti con free tier) via
# le variabili SMTP_* qui sopra, oppure da Dashboard -> Authentication -> Emails -> SMTP.
