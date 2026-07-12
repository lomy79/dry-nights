# Deploy su Vercel

L'app è un frontend **statico** (Vue + Vite): Vercel esegue la build e serve
`dist/` da CDN con HTTPS automatico. Il backend (DB, Auth, Realtime) vive già su
Supabase, quindi non c'è nessun server da deployare.

## 1. Collega il repository (una volta sola)

1. Vai su [vercel.com/new](https://vercel.com/new) e accedi con GitHub.
2. Importa il repo **`lomy79/dry-nights`**.
3. Vercel rileva automaticamente il framework **Vite**. La configurazione
   (build command, output `dist/`, fallback SPA) è già in
   [`vercel.json`](../vercel.json) — non serve toccare nulla.

## 2. Variabili d'ambiente

Nel progetto Vercel → **Settings → Environment Variables**, aggiungi (per gli
ambienti *Production* e *Preview*):

| Nome                              | Valore                                    |
|-----------------------------------|-------------------------------------------|
| `VITE_SUPABASE_URL`               | URL del progetto Supabase                 |
| `VITE_SUPABASE_PUBLISHABLE_KEY`   | publishable key (`sb_publishable_...`)    |

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

## Note

- **Redirect URL di Supabase Auth**: in Supabase → Authentication → URL
  Configuration, aggiungi il dominio Vercel (produzione ed eventuali preview) tra
  i *Redirect URLs*, altrimenti il login non torna sull'app.
- Il file `.env` locale **non** viene usato da Vercel: in produzione contano solo
  le Environment Variables del progetto.
