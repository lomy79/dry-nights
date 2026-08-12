/**
 * Correlazioni fra contesto ed esito, con la soglia scritta invece che nascosta
 * (Decisione 12).
 *
 * Il problema non è calcolare una percentuale: è che su un diario domestico
 * QUALUNQUE differenza fra due gruppi da dieci notti è compatibile col caso.
 * Peggio: qui si guarderebbero molti fattori insieme, ogni sera, fermandosi
 * quando "viene bene" — confronti multipli e optional stopping, i due modi
 * classici di fabbricare una correlazione che non c'è. Per questo NON si usa un
 * test di significatività: si guarda quanto è largo l'intervallo di incertezza,
 * e finché è largo l'app dice che non lo sa.
 *
 * Ordine di grandezza, perché non sia una sorpresa: servono ~25 notti per gruppo
 * per vedere una differenza di 30 punti percentuali, cioè circa due mesi di
 * raccolta con esposizione bilanciata.
 */

import { statoFascia } from './liquidi.js'
import { nottiDelPeriodo, quota } from './statistiche.js'

/**
 * Sotto questa soglia (per gruppo, non in totale) non si mostra nessun numero:
 * si mostra quanto manca. Dieci è il minimo sotto cui l'intervallo di Wilson è
 * più largo di mezzo asse e il grafico direbbe soltanto "boh" con la grafica di
 * una certezza.
 */
export const MIN_PER_GRUPPO = 10

/**
 * Quanto deve valere la differenza, nell'ipotesi PIÙ PRUDENTE, per chiamarla
 * "netta": 10 punti percentuali.
 *
 * Il criterio non è "l'intervallo esclude lo zero". Uno zero escluso per un pelo
 * — intervallo [1, 46] punti — è compatibile con una differenza irrilevante, e
 * chiamarlo netto sarebbe la stessa bugia del p-value appena sotto 0,05. Qui si
 * chiede che TUTTO l'intervallo stia oltre i 10 punti: anche l'estremo peggiore
 * descrive una differenza che varrebbe la pena di conoscere.
 */
export const DIFFERENZA_MINIMA = 0.1

/** z per un intervallo al 95%. */
export const Z = 1.96

/**
 * Intervallo di Wilson per una proporzione. Preferito a quello "normale"
 * (p ± z·√(p(1-p)/n)) perché con pochi dati o con p vicino a 0/1 quello normale
 * produce estremi fuori da [0,1] — cioè percentuali negative, che in una app
 * per genitori sarebbero solo un bug appariscente.
 *
 * @returns {{p:number, basso:number, alto:number}|null} null se n = 0.
 */
export function wilson(successi, n) {
  if (!n || n <= 0) return null
  const p = successi / n
  const z2 = Z * Z
  const denominatore = 1 + z2 / n
  const centro = (p + z2 / (2 * n)) / denominatore
  const meta = (Z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominatore
  return {
    p,
    basso: Math.max(0, centro - meta),
    alto: Math.min(1, centro + meta),
  }
}

/**
 * Intervallo sulla differenza fra due proporzioni, metodo ibrido di Newcombe:
 * si costruisce sugli intervalli di Wilson dei due gruppi invece che sull'errore
 * standard della differenza. Regge i campioni piccoli e sbilanciati, che qui
 * sono la norma, non l'eccezione.
 *
 * @param {{successi:number, n:number}} a
 * @param {{successi:number, n:number}} b
 * @returns {{differenza:number, basso:number, alto:number, larghezza:number}|null}
 */
export function differenzaNewcombe(a, b) {
  const wa = wilson(a.successi, a.n)
  const wb = wilson(b.successi, b.n)
  if (!wa || !wb) return null

  const differenza = wa.p - wb.p
  const basso = differenza - Math.sqrt((wa.p - wa.basso) ** 2 + (wb.alto - wb.p) ** 2)
  const alto = differenza + Math.sqrt((wa.alto - wa.p) ** 2 + (wb.p - wb.basso) ** 2)

  return {
    differenza,
    basso: Math.max(-1, basso),
    alto: Math.min(1, alto),
    larghezza: Math.min(1, alto) - Math.max(-1, basso),
  }
}

/** Esposizione da una fascia di bevande: 'bevande' sì, 'niente' no, il resto ignoto. */
function fasciaEsposta(record, fascia) {
  const stato = statoFascia(record.liquidi, fascia)
  if (stato === 'bevande') return true
  if (stato === 'niente') return false
  // 'vuoto' = non risposto, 'non_so' = risposto ma ignoto (Decisione 9).
  // Diversi fra loro per la raccolta, identici qui: l'esposizione non si sa.
  return null
}

/**
 * I fattori confrontati con l'esito. Ognuno è un'esposizione BINARIA:
 * `true` esposto, `false` non esposto, `null` non si sa — e il null è
 * un'esclusione, non un "no". Aggiungerne uno significa aggiungere una riga qui.
 */
export const FATTORI = [
  {
    chiave: 'bevande_dopo_cena',
    etichetta: 'Bevande dopo cena',
    esposizione: (r) => fasciaEsposta(r, 'dopo_cena'),
  },
  {
    chiave: 'bevande_prima_di_dormire',
    etichetta: 'Bevande subito prima di dormire',
    esposizione: (r) => fasciaEsposta(r, 'prima_di_dormire'),
  },
  {
    chiave: 'liquidi_molti',
    etichetta: 'Serata con molti liquidi',
    esposizione: (r) =>
      r.liquidi_quantita == null ? null : r.liquidi_quantita === 'molti',
  },
  {
    chiave: 'senza_pipi_prima_di_dormire',
    // Esposizione = NON ha fatto pipì: così il "fattore di rischio" è la cosa
    // che è successa, come negli altri, e la percentuale si legge nello stesso verso.
    etichetta: 'Senza pipì prima di dormire',
    esposizione: (r) => (r.pipi_prima_dormire == null ? null : r.pipi_prima_dormire === false),
  },
  {
    chiave: 'alvo_stitico',
    etichetta: 'Giornata con stitichezza',
    // Solo 'stitico' vs 'regolare': 'nessuna_evacuazione' e 'diarrea' non sono
    // né l'uno né l'altro, e forzarli in un gruppo inventerebbe un dato.
    esposizione: (r) => {
      if (r.alvo === 'stitico') return true
      if (r.alvo === 'regolare') return false
      return null
    },
  },
  {
    chiave: 'cibi_sospetti',
    etichetta: 'Cibi sospetti a cena',
    esposizione: (r) => {
      const v = r.cibi_sospetti
      if (!Array.isArray(v) || v.length === 0) return null
      if (v.includes('nessuno')) return false
      return true
    },
  },
]

/**
 * Le notti utilizzabili per una correlazione.
 *
 * Fuori le notti senza esito (niente da correlare) e quelle con salute
 * `malato` o `sconosciuto`: la malattia muove insieme le bevande e le notti
 * bagnate, quindi è un confondente — tenerla dentro farebbe apparire una
 * correlazione fra due effetti della stessa causa. `salute_stato` a null è un
 * record vecchio, non una notte incerta: lo snapshot scrive sempre un valore.
 */
export function nottiUtilizzabili(records, { da, a }) {
  const date = new Set(nottiDelPeriodo(da, a))
  const elenco = Array.isArray(records) ? records : Object.values(records ?? {})
  return elenco.filter(
    (r) =>
      r?.data_notte &&
      date.has(r.data_notte) &&
      r.esito != null &&
      r.salute_stato !== 'malato' &&
      r.salute_stato !== 'sconosciuto',
  )
}

/**
 * Valuta un fattore. Tre stati, in ordine di crescente sicurezza:
 *
 *  - 'raccolta' — il gruppo più scarso non arriva a MIN_PER_GRUPPO. Nessuna
 *    percentuale: solo quanto manca. Conta il gruppo più PICCOLO, non il totale,
 *    ed è la parte non ovvia: se beve sempre qualcosa dopo cena, si possono
 *    accumulare trecento notti senza avere mai un termine di paragone.
 *  - 'incerta' — numeri visibili, con l'intervallo. I due gruppi potrebbero
 *    ancora essere uguali.
 *  - 'netta' — l'intervallo sulla differenza sta tutto oltre DIFFERENZA_MINIMA:
 *    perfino l'estremo più prudente descrive una differenza che conta. Resta una
 *    differenza OSSERVATA: questo modulo non sa niente di cause.
 */
export function valutaFattore(records, fattore, periodo) {
  const utilizzabili = nottiUtilizzabili(records, periodo)

  const gruppi = { con: { n: 0, bagnate: 0 }, senza: { n: 0, bagnate: 0 } }
  for (const r of utilizzabili) {
    const esposto = fattore.esposizione(r)
    if (esposto == null) continue
    const g = esposto ? gruppi.con : gruppi.senza
    g.n++
    if (r.esito === 'bagnato') g.bagnate++
  }

  const con = { ...gruppi.con, quota: quota(gruppi.con.bagnate, gruppi.con.n) }
  const senza = { ...gruppi.senza, quota: quota(gruppi.senza.bagnate, gruppi.senza.n) }
  con.intervallo = wilson(con.bagnate, con.n)
  senza.intervallo = wilson(senza.bagnate, senza.n)

  const minore = Math.min(con.n, senza.n)
  const base = {
    chiave: fattore.chiave,
    etichetta: fattore.etichetta,
    con,
    senza,
    usate: con.n + senza.n,
    gruppoScarso: con.n <= senza.n ? 'con' : 'senza',
    mancanti: Math.max(0, MIN_PER_GRUPPO - minore),
    soglia: MIN_PER_GRUPPO,
  }

  if (minore < MIN_PER_GRUPPO) {
    return { ...base, stato: 'raccolta', differenza: null }
  }

  const differenza = differenzaNewcombe(
    { successi: con.bagnate, n: con.n },
    { successi: senza.bagnate, n: senza.n },
  )
  // Tutto l'intervallo oltre la soglia di rilevanza, da una parte o dall'altra.
  const netta =
    differenza.basso >= DIFFERENZA_MINIMA || differenza.alto <= -DIFFERENZA_MINIMA

  return { ...base, stato: netta ? 'netta' : 'incerta', differenza }
}

/** Tutti i fattori, nell'ordine di FATTORI. */
export function valutaFattori(records, periodo) {
  return FATTORI.map((f) => valutaFattore(records, f, periodo))
}

/**
 * Quanto manca, complessivamente, alla prima correlazione leggibile: il fattore
 * più vicino alla soglia. È il numero che vale la pena mostrare, perché è quello
 * che la prossima settimana di raccolta può davvero far scendere.
 */
export function fattorePiuVicino(valutazioni) {
  const inRaccolta = valutazioni.filter((v) => v.stato === 'raccolta')
  if (inRaccolta.length === 0) return null
  return inRaccolta.reduce((migliore, v) => (v.mancanti < migliore.mancanti ? v : migliore))
}
