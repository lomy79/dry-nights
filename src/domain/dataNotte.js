/**
 * Convenzione della data (Decisione 1) e distinzione delle due notti che la
 * sera tocca (sez. 6). Qui nasce — o si previene — il bug silenzioso che
 * attribuisce l'esito alla notte sbagliata e falsa tutte le statistiche.
 *
 * CONVENZIONE UNICA: `data_notte` = la data del MATTINO del risveglio.
 * La notte che finisce il mattino del 12 luglio ha `data_notte = 2026-07-12`.
 *
 * Tutte le funzioni sono PURE: ricevono la data di riferimento (`oggi`) invece
 * di leggere l'orologio, così sono testabili e deterministiche.
 * Le date-notte sono rappresentate come stringhe ISO 'YYYY-MM-DD' (date-only):
 * niente ora, niente fuso, un solo formato ovunque.
 */

import {
  format,
  addDays,
  subDays,
  parseISO,
  differenceInCalendarDays,
  isValid,
} from 'date-fns'

/** Finestra del recupero serale (sez. 6): "la sera dopo, al massimo due". */
export const FINESTRA_RECUPERO_GIORNI = 2

/**
 * Ora locale a cui "inizia" un nuovo giorno-scheda: il risveglio.
 * Tra la mezzanotte e quest'ora siamo ancora nella CODA della notte precedente
 * (che non è ancora finita), quindi non si scatta al giorno nuovo a mezzanotte.
 */
export const ORA_INIZIO_GIORNO = 5

/** Normalizza un input (Date | 'YYYY-MM-DD') a oggetto Date a mezzanotte locale. */
function aData(riferimento) {
  const d = typeof riferimento === 'string' ? parseISO(riferimento) : riferimento
  if (!(d instanceof Date) || !isValid(d)) {
    throw new Error(`Data non valida: ${riferimento}`)
  }
  return d
}

/**
 * La data-notte "corrente" per un istante reale, tenendo conto che il giorno
 * inizia alle ORA_INIZIO_GIORNO: prima di quell'ora restiamo sul giorno
 * precedente (la notte è ancora in corso). Ritorna 'YYYY-MM-DD'.
 * Va passato un istante reale (Date con ora), non una data-only.
 */
export function giornoEffettivo(adesso) {
  const m = adesso instanceof Date ? adesso : new Date(adesso)
  const base = m.getHours() < ORA_INIZIO_GIORNO ? subDays(m, 1) : m
  return toDataNotte(base)
}

/** Converte una data in stringa data-notte 'YYYY-MM-DD' (ora locale). */
export function toDataNotte(riferimento) {
  return format(aData(riferimento), 'yyyy-MM-dd')
}

/**
 * La notte appena trascorsa, il cui mattino è `oggi`.
 * È la notte di cui si registra l'ESITO al risveglio (porta della mattina) e
 * quella su cui interviene il recupero serale ("com'è andata la scorsa notte?").
 */
export function nottePassata(oggi) {
  return toDataNotte(oggi)
}

/**
 * La notte che sta per iniziare stanotte: il suo mattino è domani.
 * È la notte a cui si riferisce il CONTESTO serale (liquidi/cibo) inserito
 * questa sera (porta della sera).
 */
export function notteInArrivo(oggi) {
  return toDataNotte(addDays(aData(oggi), 1))
}

/**
 * Cosa tocca UNA stessa sera, esplicitato per non confonderle (sez. 6):
 *  - `esito`   → la notte appena trascorsa (data = oggi)
 *  - `contesto`→ la notte in arrivo (data = domani)
 * La sera del 12: l'esito compila la notte del 12, il contesto la notte del 13.
 */
export function serataTocca(oggi) {
  return {
    esito: nottePassata(oggi),
    contesto: notteInArrivo(oggi),
  }
}

/** Giorni di calendario tra il mattino di `dataNotte` e `oggi` (>=0 = passato). */
export function giorniDaNotte(dataNotte, oggi) {
  return differenceInCalendarDays(aData(oggi), aData(dataNotte))
}

/**
 * Si può ancora recuperare l'esito di `dataNotte` la sera di `oggi`?
 * Vero entro la finestra (0 = stessa mattina/sera, fino a FINESTRA_RECUPERO_GIORNI).
 * Oltre la finestra la notte resta "sconosciuta" (Decisione 2) e va bene così:
 * una risposta tardiva sarebbe inventata.
 */
export function puoRecuperare(dataNotte, oggi, finestra = FINESTRA_RECUPERO_GIORNI) {
  const diff = giorniDaNotte(dataNotte, oggi)
  return diff >= 0 && diff <= finestra
}

/** La data-notte di N giorni fa rispetto a oggi (utile per query/storico). */
export function dataNotteIndietro(oggi, giorni) {
  return toDataNotte(subDays(aData(oggi), giorni))
}
