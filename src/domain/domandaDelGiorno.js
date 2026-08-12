/**
 * Una domanda alla volta.
 *
 * I campi della sez. 4 — alvo, sintomi diurni, interventi — sono quelli che il
 * pediatra chiede per primi, e al 12 agosto 2026 in produzione erano vuoti al
 * 100%: non perché i genitori li saltassero, ma perché nessuna schermata li
 * chiedeva. Gravità e minzione invece si potevano già inserire, ma dietro la
 * piega dei "dettagli", e infatti c'erano su 2 notti bagnate su 12.
 *
 * La tentazione sarebbe aggiungere i campi mancanti al modulo della sera. È il
 * modo sicuro di non ottenerli: un modulo lungo alle 23 non si compila, e la
 * sez. 6 del modello dati lo dice già ("non chiedere due volte la stessa cosa",
 * "se la sera è compilata a metà, la mattina non insiste"). Quindi si chiede UNA
 * cosa sola per volta, quella che manca da più tempo, e la si può rimandare.
 *
 * Due nature diverse, due cadenze diverse:
 *  - PER NOTTE (gravità, minzione): descrivono QUELLA notte, si chiedono subito
 *    dopo l'esito e non hanno senso tre giorni dopo — la risposta sarebbe
 *    inventata, che è peggio del buco (Decisione 2).
 *  - LENTE (alvo, sintomi diurni, interventi): non cambiano ogni giorno.
 *    Chiederle ogni sera è rumore, e il rumore insegna a ignorare. Hanno una
 *    cadenza, e si chiedono di SERA: la pancia di oggi la si sa a fine giornata,
 *    non alle otto del mattino.
 *
 * Tutto puro: `oggi`, i record e i rinvii arrivano dall'esterno.
 */

import { nottePassata, notteInArrivo, giornoEffettivo, giorniDaNotte } from './dataNotte.js'
import { momentoDelGiorno } from './cosaManca.js'
import { GRAVITA, MINZIONE, ALVO, SINTOMI_DIURNI, INTERVENTI } from './costanti.js'

/**
 * Ogni quanti giorni ha senso richiedere un campo lento.
 * L'alvo più spesso degli altri perché la stitichezza è la causa nascosta più
 * frequente (sez. 4) ed è l'unica delle tre che cambia davvero di giorno in
 * giorno; gli interventi quasi mai, perché una terapia o un allarme durano
 * settimane e richiederlo ogni tre giorni sarebbe solo un modo di farsi ignorare.
 */
export const CADENZA = {
  alvo: 3,
  sintomi_diurni: 7,
  interventi: 14,
}

/** Quanto dura un "non ora". Abbastanza da non sembrare insistenza. */
export const GIORNI_RINVIO = 3

/** Le domande sulla singola notte, in ordine di priorità. */
const PER_NOTTE = [
  {
    chiave: 'gravita',
    campo: 'gravita',
    tipo: 'singola',
    opzioni: GRAVITA,
    testo: 'Quanto era bagnato il letto?',
    soloSeBagnato: true,
  },
  {
    chiave: 'minzione',
    campo: 'minzione',
    tipo: 'singola',
    opzioni: MINZIONE,
    testo: 'Si è alzato durante la notte?',
    // Il perché vale la pena chiederlo, in una riga: "da solo" è il progresso
    // vero, e senza questa distinzione non si vede.
    nota: 'Alzarsi da solo è il segnale di progresso più importante: vuol dire che sente lo stimolo mentre dorme.',
  },
]

/** Le domande lente, in ordine di priorità a parità di ritardo. */
const LENTE = [
  {
    chiave: 'alvo',
    campo: 'alvo',
    tipo: 'singola',
    opzioni: ALVO,
    testo: 'Com’è andata la pancia oggi?',
    nota: 'La stitichezza è una delle cause più frequenti dell’enuresi, ed è anche la più facile da non notare.',
  },
  {
    chiave: 'sintomi_diurni',
    campo: 'sintomi_diurni',
    tipo: 'multi',
    opzioni: SINTOMI_DIURNI,
    testo: 'Di giorno, in questi giorni?',
    nota: 'Distingue l’enuresi solo notturna da quella con una componente diurna: si trattano in modo diverso.',
  },
  {
    chiave: 'interventi',
    campo: 'interventi',
    tipo: 'multi',
    opzioni: INTERVENTI,
    testo: 'State usando qualcosa in questo periodo?',
    nota: 'Serve a leggere i numeri accanto a ciò che stavate facendo.',
  },
]

/** Un campo è valorizzato? Per gli array conta solo se non sono vuoti. */
function valorizzato(record, campo) {
  const v = record?.[campo]
  if (v == null) return false
  return Array.isArray(v) ? v.length > 0 : true
}

/**
 * Da quanti giorni non si risponde a un campo. `Infinity` se mai.
 *
 * Il limite è la notte IN ARRIVO, non oggi: le risposte lente si scrivono lì
 * (la giornata appena finita precede la notte che comincia), quindi con un
 * limite a `giorno` la risposta data stasera risulterebbe nel futuro, non
 * verrebbe contata, e la stessa domanda tornerebbe ogni sera per sempre — cioè
 * esattamente l'insistenza che questo modulo esiste per evitare. Le notti
 * ancora più avanti restano fuori: quelle sì sono futuro.
 */
export function giorniDallUltimaRisposta(records, campo, giorno) {
  const limite = notteInArrivo(giorno)
  let migliore = Infinity
  for (const [dn, rec] of Object.entries(records ?? {})) {
    if (dn > limite || !valorizzato(rec, campo)) continue
    const d = Math.max(0, giorniDaNotte(dn, giorno))
    if (d < migliore) migliore = d
  }
  return migliore
}

/** Il rinvio è ancora valido? `rinviate` è { chiave: 'YYYY-MM-DD' }. */
function rinviata(rinviate, chiave, giorno) {
  const quando = rinviate?.[chiave]
  if (!quando) return false
  const d = giorniDaNotte(quando, giorno)
  return d >= 0 && d < GIORNI_RINVIO
}

/**
 * L'unica domanda da fare adesso, o null se non ce n'è una che valga il disturbo.
 *
 * @param {Object} p
 * @param {Date} p.oggi
 * @param {'mattina'|'sera'} [p.momento]
 * @param {Object} p.records - mappa data_notte -> record
 * @param {Object} [p.rinviate] - mappa chiave -> 'YYYY-MM-DD' dell'ultimo "non ora"
 * @returns {{chiave, campo, tipo, opzioni, testo, nota?, dataNotte, valore}|null}
 */
export function prossimaDomanda({ oggi, momento, records = {}, rinviate = {} } = {}) {
  const giorno = giornoEffettivo(oggi)
  const mom = momento ?? momentoDelGiorno(oggi)
  const dnPassata = nottePassata(giorno)
  const dnArrivo = notteInArrivo(giorno)
  const recPassata = records[dnPassata] ?? null

  // 1) La notte appena registrata. Solo se l'esito c'è: finché manca quello, la
  //    domanda giusta è l'esito, e due domande insieme sono di nuovo un modulo.
  if (recPassata?.esito != null) {
    for (const d of PER_NOTTE) {
      if (d.soloSeBagnato && recPassata.esito !== 'bagnato') continue
      if (valorizzato(recPassata, d.campo)) continue
      if (rinviata(rinviate, d.chiave, giorno)) continue
      return { ...d, dataNotte: dnPassata, valore: recPassata[d.campo] ?? null }
    }
  }

  // 2) I campi lenti, solo di sera e solo se in ritardo sulla loro cadenza.
  //    Fra i candidati vince il più in ritardo; a parità, l'ordine di LENTE.
  if (mom !== 'sera') return null

  let scelta = null
  let peggiore = 0
  for (const d of LENTE) {
    if (rinviata(rinviate, d.chiave, giorno)) continue
    const da = giorniDallUltimaRisposta(records, d.campo, giorno)
    const ritardo = da - CADENZA[d.chiave]
    if (ritardo <= 0) continue
    if (ritardo > peggiore) {
      peggiore = ritardo
      scelta = d
    }
  }
  if (!scelta) return null

  const recArrivo = records[dnArrivo] ?? null
  return { ...scelta, dataNotte: dnArrivo, valore: recArrivo?.[scelta.campo] ?? null }
}
