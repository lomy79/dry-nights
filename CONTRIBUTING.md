# Come contribuire a Dry Nights

Grazie per l'interesse! Questo è un progetto nato da un'esigenza familiare, ma
aperto a chiunque voglia migliorarlo. Ogni contributo — codice, documentazione,
segnalazioni, idee — è benvenuto.

## Prima di iniziare

- Leggi il [README](README.md) per avviare il progetto in locale.
- Leggi i documenti in [`docs/`](docs/): il modello dati è la **fonte di verità
  del dominio**. Prima di toccare lo schema o le categorie di dati, allineati lì.
- Rispetta il [Codice di Condotta](CODE_OF_CONDUCT.md).

## Principi del progetto

Questa app segue alcuni principi non negoziabili; tienili presenti quando proponi
modifiche:

- **Tono senza colpa**: la notte bagnata è un dato, non un errore. Niente stati
  di "allarme", niente meccaniche a "streak" ansiogene.
- **Inserimento in pochi tap**, pensato per un genitore assonnato
  (progressive disclosure: mostrare poco, il resto solo se serve).
- **Non distruggere mai i dati grezzi**: se cambi categorie o fasce, converti in
  lettura, non nei dati.
- **Nessun segreto nel repo**: chiavi e password vivono solo in `.env` locale.

## Flusso di lavoro

1. Fai un **fork** del repository e crea un branch descrittivo
   (`feat/...`, `fix/...`, `docs/...`).
2. Fai le tue modifiche, con commit chiari e piccoli.
3. Verifica che i test passino:
   ```bash
   npm run test
   npm run build
   ```
4. Apri una **Pull Request** verso `main`, descrivendo *cosa* cambia e *perché*.

## Segnalare bug o proporre idee

Apri una **Issue** su GitHub descrivendo:

- cosa ti aspettavi e cosa è successo;
- passi per riprodurre (se è un bug);
- browser / dispositivo, se rilevante.

## Sicurezza

Se scopri una vulnerabilità, **non** aprire una issue pubblica: contatta
direttamente il maintainer. Trattandosi di dati sanitari di minori, la
riservatezza è prioritaria.
