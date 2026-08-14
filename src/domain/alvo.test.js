import { describe, it, expect } from 'vitest'
import {
  ultimaEvacuazione,
  consistenzaAlvo,
  giorniSenzaEvacuazione,
  esposizioneSenzaEvacuazione,
  etichettaUltimaEvacuazione,
} from './alvo.js'

describe('ultimaEvacuazione — leggere anche le schede pre-v3', () => {
  it('il campo nuovo vince, quando c’è', () => {
    const r = { ultima_evacuazione: 'due_tre_giorni', alvo: 'regolare' }
    expect(ultimaEvacuazione(r)).toBe('due_tre_giorni')
  })

  it('un vecchio alvo di consistenza implica un’evacuazione quel giorno', () => {
    // Non è una stima: per dire com'erano le feci bisognava averle viste.
    expect(ultimaEvacuazione({ alvo: 'regolare' })).toBe('oggi')
    expect(ultimaEvacuazione({ alvo: 'stitico' })).toBe('oggi')
    expect(ultimaEvacuazione({ alvo: 'diarrea' })).toBe('oggi')
  })

  it('"nessuna evacuazione" dice solo "non oggi": quanti giorni resta ignoto', () => {
    // È il buco che la Decisione 14 esiste per chiudere: riempirlo a stima
    // sarebbe il modo peggiore di celebrarla.
    expect(ultimaEvacuazione({ alvo: 'nessuna_evacuazione' })).toBeNull()
  })

  it('scheda vuota o assente: ignoto, non zero', () => {
    expect(ultimaEvacuazione({})).toBeNull()
    expect(ultimaEvacuazione(null)).toBeNull()
  })
})

describe('consistenzaAlvo', () => {
  it('non deduce niente all’indietro', () => {
    expect(consistenzaAlvo({ alvo: 'stitico' })).toBe('stitico')
    expect(consistenzaAlvo({ ultima_evacuazione: 'oggi' })).toBeNull()
  })

  it('"nessuna evacuazione" non è una consistenza', () => {
    expect(consistenzaAlvo({ alvo: 'nessuna_evacuazione' })).toBeNull()
  })
})

describe('giorniSenzaEvacuazione', () => {
  it('una fascia vale il suo estremo basso, non una media inventata', () => {
    expect(giorniSenzaEvacuazione({ ultima_evacuazione: 'oggi' })).toBe(0)
    expect(giorniSenzaEvacuazione({ ultima_evacuazione: 'ieri' })).toBe(1)
    expect(giorniSenzaEvacuazione({ ultima_evacuazione: 'due_tre_giorni' })).toBe(2)
    expect(giorniSenzaEvacuazione({ ultima_evacuazione: 'oltre_tre_giorni' })).toBe(4)
  })

  it('"non so" è ignoto, e ignoto non è zero', () => {
    expect(giorniSenzaEvacuazione({ ultima_evacuazione: 'non_so' })).toBeNull()
    expect(giorniSenzaEvacuazione({})).toBeNull()
  })
})

describe('esposizioneSenzaEvacuazione — solo i poli', () => {
  it('oltre i tre giorni è esposizione, oggi e ieri no', () => {
    expect(esposizioneSenzaEvacuazione({ ultima_evacuazione: 'oltre_tre_giorni' })).toBe(true)
    expect(esposizioneSenzaEvacuazione({ ultima_evacuazione: 'oggi' })).toBe(false)
    expect(esposizioneSenzaEvacuazione({ ultima_evacuazione: 'ieri' })).toBe(false)
  })

  it('"2-3 giorni" resta fuori: è la zona in cui la risposta onesta è "dipende"', () => {
    expect(esposizioneSenzaEvacuazione({ ultima_evacuazione: 'due_tre_giorni' })).toBeNull()
  })

  it('"non so" è ignoto, non negativo (Decisione 9)', () => {
    expect(esposizioneSenzaEvacuazione({ ultima_evacuazione: 'non_so' })).toBeNull()
  })

  it('una scheda vecchia con feci descritte conta come non esposta', () => {
    expect(esposizioneSenzaEvacuazione({ alvo: 'stitico' })).toBe(false)
  })
})

describe('etichettaUltimaEvacuazione', () => {
  it('traduce, anche partendo da una scheda vecchia', () => {
    expect(etichettaUltimaEvacuazione({ ultima_evacuazione: 'oltre_tre_giorni' })).toBe(
      'Più di 3 giorni fa',
    )
    expect(etichettaUltimaEvacuazione({ alvo: 'regolare' })).toBe('Oggi')
  })

  it('niente da dire, niente etichetta', () => {
    expect(etichettaUltimaEvacuazione({})).toBeNull()
  })
})
