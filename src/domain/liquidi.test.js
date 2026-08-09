import { describe, it, expect } from 'vitest'
import {
  liquidiVuoti,
  tipiPerOrario,
  impostaOrario,
  riassuntoLiquidi,
  toggleVoce,
  statoFascia,
  riassuntoFascia,
  eRisposta,
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

describe('"niente" e "non so" (risposte, non bevande)', () => {
  it('distingue le risposte dalle bevande', () => {
    expect(eRisposta('nessuna')).toBe(true)
    expect(eRisposta('non_so')).toBe(true)
    expect(eRisposta('acqua')).toBe(false)
  })

  it('accende e spegne una bevanda', () => {
    let l = toggleVoce({}, 'a_cena', 'acqua')
    expect(l).toEqual({ a_cena: ['acqua'] })
    l = toggleVoce(l, 'a_cena', 'latte')
    expect(l).toEqual({ a_cena: ['acqua', 'latte'] })
    l = toggleVoce(l, 'a_cena', 'acqua')
    expect(l).toEqual({ a_cena: ['latte'] })
  })

  it('"niente" scaccia le bevande già scelte', () => {
    const l = { a_cena: ['acqua', 'latte'] }
    expect(toggleVoce(l, 'a_cena', 'nessuna')).toEqual({ a_cena: ['nessuna'] })
  })

  it('una bevanda scaccia "niente"', () => {
    const l = { a_cena: ['nessuna'] }
    expect(toggleVoce(l, 'a_cena', 'latte')).toEqual({ a_cena: ['latte'] })
  })

  it('"niente" e "non so" non convivono', () => {
    const l = { a_cena: ['nessuna'] }
    expect(toggleVoce(l, 'a_cena', 'non_so')).toEqual({ a_cena: ['non_so'] })
  })

  it('ri-toccare la risposta torna a "non risposto"', () => {
    const l = { a_cena: ['non_so'] }
    expect(toggleVoce(l, 'a_cena', 'non_so')).toEqual({})
  })

  it('non tocca le altre fasce ed è immutabile', () => {
    const l = { prima_di_cena: ['acqua'] }
    const dopo = toggleVoce(l, 'a_cena', 'nessuna')
    expect(dopo).toEqual({ prima_di_cena: ['acqua'], a_cena: ['nessuna'] })
    expect(l).toEqual({ prima_di_cena: ['acqua'] })
  })

  it('"non ha bevuto" è un DATO, non un buco', () => {
    // È la distinzione per cui esistono questi due valori: senza, "a cena non
    // ha bevuto niente" sarebbe indistinguibile dal non aver risposto, e il
    // contesto risulterebbe vuoto (l'app lo richiederebbe, la notifica
    // partirebbe). Stesso principio di "assenza di record ≠ asciutto".
    expect(liquidiVuoti({ a_cena: ['nessuna'] })).toBe(false)
    expect(liquidiVuoti({ a_cena: ['non_so'] })).toBe(false)
    expect(liquidiVuoti({ a_cena: [] })).toBe(true)
  })

  it('racconta lo stato di una fascia', () => {
    expect(statoFascia({}, 'a_cena')).toBe('vuoto')
    expect(statoFascia({ a_cena: ['nessuna'] }, 'a_cena')).toBe('niente')
    expect(statoFascia({ a_cena: ['non_so'] }, 'a_cena')).toBe('non_so')
    expect(statoFascia({ a_cena: ['acqua'] }, 'a_cena')).toBe('bevande')
  })

  it('riassume la fascia per la riga richiusa', () => {
    expect(riassuntoFascia({}, 'a_cena')).toBeNull()
    expect(riassuntoFascia({ a_cena: ['nessuna'] }, 'a_cena')).toBe('niente')
    expect(riassuntoFascia({ a_cena: ['non_so'] }, 'a_cena')).toBe('non so')
    expect(riassuntoFascia({ a_cena: ['acqua', 'latte'] }, 'a_cena')).toBe('acqua, latte')
  })
})
