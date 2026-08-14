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
| `ultimaEvacuazione` | enum | no | `oggi` \| `ieri` \| `2-3 giorni fa` \| `più di 3 giorni fa` \| `non so` — **la stitichezza è una causa frequente e nascosta dell'enuresi**, e ciò che conta è ogni quanti giorni. La risposta copre anche i giorni in cui la domanda non è stata fatta (*Decisione 14*) |
| `alvo` | enum | no | `regolare` \| `stitico/feci dure` \| `diarrea` — solo la **consistenza**: feci dure fanno male e insegnano a trattenere, ed è un'altra cura rispetto al solo numero di giorni. `nessuna evacuazione` resta legale nel database per le schede vecchie, ma non si offre più (*Decisione 14*) |
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

- **Raccolta** — il gruppo più piccolo non arriva a `MIN_PER_GRUPPO` (10). Nessuna percentuale: solo quante notti mancano, dette **per ciascuna delle due metà** (`mancaCon`, `mancaSenza`) e non solo per quella più magra: a gruppi vuoti "mancano 10 notti" prometteva metà del lavoro, quando le notti da raccogliere erano venti. Per lo stesso motivo il fattore "più vicino" si sceglie sul **totale** che gli manca, o 9-e-0 (undici alla meta) scavalcherebbe 5-e-5 (dieci). La soglia però resta sul gruppo **più piccolo**, ed è la parte non ovvia: se beve sempre qualcosa dopo cena si possono accumulare trecento notti senza avere mai un termine di paragone, e il contatore deve dire che servono notti *senza*.
- **Incerta** — percentuali visibili, ognuna col suo intervallo di Wilson al 95%, più la frase che le due situazioni potrebbero ancora essere uguali.
- **Netta** — l'intervallo sulla differenza (Newcombe) sta **tutto oltre `DIFFERENZA_MINIMA`** (10 punti): anche l'estremo più prudente descrive una differenza che conta. Non basta "esclude lo zero": un intervallo [+1, +46] è compatibile con l'irrilevanza, e chiamarlo netto sarebbe la stessa bugia del p-value appena sotto 0,05. Anche qui il testo dice *osservata*, mai *causa*.

Ordine di grandezza, perché non sia una sorpresa: servono ~25 notti per gruppo per vedere una differenza di 30 punti, cioè circa due mesi con esposizione bilanciata. Il contatore non è un ripiego: è l'unica cosa che si muove ogni settimana, ed è il miglior motivo per compilare anche stasera. Sono escluse dalle correlazioni le notti con salute `malato` o `sconosciuto` (la malattia muove insieme bevande ed esito: è un confondente) e, per il singolo fattore, quelle in cui l'esposizione è `non so` — ignota, non negativa (*Decisione 9*).

**Decisione 13 — Una domanda alla volta, quella che manca da più tempo.** Il primo report sui dati veri (12 agosto 2026) ha mostrato che i campi della sez. 4 erano vuoti al 100%: `alvo`, `sintomi_diurni` e `interventi` non li saltava nessuno — **nessuna schermata li chiedeva**. Esistevano nello schema, nelle costanti e nel riepilogo, ma non c'era un componente che li scrivesse. `gravita` e `minzione` erano raccoglibili, ma dietro la piega dei "dettagli" che si apre solo arrivando dal bottone "Bagnato" della notifica: presenti su 2 notti bagnate su 12.

La correzione ovvia — aggiungerli al modulo della sera — è il modo sicuro di non ottenerli lo stesso: un modulo lungo alle 23 non si compila, ed è la stessa ragione per cui la sez. 6 dice "non chiedere due volte la stessa cosa" e "se la sera è compilata a metà, la mattina non insiste". Quindi si chiede **una cosa sola per volta**, con un tap per rispondere e un tap per rimandare (`src/domain/domandaDelGiorno.js`).

- **Domande sulla notte** (`gravita`, `minzione`): riguardano *quella* notte, si fanno subito dopo l'esito e non ricompaiono nei giorni seguenti — a distanza la risposta sarebbe inventata, che è peggio del buco (*Decisione 2*). Non partono finché l'esito manca: finché manca quello, la domanda giusta è l'esito.
- **Domande lente** (`ultimaEvacuazione` ogni 3 giorni, `alvo` 7, `sintomi_diurni` 7, `interventi` 14): non cambiano ogni giorno, e richiederle ogni sera è rumore — il rumore insegna a ignorare, ed è lo stesso motivo per cui la notifica tace se il dato c'è già. Si fanno **solo di sera**: la pancia di oggi la si sa a fine giornata, non alle otto del mattino. Vince quella più in ritardo rispetto alla **propria** cadenza; "mai risposto" è un ritardo infinito e passa davanti a tutto.
- Le risposte lente si scrivono sulla notte **in arrivo** (la giornata appena finita precede quella notte), quindi il calcolo del "da quanto non rispondi" deve includerla: guardando solo fino a oggi, la risposta data stasera risulterebbe nel futuro e la domanda tornerebbe ogni sera per sempre. Per lo stesso motivo l'età di una risposta si conta dal **giorno in cui è stata data**, non dalla notte su cui è scritta, e la cadenza è scaduta quando i giorni la **raggiungono**: contare dalla notte e pretendere di superarla erano due ritardi da un giorno l'uno, e insieme facevano tornare l'alvo ogni cinque sere invece che ogni tre — un campo chiesto la metà delle volte previste, senza che nulla nell'app lo dicesse (corretto il 14 agosto 2026).
- Ogni domanda porta con sé **il perché in una riga** (la stitichezza è una causa frequente; alzarsi da solo è il progresso vero). Chiedere la pancia a chi non sa cosa c'entri con la pipì a letto è il modo migliore per farsi rispondere a caso.
- Il "non ora" vale 3 giorni e vive nel `localStorage`, non nel database: è una preferenza di chi ha in mano il telefono, non un dato del bambino. Se un genitore rimanda, l'altro può ancora rispondere — e magari lui la risposta ce l'ha.

**Decisione 14 — La pancia si conta in giorni, non si fotografa una sera.** Il campo `alvo` metteva insieme due cose di natura diversa: la **consistenza** delle feci (`regolare`, `stitico`, `diarrea`) e un **conteggio** (`nessuna evacuazione`). Sulla consistenza un campione ogni tre sere va bene — è un tratto che dura. Sul conteggio no, e il perché è aritmetico: fra una risposta e l'altra restano due sere ignote, quindi rispondendo "nessuna evacuazione" lunedì e "regolare" giovedì non si distingue un bambino che evacua ogni giorno da uno che l'ha fatto una volta in quattro. L'intervallo del campionamento e la scala del fenomeno coincidono, e un fenomeno campionato al proprio passo sparisce. Spariva proprio la **frequenza**, cioè la prima cosa che il pediatra guarda.

La via d'uscita non è chiedere ogni sera. Si fa **una domanda a sera** (*Decisione 13*), quindi la somma delle frequenze è un budget: `1/3 + 1/7 + 1/7 + 1/14 ≈ 0,69` domande a sera ci sta, ma una cadenza giornaliera da sola lo saturerebbe e le altre tre non uscirebbero quasi mai. Le cadenze diventerebbero promesse che l'app non può mantenere — e c'è un test che verifica che la somma resti sotto 1, perché è un vincolo vero, non una raccomandazione.

Quindi si cambia **la domanda**, non la frequenza: *"Quando ha fatto la cacca l'ultima volta?"* → `oggi` | `ieri` | `2-3 giorni fa` | `più di 3 giorni fa` | `non so`. Una risposta così porta dentro di sé i giorni in cui non è stata chiesta: "più di 3 giorni fa" dice qualcosa anche delle sere in cui l'app taceva, mentre "nessuna evacuazione" parlava solo di quel giorno. Chiesta ogni tre sere, la frequenza si ricostruisce lo stesso. `non so` c'è per la stessa ragione delle fasce dei liquidi (*Decisione 9*): senza, il genitore che non c'era o inventa o salta, e saltare fa tornare la domanda comunque.

- Le fasce **non si sovrappongono e coprono tutto**: nessuna risposta è "quasi". Confrontandole si usa l'estremo **basso** (`2-3 giorni` → 2), per non promettere una precisione che la risposta non ha.
- La correlazione nuova (`senza_evacuazione`, oltre i 3 giorni) prende solo i **poli**: `oggi`/`ieri` è non-esposto, `oltre 3 giorni` è esposto, `2-3 giorni` resta fuori perché lì la risposta onesta è "dipende" e forzarla in un gruppo inventerebbe un dato (*Decisione 12*). `non so` è ignoto, non negativo (*Decisione 9*). È anche la correlazione che riempirà i gruppi per prima, essendo la domanda più frequente.
- `alvo` resta, con le sole tre consistenze offerte, sulla cadenza dei 7 giorni.
- **I dati vecchi non si riscrivono, si leggono** (`src/domain/alvo.js`). Un vecchio `alvo` di consistenza implica un'evacuazione quel giorno — è una deduzione, non una stima: per dire com'erano le feci bisognava averle viste. `nessuna evacuazione`, invece, dice soltanto "non oggi": quanti giorni fossero passati non è mai stato chiesto e resta **ignoto**. È esattamente il buco per cui questa decisione esiste, e riempirlo a posteriori con una media sarebbe il modo peggiore di celebrarla.
