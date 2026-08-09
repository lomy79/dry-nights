/**
 * Bevande correlate alla fascia oraria (schema_version 2).
 *
 * Struttura: mappa { fascia -> [tipi] }. Conserva la correlazione che due liste
 * separate perdevano: "the (caffeina) prima di cena, acqua a cena, latte dopo
 * cena" diventa
 *   { prima_di_cena: ['caffeina_teina'], a_cena: ['acqua'], dopo_cena: ['latte'] }.
 *
 * Le fasce senza bevande sono assenti dalla mappa (o array vuoto): mappa vuota
 * = nessun dato.
 */

import { LIQUIDI_ORARIO, LIQUIDI_TIPO, LIQUIDI_RISPOSTA, etichettaValore } from './costanti.js'

/** Le fasce, in ordine canonico (per iterazione/visualizzazione). */
export const ORARI = LIQUIDI_ORARIO.map((o) => o.value)
/** I tipi di bevanda ammessi. */
export const TIPI = LIQUIDI_TIPO.map((o) => o.value)
/** Le risposte che non sono bevande: 'nessuna' (non ha bevuto) e 'non_so'. */
export const RISPOSTE = LIQUIDI_RISPOSTA.map((o) => o.value)

/** True se `voce` è una risposta ('nessuna'/'non_so') e non una bevanda. */
export function eRisposta(voce) {
  return RISPOSTE.includes(voce)
}

/** True se nessuna fascia ha bevande. */
export function liquidiVuoti(liquidi) {
  if (!liquidi || typeof liquidi !== 'object') return true
  return Object.values(liquidi).every((t) => !Array.isArray(t) || t.length === 0)
}

/** I tipi bevuti in una fascia (array, eventualmente vuoto). */
export function tipiPerOrario(liquidi, orario) {
  const t = liquidi?.[orario]
  return Array.isArray(t) ? t : []
}

/**
 * Ritorna una NUOVA mappa con i tipi di una fascia impostati. Se `tipi` è vuoto,
 * rimuove la fascia (così la mappa resta pulita e `liquidiVuoti` funziona).
 */
export function impostaOrario(liquidi, orario, tipi) {
  const base = { ...(liquidi ?? {}) }
  if (!Array.isArray(tipi) || tipi.length === 0) {
    delete base[orario]
  } else {
    base[orario] = [...tipi]
  }
  return base
}

/**
 * Accende/spegne una voce in una fascia, applicando l'esclusività.
 *
 * 'Niente' e 'Non so' sono risposte, non bevande: convivere con l'acqua non ha
 * senso, e nemmeno stare insieme fra loro. Quindi:
 *  - tocchi una risposta  -> sostituisce tutto (ri-toccarla azzera la fascia);
 *  - tocchi una bevanda   -> scaccia l'eventuale risposta e fa toggle normale.
 *
 * Ritorna una NUOVA mappa (le altre fasce restano intatte).
 */
export function toggleVoce(liquidi, orario, voce) {
  const attuali = tipiPerOrario(liquidi, orario)

  if (eRisposta(voce)) {
    // Ri-tap sulla stessa risposta = torna a "non risposto".
    return impostaOrario(liquidi, orario, attuali.includes(voce) ? [] : [voce])
  }

  const soloBevande = attuali.filter((v) => !eRisposta(v))
  const nuove = soloBevande.includes(voce)
    ? soloBevande.filter((v) => v !== voce)
    : [...soloBevande, voce]
  return impostaOrario(liquidi, orario, nuove)
}

/** 'vuoto' | 'niente' | 'non_so' | 'bevande' — lo stato di una fascia. */
export function statoFascia(liquidi, orario) {
  const voci = tipiPerOrario(liquidi, orario)
  if (voci.length === 0) return 'vuoto'
  if (voci.includes('nessuna')) return 'niente'
  if (voci.includes('non_so')) return 'non_so'
  return 'bevande'
}

/**
 * Riepilogo leggibile di una fascia, per la riga richiusa.
 * Null quando non c'è risposta: la UI mostra un trattino, che è il modo di dire
 * "questa domanda è ancora aperta" senza scriverlo.
 */
export function riassuntoFascia(liquidi, orario) {
  const voci = tipiPerOrario(liquidi, orario)
  if (voci.length === 0) return null
  return voci.map((v) => etichettaValore('liquidi_voce', v).toLowerCase()).join(', ')
}

/** Lista ordinata { orario, tipi } delle sole fasce con bevande (per il riepilogo). */
export function riassuntoLiquidi(liquidi) {
  return ORARI.filter((o) => tipiPerOrario(liquidi, o).length > 0).map((o) => ({
    orario: o,
    tipi: tipiPerOrario(liquidi, o),
  }))
}
