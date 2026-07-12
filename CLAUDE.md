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
- **Dati strutturati** (toggle/scelte), non testo libero: veloci da inserire e analizzabili.

## Principi di UX da rispettare
- Inserimento del minimo (l'esito) in **pochi tap**, pensato per un genitore assonnato.
- **Progressive disclosure**: mostrare poco, far comparire il resto solo se serve.
- Tono **senza colpa**: la notte bagnata è un dato, non un errore. Niente stati "allarme".
- Evitare meccaniche a "streak" ansiogene: premiare la costanza, non il risultato asciutto.
- Il bambino (8 anni) può fare lui il tap del mattino; il contesto ricco lo cura il genitore.
- Notifiche (sera + mattina) = motore della raccolta. Da tenere nel primo giro, non dopo.

## Guardrail tecnici
- Ogni record ha `schema_version`, timestamp e `created_by`/`updated_by`: non rimuoverli.
- Non distruggere mai dati grezzi: se cambi categorie/fasce, converti in lettura, non nei dati.
- La logica di scadenza salute vive lato client (legge `child_active_states.salute_confermato_il`).

## Come lavorare
- Prima di scrivere codice, **proponi la struttura del progetto** e aspetta conferma.
- Se un requisito è ambiguo, **fai domande di chiarimento** prima di implementare.
- Aggiorna questo file quando prendiamo nuove decisioni, così resta la memoria del progetto.
