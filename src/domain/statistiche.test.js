import { describe, it, expect } from 'vitest'
import {
  nottiDelPeriodo,
  riepilogo,
  perSettimana,
  quota,
  inizioDiario,
  restringiPeriodo,
} from './statistiche.js'

/** Scorciatoia: una notte registrata. */
function notte(data_notte, campi = {}) {
  return { data_notte, esito: 'asciutto', ...campi }
}

describe('nottiDelPeriodo', () => {
  it('include entrambi gli estremi', () => {
    expect(nottiDelPeriodo('2026-08-10', '2026-08-12')).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
    ])
  })

  it('un solo giorno è un periodo valido', () => {
    expect(nottiDelPeriodo('2026-08-10', '2026-08-10')).toEqual(['2026-08-10'])
  })

  it('periodo invertito è vuoto, non esplode', () => {
    expect(nottiDelPeriodo('2026-08-12', '2026-08-10')).toEqual([])
  })

  it('attraversa il cambio di mese', () => {
    expect(nottiDelPeriodo('2026-07-31', '2026-08-01')).toEqual(['2026-07-31', '2026-08-01'])
  })
})

describe('quota', () => {
  it('su denominatore zero è null, mai NaN né zero', () => {
    expect(quota(0, 0)).toBeNull()
    expect(quota(3, 4)).toBe(0.75)
  })
})

describe('inizioDiario e restringiPeriodo', () => {
  it('senza niente non c’è un inizio', () => {
    expect(inizioDiario([], null)).toBeNull()
  })

  it('è la creazione del bambino se non ci sono notti', () => {
    expect(inizioDiario([], '2026-07-26T09:13:10Z')).toBe('2026-07-26')
  })

  it('vince la notte più vecchia se precede la creazione', () => {
    // Caso reale: notti compilate dallo storico per giorni antecedenti.
    const r = [notte('2026-07-24'), notte('2026-07-28')]
    expect(inizioDiario(r, '2026-07-26T09:13:10Z')).toBe('2026-07-24')
  })

  it('vince la creazione se le notti sono tutte successive', () => {
    expect(inizioDiario([notte('2026-08-01')], '2026-07-26T09:13:10Z')).toBe('2026-07-26')
  })

  it('restringe solo se l’inizio è dentro il periodo', () => {
    expect(restringiPeriodo({ da: '2026-05-15', a: '2026-08-12' }, '2026-07-24')).toEqual({
      da: '2026-07-24',
      a: '2026-08-12',
      ristretto: true,
    })
    expect(restringiPeriodo({ da: '2026-08-01', a: '2026-08-12' }, '2026-07-24')).toEqual({
      da: '2026-08-01',
      a: '2026-08-12',
      ristretto: false,
    })
    expect(restringiPeriodo({ da: '2026-08-01', a: '2026-08-12' }, null)).toEqual({
      da: '2026-08-01',
      a: '2026-08-12',
      ristretto: false,
    })
  })

  it('un diario nato dopo la fine del periodo non produce un periodo rovesciato', () => {
    expect(restringiPeriodo({ da: '2026-01-01', a: '2026-02-01' }, '2026-06-01')).toEqual({
      da: '2026-02-01',
      a: '2026-02-01',
      ristretto: true,
    })
  })

  it('la copertura cambia da sola smettendo di contare la preistoria', () => {
    // 17 notti note su un diario iniziato il 24/7, guardate a 90 giorni.
    // 24 luglio → 12 agosto sono 20 notti: 17 registrate, 3 saltate.
    const records = nottiDelPeriodo('2026-07-24', '2026-08-12')
      .slice(0, 17)
      .map((dn) => notte(dn))
    const largo = { da: '2026-05-15', a: '2026-08-12' }
    const stretto = restringiPeriodo(largo, inizioDiario(records, '2026-07-26T00:00:00Z'))
    expect(riepilogo(records, largo).copertura).toBeLessThan(0.25)
    expect(riepilogo(records, stretto).copertura).toBeGreaterThan(0.8)
  })
})

describe('riepilogo', () => {
  const periodo = { da: '2026-08-01', a: '2026-08-10' } // 10 notti

  it('senza record è tutto sconosciuto: nessuna percentuale inventata', () => {
    const r = riepilogo([], periodo)
    expect(r.notti).toBe(10)
    expect(r.note).toBe(0)
    expect(r.sconosciute).toBe(10)
    expect(r.copertura).toBe(0)
    // Il punto della Decisione 2: zero notti note non vale "zero asciutte".
    expect(r.quotaAsciutte).toBeNull()
  })

  it('le notti senza esito non contano come note', () => {
    // Record esistente ma con solo il contesto serale: la notte resta sconosciuta.
    const r = riepilogo([{ data_notte: '2026-08-02', esito: null, liquidi_quantita: 'molti' }], periodo)
    expect(r.note).toBe(0)
    expect(r.sconosciute).toBe(10)
  })

  it('conta sulle notti note, non sui giorni di calendario', () => {
    const r = riepilogo(
      [
        notte('2026-08-01'),
        notte('2026-08-02'),
        notte('2026-08-03', { esito: 'bagnato', gravita: 'media' }),
        notte('2026-08-04'),
      ],
      periodo,
    )
    expect(r.note).toBe(4)
    expect(r.asciutte).toBe(3)
    expect(r.bagnate).toBe(1)
    expect(r.quotaAsciutte).toBe(0.75) // 3 su 4 note, NON 3 su 10 giorni
    expect(r.copertura).toBe(0.4)
  })

  it('ignora i record fuori periodo', () => {
    const r = riepilogo([notte('2026-07-31'), notte('2026-08-11'), notte('2026-08-05')], periodo)
    expect(r.note).toBe(1)
  })

  it('accetta anche la mappa data_notte -> record dello store', () => {
    const mappa = { '2026-08-01': notte('2026-08-01'), '2026-08-02': notte('2026-08-02') }
    expect(riepilogo(mappa, periodo).note).toBe(2)
  })

  it('la gravità si conta solo sulle notti bagnate', () => {
    const r = riepilogo(
      [
        notte('2026-08-01', { esito: 'bagnato', gravita: 'piccola' }),
        notte('2026-08-02', { esito: 'bagnato', gravita: 'piccola' }),
        notte('2026-08-03', { esito: 'bagnato', gravita: 'zuppo' }),
        // Asciutta con una gravità rimasta appesa: non deve entrare nei conti.
        notte('2026-08-04', { gravita: 'media' }),
      ],
      periodo,
    )
    expect(r.gravita).toEqual({ piccola: 2, zuppo: 1 })
  })

  it('conta i campi multi-scelta una volta per notte', () => {
    const r = riepilogo(
      [
        notte('2026-08-01', { sintomi_diurni: ['urgenza', 'minzioni_frequenti'] }),
        notte('2026-08-02', { sintomi_diurni: ['urgenza'] }),
        notte('2026-08-03', { sintomi_diurni: [] }),
        notte('2026-08-04', { interventi: ['allarme'] }),
      ],
      periodo,
    )
    expect(r.sintomiDiurni).toEqual({ urgenza: 2, minzioni_frequenti: 1 })
    expect(r.interventi).toEqual({ allarme: 1 })
  })

  it('gli episodi: media sulle notti in cui il dato c’è', () => {
    const r = riepilogo(
      [
        notte('2026-08-01', { esito: 'bagnato', episodi: 1 }),
        notte('2026-08-02', { esito: 'bagnato', episodi: 3 }),
        notte('2026-08-03', { esito: 'bagnato' }), // episodi non registrati
      ],
      periodo,
    )
    expect(r.episodi.notti).toBe(2)
    expect(r.episodi.media).toBe(2)
    expect(r.episodi.massimo).toBe(3)
  })

  it('senza episodi registrati media e massimo sono null', () => {
    const r = riepilogo([notte('2026-08-01', { esito: 'bagnato' })], periodo)
    expect(r.episodi.media).toBeNull()
    expect(r.episodi.massimo).toBeNull()
  })
})

describe('perSettimana', () => {
  it('spezza in settimane ancorate alla fine', () => {
    // 14 giorni esatti: due settimane piene.
    const gruppi = perSettimana([], { da: '2026-08-01', a: '2026-08-14' })
    expect(gruppi).toHaveLength(2)
    expect(gruppi[0].da).toBe('2026-08-01')
    expect(gruppi[1].a).toBe('2026-08-14') // l'ultima finisce sempre su `a`
    expect(gruppi.every((g) => !g.parziale)).toBe(true)
  })

  it('il gruppo corto è il più vecchio, ed è marcato parziale', () => {
    // 10 giorni: 3 + 7, e i 3 stanno all'inizio perché l'ancora è la fine.
    const gruppi = perSettimana([], { da: '2026-08-01', a: '2026-08-10' })
    expect(gruppi).toHaveLength(2)
    expect(gruppi[0].notti).toBe(3)
    expect(gruppi[0].parziale).toBe(true)
    expect(gruppi[1].notti).toBe(7)
    expect(gruppi[1].parziale).toBe(false)
    expect(gruppi[1].a).toBe('2026-08-10')
  })

  it('conta note, asciutte e sconosciute per settimana', () => {
    const gruppi = perSettimana(
      [
        notte('2026-08-08'),
        notte('2026-08-09', { esito: 'bagnato' }),
        notte('2026-08-10'),
        notte('2026-08-01'),
      ],
      { da: '2026-08-04', a: '2026-08-10' },
    )
    expect(gruppi).toHaveLength(1)
    expect(gruppi[0]).toMatchObject({
      note: 3,
      asciutte: 2,
      bagnate: 1,
      sconosciute: 4,
      quotaAsciutte: 2 / 3,
    })
  })

  it('una settimana senza dati ha quota null, non zero', () => {
    const gruppi = perSettimana([], { da: '2026-08-04', a: '2026-08-10' })
    expect(gruppi[0].quotaAsciutte).toBeNull()
    expect(gruppi[0].sconosciute).toBe(7)
  })

  it('periodo vuoto: nessun gruppo', () => {
    expect(perSettimana([], { da: '2026-08-10', a: '2026-08-01' })).toEqual([])
  })
})
