# Deploy su Vercel

L'app è un frontend **statico** (Vue + Vite): Vercel esegue la build e serve
`dist/` da CDN con HTTPS automatico. Il backend (DB, Auth, Realtime) vive già su
Supabase, quindi non c'è nessun server da deployare.

## Ambienti: produzione e staging

Supabase non ha "ambienti" interni: la separazione si fa con **due progetti
Supabase distinti** (due database, due set di chiavi). Il codice è identico —
cambia solo il valore delle variabili d'ambiente lette a build-time.

| Progetto Supabase        | Ambiente Vercel        | Quando           |
|--------------------------|------------------------|------------------|
| `dry-nights` (prod)      | **Production**         | push su `main`   |
| `dry-nights-staging`     | **Preview**            | le Pull Request  |
| `dry-nights-staging`     | sviluppo **locale**    | `npm run dev`    |

Regola pratica: **la produzione la tocca solo `main` deployato**. In locale e
nelle PR si lavora su staging, così i dati reali non vengono mai sporcati.

Setup una tantum del progetto staging:

- **Automatico** (consigliato): lo script [`scripts/setup-staging.sh`](../scripts/setup-staging.sh)
  crea il progetto via Management API e applica `schema.sql`. Richiede un
  *Personal Access Token* Supabase (Account → Access Tokens) e l'`organization_id`:
  ```bash
  export SUPABASE_ACCESS_TOKEN=sbp_...
  export SUPABASE_ORG_ID=xxxxxxxx      # GET https://api.supabase.com/v1/organizations
  ./scripts/setup-staging.sh
  ```
  Al termine stampa `VITE_SUPABASE_URL` e la publishable key da incollare nel
  `.env` locale e nelle env *Preview* di Vercel. Nessun segreto viene salvato su disco.
- **Manuale**: crea un secondo progetto dalla dashboard (es. `dry-nights-staging`)
  ed esegui `schema.sql` nell'SQL editor.

In entrambi i casi il tuo `.env` locale deve puntare a **staging** (vedi `.env.example`).

## 1. Collega il repository (una volta sola)

1. Vai su [vercel.com/new](https://vercel.com/new) e accedi con GitHub.
2. Importa il repo **`lomy79/dry-nights`**.
3. Vercel rileva automaticamente il framework **Vite**. La configurazione
   (build command, output `dist/`, fallback SPA) è già in
   [`vercel.json`](../vercel.json) — non serve toccare nulla.

## 2. Variabili d'ambiente

Nel progetto Vercel → **Settings → Environment Variables**. Usa lo **stesso
nome** di variabile con **valori diversi** per ambiente: seleziona *Production*
per i valori prod e *Preview* per quelli di staging.

| Nome                              | Production (`dry-nights`)         | Preview (`dry-nights-staging`)   |
|-----------------------------------|-----------------------------------|----------------------------------|
| `VITE_SUPABASE_URL`               | URL progetto **prod**             | URL progetto **staging**         |
| `VITE_SUPABASE_PUBLISHABLE_KEY`   | publishable key **prod**          | publishable key **staging**      |

> ⚠️ Usa **solo** la *publishable key*, mai la secret: nel client è pubblica per
> natura e a proteggere i dati sono le RLS di Supabase, non la sua segretezza.
> Le variabili devono iniziare con `VITE_` per essere incluse nella build.

Dopo aver aggiunto/modificato le variabili, fai un **redeploy** perché vengano
applicate (sono lette a build-time).

## 3. Deploy

- **Automatico**: ogni push su `main` → deploy di *Production*; ogni PR → deploy
  di *Preview* con URL dedicato.
- **Da CLI** (opzionale):
  ```bash
  npm i -g vercel      # una volta
  vercel login
  vercel               # deploy di preview
  vercel --prod        # deploy di produzione
  ```

## 4. Verifica PWA

Dopo il deploy, sul dominio Vercel (HTTPS):

- il browser deve proporre **"Aggiungi a schermata home"**;
- `manifest.webmanifest` e `sw.js` vengono serviti correttamente (già gestiti in
  `vercel.json`);
- il refresh su una sotto-route (es. `/storico`) non deve dare 404 — garantito
  dal rewrite SPA.

## Autenticazione e Redirect URL

L'app fa login con **magic link** (email, nessuna password) e reindirizza a
`window.location.origin`. Perché il link nell'email funzioni, quell'origin deve
essere nell'`uri_allow_list` del progetto, altrimenti si ricade sul *Site URL*.

Configura l'Auth di **ciascun** progetto con
[`scripts/configure-auth.sh`](../scripts/configure-auth.sh) (imposta magic link,
Site URL e redirect ammessi):

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...

# Staging (locale + preview Vercel) — lo fa già setup-staging.sh, ma è ripetibile:
PROJECT_REF=<ref-staging> \
SITE_URL=http://localhost:5173 \
REDIRECT_URLS='http://localhost:5173,https://*-lomy79.vercel.app' \
./scripts/configure-auth.sh

# Produzione:
PROJECT_REF=<ref-prod> \
SITE_URL=https://<dominio-prod> \
REDIRECT_URLS='https://<dominio-prod>' \
./scripts/configure-auth.sh
```

In alternativa, dalla dashboard: Supabase → Authentication → URL Configuration.

> ⚙️ **Registrazioni**: di default sono aperte (serve per creare i primi account
> genitore col magic link). Per bloccarle dopo il bootstrap, rilancia lo script
> con `AUTH_DISABLE_SIGNUP=true`.

> ✉️ **Email in produzione**: il mailer integrato di Supabase è pensato solo per i
> test (poche email/ora, rischio spam). Per un uso reale imposta un **SMTP tuo**
> (Resend, Brevo, SendGrid — free tier) via le variabili `SMTP_*` dello script o
> da Dashboard → Authentication → Emails → SMTP.

## Note

- Il file `.env` locale **non** viene usato da Vercel: in produzione contano solo
  le Environment Variables del progetto.
