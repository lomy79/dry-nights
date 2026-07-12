/**
 * Scadenza del flag salute (Decisione 7) — anti "flag dimenticato".
 *
 * Uno stato ≠ 'sano' è persistente ma NON eterno: vale per una finestra breve;
 * oltre, l'app obbliga a reimpostare ripartendo da 'sano'. Un flag lasciato
 * acceso per inerzia non è un buco (che sai leggere) ma un dato FALSO che
 * sporca le statistiche in silenzio.
 *
 * La logica vive lato client e legge `child_active_states.salute_confermato_il`
 * (guardrail in CLAUDE.md). Tutto puro e testabile: `oggi` passato dall'esterno.
 */

import { differenceInCalendarDays, parseISO, isValid } from 'date-fns'

/** Finestra massima di validità di uno stato ≠ 'sano' (Decisione 7: 3-4 giorni). */
export const FINESTRA_SALUTE_GIORNI = 3

function aData(riferimento) {
  const d = typeof riferimento === 'string' ? parseISO(riferimento) : riferimento
  if (!(d instanceof Date) || !isValid(d)) {
    throw new Error(`Data non valida: ${riferimento}`)
  }
  return d
}

/**
 * Stato di salute EFFETTIVO a una certa data, applicando la scadenza.
 *
 * @param {object} stato - riga child_active_states:
 *   { salute_stato, salute_sintomi, salute_confermato_il }
 * @param {Date|string} quando - data per cui calcolare (di norma la data_notte).
 * @returns {{ stato: 'sano'|'malato'|'sconosciuto', sintomi: string[], scaduto: boolean }}
 *
 * Regole:
 *  - 'sano' non scade mai → resta 'sano'.
 *  - ≠ 'sano' entro la finestra → resta 'malato' con i suoi sintomi.
 *  - ≠ 'sano' oltre la finestra (o senza data di conferma) → 'sconosciuto':
 *    mai 'sano' d'ufficio, mai il vecchio sintomo (Decisione 7).
 */
export function statoSaluteEffettivo(stato, quando) {
  const salute_stato = stato?.salute_stato ?? 'sano'
  const sintomi = stato?.salute_sintomi ?? []

  if (salute_stato === 'sano') {
    return { stato: 'sano', sintomi: [], scaduto: false }
  }

  // Stato ≠ 'sano' senza data di conferma: non ci fidiamo → sconosciuto.
  if (!stato?.salute_confermato_il) {
    return { stato: 'sconosciuto', sintomi: [], scaduto: true }
  }

  const diff = differenceInCalendarDays(aData(quando), aData(stato.salute_confermato_il))

  // Notti PRIMA della conferma: lo stato non era ancora impostato → sconosciuto.
  if (diff < 0) {
    return { stato: 'sconosciuto', sintomi: [], scaduto: false }
  }

  if (diff <= FINESTRA_SALUTE_GIORNI) {
    return { stato: 'malato', sintomi: [...sintomi], scaduto: false }
  }

  // Oltre la finestra, non riconfermato.
  return { stato: 'sconosciuto', sintomi: [], scaduto: true }
}

/**
 * L'app deve OBBLIGARE a reimpostare la salute prima di poter salvare?
 * Vero quando lo stato corrente è ≠ 'sano' ed è scaduto (o senza data valida).
 * Alla riconferma si riparte da 'sano' (rimettere ≠ confermare passivamente).
 */
export function richiedeReset(stato, oggi) {
  const salute_stato = stato?.salute_stato ?? 'sano'
  if (salute_stato === 'sano') return false
  return statoSaluteEffettivo(stato, oggi).scaduto === true
}

/**
 * Snapshot da salvare sul night_record di una certa notte (i campi
 * `salute_stato` / `salute_sintomi` della scheda notte servono alle
 * correlazioni: vanno congelati com'erano QUELLA notte, non "ora").
 */
export function snapshotSalutePerNotte(stato, dataNotte) {
  const eff = statoSaluteEffettivo(stato, dataNotte)
  return { salute_stato: eff.stato, salute_sintomi: eff.sintomi }
}
