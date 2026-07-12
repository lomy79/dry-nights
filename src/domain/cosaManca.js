/**
 * Motore "cosa manca": data la giornata, il momento (mattina/sera), i record
 * delle notti rilevanti e lo stato salute, decide quali "porte" mostrare.
 *
 * Incarna le regole della sez. 6:
 *  - MATTINA (oggi = X): registra l'ESITO della notte appena passata (X). Se il
 *    contesto di quella notte è ANCORA VUOTO, lo chiede insieme (retrospettivo,
 *    "a memoria"); se è compilato a metà, non insiste.
 *  - SERA (oggi = X): offre il CONTESTO della notte in arrivo (X+1, prospettico,
 *    opzionale) e fa da rete di RECUPERO per gli esiti mancanti delle notti
 *    recenti entro la finestra (incluso oggi: "com'è andata la scorsa notte?").
 *  - Sempre: se il flag salute è scaduto, chiede il RESET (Decisione 7).
 *
 * Tutto puro: `oggi`, `momento` e i record arrivano dall'esterno. `records` è
 * una mappa { 'YYYY-MM-DD': record }. Un record assente/incompleto = "sconosciuto".
 */

import {
  nottePassata,
  notteInArrivo,
  dataNotteIndietro,
  giornoEffettivo,
  puoRecuperare,
  FINESTRA_RECUPERO_GIORNI,
  ORA_INIZIO_GIORNO,
} from './dataNotte.js'
import { richiedeReset } from './saluteScadenza.js'
import { contestoVuoto, statoContesto } from './contesto.js'

/** Dalle 14 in poi consideriamo "sera". Solo un default, sovrascrivibile. */
export const CUTOFF_SERA_ORA = 14

/**
 * 'mattina' | 'sera' in base all'ora di `oggi`.
 * "Sera" va dal pomeriggio (cutoff) fino al risveglio (ORA_INIZIO_GIORNO),
 * attraversando la mezzanotte: alle 2 di notte siamo ancora "sera" (la notte
 * è in corso), non "mattina".
 */
export function momentoDelGiorno(oggi, cutoff = CUTOFF_SERA_ORA) {
  const h = (oggi instanceof Date ? oggi : new Date(oggi)).getHours()
  if (h >= cutoff || h < ORA_INIZIO_GIORNO) return 'sera'
  return 'mattina'
}

function esitoMancante(record) {
  return !record || record.esito == null
}

/**
 * @returns {{
 *   momento: 'mattina'|'sera',
 *   saluteReset: boolean,
 *   esito: {dataNotte, record}|null,          // mattina: notte passata da registrare
 *   contestoRetro: {dataNotte, record}|null,  // mattina: contesto della notte passata se vuoto
 *   contestoProsp: {dataNotte, record, stato}|null, // sera: contesto notte in arrivo
 *   recuperi: Array<{dataNotte, record}>,     // sera: esiti mancanti entro la finestra
 * }}
 */
export function cosaManca({
  oggi,
  momento,
  records = {},
  statoSalute = null,
  finestraRecupero = FINESTRA_RECUPERO_GIORNI,
} = {}) {
  const mom = momento ?? momentoDelGiorno(oggi)
  // Giorno effettivo: prima delle 5 restiamo sulla notte precedente.
  const giorno = giornoEffettivo(oggi)
  const dnPassata = nottePassata(giorno)
  const dnArrivo = notteInArrivo(giorno)
  const recPassata = records[dnPassata] ?? null

  const out = {
    momento: mom,
    saluteReset: !!statoSalute && richiedeReset(statoSalute, oggi),
    esito: null,
    contestoRetro: null,
    contestoProsp: null,
    recuperi: [],
  }

  if (mom === 'mattina') {
    if (esitoMancante(recPassata)) {
      out.esito = { dataNotte: dnPassata, record: recPassata }
    }
  } else {
    const recArrivo = records[dnArrivo] ?? null
    out.contestoProsp = {
      dataNotte: dnArrivo,
      record: recArrivo,
      stato: statoContesto(recArrivo),
    }
  }

  // Contesto della notte appena passata: se è rimasto DEL TUTTO VUOTO (nessuno
  // l'ha compilato la sera prima), lo si ripropone — di mattina come di sera,
  // finché resta vuoto. Se è compilato anche solo a metà, non si insiste.
  if (contestoVuoto(recPassata)) {
    out.contestoRetro = { dataNotte: dnPassata, record: recPassata }
  }

  // Recupero degli esiti mancanti nelle notti recenti (entro la finestra).
  // Mattina: dalla notte di IERI all'indietro (oggi è già la card principale).
  // Sera: oggi incluso ("com'è andata la scorsa notte?").
  const gInizio = mom === 'mattina' ? 1 : 0
  for (let g = gInizio; g <= finestraRecupero; g++) {
    const dn = g === 0 ? dnPassata : dataNotteIndietro(giorno, g)
    const rec = records[dn] ?? null
    if (esitoMancante(rec) && puoRecuperare(dn, giorno, finestraRecupero)) {
      out.recuperi.push({ dataNotte: dn, record: rec })
    }
  }

  return out
}

/**
 * Le date-notte che servono a `cosaManca` per una certa giornata: la notte in
 * arrivo, quella passata e le notti recuperabili. Utile allo store per sapere
 * quali record caricare in un colpo solo.
 */
export function dateNottiRilevanti(oggi, finestraRecupero = FINESTRA_RECUPERO_GIORNI) {
  const giorno = giornoEffettivo(oggi)
  const date = new Set([notteInArrivo(giorno), nottePassata(giorno)])
  for (let g = 1; g <= finestraRecupero; g++) date.add(dataNotteIndietro(giorno, g))
  return [...date]
}
