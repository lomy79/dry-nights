/**
 * Formattazione dei numeri del report.
 *
 * Sta qui e non in `src/domain/` perché è presentazione: il dominio restituisce
 * quote fra 0 e 1 e `null` quando il denominatore è zero, e non deve sapere che
 * qualcuno le mostrerà con il segno di percentuale.
 */

/** Una quota 0..1 come percentuale intera. `null` non è 0: è "non si sa". */
export function percento(q, seIgnoto = '—') {
  return q == null ? seIgnoto : `${Math.round(q * 100)}%`
}

/** Una differenza fra quote, in punti percentuali, col segno esplicito. */
export function punti(d, seIgnoto = '—') {
  if (d == null) return seIgnoto
  const v = Math.round(d * 100)
  return `${v > 0 ? '+' : ''}${v}`
}

/** Plurale semplice: 1 notte, 2 notti. */
export function nottiConta(n) {
  return `${n} ${n === 1 ? 'notte' : 'notti'}`
}
