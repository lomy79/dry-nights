import { describe, it, expect } from 'vitest'
import {
  campiContestoValorizzati,
  contestoVuoto,
  statoContesto,
  CAMPI_CONTESTO,
} from './contesto.js'

describe('contesto serale', () => {
  it('record nullo o senza contesto è vuoto', () => {
    expect(contestoVuoto(null)).toBe(true)
    expect(contestoVuoto({ esito: 'asciutto' })).toBe(true)
    expect(statoContesto(null)).toBe('vuoto')
  })

  it('un solo campo impostato → parziale', () => {
    const r = { liquidi_quantita: 'molti' }
    expect(campiContestoValorizzati(r)).toBe(1)
    expect(statoContesto(r)).toBe('parziale')
  })

  it('pipi_prima_dormire === false conta come risposta esplicita', () => {
    expect(campiContestoValorizzati({ pipi_prima_dormire: false })).toBe(1)
    expect(contestoVuoto({ pipi_prima_dormire: false })).toBe(false)
  })

  it('array/mappe vuoti non contano', () => {
    const r = { cibi_sospetti: [], liquidi: {} }
    expect(contestoVuoto(r)).toBe(true)
  })

  it('una mappa liquidi con una fascia conta', () => {
    expect(contestoVuoto({ liquidi: { a_cena: ['acqua'] } })).toBe(false)
  })

  it('tutti i campi impostati → completo', () => {
    const r = {
      pipi_prima_dormire: true,
      liquidi_quantita: 'medi',
      liquidi: { a_cena: ['acqua'] },
      cibi_sospetti: ['nessuno'],
    }
    expect(campiContestoValorizzati(r)).toBe(CAMPI_CONTESTO.length)
    expect(statoContesto(r)).toBe('completo')
  })
})
