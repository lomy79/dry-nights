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

import { LIQUIDI_ORARIO, LIQUIDI_TIPO } from './costanti.js'

/** Le fasce, in ordine canonico (per iterazione/visualizzazione). */
export const ORARI = LIQUIDI_ORARIO.map((o) => o.value)
/** I tipi di bevanda ammessi. */
export const TIPI = LIQUIDI_TIPO.map((o) => o.value)

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

/** Lista ordinata { orario, tipi } delle sole fasce con bevande (per il riepilogo). */
export function riassuntoLiquidi(liquidi) {
  return ORARI.filter((o) => tipiPerOrario(liquidi, o).length > 0).map((o) => ({
    orario: o,
    tipi: tipiPerOrario(liquidi, o),
  }))
}
