#!/usr/bin/env bash
#
# setup-notifiche.sh — configura i promemoria push su UN progetto Supabase.
#
# Come configure-auth.sh, è riutilizzabile: lancialo una volta per lo staging e
# una per la produzione, cambiando PROJECT_REF. I due progetti hanno chiavi VAPID
# diverse, così è impossibile che un test di staging suoni sul telefono "vero".
#
# Cosa fa:
#   1. recupera (o genera) le chiavi VAPID e il segreto del cron;
#   2. applica docs/migrations/003-notifiche-push.sql;
#   3. salva i segreti tra quelli della Edge Function;
#   4. deploya la function `invia-promemoria`;
#   5. programma pg_cron ogni 15 minuti;
#   6. stampa la VITE_VAPID_PUBLIC_KEY da mettere nel .env / in Vercel.
#
# È IDEMPOTENTE: rilanciarlo non rigenera le chiavi VAPID (le rilegge dal file
# locale .env.vapid.<PROJECT_REF>), quindi non invalida le iscrizioni già fatte.
# Per rigenerarle davvero — e costringere ogni telefono a riattivarsi —
# passa VAPID_RIGENERA=true.
#
# Le chiavi stanno in un file locale e NON si rileggono dai secrets di Supabase:
# `GET /v1/projects/<ref>/secrets` restituisce lo SHA-256 dei valori, non i
# valori. Vedi il commento al punto 1: è già costato un ambiente.
#
# Uso (staging):
#   PROJECT_REF=<ref-staging> ./scripts/setup-notifiche.sh
#
# Uso (produzione, con invio di prova a fine setup):
#   PROJECT_REF=<ref-prod> PROVA=true ./scripts/setup-notifiche.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATION="$ROOT_DIR/docs/migrations/003-notifiche-push.sql"

# Carica le credenziali da .env.scripts se presente (non committato).
if [ -f "$ROOT_DIR/.env.scripts" ]; then
  set -a; . "$ROOT_DIR/.env.scripts"; set +a
fi

API="https://api.supabase.com/v1"
NOME_FUNZIONE="invia-promemoria"
NOME_CRON="promemoria-push"

for cmd in curl jq node npx openssl; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "❌ Manca '$cmd'." >&2; exit 1; }
done
: "${SUPABASE_ACCESS_TOKEN:?❌ Serve SUPABASE_ACCESS_TOKEN (compila .env.scripts)}"
: "${PROJECT_REF:?❌ Serve PROJECT_REF (il ref del progetto da configurare)}"
[ -f "$MIGRATION" ] || { echo "❌ Migrazione non trovata: $MIGRATION" >&2; exit 1; }

auth=(-H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}")
VAPID_SUBJECT="${VAPID_SUBJECT:-mailto:promemoria@notti-serene.app}"

esegui_sql() {
  # Stesso endpoint dell'SQL editor: niente connessione diretta al DB da gestire.
  local sql="$1"
  local body; body="$(jq -n --arg q "$sql" '{query: $q}')"
  curl -fsS "${auth[@]}" -H "Content-Type: application/json" \
    -X POST "$API/projects/$PROJECT_REF/database/query" -d "$body"
}

# Il progetto ha già dei segreti con questo nome? Serve solo a distinguere il
# primo setup da un file locale perso: i VALORI non si possono rileggere.
secret_esiste() {
  echo "${SECRETS_JSON:-[]}" | jq -e --arg n "$1" 'any(.[]; .name == $n)' >/dev/null 2>&1
}

# Una chiave pubblica VAPID e' un punto P-256 non compresso: 65 byte che
# iniziano con 0x04, in base64url. Il controllo esiste perche' il modo in cui
# questo script si e' rotto una volta — scriverci dentro un digest esadecimale —
# non da' errore al salvataggio: esplode dopo, al boot della Edge Function.
chiave_pubblica_valida() {
  node -e '
    let b
    try { b = Buffer.from(process.argv[1] ?? "", "base64url") } catch { process.exit(1) }
    process.exit(b.length === 65 && b[0] === 4 ? 0 : 1)
  ' "$1"
}

# ---- 1) chiavi VAPID e segreto del cron -------------------------------------
#
# Le chiavi vivono QUI, in un file locale per progetto, e non nei secrets di
# Supabase. Non e' una preferenza: `GET /v1/projects/<ref>/secrets` restituisce
# lo SHA-256 di ogni valore, non il valore. La versione precedente li rileggeva
# da li' e li riscriveva come se fossero le chiavi vere, quindi ogni rilancio
# sostituiva la coppia VAPID col suo digest. Il salvataggio riusciva, la
# funzione non ripartiva piu' e i telefoni tacevano senza un errore che
# indicasse questo punto. L'idempotenza dichiarata faceva esattamente il danno
# che prometteva di evitare.
FILE_CHIAVI="$ROOT_DIR/.env.vapid.$PROJECT_REF"   # ignorato da Git (.gitignore: .env.*)

echo "▶ Progetto $PROJECT_REF — chiavi VAPID…"
SECRETS_JSON="$(curl -fsS "${auth[@]}" "$API/projects/$PROJECT_REF/secrets" || echo '[]')"

if [ -f "$FILE_CHIAVI" ]; then
  # shellcheck disable=SC1090
  set -a; . "$FILE_CHIAVI"; set +a
  echo "  ✓ Lette da $(basename "$FILE_CHIAVI")."
fi
VAPID_PUBLIC_KEY="${VAPID_PUBLIC_KEY:-}"
VAPID_PRIVATE_KEY="${VAPID_PRIVATE_KEY:-}"
CRON_SECRET="${CRON_SECRET:-}"

if [ -n "$VAPID_PUBLIC_KEY" ] && ! chiave_pubblica_valida "$VAPID_PUBLIC_KEY"; then
  echo "❌ La chiave pubblica non e' una P-256 valida (65 byte, base64url)." >&2
  echo "   Origine: ${FILE_CHIAVI}. Se contiene 64 caratteri esadecimali e' un" >&2
  echo "   digest, non una chiave: cancella il file e rilancia con VAPID_RIGENERA=true." >&2
  exit 1
fi

if [ "${VAPID_RIGENERA:-false}" = "true" ] || [ -z "$VAPID_PUBLIC_KEY" ] || [ -z "$VAPID_PRIVATE_KEY" ]; then
  # Rigenerare invalida OGNI iscrizione: non deve poter succedere per inerzia.
  # Se il progetto ha gia' un VAPID_PUBLIC_KEY ma qui non c'e' il file, non e'
  # un primo setup — e' un file perso (altra macchina, cartella ripulita). La
  # differenza costa a due genitori una riattivazione a testa, quindi la scelta
  # e' loro, non dello script.
  if [ "${VAPID_RIGENERA:-false}" != "true" ] && secret_esiste VAPID_PUBLIC_KEY; then
    echo "❌ Il progetto $PROJECT_REF ha gia' delle chiavi VAPID, ma qui manca" >&2
    echo "   $FILE_CHIAVI e dai secrets non si possono rileggere." >&2
    echo "   Se hai il file su un'altra macchina, copialo qui e rilancia." >&2
    echo "   Altrimenti rigenera — ma ogni telefono dovra' riattivare i" >&2
    echo "   promemoria dall'app:" >&2
    echo "     PROJECT_REF=$PROJECT_REF VAPID_RIGENERA=true $0" >&2
    exit 1
  fi
  echo "▶ Genero una nuova coppia di chiavi VAPID…"
  # Una P-256, nel formato che vuole il Web Push: pubblica = punto non compresso
  # (0x04 ‖ x ‖ y) in base64url, privata = lo scalare d. Niente dipendenze nuove:
  # basta node:crypto.
  eval "$(node -e '
    const { generateKeyPairSync } = require("node:crypto")
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" })
    const jwk = privateKey.export({ format: "jwk" })
    const b = (s) => Buffer.from(s, "base64url")
    const pub = Buffer.concat([Buffer.from([4]), b(jwk.x), b(jwk.y)]).toString("base64url")
    console.log(`VAPID_PUBLIC_KEY=${pub}`)
    console.log(`VAPID_PRIVATE_KEY=${jwk.d}`)
  ')"
  echo "  ✓ Chiavi generate."
  RIGENERATE=true
else
  echo "  ✓ Chiavi VAPID già presenti: le riuso (le iscrizioni restano valide)."
  RIGENERATE=false
fi

if [ -z "$CRON_SECRET" ]; then
  CRON_SECRET="$(openssl rand -hex 32)"
  echo "  ✓ Segreto del cron generato."
fi

# Il file locale e' l'unica copia leggibile: se sparisce, le chiavi sono perse e
# i telefoni vanno riattivati. Permessi 600 perche' contiene la chiave privata.
( umask 077
  cat > "$FILE_CHIAVI" <<EOF
# Chiavi dei promemoria push del progetto $PROJECT_REF — NON committare.
# Le rilegge scripts/setup-notifiche.sh: dai secrets di Supabase non si possono
# rileggere (l'API restituisce il loro SHA-256). Se perdi questo file l'unica
# strada e' rigenerare, e ogni telefono deve riattivare i promemoria.
VAPID_PUBLIC_KEY=$VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY=$VAPID_PRIVATE_KEY
CRON_SECRET=$CRON_SECRET
EOF
)
echo "  ✓ Copia locale in $(basename "$FILE_CHIAVI") (600, fuori da Git)."

# ---- 2) migrazione -----------------------------------------------------------
echo "▶ Applico docs/migrations/003-notifiche-push.sql…"
esegui_sql "$(cat "$MIGRATION")" >/dev/null || {
  echo "❌ Migrazione fallita. In alternativa incollala nell'SQL editor." >&2
  exit 1
}
echo "  ✓ Tabelle, RLS e funzioni pronte."

# ---- 3) segreti della Edge Function -----------------------------------------
echo "▶ Salvo i segreti della Edge Function…"
secrets_body="$(jq -n \
  --arg pub "$VAPID_PUBLIC_KEY" \
  --arg priv "$VAPID_PRIVATE_KEY" \
  --arg subj "$VAPID_SUBJECT" \
  --arg cron "$CRON_SECRET" \
  '[{name:"VAPID_PUBLIC_KEY",value:$pub},
    {name:"VAPID_PRIVATE_KEY",value:$priv},
    {name:"VAPID_SUBJECT",value:$subj},
    {name:"CRON_SECRET",value:$cron}]')"
curl -fsS "${auth[@]}" -H "Content-Type: application/json" \
  -X POST "$API/projects/$PROJECT_REF/secrets" -d "$secrets_body" >/dev/null
echo "  ✓ Segreti salvati (restano solo lato server: la privata non tocca mai il client)."

# ---- 4) deploy della function ------------------------------------------------
echo "▶ Deploy della Edge Function $NOME_FUNZIONE…"
( cd "$ROOT_DIR" && npx --yes supabase@latest functions deploy "$NOME_FUNZIONE" \
    --project-ref "$PROJECT_REF" ) || {
  echo "❌ Deploy fallito. Riprova a mano:" >&2
  echo "   npx supabase functions deploy $NOME_FUNZIONE --project-ref $PROJECT_REF" >&2
  exit 1
}
echo "  ✓ Function deployata."

FUNZIONE_URL="https://${PROJECT_REF}.supabase.co/functions/v1/${NOME_FUNZIONE}"

# La funzione parte davvero? Una chiamata SENZA segreto deve rispondere 401: e'
# la prova che il modulo si e' caricato, VAPID compreso (setVapidDetails gira a
# import-time e con una chiave malformata butta giu' tutto). Se invece risponde
# 500 il worker e' morto al boot — l'unico sintomo che il guasto d'agosto 2026
# ha dato per ore, mentre il cron continuava a segnare "succeeded".
echo "▶ Controllo che la function risponda…"
CODICE="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$FUNZIONE_URL" \
  -H "Content-Type: application/json" -d '{}' || echo 000)"
if [ "$CODICE" != "401" ]; then
  echo "❌ La function risponde $CODICE invece di 401: non e' partita." >&2
  echo "   Log: Dashboard → Edge Functions → $NOME_FUNZIONE → Logs." >&2
  exit 1
fi
echo "  ✓ Risponde 401 a chi non ha il segreto: e' viva."

# ---- 5) cron ogni 15 minuti --------------------------------------------------
echo "▶ Programmo pg_cron (ogni 15 minuti)…"
esegui_sql "
do \$cron\$
begin
  -- Rilanciabile: se il job c'era già, lo si sostituisce.
  perform cron.unschedule('${NOME_CRON}');
exception when others then null;
end
\$cron\$;

select cron.schedule('${NOME_CRON}', '*/15 * * * *', \$job\$
  select net.http_post(
    url := '${FUNZIONE_URL}',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '${CRON_SECRET}'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
\$job\$);
" >/dev/null
echo "  ✓ Cron attivo. Il confronto con gli orari avviene in Europe/Rome: l'ora"
echo "    legale si gestisce da sé."

# ---- 6) invio di prova (opzionale) ------------------------------------------
if [ "${PROVA:-false}" = "true" ]; then
  echo "▶ Invio di prova a TUTTI i dispositivi già iscritti…"
  # Senza -f: il corpo di un 500 dice PERCHE' ha fallito, e nasconderlo dietro
  # "chiamata fallita" e' esattamente cio' che ha allungato una diagnosi.
  risposta="$(curl -sS -X POST "$FUNZIONE_URL" \
    -H "Content-Type: application/json" \
    -H "x-cron-secret: ${CRON_SECRET}" \
    -w ' [HTTP %{http_code}]' \
    -d '{"prova": true}')" || risposta='chiamata non riuscita'
  echo "  → $risposta"
  echo "  (0 inviati = nessun telefono ancora iscritto: attiva i promemoria"
  echo "   dall'app, poi rilancia con PROVA=true)"
fi

# ---- riepilogo ---------------------------------------------------------------
cat <<EOF

============================================================
✅ Promemoria push configurati sul progetto $PROJECT_REF
============================================================

Metti questa chiave PUBBLICA tra le variabili d'ambiente del frontend —
nel .env locale se questo è lo staging, nelle env di Vercel per l'ambiente
corrispondente (Preview per staging, Production per la produzione):

  VITE_VAPID_PUBLIC_KEY=$VAPID_PUBLIC_KEY

Poi fai un redeploy su Vercel: è letta a build-time.
EOF

if [ "$RIGENERATE" = "true" ]; then
  cat <<'EOF'

⚠️  Chiavi VAPID NUOVE su questo progetto. Ogni telefono già iscritto deve
    riattivare i promemoria dall'app (l'iscrizione è legata alla chiave con cui
    è nata). L'app se ne accorge da sola e la rifà alla prossima attivazione.
EOF
fi

cat <<'EOF'

Prossimi passi:
  • Apri l'app sul telefono → 🔔 Promemoria → "Attiva su questo telefono".
  • Ogni genitore deve farlo sul proprio telefono, una volta.
  • Verifica la catena senza aspettare le 23:
      PROJECT_REF=<ref> PROVA=true ./scripts/setup-notifiche.sh
  • Diagnostica: docs/notifiche-push.md
============================================================
EOF
