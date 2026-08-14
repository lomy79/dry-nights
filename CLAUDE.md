# App monitoraggio enuresi — contesto progetto

## Cos'è
App per monitorare l'enuresi notturna (pipì a letto) di un bambino di 8 anni.
Serve a due scopi: dare un quadro utile al pediatra e mostrare i progressi nel tempo.
Utenti: i due genitori (che si alternano) e, per la parte motivazionale, il bambino.

## Obiettivo attuale
Iniziare a **raccogliere dati il prima possibile**. Il valore cresce col tempo di
raccolta, quindi si parte presto. La prima versione include tutto il flusso progettato.

## Stack
- Frontend: **Vue**, come **PWA installabile** ("aggiungi a schermata home"), non app nativa.
- Backend: **Supabase** (Postgres + Auth + Realtime + Row-Level Security).
- Sync tra i due telefoni: Realtime di Supabase (già abilitato nello schema).
- Segreti (chiavi Supabase) in un file `.env` **fuori da Git**.

## Documenti da leggere PRIMA di lavorare
- `docs/scheda-notte-modello-dati.md` — modello dati completo, con tutte le decisioni
  di design spiegate. È la fonte di verità del dominio.
- `docs/schema.sql` — schema Postgres già pronto da eseguire nell'SQL editor di Supabase.
  Rispecchia il modello dati. Non reinventarlo: leggilo e allineati.

## Decisioni chiave (dettagli nei documenti)
- **Convenzione data**: `data_notte` = data del mattino del risveglio. Coerente ovunque.
- **Un record per notte** (`child_id` + `data_notte`), scritto in più momenti:
  sera (contesto), mattina (esito), più recupero serale se la mattina è saltata.
  Attenzione: la sera si toccano DUE notti diverse (esito di ieri + contesto di stanotte).
- **Assenza di record = "sconosciuto"**, mai "asciutto". Non falsare le statistiche.
- **Profilo bambino condiviso** tra i due genitori via `child_members` + RLS.
- **Flag salute persistente con scadenza** (Decisione 7): ≠ sano vale max 3-4 giorni,
  poi l'app obbliga a reimpostare ripartendo da "sano"; oltre la scadenza → "sconosciuto".
- **"Non ha bevuto" ≠ "non so" ≠ "non risposto"** (Decisione 9): ogni fascia di `liquidi`
  ammette `nessuna` e `non_so`, esclusive fra loro e con le bevande. Senza, il silenzio
  significava tre cose insieme — lo stesso errore che evitiamo per l'esito.
- **La UI ordina le fasce per ciò che il genitore SA, non solo per ciò che pesa**
  (Decisione 10): "a cena" aperta e in alto perché è il dato che verrà inserito davvero;
  le altre richiudibili. Un dato raccolto ogni sera vale più di uno decisivo e sempre vuoto.
- **Le statistiche si contano sulle notti NOTE** (Decisione 11): mai sui giorni di
  calendario, o ogni buco diventa una notte non-bagnata. La copertura ("27 note su 30")
  sta accanto al numero grande, non a fondo pagina: è ciò che lo rende vero o falso.
- **Le correlazioni hanno una soglia scritta** (Decisione 12): sotto 10 notti nel gruppo
  **più piccolo** si mostra quanto manca, non una percentuale. Niente p-value — su un
  diario riguardato ogni sera, confronti multipli e optional stopping fabbricano
  correlazioni a comando. "Netta" solo se l'intervallo sta tutto oltre i 10 punti.
- **Una domanda alla volta** (Decisione 13): i campi della sez. 4 restavano vuoti perché
  nessuna schermata li chiedeva, e aggiungerli al modulo della sera sarebbe stato il modo
  sicuro di non ottenerli lo stesso. Si chiede un campo solo, quello più in ritardo sulla
  propria cadenza, con il perché in una riga e un "non ora" che costa un tap.
- **Dati strutturati** (toggle/scelte), non testo libero: veloci da inserire e analizzabili.
  Unica eccezione voluta: il campo `note` della sez. 5, che raccoglie l'imprevisto che
  nessun chip prevede. Non deve mai diventare il posto dove finiscono dati strutturabili.
- **Promemoria push via server** (`docs/notifiche-push.md`): una PWA non può programmare
  da sola una notifica ad app chiusa, quindi la sveglia è `pg_cron` su Supabase → Edge
  Function → Web Push. Non Vercel: il free tier limita i cron a 1/giorno senza garanzia
  sul minuto. Chi avvisare lo decide **SQL** (`promemoria_da_inviare()`), non la Edge
  Function: la regola sta accanto ai dati e si interroga a mano. Solo **Android**.

## Principi di UX da rispettare
- Inserimento del minimo (l'esito) in **pochi tap**, pensato per un genitore assonnato.
- **Progressive disclosure**: mostrare poco, far comparire il resto solo se serve.
- Tono **senza colpa**: la notte bagnata è un dato, non un errore. Niente stati "allarme".
- Evitare meccaniche a "streak" ansiogene: premiare la costanza, non il risultato asciutto.
- Il bambino (8 anni) può fare lui il tap del mattino; il contesto ricco lo cura il genitore.
- Notifiche (sera + mattina) = motore della raccolta. Da tenere nel primo giro, non dopo.
- **Notifica silenziosa se il dato c'è già** — per entrambi i genitori, perché il dato è
  del bambino, non di chi lo scrive. Un promemoria a scheda piena è rumore e insegna a
  ignorarlo. I bottoni "Asciutto"/"Bagnato" nella notifica del mattino registrano la notte
  con un tap; i dettagli del bagnato si aprono ma restano **facoltativi** (nullable a
  schema), altrimenti la notte bagnata costerebbe più fatica di quella asciutta.
- **"Sera" inizia alle 21** (`CUTOFF_SERA_ORA`), non nel pomeriggio: prima di quell'ora
  chiedere il contesto di stanotte significa farlo inventare, la cena non c'è ancora stata.
  Il pomeriggio resta la coda della mattina (l'esito della notte passata è ancora aperto).
- **In una PWA "la sessione" dura giorni**: la schermata fissa l'istante all'apertura (le
  card non devono muoversi sotto le dita), ma va rifatta al rientro in primo piano se nel
  frattempo è cambiato il giorno o il momento (`cambiamenti()`), altrimenti un'app aperta
  la mattina e riaperta alle 22 resta convinta che sia mattina e la domanda della sera non
  arriva mai. Solo quei due cambi: tornare da un'altra app dopo dieci secondi non ridisegna.

## Guardrail tecnici
- Ogni record ha `schema_version`, timestamp e `created_by`/`updated_by`: non rimuoverli.
- Non distruggere mai dati grezzi: se cambi categorie/fasce, converti in lettura, non nei dati.
- La logica di scadenza salute vive lato client (legge `child_active_states.salute_confermato_il`).
- **Due regole sono duplicate in SQL** per i promemoria (il server deve decidere mentre i
  telefoni dormono): `giorno_effettivo()` rispecchia `ORA_INIZIO_GIORNO = 5` e
  `contesto_vuoto()` rispecchia `contestoVuoto()`. Se cambi quelle lato client, cambia
  anche la migration 003: sono l'unico punto di disallineamento possibile.
- **Ogni ambiente ha le sue chiavi VAPID** (staging ≠ prod): un test non deve poter
  suonare sul telefono "vero". `scripts/setup-notifiche.sh` è idempotente e le riusa —
  rigenerarle costringe ogni telefono a riattivarsi.
- **Le chiavi VAPID stanno in `.env.vapid.<ref>`, non nei secrets di Supabase**: l'API
  `GET /projects/<ref>/secrets` restituisce lo SHA-256 dei valori, non i valori. Non
  rileggerle da lì per nessun motivo — riscriverle significa sostituirle col digest, e
  la Edge Function muore al boot (500) senza che nulla punti alla causa.

## Come lavorare
- Prima di scrivere codice, **proponi la struttura del progetto** e aspetta conferma.
- Se un requisito è ambiguo, **fai domande di chiarimento** prima di implementare.
- Aggiorna questo file quando prendiamo nuove decisioni, così resta la memoria del progetto.
