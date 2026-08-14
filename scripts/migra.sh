#!/usr/bin/env bash
# ============================================================
#  Applica un file di migrazione a un progetto Supabase.
#
#  Le migrazioni di docs/migrations/ sono scritte per essere ESEGUITE PIU' VOLTE
#  senza danno (create if not exists, add column if not exists): questo script
#  non tiene uno storico, si limita a mandarle. Se una migrazione non fosse
#  idempotente, il posto giusto per sistemarla e' la migrazione, non lo script.
#
#  Prima di eseguire stampa il NOME del progetto, non solo il ref: dei due
#  progetti uno fa suonare il telefono di casa, e "bjbr..." e "olgx..." si
#  somigliano abbastanza da poter essere scambiati alle undici di sera.
#
#  Uso:
#    PROJECT_REF=<ref> ./scripts/migra.sh docs/migrations/004-ultima-evacuazione.sql
#
#  Serve SUPABASE_ACCESS_TOKEN in .env.scripts (fuori da Git).
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API="https://api.supabase.com/v1"

for cmd in curl jq; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "❌ Manca '$cmd'." >&2; exit 1; }
done

FILE="${1:-}"
[ -n "$FILE" ] || { echo "❌ Uso: PROJECT_REF=<ref> $0 <file.sql>" >&2; exit 1; }
[ -f "$FILE" ] || { echo "❌ File non trovato: $FILE" >&2; exit 1; }

if [ -f "$ROOT_DIR/.env.scripts" ]; then
  set -a; . "$ROOT_DIR/.env.scripts"; set +a
fi
: "${SUPABASE_ACCESS_TOKEN:?❌ Serve SUPABASE_ACCESS_TOKEN (in .env.scripts)}"
: "${PROJECT_REF:?❌ Serve PROJECT_REF (il ref del progetto da migrare)}"

auth=(-H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN")

nome="$(curl -fsS "${auth[@]}" "$API/projects/$PROJECT_REF" | jq -r '.name // empty')"
[ -n "$nome" ] || { echo "❌ Progetto $PROJECT_REF non trovato o token senza accesso." >&2; exit 1; }

echo "▶ Progetto: $nome  ($PROJECT_REF)"
echo "▶ Migrazione: $FILE"

body="$(jq -Rs '{query: .}' < "$FILE")"
resp="$(curl -fsS "${auth[@]}" -H "Content-Type: application/json" \
  -X POST "$API/projects/$PROJECT_REF/database/query" -d "$body")" || {
  echo "❌ La migrazione non è passata. Risposta:" >&2
  echo "$resp" >&2
  exit 1
}

echo "✅ Applicata a $nome."
