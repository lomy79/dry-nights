# Setup Supabase — passo per passo

Serve a creare il backend da zero e collegarlo all'app. Da fare una volta sola.

## 1. Crea il progetto
1. Vai su [supabase.com](https://supabase.com) → **New project**.
2. Scegli nome, password del DB (salvala) e regione vicina (es. *EU Central*).
3. Attendi il provisioning (~1-2 min).

## 2. Esegui lo schema
1. Nel progetto: **SQL Editor** → **New query**.
2. Incolla **tutto** il contenuto di [`schema.sql`](./schema.sql) ed esegui (**Run**).
3. Verifica in **Table Editor** che esistano: `children`, `child_members`,
   `child_active_states`, `night_records`.

## 3. Abilita l'accesso via magic link
Il magic link **non ha un interruttore dedicato**: basta il provider Email attivo,
e la chiamata `signInWithOtp` dell'app invia il link da sola.
1. **Authentication → Sign In / Providers** (in alcune versioni: *Providers*):
   apri **Email** e verifica che sia **Enabled** (di default lo è).
2. **Authentication → URL Configuration**:
   - **Site URL** → `http://localhost:5173`
   - **Redirect URLs** → aggiungi `http://localhost:5173`.
   Senza questo, il link nella mail non sa dove riportarti e il login fallisce.

## 4. Copia le chiavi nell'app
1. **Project Settings → API Keys** (in alcune versioni: *API*).
2. Copia l'**API URL** (in alcune versioni: *Project URL* — è lo stesso,
   `https://<ref>.supabase.co`) e la **Publishable key** (`sb_publishable_...`).
   - ⚠️ **Non** usare la **Secret key** (`sb_secret_...`): bypassa le RLS e non
     deve mai finire nel client. Serve solo lato server.
   - Le vecchie `anon` / `service_role` funzionano ancora ma sono in dismissione:
     parti con le nuove. La publishable è l'equivalente della vecchia `anon`.
3. Nella root del progetto: copia `.env.example` in `.env` e riempi:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
   `.env` è ignorato da Git: le chiavi non finiscono nel repo. La publishable key
   è pensata per il client; a proteggere i dati sono le **RLS**, non il segreto.

## 5. Onboarding dei due genitori (già risolto nello schema)
`schema.sql` include due funzioni `SECURITY DEFINER` che gestiscono le uniche due
operazioni che le RLS da sole non potrebbero esprimere senza aprire buchi:

- **`create_child(nome, data_nascita)`** — crea il bambino, iscrive chi chiama come
  primo genitore e semina lo stato salute (`sano`), tutto in modo atomico.
  Restituisce la riga del bambino, incluso il suo `invite_code`.
- **`join_child(invite_code)`** — il secondo genitore si unisce a un bambino
  esistente passando l'`invite_code` (un UUID condiviso dal primo genitore).

Dal client si chiamano così:
```js
// Primo genitore
const { data: bambino } = await supabase.rpc('create_child', {
  p_nome: 'Marco', p_data_nascita: '2018-03-01',
})
// bambino.invite_code → da condividere con l'altro genitore

// Secondo genitore (dopo aver ricevuto il codice)
await supabase.rpc('join_child', { p_invite_code: '<codice-ricevuto>' })
```

Perché funzioni e non policy di INSERT dirette: iscrivere il **primo** membro con
sole RLS crea un problema ricorsivo (per inserirti devi già essere membro), e una
policy `with check (true)` lascerebbe chiunque aggiungersi a qualsiasi `child_id`.
Le due funzioni girano coi diritti del proprietario, in modo controllato e atomico.

> Scelta di default: invito **via codice condiviso** (nessuna infrastruttura email).
> Se preferisci l'invito via email o un codice più corto/leggibile, si cambia solo
> `join_child` e la colonna `invite_code` — dimmelo.

## 6. Avvia in locale
```
npm install
npm run dev
```
Apri `http://localhost:5173`. Al primo giro l'app è ancora lo scaffold: il flusso
di login e inserimento arriva nei milestone successivi.
