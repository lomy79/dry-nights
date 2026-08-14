import { describe, it, expect } from 'vitest'
import {
  wilson,
  differenzaNewcombe,
  nottiUtilizzabili,
  valutaFattore,
  valutaFattori,
  fattorePiuVicino,
  FATTORI,
  MIN_PER_GRUPPO,
  DIFFERENZA_MINIMA,
} from './correlazioni.js'

const PERIODO = { da: '2026-01-01', a: '2026-12-31' }

/**
 * Genera `n` notti a partire da una data, con esito e campi fissi.
 * Le date servono solo a stare dentro il periodo: la correlazione non guarda
 * l'ordine, guarda i gruppi.
 */
function notti(n, { da = 1, esito = 'asciutto', ...campi } = {}) {
  return Array.from({ length: n }, (_, i) => ({
    data_notte: `2026-03-${String(da + i).padStart(2, '0')}`,
    esito,
    salute_stato: 'sano',
    ...campi,
  }))
}

/** Un fattore finto: esposto se il record ha `x: true`. */
const FATTORE_X = {
  chiave: 'x',
  etichetta: 'X',
  esposizione: (r) => (r.x == null ? null : r.x === true),
}

describe('wilson', () => {
  it('n = 0 non produce un intervallo', () => {
    expect(wilson(0, 0)).toBeNull()
  })

  it('5 su 10 → [0.237, 0.763] (valore da tabella)', () => {
    const w = wilson(5, 10)
    expect(w.p).toBe(0.5)
    expect(w.basso).toBeCloseTo(0.2366, 3)
    expect(w.alto).toBeCloseTo(0.7634, 3)
  })

  it('0 su 20 → [0, 0.161]: resta dentro [0,1] dove il metodo normale sfonderebbe', () => {
    const w = wilson(0, 20)
    expect(w.basso).toBe(0)
    expect(w.alto).toBeCloseTo(0.1611, 3)
  })

  it('tutte bagnate: l’estremo alto è 1, non 1.2', () => {
    const w = wilson(12, 12)
    expect(w.alto).toBe(1)
    expect(w.basso).toBeLessThan(1)
  })

  it('più dati = intervallo più stretto', () => {
    const stretto = wilson(50, 100)
    const largo = wilson(5, 10)
    expect(stretto.alto - stretto.basso).toBeLessThan(largo.alto - largo.basso)
  })
})

describe('differenzaNewcombe', () => {
  it('con un gruppo vuoto non c’è differenza da calcolare', () => {
    expect(differenzaNewcombe({ successi: 3, n: 10 }, { successi: 0, n: 0 })).toBeNull()
  })

  it('gruppi identici: la differenza è zero e l’intervallo lo contiene', () => {
    const d = differenzaNewcombe({ successi: 5, n: 10 }, { successi: 5, n: 10 })
    expect(d.differenza).toBe(0)
    expect(d.basso).toBeLessThan(0)
    expect(d.alto).toBeGreaterThan(0)
  })

  it('differenza vistosa su pochi dati: l’intervallo contiene ancora lo zero', () => {
    // 6/10 contro 3/10 sembra molto a occhio; l'intervallo dice che non lo è.
    const d = differenzaNewcombe({ successi: 6, n: 10 }, { successi: 3, n: 10 })
    expect(d.differenza).toBeCloseTo(0.3, 6)
    expect(d.basso).toBeLessThan(0)
  })

  it('stessa differenza con quattro volte i dati: lo zero esce', () => {
    const d = differenzaNewcombe({ successi: 24, n: 40 }, { successi: 12, n: 40 })
    expect(d.differenza).toBeCloseTo(0.3, 6)
    expect(d.basso).toBeGreaterThan(0)
  })

  it('resta dentro [-1, 1]', () => {
    const d = differenzaNewcombe({ successi: 10, n: 10 }, { successi: 0, n: 10 })
    expect(d.basso).toBeGreaterThanOrEqual(-1)
    expect(d.alto).toBeLessThanOrEqual(1)
  })
})

describe('nottiUtilizzabili', () => {
  it('esclude le notti senza esito', () => {
    const r = [{ data_notte: '2026-03-01', esito: null, salute_stato: 'sano' }]
    expect(nottiUtilizzabili(r, PERIODO)).toHaveLength(0)
  })

  it('esclude le notti di malattia e quelle a salute sconosciuta', () => {
    const r = [
      ...notti(1, { da: 1 }),
      ...notti(1, { da: 2, salute_stato: 'malato' }),
      ...notti(1, { da: 3, salute_stato: 'sconosciuto' }),
    ]
    expect(nottiUtilizzabili(r, PERIODO)).toHaveLength(1)
  })

  it('tiene i record vecchi senza snapshot di salute', () => {
    const r = [{ data_notte: '2026-03-01', esito: 'asciutto' }]
    expect(nottiUtilizzabili(r, PERIODO)).toHaveLength(1)
  })

  it('esclude le notti fuori periodo', () => {
    const r = notti(3, { da: 1 })
    expect(nottiUtilizzabili(r, { da: '2026-03-02', a: '2026-03-02' })).toHaveLength(1)
  })
})

describe('valutaFattore — la soglia', () => {
  it('senza dati mancano DUE gruppi pieni, non uno', () => {
    // Il conto che l'app mostrava a chi comincia: diceva dieci, ma le notti da
    // raccogliere erano venti — dieci col fattore e dieci senza. Prometteva
    // metà strada, e la barra si sarebbe fermata a meta' senza spiegare perche'.
    const v = valutaFattore([], FATTORE_X, PERIODO)
    expect(v.stato).toBe('raccolta')
    expect(v.mancaCon).toBe(MIN_PER_GRUPPO)
    expect(v.mancaSenza).toBe(MIN_PER_GRUPPO)
    expect(v.mancanti).toBe(2 * MIN_PER_GRUPPO)
    expect(v.differenza).toBeNull()
  })

  it('conta il gruppo PIÙ PICCOLO: cento notti esposte non bastano da sole', () => {
    // Il caso che rende la soglia non ovvia: se è sempre esposto, il confronto
    // non esiste e il contatore non deve scendere.
    const v = valutaFattore(notti(30, { x: true }), FATTORE_X, PERIODO)
    expect(v.stato).toBe('raccolta')
    expect(v.gruppoScarso).toBe('senza')
    expect(v.mancaCon).toBe(0) // di notti esposte ce n'e' d'avanzo
    expect(v.mancanti).toBe(MIN_PER_GRUPPO)
  })

  it('sotto soglia non mostra la differenza, ma i conteggi ci sono', () => {
    const v = valutaFattore(
      [...notti(9, { da: 1, x: true, esito: 'bagnato' }), ...notti(12, { da: 10, x: false })],
      FATTORE_X,
      PERIODO,
    )
    expect(v.stato).toBe('raccolta')
    expect(v.con.n).toBe(9)
    expect(v.senza.n).toBe(12)
    expect(v.mancanti).toBe(1)
    expect(v.differenza).toBeNull()
  })

  it('le notti a esposizione ignota non contano in nessuno dei due gruppi', () => {
    const v = valutaFattore(
      [...notti(10, { da: 1, x: true }), ...notti(10, { da: 11, x: null })],
      FATTORE_X,
      PERIODO,
    )
    expect(v.con.n).toBe(10)
    expect(v.senza.n).toBe(0)
    expect(v.usate).toBe(10)
  })

  it('raggiunta la soglia con differenza piccola: incerta, non netta', () => {
    const v = valutaFattore(
      [
        ...notti(6, { da: 1, x: true, esito: 'bagnato' }),
        ...notti(4, { da: 7, x: true }),
        ...notti(5, { da: 11, x: false, esito: 'bagnato' }),
        ...notti(5, { da: 16, x: false }),
      ],
      FATTORE_X,
      PERIODO,
    )
    expect(v.stato).toBe('incerta')
    expect(v.con.quota).toBe(0.6)
    expect(v.senza.quota).toBe(0.5)
    expect(v.differenza.basso).toBeLessThan(0) // potrebbero essere uguali
  })

  it('differenza enorme su campione ampio: netta', () => {
    const v = valutaFattore(
      [
        ...notti(24, { da: 1, x: true, esito: 'bagnato' }),
        ...notti(6, { da: 25, x: true }),
        ...notti(6, { da: 1, x: false, esito: 'bagnato' }),
        ...notti(24, { da: 7, x: false }),
      ].map((r, i) => ({ ...r, data_notte: `2026-0${1 + (i % 9)}-01` })),
      FATTORE_X,
      PERIODO,
    )
    expect(v.stato).toBe('netta')
    // Anche l'estremo prudente dell'intervallo resta oltre la soglia di rilevanza.
    expect(v.differenza.basso).toBeGreaterThanOrEqual(DIFFERENZA_MINIMA)
  })

  it('zero escluso per un pelo non basta a chiamarla netta', () => {
    // 60% contro 30% su 40 notti per gruppo: l'intervallo esclude lo zero, ma
    // parte da 8 punti — una differenza che potrebbe non contare niente.
    const v = valutaFattore(
      [
        ...notti(24, { da: 1, x: true, esito: 'bagnato' }),
        ...notti(16, { da: 1, x: true }),
        ...notti(12, { da: 1, x: false, esito: 'bagnato' }),
        ...notti(28, { da: 1, x: false }),
      ],
      FATTORE_X,
      PERIODO,
    )
    expect(v.differenza.basso).toBeGreaterThan(0)
    expect(v.differenza.basso).toBeLessThan(DIFFERENZA_MINIMA)
    expect(v.stato).toBe('incerta')
  })
})

describe('FATTORI — le esposizioni', () => {
  const perChiave = (c) => FATTORI.find((f) => f.chiave === c)

  it('bevande dopo cena: bevute sì, "niente" no, "non so" e vuoto ignoti', () => {
    const f = perChiave('bevande_dopo_cena')
    expect(f.esposizione({ liquidi: { dopo_cena: ['latte'] } })).toBe(true)
    expect(f.esposizione({ liquidi: { dopo_cena: ['nessuna'] } })).toBe(false)
    expect(f.esposizione({ liquidi: { dopo_cena: ['non_so'] } })).toBeNull()
    expect(f.esposizione({ liquidi: {} })).toBeNull()
    expect(f.esposizione({})).toBeNull()
  })

  it('pipì prima di dormire: l’esposizione è il NON averla fatta', () => {
    const f = perChiave('senza_pipi_prima_di_dormire')
    expect(f.esposizione({ pipi_prima_dormire: false })).toBe(true)
    expect(f.esposizione({ pipi_prima_dormire: true })).toBe(false)
    expect(f.esposizione({ pipi_prima_dormire: null })).toBeNull()
  })

  it('alvo: solo stitico contro regolare, il resto è escluso', () => {
    const f = perChiave('alvo_stitico')
    expect(f.esposizione({ alvo: 'stitico' })).toBe(true)
    expect(f.esposizione({ alvo: 'regolare' })).toBe(false)
    expect(f.esposizione({ alvo: 'diarrea' })).toBeNull()
    expect(f.esposizione({ alvo: 'nessuna_evacuazione' })).toBeNull()
  })

  it('cibi sospetti: "nessuno" è una risposta, l’array vuoto no', () => {
    const f = perChiave('cibi_sospetti')
    expect(f.esposizione({ cibi_sospetti: ['fritto'] })).toBe(true)
    expect(f.esposizione({ cibi_sospetti: ['nessuno'] })).toBe(false)
    expect(f.esposizione({ cibi_sospetti: [] })).toBeNull()
  })

  it('molti liquidi: pochi e medi sono il gruppo di confronto', () => {
    const f = perChiave('liquidi_molti')
    expect(f.esposizione({ liquidi_quantita: 'molti' })).toBe(true)
    expect(f.esposizione({ liquidi_quantita: 'pochi' })).toBe(false)
    expect(f.esposizione({ liquidi_quantita: null })).toBeNull()
  })
})

describe('valutaFattori e fattorePiuVicino', () => {
  it('valuta tutti i fattori dichiarati', () => {
    expect(valutaFattori([], PERIODO)).toHaveLength(FATTORI.length)
  })

  it('indica il fattore più vicino alla soglia', () => {
    const records = [
      ...notti(8, { da: 1, liquidi: { dopo_cena: ['latte'] } }),
      ...notti(9, { da: 9, liquidi: { dopo_cena: ['nessuna'] } }),
    ]
    const vicino = fattorePiuVicino(valutaFattori(records, PERIODO))
    expect(vicino.chiave).toBe('bevande_dopo_cena')
    expect(vicino.mancanti).toBe(3) // 2 dal gruppo da 8, 1 da quello da 9
  })

  it('"più vicino" è chi ha meno notti da raccogliere in tutto', () => {
    // 9 e 0 sembra a una notte dalla meta' se si guarda solo il gruppo magro,
    // ma ne servono 11; 5 e 5 ne servono 10 ed e' davvero il piu' vicino.
    const quasi = { stato: 'raccolta', chiave: 'quasi', mancaCon: 1, mancaSenza: 10, mancanti: 11 }
    const davvero = { stato: 'raccolta', chiave: 'davvero', mancaCon: 5, mancaSenza: 5, mancanti: 10 }
    expect(fattorePiuVicino([quasi, davvero]).chiave).toBe('davvero')
  })

  it('se nessun fattore è in raccolta, non c’è nulla da indicare', () => {
    expect(fattorePiuVicino([{ stato: 'incerta' }])).toBeNull()
  })
})
