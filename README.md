# Dry Nights 🌙

App PWA per il **monitoraggio dell'enuresi notturna** (pipì a letto) nei bambini.

Nasce da un'esigenza familiare concreta: raccogliere in modo semplice e senza
colpevolizzare i dati delle notti, per due scopi:

1. dare un **quadro utile al pediatra**;
2. mostrare i **progressi nel tempo**, con un taglio motivazionale per il bambino.

> L'enuresi notturna è comune e, nella grande maggioranza dei casi, si risolve
> con la crescita. Questa app tratta la notte bagnata come **un dato, non un
> errore**: nessuno stato di "allarme", nessuna meccanica ansiogena.

## Caratteristiche

- 📲 **PWA installabile** ("aggiungi a schermata home"), non app nativa.
- 👨‍👩‍👦 **Profilo bambino condiviso** tra i due genitori, che si alternano.
- 🌗 **Doppio momento di inserimento**: contesto la sera, esito la mattina —
  con un solo tap per il minimo indispensabile, pensato per un genitore assonnato.
- 🔄 **Sync in tempo reale** tra i due telefoni.
- 📊 Dati **strutturati** (toggle e scelte, non testo libero): veloci da inserire
  e realmente analizzabili.

## Stack tecnologico

| Livello    | Tecnologia |
|------------|------------|
| Frontend   | [Vue 3](https://vuejs.org/) + [Vite](https://vitejs.dev/), [Pinia](https://pinia.vuejs.org/), [Vue Router](https://router.vuejs.org/) |
| PWA        | [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) |
| Backend    | [Supabase](https://supabase.com/) (Postgres + Auth + Realtime + Row-Level Security) |
| Test       | [Vitest](https://vitest.dev/) |

Il frontend è **statico**: non c'è un server applicativo da gestire, tutta la
persistenza, l'autenticazione e la sicurezza (RLS) vivono su Supabase.

## Avvio in locale

Requisiti: [Node.js](https://nodejs.org/) 18+ e un progetto Supabase.

```bash
# 1. Installa le dipendenze
npm install

# 2. Configura le variabili d'ambiente
cp .env.example .env
#    ...poi apri .env e inserisci URL e publishable key del TUO progetto Supabase

# 3. Prepara il database
#    Esegui docs/schema.sql nell'SQL editor di Supabase

# 4. Avvia in sviluppo
npm run dev
```

Altri comandi:

```bash
npm run build     # build di produzione (output in dist/)
npm run preview   # anteprima della build
npm run test      # esegue i test
```

## Configurazione

Le chiavi vanno in un file `.env` (**mai** committato — vedi `.gitignore`).
Parti da [`.env.example`](.env.example):

- `VITE_SUPABASE_URL` — URL del progetto Supabase.
- `VITE_SUPABASE_PUBLISHABLE_KEY` — la **publishable key** (`sb_publishable_...`),
  pensata per il client. La secret key bypassa le RLS e non deve **mai** finire
  nel frontend.

A proteggere i dati sono le **Row-Level Security policy** definite in
[`docs/schema.sql`](docs/schema.sql), non la segretezza della chiave.

## Documentazione

- [`docs/scheda-notte-modello-dati.md`](docs/scheda-notte-modello-dati.md) —
  modello dati completo, con tutte le decisioni di design. È la fonte di verità
  del dominio.
- [`docs/schema.sql`](docs/schema.sql) — schema Postgres pronto da eseguire.

## Contribuire

I contributi sono benvenuti! Leggi [CONTRIBUTING.md](CONTRIBUTING.md) e il
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Privacy

L'app tratta dati sensibili sulla salute di un minore. Chi la self-hosta è
responsabile del proprio deployment: i dati risiedono nel **tuo** progetto
Supabase e sono protetti da RLS. Questo repository **non contiene alcun dato
personale** né alcuna chiave.

## Licenza

Distribuito con licenza [MIT](LICENSE). © 2026 Andrea Aresu.
