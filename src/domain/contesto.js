/**
 * Stato di completamento del contesto serale (sez. 3) di una scheda notte.
 *
 * Serve al motore "cosa manca" per decidere se chiedere il contesto:
 *  - la mattina lo si chiede SOLO se è del tutto vuoto (non insistere sui buchi,
 *    sez. 6: "se la sera è compilata a metà, la mattina non insiste").
 */

import { haValore } from './schedaMerge.js'
import { liquidiVuoti } from './liquidi.js'

/** I campi che compongono il contesto serale (sez. 3). */
export const CAMPI_CONTESTO = [
  'pipi_prima_dormire',
  'liquidi_quantita',
  'liquidi', // mappa fascia->tipi (v2), correlata
  'cibi_sospetti',
]

/** Quanti campi del contesto sono valorizzati in questo record. */
export function campiContestoValorizzati(record) {
  if (!record) return 0
  let n = 0
  for (const c of CAMPI_CONTESTO) {
    // `liquidi` è una mappa: "vuota" ha bisogno di un controllo dedicato.
    if (c === 'liquidi') {
      if (!liquidiVuoti(record.liquidi)) n++
    } else if (haValore(record[c])) {
      // pipi_prima_dormire === false CONTA (risposta esplicita "no").
      n++
    }
  }
  return n
}

/** True se nessun campo di contesto è impostato. */
export function contestoVuoto(record) {
  return campiContestoValorizzati(record) === 0
}

/** 'vuoto' | 'parziale' | 'completo' — per l'etichetta nella UI. */
export function statoContesto(record) {
  const n = campiContestoValorizzati(record)
  if (n === 0) return 'vuoto'
  if (n === CAMPI_CONTESTO.length) return 'completo'
  return 'parziale'
}
