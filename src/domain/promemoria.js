/**
 * Promemoria push: orari e deep-link dei bottoni della notifica.
 *
 * Qui sta solo la parte PURA (nessuna rete, nessun browser): gli orari validi
 * e la lettura del deep-link con cui la notifica riapre l'app. La decisione di
 * "chi avvisare" vive in SQL (docs/migrations/003-notifiche-push.sql), perche'
 * va presa sul server mentre i telefoni dormono.
 */

import { ESITO } from './costanti.js'
import {
  nottePassata,
  giornoEffettivo,
  puoRecuperare,
  FINESTRA_RECUPERO_GIORNI,
} from './dataNotte.js'

/**
 * I due promemoria. La sera alle 23 la giornata e' finita davvero (cena e
 * liquidi sono gia' stati, non si inventa niente); le 8 prendono il risveglio
 * senza suonare in piena notte.
 */
export const ORE_PROMEMORIA_DEFAULT = {
  sera: '23:00',
  mattina: '08:00',
}

/**
 * Il cron gira ogni 15 minuti: un orario piu' fine di cosi' sarebbe una bugia
 * (chiederesti le 23:07 e arriverebbe comunque alle 23:15). Meglio offrire solo
 * quello che l'infrastruttura sa mantenere.
 */
export const PASSO_MINUTI = 15

const RE_ORA = /^([01]\d|2[0-3]):([0-5]\d)$/

/** True se `hhmm` e' un orario 'HH:MM' valido. */
export function oraValida(hhmm) {
  return typeof hhmm === 'string' && RE_ORA.test(hhmm)
}

/**
 * Arrotonda un orario al quarto d'ora piu' vicino, restando dentro la giornata:
 * 23:53 diventa 23:45, non 00:00 del giorno dopo (che sposterebbe il promemoria
 * della sera sulla notte sbagliata).
 */
export function arrotondaAlQuarto(hhmm) {
  if (!oraValida(hhmm)) throw new Error(`Orario non valido: ${hhmm}`)
  const [h, m] = hhmm.split(':').map(Number)
  const minuti = h * 60 + m
  const arrotondati = Math.min(
    Math.round(minuti / PASSO_MINUTI) * PASSO_MINUTI,
    24 * 60 - PASSO_MINUTI,
  )
  const hh = String(Math.floor(arrotondati / 60)).padStart(2, '0')
  const mm = String(arrotondati % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

/** 'HH:MM:SS' (come lo restituisce Postgres) -> 'HH:MM' per l'input time. */
export function oraDaDb(valore) {
  if (typeof valore !== 'string') return null
  const m = valore.match(/^(\d{2}:\d{2})/)
  return m ? m[1] : null
}

const ESITI_AMMESSI = ESITO.map((o) => o.value)

/**
 * Legge i parametri con cui la notifica riapre l'app dopo un tap su
 * "Asciutto"/"Bagnato": `?esito=asciutto&notte=YYYY-MM-DD`.
 *
 * Se `notte` manca si assume la notte appena passata (il caso normale della
 * notifica del mattino). Se c'e' ma e' fuori dalla finestra di recupero si
 * RIFIUTA: una notifica rimasta sulla schermata di blocco per tre giorni non
 * deve poter scrivere un esito su una notte lontana, che nessuno ricorda piu'.
 *
 * @returns {{dataNotte: string, esito: string}|null}
 */
export function leggiDeepLinkEsito(
  query = {},
  oggi = new Date(),
  finestraRecupero = FINESTRA_RECUPERO_GIORNI,
) {
  const esito = query.esito
  if (!ESITI_AMMESSI.includes(esito)) return null

  const giorno = giornoEffettivo(oggi)
  const dataNotte = query.notte ?? nottePassata(giorno)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataNotte)) return null
  let recuperabile
  try {
    recuperabile = puoRecuperare(dataNotte, giorno, finestraRecupero)
  } catch {
    return null // data sintatticamente giusta ma inesistente (es. 2026-02-31)
  }
  if (!recuperabile) return null

  return { dataNotte, esito }
}
