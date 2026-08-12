# Promemoria push (sera + mattina)

Due notifiche al giorno sul telefono: una la sera per il contesto della notte in
arrivo, una la mattina per l'esito di quella appena finita. Sono il motore della
raccolta dati — senza, la scheda si compila solo quando ci si ricorda.

## Perché serve un pezzo di server

Una PWA **non può programmare da sola** una notifica per le 23:00: ad app chiusa
non gira niente sul telefono. L'unica strada è il **Web Push**: un server manda
la notifica, il telefono la riceve anche con l'app chiusa e lo schermo spento.

La sveglia sta su Supabase (`pg_cron`), non su Vercel: il piano gratuito di
Vercel limita i cron a **una esecuzione al giorno** e senza garanzia sul minuto,
inadatto a una sveglia alle 23:00 precise.

```
pg_cron (ogni 15 min)
   └─ pg_net → Edge Function `invia-promemoria`
        ├─ chiede a Postgres: promemoria_da_inviare()   ← qui la regola
        └─ cifra (VAPID) e spinge verso il push service → telefono
```

## Dove vive cosa

| Pezzo | File | Ruolo |
|---|---|---|
| Chi avvisare | `docs/migrations/003-notifiche-push.sql` | tabelle, RLS e `promemoria_da_inviare()` |
| Invio | `supabase/functions/invia-promemoria/index.ts` | solo crittografia e consegna |
| Ricezione | `src/sw.js` | mostra la notifica, gestisce i bottoni |
| Deep-link | `src/domain/promemoria.js` | legge `?esito=…&notte=…`, con i suoi test |
| Iscrizione | `src/lib/push.js`, `src/stores/notifiche.js` | permesso, subscription, preferenze |
| Impostazioni | `src/views/ImpostazioniView.vue` | interruttore e orari (rotta `/promemoria`) |
| Setup | `scripts/setup-notifiche.sh` | fa tutto quanto sopra su un progetto |

La decisione di **chi** avvisare sta apposta in SQL, accanto ai dati: c'è un
solo posto in cui può sbagliare, ed è interrogabile a mano dall'SQL editor.

## La regola del silenzio

Se il dato di quel momento c'è già, **la notifica non parte**. Nel dettaglio:

- **mattina** → si notifica solo se manca l'`esito` della notte appena passata;
- **sera** → solo se il contesto della notte in arrivo è ancora del tutto vuoto.

Vale per **entrambi i genitori**: il dato è del bambino, non di chi lo scrive.
Se uno dei due ha già segnato, tacciono i telefoni di tutti e due.

È una scelta di tono, non solo di efficienza: un promemoria che arriva a scheda
già compilata diventa rumore, e ci si abitua a ignorarlo.

## Il fuso e l'ora legale

`pg_cron` gira in UTC, ma il confronto con gli orari avviene in `Europe/Rome`
(colonna `notification_prefs.timezone`). A ottobre e a marzo **non c'è niente da
toccare**.

Gli orari si arrotondano al quarto d'ora perché il cron controlla ogni 15
minuti: promettere le 23:07 sarebbe una bugia.

Attenzione al confine notturno: la funzione SQL `giorno_effettivo()` rispecchia
`ORA_INIZIO_GIORNO = 5` di `src/domain/dataNotte.js`. Tra mezzanotte e le 5 si
resta sulla notte precedente, altrimenti un promemoria all'una attribuirebbe la
notte sbagliata. **Se cambi quella costante lato client, cambiala anche in SQL.**
Stesso discorso per `contesto_vuoto()`, che rispecchia `contestoVuoto()`.

## I bottoni della notifica del mattino

La notifica delle 8 ha due bottoni, **Asciutto** e **Bagnato**: un tap dalla
schermata di blocco e la notte è registrata.

Il service worker non ha la sessione Supabase, quindi **non può scrivere lui**:
passa l'esito all'app nell'URL (`/?esito=asciutto&notte=2026-08-09`) e a salvarlo
è l'app all'avvio. Il guadagno non è "non aprire l'app" — quella si apre — ma
**non dover scegliere niente**: l'esito è già dentro quando lo schermo si accende.

- **Asciutto** → l'app si apre sul riepilogo. Finito.
- **Bagnato** → l'app si apre con i dettagli già aperti (quanto, quante volte,
  si è alzato), che restano **facoltativi**: `gravita`, `episodi` e `minzione`
  sono nullable. Chiudere subito lascia comunque un record valido.

Una notifica rimasta sulla schermata di blocco per giorni non può scrivere su una
notte lontana: `leggiDeepLinkEsito()` rifiuta tutto ciò che è fuori dalla finestra
di recupero.

La notifica della sera non ha bottoni: il contesto ha troppe sfumature per stare
in una scelta secca.

### Le due icone non sono la stessa cosa

`icon` è l'immagine grande a colori nel corpo della notifica: `icon-192.png`,
la stessa dell'app. `badge` è l'icona piccola della barra di stato, e Android ne
usa **solo il canale alfa**, riempiendo la sagoma col colore di sistema. Passargli
l'icona a colori — come si faceva all'inizio — equivale a dargli un quadrato
pieno: non si vede l'app rimpicciolita, si vede una macchia bianca. Per questo
esiste `badge-96.png`, una silhouette bianca su trasparente.

## Setup di un progetto

Serve `SUPABASE_ACCESS_TOKEN` in `.env.scripts` (lo stesso degli altri script).
Va fatto **una volta per progetto**, staging e produzione separatamente: i due
hanno chiavi VAPID diverse, così un test di staging non può suonare sul telefono
"vero".

```bash
# Staging
PROJECT_REF=<ref-staging> ./scripts/setup-notifiche.sh

# Produzione
PROJECT_REF=<ref-prod> ./scripts/setup-notifiche.sh
```

Lo script applica la migrazione, salva i segreti, deploya la Edge Function e
programma il cron. Alla fine stampa la chiave pubblica da mettere nel frontend:

```
VITE_VAPID_PUBLIC_KEY=BF3x…
```

- **staging** → nel `.env` locale e nelle env *Preview* di Vercel;
- **produzione** → nelle env *Production* di Vercel.

Poi **redeploy su Vercel**: è letta a build-time.

Lo script è **idempotente**: rilanciarlo rilegge le chiavi VAPID dal file locale
`.env.vapid.<ref>` invece di rigenerarle, quindi non invalida le iscrizioni
esistenti. Per rigenerarle davvero serve `VAPID_RIGENERA=true` — e in quel caso
ogni telefono deve riattivare i promemoria.

### Dove stanno le chiavi, e perché non nei secrets

`.env.vapid.<ref>` (permessi 600, fuori da Git) è **l'unica copia leggibile**
della coppia VAPID. Dai secrets di Supabase non si rileggono: l'endpoint
`GET /v1/projects/<ref>/secrets` restituisce lo **SHA-256** di ogni valore, non
il valore — vale per tutti, anche per `SUPABASE_URL`, che hex non è.

Non è un dettaglio da manuale: la prima versione dello script li rileggeva da lì
e li riscriveva credendoli le chiavi, quindi **ogni rilancio sostituiva la coppia
VAPID col proprio digest**. Il salvataggio riusciva, e il danno si vedeva solo
dopo — `setVapidDetails` gira all'import della Edge Function, quindi con una
chiave malformata il worker muore al boot e ogni chiamata risponde 500. Per
questo lo script ora, dopo il deploy, chiama la function **senza segreto e
pretende un 401**: è la prova che il modulo si è caricato.

Se perdi il file (macchina nuova, cartella ripulita) le chiavi sono perse:
copialo dall'altra macchina, oppure rigenera e riattiva i telefoni. Lo script si
ferma da solo se il progetto ha già delle chiavi ma il file locale non c'è — non
rigenera per inerzia, perché costerebbe una riattivazione a ogni genitore.

## Attivazione sul telefono

Ogni genitore, sul proprio telefono, **una volta**:

1. apri l'app → 🔔 in alto a destra → **Attiva su questo telefono**;
2. concedi il permesso quando il browser lo chiede.

L'interruttore vale per il dispositivo (telefono e tablet sono due iscrizioni);
gli **orari** valgono per il genitore, su tutti i suoi dispositivi. L'altro
genitore ha i suoi.

Il permesso va chiesto da un tap: è il motivo per cui c'è un bottone e non una
richiesta automatica all'avvio.

## Verifica senza aspettare le 23

```bash
PROJECT_REF=<ref> PROVA=true ./scripts/setup-notifiche.sh
```

Manda un push a tutti i dispositivi iscritti, ignorando orari, silenzio e log.
Risposta `{"inviati":0}` = nessun telefono ancora iscritto.

## Diagnostica

**Non arriva niente.** In ordine:

1. `VITE_VAPID_PUBLIC_KEY` è nell'ambiente giusto di Vercel, ed è stato fatto un
   redeploy dopo averla messa?
2. Il dispositivo risulta iscritto? `select count(*) from push_subscriptions;`
3. Ci sarebbe qualcosa da mandare? Il silenzio è previsto se il dato c'è già:
   ```sql
   select * from promemoria_da_inviare(now());
   ```
   ⚠️ **Non è a sola lettura**: scrive nel log e "consuma" l'invio di quel giro.
   Per rifarlo, cancella la riga da `notification_log`.
4. Il cron gira?
   ```sql
   select * from cron.job where jobname = 'promemoria-push';
   select * from cron.job_run_details order by start_time desc limit 10;
   ```
5. **La Edge Function che risponde?** Questa è la domanda che gli altri punti
   non fanno, ed è dove si nasconde il guasto più silenzioso di tutti:
   ```sql
   select status_code, count(*), max(created) from net._http_response group by 1;
   select distinct content from net._http_response where status_code >= 400;
   ```
   `cron.job_run_details` dice `succeeded` anche quando la funzione risponde 500:
   il job ha solo **accodato** la chiamata con `net.http_post`, e ha fatto il suo
   lavoro. La risposta vera arriva dopo e finisce qui. `net._http_response`
   conserva circa sei ore, quindi si guarda finché il guasto è in corso.
6. Errori d'invio?
   ```sql
   select endpoint, last_ok_at, last_error_at, last_error from push_subscriptions;
   ```
7. Log della Edge Function: Dashboard → Edge Functions → `invia-promemoria` → Logs.

Nota: finché il guasto è *prima* dell'invio (la query fallisce, la function va in
errore), `push_subscriptions.last_error` resta **null** e `last_ok_at` pure. Una
subscription con entrambe le colonne vuote da giorni non è un telefono a posto:
è un telefono a cui non ha mai provato a scrivere nessuno.

**Arriva due volte.** Non dovrebbe: la primary key di `notification_log`
(`subscription_id, momento, data_notte`) fa da lucchetto e solo chi riesce a
inserire la riga invia. Due notifiche su **telefoni diversi** dello stesso
genitore sono invece normali — sono due iscrizioni.

**Il telefono ha smesso di ricevere.** Se il push service risponde 404/410 la
subscription è morta e viene cancellata da sola: basta riattivare dall'app.

**Ho cambiato le chiavi VAPID.** Le iscrizioni vecchie restano nel database ma
sono inservibili. L'app se ne accorge (`chiaveDiversa()` in `src/lib/push.js`) e
rifà l'iscrizione alla prossima attivazione. Conviene comunque cancellare le
righe morte: con la chiave sbagliata il push service risponde **403**, che non è
fra i codici (404/410) per cui la subscription si cancella da sola.

**La function risponde 500 a ogni chiamata.** Prima di cercare nella logica,
verifica che parta: `curl -X POST <url-function> -d '{}'` **senza** header
`x-cron-secret` deve rispondere `401 non autorizzato`. Se risponde 500 con
`WORKER_ERROR` il modulo non si carica, e il sospetto numero uno sono le chiavi
VAPID nei secrets (vedi «Dove stanno le chiavi»).

## Note e limiti noti

- **Solo Android** per scelta (vedi CLAUDE.md). Su iOS il Web Push esiste da
  16.4 ma solo per PWA installate in schermata Home, e i bottoni nelle notifiche
  non sono supportati: servirebbe una UI dedicata.
- Se un invio fallisce, la riga di log viene rimossa e il giro successivo (15
  minuti dopo, ancora dentro la finestra di un'ora) riprova. Oltre la finestra il
  promemoria di quel giorno è perso: è un promemoria domestico, non un allarme.
- Il `CRON_SECRET` compare in chiaro nel comando del cron job, dentro il
  database. È leggibile solo dal service role. Accettabile qui; se un giorno
  smettesse di esserlo, si sposta in Supabase Vault.
- La Edge Function è deployata con `verify_jwt = false` (`supabase/config.toml`)
  perché a chiamarla è il database, non un utente loggato. A proteggerla è
  l'header `x-cron-secret`.
