# Scheda Notte — Modello dati

Rappresenta **una notte per bambino**. È l'unità base dell'app: da qui si costruiscono grafici, statistiche ed export per il pediatra.

Principio guida: **il dato minimo si prende in pochi secondi**; tutto il resto è contesto opzionale che non deve mai rallentare o bloccare la registrazione quotidiana.

---

## 1. Identità e metadati

| Campo | Tipo | Obbligatorio | Valori / Note |
|---|---|---|---|
| `id` | UUID | sì (generato) | Identificatore univoco della scheda |
| `bambinoId` | riferimento | sì | Profilo del bambino, **condiviso tra i due genitori** (vedi sez. 6 e *Decisione 5*). Utile prevederlo anche con un solo figlio, per non riprogettare tutto se in futuro se ne aggiunge un altro |
| `dataNotte` | data | sì | La notte di riferimento (vedi *Decisione 1*). Vincolo di unicità: una sola scheda per `bambinoId` + `dataNotte` |
| `creatoIl` | datetime | sì (auto) | Momento della prima registrazione |
| `modificatoIl` | datetime | sì (auto) | Ultima modifica |
| `inseritoDa` | enum | no | `genitore` \| `bambino` — utile per capire chi usa cosa |

---

## 2. Esito — il nucleo obbligatorio

È la spina dorsale. Deve essere registrabile con **un tap** da un genitore assonnato.

| Campo | Tipo | Obbligatorio | Valori / Note |
|---|---|---|---|
| `esito` | enum | sì | `asciutto` \| `bagnato` |
| `gravita` | enum | sì *se* `bagnato` | `piccola` (macchia) \| `media` \| `zuppo` (letto intero) |
| `episodi` | intero ≥1 | no (solo se `bagnato`) | Quante volte durante la notte |
| `minzioneNotturna` | enum | no (consigliato) | `nessuna` (ha dormito senza alzarsi) \| `da solo` (svegliato e in bagno **spontaneamente** — segnale di progresso: percepisce lo stimolo nel sonno) \| `accompagnato/svegliato` (portato dal genitore o svegliato dall'allarme) |
| `numeroRisvegli` | intero ≥1 | no | Se si è alzato più volte nella stessa notte |

Note importanti:
- Se `esito = asciutto`, `gravita` ed `episodi` non si applicano (restano nulli).
- **Assenza di scheda ≠ notte asciutta.** Un giorno senza dato è *sconosciuto* (vedi *Decisione 2*).
- `minzioneNotturna` descrive **cos'è successo davvero** quella notte; non va confuso con `interventi` (sez. 4), che descrive la **strategia** adottata. Tenere `da solo` separato da `accompagnato/svegliato` è essenziale: solo il primo è merito del bambino e misura il vero progresso. Questo dato lo conosce il genitore (non si legge dal letto), quindi si chiede la mattina con l'esito o lo registra chi è sveglio di notte.

---

## 3. Contesto serale (liquidi e cibo) — opzionale

Dà senso ai numeri, ma non va imposto ogni giorno. Qui non conta solo *quanto* ha bevuto, ma **quando** e **cosa**: sono i fattori che, sera dopo sera, fanno emergere i pattern di tuo figlio.

| Campo | Tipo | Obbligatorio | Valori / Note |
|---|---|---|---|
| `pipiPrimaDiDormire` | booleano | no | Ha svuotato la vescica prima di coricarsi |
| `liquidiSera` | enum | no | `pochi` \| `medi` \| `molti` — quantità **complessiva** della sera |
| `liquidi` | mappa `fascia → [voci]` | no | **Tipo e fascia CORRELATI** (schema_version 2). Per ogni fascia (`prima di cena` \| `a cena` \| `dopo cena` \| `subito prima di dormire`) si scelgono i tipi bevuti (`acqua` \| `latte` \| `zuccherate` \| `caffeina/teina` \| `altro`) **oppure** una delle due risposte non-bevanda `nessuna` (non ha bevuto) \| `non so` — vedi *Decisione 9*. Cattura "the prima di cena, acqua a cena, latte dopo cena", che due liste separate perdevano. La fascia cattura la differenza che conta (bere alle 19 ≠ bere alle 23); "subito prima di dormire" è il caso più a rischio. *Sostituisce* i vecchi `tipoLiquidiSera`/`orarioLiquidi` (colonne legacy tenute, non più usate)|
| `cibiSospetti` | multi-scelta | no | `fritto` \| `molto salato` \| `piccante` \| `frutta molto acquosa` \| `nessuno` — solo i fattori che possono influire sulla produzione di urina notturna, **non** un diario alimentare completo |

---

## 4. Contesto clinico / giornaliero — opzionale ma prezioso

Sono i campi che un medico chiederà quasi sicuramente.

| Campo | Tipo | Obbligatorio | Valori / Note |
|---|---|---|---|
| `alvo` | enum | no | `regolare` \| `stitico/feci dure` \| `nessuna evacuazione` \| `diarrea` — **la stitichezza è una causa frequente e nascosta dell'enuresi** |
| `sintomiDiurni` | multi-scelta | no | `urgenza` \| `minzioni molto frequenti` \| `incidenti di giorno` \| `nessuno` — distingue l'enuresi notturna "semplice" da quella con componente diurna, che si tratta diversamente |
| `interventi` | multi-scelta | no | `sveglia/lifting notturno` \| `allarme enuresi` \| `terapia in corso` \| `nessuno` — serve a correlare poi le azioni con i risultati |
| `statoSalute` | multi-scelta **persistente** | no | `sano` (default) \| `febbre` \| `tosse` \| `raffreddore/naso chiuso` \| `mal di gola` \| `altro` — la febbre fa bere e sudare di più, un malanno spiega spesso le notti-outlier. **Persistente**: una volta impostato ≠ `sano`, vale per le notti successive senza reinserirlo ogni sera (vedi *Decisione 7* per la scadenza). Distingue una notte bagnata "da malattia" da un vero peggioramento |

---

## 5. Note e tono

| Campo | Tipo | Obbligatorio | Valori / Note |
|---|---|---|---|
| `note` | testo libero | no | Spazio per l'imprevisto (febbre, gita, dormito fuori casa…) |
| `umoreBambino` | enum/emoji | no | `contento` \| `neutro` \| `turbato` — leggero, dà colore senza mai trasformare la notte bagnata in una "bocciatura" |

---

## 6. Come e quando si compila — un record, più momenti

La scheda della notte **non** ha un momento fisso di compilazione: è una finestra unica con **due occasioni** per riempirla, pensata per due genitori che si alternano.

- **La sera (opzionale):** chi mette a letto il bambino può inserire il contesto (sez. 3 — liquidi, orario, cibo) per la notte che sta per iniziare. Se nessuno lo fa, non succede niente di male.
- **La mattina (obbligatoria):** chi controlla il letto registra l'**esito** (sez. 2). Se il contesto della sera è **ancora vuoto**, l'app lo chiede qui con due chip veloci (a memoria). Se invece la sera è già stato compilato, la mattina **non lo richiede**: mostra al massimo un riepilogo con opzione "modifica".
- **Recupero serale (rete di sicurezza):** se la mattina ci si dimentica di registrare l'esito, la sera dopo l'app chiede *"com'è andata la scorsa notte?"* e chiude il buco. Un dato in ritardo vale molto più di un dato perso.

**Attenzione: la sera si toccano due record diversi.** La sera del 12, "com'è andata la scorsa notte?" compila l'**esito della notte del 12**; il contesto liquidi/cibo inserito la stessa sera riguarda invece la **notte del 13**. Vanno tenuti separati nella UI e nei dati, o si attribuisce l'esito alla notte sbagliata — bug che falsa silenziosamente tutte le statistiche. La convenzione di *Decisione 1* è ciò che rende questa distinzione univoca.

Regole che discendono da questa logica:

- **Un solo record per notte** (`bambinoId` + `dataNotte`): i momenti di compilazione sono porte d'ingresso verso lo stesso dato, mai schede diverse.
- **Non chiedere due volte la stessa cosa.** Ogni momento controlla cosa manca e chiede solo quello; se un dato c'è già, non lo ripropone.
- **I chip di contesto compaiono anche dopo una notte asciutta**, non solo dopo una bagnata: senza il confronto asciutto vs bagnato non emerge nessun pattern.
- **Se la sera è compilata a metà** (es. liquidi sì, cibo no), la mattina *non insiste* sui buchi. Per un dato "meglio-che-niente", l'attrito in più non vale la pena.
- **Il recupero ha una finestra breve** — la sera dopo, al massimo due. Chiedere "com'è andata martedì?" il venerdì è inutile: la risposta sarebbe inventata. Passata la finestra, la notte resta *sconosciuta* e va bene così.

---

## Decisioni da prendere prima di scrivere codice

**Decisione 1 — Convenzione della data.** Una notte è a cavallo di due giorni. Serve una regola unica e coerente. Consiglio: `dataNotte` = **la data del mattino del risveglio**, perché è quando si registra ed è la più intuitiva. L'importante è non mischiare le due convenzioni.

**Decisione 2 — Giorni mancanti.** Le persone salteranno dei giorni. Un giorno senza scheda deve valere *sconosciuto*, non *asciutto*: se lo tratti come asciutto, gonfi i progressi e i grafici mentono. Da gestire esplicitamente in statistiche ed export.

**Decisione 3 — Dati strutturati, non testo.** Tutti i campi sopra sono toggle/scelte, non testo libero (tranne `note`). Motivo: si inseriscono in pochi secondi *e* sono analizzabili per grafici ed export. Il testo libero non è né l'uno né l'altro.

**Decisione 4 — Dove chiedere il contesto.** Il contesto (sez. 3) si raccoglie nella finestra unica descritta in sez. 6: opzionale la sera, e se rimasto vuoto lo si chiede la mattina insieme all'esito. Da evitare l'"Aggiungi dettagli" come rituale serale separato: un campo opzionale, nascosto e in un momento a sé tende a restare sempre vuoto.

**Decisione 5 — Profilo condiviso tra i due genitori.** Perché "sera o mattina" funzioni davvero, i dati devono essere **condivisi e sincronizzati** tra i due account: l'app della mattina deve poter sapere che l'altro genitore ha già compilato la sera. Serve un profilo bambino condiviso (o un account famiglia). Senza sincronizzazione, i due momenti non si parlano.

**Decisione 6 — Conflitti / doppia scrittura.** Con dati sincronizzati i due momenti scrivono **campi diversi** (la sera il contesto, la mattina l'esito), quindi normalmente non si pestano i piedi. Per il caso raro di scrittura simultanea o offline sullo **stesso** campo, regola semplice: *vince l'ultimo che scrive*. Sui campi distinti, invece, si **fondono** i due contributi.

**Decisione 7 — Scadenza del flag salute (anti-flag-dimenticato).** Un flag persistente diverso da `sano` risolve l'attrito ma rischia di restare acceso per inerzia: una `febbre` dimenticata per settimane non è un buco (che sai leggere), è un dato *falso* che sporca le statistiche in silenzio. Regola:

- Lo stato ≠ `sano` vale per un **massimo di 3-4 giorni** (una sola finestra fissa nella prima versione — più semplice; la si differenzia per sintomo solo se serve).
- Alla scadenza l'app **obbliga a reimpostare** lo stato prima di poter salvare, e lo fa **ripartendo da `sano`**: si deve ri-selezionare attivamente il sintomo se persiste. Questo evita il "conferma automatica" di un genitore assonnato (rimettere ≠ confermare passivamente).
- Per le notti **oltre la scadenza non riconfermate**, lo stato è `sconosciuto` — mai `sano` d'ufficio né il vecchio sintomo. Alla riconferma si può chiudere la finestra retroattivamente alla data giusta ("è tornato sano da martedì").

**Decisione 8 — Bevande correlate alla fascia oraria (schema_version 2).** Tenere "cosa ha bevuto" e "quando" come due liste separate perde la correlazione: non distingue "the prima di cena + acqua a cena + latte dopo cena" da qualunque altra combinazione degli stessi ingredienti. Poiché il *pattern* (cosa, in quale fascia) è proprio ciò che fa emergere le cause, il dato va raccolto **correlato**: campo `liquidi` come mappa `fascia → [tipi]`. Le vecchie colonne `liquidi_tipo`/`liquidi_orario` restano (legacy, non distrutte — guardrail dati grezzi) ma non si usano più. La `liquidiSera` (quantità complessiva) resta separata. Migrazione additiva: `docs/migrations/002-liquidi-correlati.sql`.

**Decisione 9 — "Non ha bevuto" e "non so" sono risposte, non silenzio.** Con le sole bevande, una fascia senza chip accesi significava tre cose insieme: *non ho ancora risposto*, *non ha bevuto niente*, *ha bevuto ma non so cosa*. Le prime due sono agli antipodi — "a cena non ha bevuto" è un dato prezioso, che confrontato con le altre sere fa emergere un pattern — e appiattirle è lo stesso errore che la *Decisione 2* evita per l'esito (assenza ≠ asciutto). Quindi ogni fascia ammette due voci in più, `nessuna` e `non so`, **mutuamente esclusive** fra loro e con le bevande. Entrambe contano come contesto compilato: sono risposte date, e l'app non deve ririchiederle né far partire il promemoria serale. Statisticamente `non so` resta *sconosciuto*, `nessuna` è un valore vero. Nessuna migrazione: il vincolo Postgres su `liquidi` verifica solo che sia un oggetto JSON, i valori ammessi vivono in `src/domain/costanti.js`.

**Decisione 10 — La UI ordina le fasce per ciò che il genitore sa, non solo per ciò che pesa.** Le quattro fasce non sono equivalenti su due assi distinti: quanto contano clinicamente (cresce avvicinandosi al sonno) e quanto sono *conoscibili* (a cena il genitore c'è e guarda; alle 17 il bambino era a scuola o dai nonni). Mostrarle come quattro blocchi identici cancellava entrambe le gerarchie proprio mentre il campo esiste per catturarle. Perciò **"a cena" sta in alto e aperta** — è il dato che verrà inserito davvero, ogni sera — e le altre tre sono righe richiudibili che mostrano la risposta data. Un dato meno pesante ma raccolto tutte le sere vale più di un dato decisivo che resta sempre vuoto.

**Decisione 11 — Le statistiche si contano sulle notti NOTE, e la copertura viaggia col numero.** È la *Decisione 2* portata fino in fondo: se il denominatore fossero i giorni di calendario, ogni buco verrebbe contato come una notte non-bagnata e i progressi risulterebbero gonfiati proprio nei periodi in cui si è compilato meno. Quindi ogni percentuale ha per denominatore le notti con esito registrato, e accanto sta sempre **quante notti sono note su quante** — non in fondo alla schermata, nello stesso sguardo del numero grande. Un "80% di asciutte" su 5 notti registrate su 30 è la frase che un genitore riferirebbe al pediatra in perfetta buona fede, ed è falsa. Sotto due terzi di copertura l'app lo dice esplicitamente. Nel grafico settimanale le notti sconosciute sono un tratteggio e non un vuoto, e l'altezza della barra è il numero di notti *note*: una settimana con due dati deve apparire più corta, o il grafico dichiara una conoscenza che non c'è. **Il denominatore parte dall'inizio del diario**, non dal bordo del periodo scelto: prima che il bambino esistesse nell'app non ci sono notti sconosciute, c'è tempo in cui nessuno poteva registrare niente. Contarle come buchi fa due danni simmetrici — abbassa la copertura per dati che non potevano esistere e riempie il grafico di settimane vuote che sembrano settimane saltate. Verificato sui dati veri il 2026-08-12: un diario iniziato il 24 luglio, guardato a 90 giorni, dichiarava 73 notti sconosciute e una copertura del 19%; con il taglio all'inizio del diario, 17 note su 20 e l'85%. L'inizio è la più vecchia fra la creazione del bambino e la prima notte registrata, perché dallo storico si possono compilare notti antecedenti. Quando il taglio scatta, la UI lo dice: un "ultimi 90 giorni" che ne mostra venti senza spiegarsi sembra un dato perso. Implementazione: `src/domain/statistiche.js` (`inizioDiario`, `restringiPeriodo`).

**Decisione 12 — Le correlazioni hanno una soglia dichiarata, un'incertezza dichiarata e un contatore.** Il contesto (sez. 3 e 4) esiste per far emergere i pattern, ma su un diario domestico qualunque differenza fra due gruppi da dieci notti è compatibile col caso. E il modo in cui la si guarderebbe è il peggiore possibile: molti fattori insieme, riguardati ogni sera, fermandosi quando "viene bene" — confronti multipli e *optional stopping*, i due modi classici di fabbricare una correlazione inesistente. Perciò **niente test di significatività**: si guarda l'ampiezza dell'incertezza, con tre stati (`src/domain/correlazioni.js`).

- **Raccolta** — il gruppo più piccolo non arriva a `MIN_PER_GRUPPO` (10). Nessuna percentuale: solo quante notti mancano. Conta il gruppo **più piccolo**, non il totale, ed è la parte non ovvia: se beve sempre qualcosa dopo cena si possono accumulare trecento notti senza avere mai un termine di paragone, e il contatore deve dire che servono notti *senza*.
- **Incerta** — percentuali visibili, ognuna col suo intervallo di Wilson al 95%, più la frase che le due situazioni potrebbero ancora essere uguali.
- **Netta** — l'intervallo sulla differenza (Newcombe) sta **tutto oltre `DIFFERENZA_MINIMA`** (10 punti): anche l'estremo più prudente descrive una differenza che conta. Non basta "esclude lo zero": un intervallo [+1, +46] è compatibile con l'irrilevanza, e chiamarlo netto sarebbe la stessa bugia del p-value appena sotto 0,05. Anche qui il testo dice *osservata*, mai *causa*.

Ordine di grandezza, perché non sia una sorpresa: servono ~25 notti per gruppo per vedere una differenza di 30 punti, cioè circa due mesi con esposizione bilanciata. Il contatore non è un ripiego: è l'unica cosa che si muove ogni settimana, ed è il miglior motivo per compilare anche stasera. Sono escluse dalle correlazioni le notti con salute `malato` o `sconosciuto` (la malattia muove insieme bevande ed esito: è un confondente) e, per il singolo fattore, quelle in cui l'esposizione è `non so` — ignota, non negativa (*Decisione 9*).
