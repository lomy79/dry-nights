#!/usr/bin/env bash
#
# list-orgs.sh — elenca le organizzazioni Supabase del tuo account, con il loro id.
# Serve a recuperare SUPABASE_ORG_ID da incollare in .env.scripts.
#
# Uso:
#   ./scripts/list-orgs.sh
# Legge SUPABASE_ACCESS_TOKEN da .env.scripts (o dall'ambiente).
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -f "$ROOT_DIR/.env.scripts" ]; then
  set -a; . "$ROOT_DIR/.env.scripts"; set +a
fi

command -v curl >/dev/null 2>&1 || { echo "❌ Manca 'curl'." >&2; exit 1; }
command -v jq   >/dev/null 2>&1 || { echo "❌ Manca 'jq'." >&2; exit 1; }
: "${SUPABASE_ACCESS_TOKEN:?❌ Serve SUPABASE_ACCESS_TOKEN (compila .env.scripts)}"

resp="$(curl -fsS https://api.supabase.com/v1/organizations \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}")" || {
    echo "❌ Chiamata fallita. Controlla che il token sia valido." >&2
    exit 1
  }

echo "Organizzazioni Supabase (copia l'id giusto in SUPABASE_ORG_ID):"
echo "$resp" | jq -r '.[] | "  \(.id)\t\(.name)"'
