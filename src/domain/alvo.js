/**
 * La pancia: da quanto non evacua, e com'erano le feci (Decisione 14).
 *
 * Il campo `alvo` nasceva mescolando due cose diverse: la CONSISTENZA
 * (`regolare`, `stitico`, `diarrea`) e un CONTEGGIO (`nessuna_evacuazione`).
 * Il conteggio non si può campionare ogni tre giorni: se lunedì rispondi
 * "nessuna evacuazione" e giovedì "regolare", martedì e mercoledì restano
 * ignoti, e non distingui un bambino che va tutti i giorni da uno che è andato
 * una volta in quattro. L'intervallo del campionamento e la scala del fenomeno
 * sono gli stessi, quindi il fenomeno sparisce — proprio la frequenza che il
 * pediatra guarda per prima.
 *
 * Da qui `ultima_evacuazione`: una risposta che porta dentro di sé i giorni in
 * cui non è stata chiesta. "Più di 3 giorni fa" dice qualcosa anche delle sere
 * in cui l'app taceva, mentre "nessuna evacuazione" parlava solo di quel giorno.
 *
 * I dati vecchi non si riscrivono: si leggono. Qui sta la conversione.
 */

import { ULTIMA_EVACUAZIONE } from './costanti.js'

/** L'ordine delle fasce, dalla più recente alla più lontana. `non_so` è fuori. */
const ORDINE = ['oggi', 'ieri', 'due_tre_giorni', 'oltre_tre_giorni']

/**
 * Da quanto non evacua, leggendo anche le schede scritte prima di v3.
 *
 * Un vecchio `alvo` di consistenza (`regolare`, `stitico`, `diarrea`) descrive
 * feci che ci sono state quel giorno: implica `oggi`, e non è un'invenzione ma
 * una deduzione — per descriverle bisognava averle viste.
 *
 * `nessuna_evacuazione` invece dice solo "non oggi": quanti giorni fossero
 * passati non è mai stato chiesto, quindi resta `null`. È il buco che la
 * Decisione 14 esiste per chiudere, e riempirlo a posteriori con una stima
 * sarebbe il modo peggiore di celebrarla.
 *
 * @returns {string|null} un valore di ULTIMA_EVACUAZIONE, o null se ignoto
 */
export function ultimaEvacuazione(record) {
  const v = record?.ultima_evacuazione
  if (v != null) return v

  switch (record?.alvo) {
    case 'regolare':
    case 'stitico':
    case 'diarrea':
      return 'oggi'
    default:
      return null // 'nessuna_evacuazione' compreso: sappiamo "non oggi", non quanto
  }
}

/**
 * La consistenza delle feci, o null. Non deduce niente all'indietro: le schede
 * vecchie hanno già il valore nel posto giusto, e `nessuna_evacuazione` non è
 * una consistenza — è l'assenza di feci da descrivere.
 */
export function consistenzaAlvo(record) {
  const v = record?.alvo
  return v == null || v === 'nessuna_evacuazione' ? null : v
}

/**
 * Quanti giorni sono passati, come numero, per poter ordinare e confrontare.
 * Le fasce sono fasce: si prende l'estremo BASSO ("2-3 giorni" → 2), così un
 * confronto non promette una precisione che la risposta non ha.
 * `null` per ignoto e per `non_so`.
 */
export function giorniSenzaEvacuazione(record) {
  const v = ultimaEvacuazione(record)
  const i = ORDINE.indexOf(v)
  if (i < 0) return null // mai risposto, oppure 'non_so': ignoto, non zero
  return [0, 1, 2, 4][i]
}

/**
 * Una giornata "da stitichezza" ai fini delle correlazioni?
 *
 * Solo i poli, come per `alvo_stitico`: oltre i tre giorni è sì, oggi o ieri è
 * no, "2-3 giorni" resta `null` perché è la zona in cui la risposta onesta è
 * "dipende" — e forzarla in un gruppo inventerebbe un dato (Decisione 12).
 * `non_so` è ignoto, non negativo (Decisione 9).
 */
export function esposizioneSenzaEvacuazione(record) {
  switch (ultimaEvacuazione(record)) {
    case 'oltre_tre_giorni':
      return true
    case 'oggi':
    case 'ieri':
      return false
    default:
      return null
  }
}

/** Etichetta pronta per la UI, o null. */
export function etichettaUltimaEvacuazione(record) {
  const v = ultimaEvacuazione(record)
  return ULTIMA_EVACUAZIONE.find((o) => o.value === v)?.label ?? null
}
