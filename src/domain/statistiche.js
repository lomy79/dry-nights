/**
 * Statistiche descrittive delle notti — il motore della vista "Andamento".
 *
 * Regola numero uno (Decisione 2, ripresa nella Decisione 11): si conta sulle
 * notti NOTE. Una notte senza record non è asciutta, è sconosciuta. Quindi ogni
 * percentuale qui dentro ha per denominatore le notti note, mai i giorni del
 * calendario, e la copertura viaggia insieme al numero: "80% di asciutte" su 5
 * notti registrate su 30 non è un risultato, è un'illusione ottica — e sarebbe
 * anche il modo più efficace di mentire a un pediatra in buona fede.
 *
 * Funzioni pure: ricevono i record (array o mappa data_notte->record) e un
 * periodo, non toccano store né rete. Le consumeranno tre viste diverse (i
 * genitori, il foglio per il pediatra, un giorno il bambino), quindi qui dentro
 * non c'è nessun testo rivolto a qualcuno.
 */

import { parseISO, addDays, differenceInCalendarDays } from 'date-fns'
import { toDataNotte } from './dataNotte.js'

/** Ampiezza del raggruppamento temporale: la settimana è l'unità in cui si ragiona. */
export const GIORNI_SETTIMANA = 7

/** Normalizza array | mappa in una mappa data_notte -> record. */
function indicizza(records) {
  if (!records) return {}
  const elenco = Array.isArray(records) ? records : Object.values(records)
  const mappa = {}
  for (const r of elenco) {
    if (r?.data_notte) mappa[r.data_notte] = r
  }
  return mappa
}

/** Le date-notte del periodo, in ordine crescente, estremi inclusi. */
export function nottiDelPeriodo(da, a) {
  const inizio = parseISO(da)
  const giorni = differenceInCalendarDays(parseISO(a), inizio)
  if (giorni < 0) return []
  return Array.from({ length: giorni + 1 }, (_, i) => toDataNotte(addDays(inizio, i)))
}

/**
 * Il giorno in cui comincia il diario: la più VECCHIA fra la creazione del
 * bambino e la prima notte registrata (si possono compilare notti antecedenti
 * dallo storico, e restano notti del diario a tutti gli effetti).
 *
 * Serve perché prima di quel giorno non ci sono notti "sconosciute": non c'era
 * l'app. Contarle come buchi fa due danni opposti e simmetrici — abbassa la
 * copertura di dati che nessuno poteva raccogliere, e riempie il grafico di
 * settimane vuote che sembrano settimane saltate. Su un diario di venti giorni
 * guardato a novanta, la copertura passava dal 19% all'85% solo smettendo di
 * misurare il passato.
 *
 * @returns {string|null} 'YYYY-MM-DD', null se non c'è né l'uno né l'altro.
 */
export function inizioDiario(records, creatoIl) {
  const date = Object.keys(indicizza(records)).sort()
  const candidati = []
  if (date.length > 0) candidati.push(date[0])
  if (creatoIl) candidati.push(toDataNotte(parseISO(creatoIl)))
  if (candidati.length === 0) return null
  return candidati.sort()[0]
}

/**
 * Restringe un periodo all'inizio del diario. `ristretto` dice alla UI di
 * spiegarlo: un "ultimi 90 giorni" che ne mostra venti deve dire perché, o
 * sembra che manchino dei dati.
 */
export function restringiPeriodo({ da, a }, inizio) {
  if (!inizio || inizio <= da) return { da, a, ristretto: false }
  return { da: inizio > a ? a : inizio, a, ristretto: true }
}

/** Conta le occorrenze di un valore singolo, ignorando i null. */
function conta(mappa, valore) {
  if (valore == null) return
  mappa[valore] = (mappa[valore] ?? 0) + 1
}

/** Conta le occorrenze dei valori di un campo multi-scelta (una per notte). */
function contaMulti(mappa, valori) {
  if (!Array.isArray(valori)) return
  for (const v of valori) conta(mappa, v)
}

/** Percentuale su un denominatore che può essere zero: null, mai NaN, mai 0 finto. */
export function quota(parte, totale) {
  return totale > 0 ? parte / totale : null
}

/**
 * Il quadro del periodo. Tutti i conteggi delle sezioni cliniche sono sulle
 * notti in cui quel campo è stato compilato: un campo vuoto non vale "nessuno",
 * per lo stesso motivo per cui una notte senza record non vale "asciutto".
 */
export function riepilogo(records, { da, a }) {
  const perData = indicizza(records)
  const date = nottiDelPeriodo(da, a)

  let note = 0
  let asciutte = 0
  let bagnate = 0
  let episodiTotale = 0
  let episodiNotti = 0
  let episodiMassimo = 0
  const gravita = {}
  const minzione = {}
  const alvo = {}
  const sintomiDiurni = {}
  const interventi = {}
  const salute = {}

  for (const dn of date) {
    const r = perData[dn]
    if (!r || r.esito == null) continue // notte sconosciuta: non entra in nessun conto
    note++
    if (r.esito === 'asciutto') asciutte++
    else bagnate++

    if (r.esito === 'bagnato') conta(gravita, r.gravita)
    conta(minzione, r.minzione)
    conta(alvo, r.alvo)
    contaMulti(sintomiDiurni, r.sintomi_diurni)
    contaMulti(interventi, r.interventi)
    conta(salute, r.salute_stato)

    if (r.episodi != null) {
      episodiNotti++
      episodiTotale += r.episodi
      episodiMassimo = Math.max(episodiMassimo, r.episodi)
    }
  }

  return {
    da,
    a,
    notti: date.length,
    note,
    sconosciute: date.length - note,
    asciutte,
    bagnate,
    copertura: quota(note, date.length),
    quotaAsciutte: quota(asciutte, note),
    quotaBagnate: quota(bagnate, note),
    gravita,
    minzione,
    alvo,
    sintomiDiurni,
    interventi,
    salute,
    episodi: {
      notti: episodiNotti,
      totale: episodiTotale,
      media: quota(episodiTotale, episodiNotti),
      massimo: episodiNotti > 0 ? episodiMassimo : null,
    },
  }
}

/**
 * Il periodo spezzato in settimane, dalla più vecchia alla più recente.
 *
 * Le settimane sono ancorate alla FINE, non all'inizio: l'ultimo gruppo finisce
 * sempre su `a`, così la barra più a destra è "questa settimana" e resta la
 * stessa mentre i giorni passano. Ancorandole all'inizio, ogni giorno che passa
 * farebbe scivolare tutti i confini e due aperture consecutive dell'app
 * mostrerebbero due grafici diversi sugli stessi dati.
 *
 * Il gruppo più vecchio può essere corto: è marcato `parziale`, perché una
 * settimana da tre giorni non si confronta con una da sette.
 */
export function perSettimana(records, { da, a, ampiezza = GIORNI_SETTIMANA }) {
  const perData = indicizza(records)
  const date = nottiDelPeriodo(da, a)
  const gruppi = []

  for (let fine = date.length; fine > 0; fine -= ampiezza) {
    const inizio = Math.max(0, fine - ampiezza)
    const finestra = date.slice(inizio, fine)

    let note = 0
    let asciutte = 0
    for (const dn of finestra) {
      const r = perData[dn]
      if (!r || r.esito == null) continue
      note++
      if (r.esito === 'asciutto') asciutte++
    }

    gruppi.unshift({
      da: finestra[0],
      a: finestra[finestra.length - 1],
      notti: finestra.length,
      note,
      asciutte,
      bagnate: note - asciutte,
      sconosciute: finestra.length - note,
      quotaAsciutte: quota(asciutte, note),
      parziale: finestra.length < ampiezza,
    })
  }

  return gruppi
}
