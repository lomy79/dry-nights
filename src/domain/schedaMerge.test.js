import { describe, it, expect } from 'vitest'
import {
  haValore,
  applicaPatch,
  normalizzaEsito,
  mergeSchede,
} from './schedaMerge.js'

describe('haValore', () => {
  it('null/undefined non contano', () => {
    expect(haValore(null)).toBe(false)
    expect(haValore(undefined)).toBe(false)
  })
  it('array vuoto (default schema) non conta', () => {
    expect(haValore([])).toBe(false)
  })
  it('false è un valore reale', () => {
    expect(haValore(false)).toBe(true)
  })
  it('stringa e array pieno contano', () => {
    expect(haValore('asciutto')).toBe(true)
    expect(haValore(['acqua'])).toBe(true)
  })
})

describe('applicaPatch — fusione dei campi distinti (Decisione 6)', () => {
  it('sera e mattina scrivono campi diversi senza pestarsi i piedi', () => {
    const sera = { liquidi_quantita: 'molti', liquidi_orario: ['prima_di_dormire'] }
    const mattina = { esito: 'bagnato', gravita: 'media' }
    const record = applicaPatch(sera, mattina)
    expect(record).toEqual({
      liquidi_quantita: 'molti',
      liquidi_orario: ['prima_di_dormire'],
      esito: 'bagnato',
      gravita: 'media',
    })
  })

  it('le chiavi undefined nel patch non toccano la base', () => {
    const base = { esito: 'asciutto', note: 'ok' }
    const out = applicaPatch(base, { esito: undefined, umore_bambino: 'contento' })
    expect(out.esito).toBe('asciutto')
    expect(out.umore_bambino).toBe('contento')
  })

  it('null nel patch cancella esplicitamente un campo', () => {
    const base = { esito: 'bagnato', gravita: 'zuppo' }
    const out = applicaPatch(base, { esito: 'asciutto', gravita: null })
    expect(out.gravita).toBeNull()
  })
})

describe('normalizzaEsito — coerenza col CHECK dello schema', () => {
  it('asciutto azzera gravità ed episodi', () => {
    const out = normalizzaEsito({ esito: 'asciutto', gravita: 'media', episodi: 2 })
    expect(out.gravita).toBeNull()
    expect(out.episodi).toBeNull()
  })
  it('bagnato lascia intatti gravità ed episodi', () => {
    const out = normalizzaEsito({ esito: 'bagnato', gravita: 'media', episodi: 2 })
    expect(out.gravita).toBe('media')
    expect(out.episodi).toBe(2)
  })
})

describe('mergeSchede — conflitto offline (Decisione 6)', () => {
  it('unisce i campi distinti indipendentemente da chi è più recente', () => {
    const locale = {
      updated_at: '2026-07-12T07:00:00Z',
      esito: 'asciutto',
      liquidi_quantita: null,
    }
    const remoto = {
      updated_at: '2026-07-11T22:00:00Z',
      esito: null,
      liquidi_quantita: 'molti',
    }
    const out = mergeSchede(locale, remoto)
    expect(out.esito).toBe('asciutto')
    expect(out.liquidi_quantita).toBe('molti')
  })

  it('sullo stesso campo vince la scrittura più recente (last-write-wins)', () => {
    const vecchio = { updated_at: '2026-07-12T06:00:00Z', esito: 'asciutto' }
    const nuovo = { updated_at: '2026-07-12T08:00:00Z', esito: 'bagnato' }
    expect(mergeSchede(vecchio, nuovo).esito).toBe('bagnato')
    expect(mergeSchede(nuovo, vecchio).esito).toBe('bagnato')
  })

  it('il più recente ma vuoto non cancella un valore valido dell altro', () => {
    const recenteVuoto = { updated_at: '2026-07-12T09:00:00Z', esito: null }
    const vecchioPieno = { updated_at: '2026-07-12T07:00:00Z', esito: 'bagnato' }
    expect(mergeSchede(recenteVuoto, vecchioPieno).esito).toBe('bagnato')
  })
})
