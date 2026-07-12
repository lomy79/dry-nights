import { describe, it, expect } from 'vitest'
import {
  liquidiVuoti,
  tipiPerOrario,
  impostaOrario,
  riassuntoLiquidi,
} from './liquidi.js'

describe('liquidi correlati (tipo × fascia)', () => {
  it('mappa vuota / assente è vuota', () => {
    expect(liquidiVuoti({})).toBe(true)
    expect(liquidiVuoti(null)).toBe(true)
    expect(liquidiVuoti({ a_cena: [] })).toBe(true)
  })

  it('una fascia con tipi non è vuota', () => {
    expect(liquidiVuoti({ a_cena: ['acqua'] })).toBe(false)
  })

  it('legge i tipi di una fascia', () => {
    const l = { dopo_cena: ['latte'] }
    expect(tipiPerOrario(l, 'dopo_cena')).toEqual(['latte'])
    expect(tipiPerOrario(l, 'a_cena')).toEqual([])
  })

  it('imposta i tipi di una fascia senza toccare le altre', () => {
    const l = { prima_di_cena: ['caffeina_teina'] }
    const dopo = impostaOrario(l, 'a_cena', ['acqua'])
    expect(dopo).toEqual({ prima_di_cena: ['caffeina_teina'], a_cena: ['acqua'] })
    // Immutabile: l'originale non cambia.
    expect(l).toEqual({ prima_di_cena: ['caffeina_teina'] })
  })

  it('impostare a vuoto rimuove la fascia', () => {
    const l = { a_cena: ['acqua'] }
    expect(impostaOrario(l, 'a_cena', [])).toEqual({})
  })

  it('conserva lo scenario del genitore', () => {
    let l = {}
    l = impostaOrario(l, 'prima_di_cena', ['caffeina_teina'])
    l = impostaOrario(l, 'a_cena', ['acqua'])
    l = impostaOrario(l, 'dopo_cena', ['latte'])
    expect(riassuntoLiquidi(l)).toEqual([
      { orario: 'prima_di_cena', tipi: ['caffeina_teina'] },
      { orario: 'a_cena', tipi: ['acqua'] },
      { orario: 'dopo_cena', tipi: ['latte'] },
    ])
  })

  it('il riassunto è in ordine canonico di fascia', () => {
    const l = { dopo_cena: ['latte'], prima_di_cena: ['acqua'] }
    expect(riassuntoLiquidi(l).map((x) => x.orario)).toEqual([
      'prima_di_cena',
      'dopo_cena',
    ])
  })
})
