import { describe, it, expect } from 'vitest'
import {
  valoreValido,
  valoriMultiValidi,
  VALORI_AMMESSI,
  ESITO,
  SALUTE_SINTOMI,
} from './costanti.js'

describe('specchio dello schema — valori a scelta singola', () => {
  it('accetta i valori dell enum', () => {
    expect(valoreValido('esito', 'asciutto')).toBe(true)
    expect(valoreValido('esito', 'bagnato')).toBe(true)
  })
  it('rifiuta valori fuori enum', () => {
    expect(valoreValido('esito', 'umido')).toBe(false)
  })
  it('null è ammesso (campo non ancora registrato)', () => {
    expect(valoreValido('gravita', null)).toBe(true)
  })
  it('un campo sconosciuto è un errore di programmazione', () => {
    expect(() => valoreValido('inesistente', 'x')).toThrow()
  })
})

describe('specchio dello schema — multi-scelta (array)', () => {
  it('accetta array di valori ammessi', () => {
    expect(valoriMultiValidi('salute_sintomi', ['febbre', 'tosse'])).toBe(true)
  })
  it('rifiuta se anche un solo valore non è ammesso', () => {
    expect(valoriMultiValidi('salute_sintomi', ['febbre', 'emicrania'])).toBe(false)
  })
  it('array vuoto e null sono validi', () => {
    expect(valoriMultiValidi('cibi_sospetti', [])).toBe(true)
    expect(valoriMultiValidi('cibi_sospetti', null)).toBe(true)
  })
})

describe('coerenza con i CHECK dello schema.sql', () => {
  // Guardia: se qualcuno cambia una lista senza allineare il DB, questo test
  // documenta i valori attesi ed esplode, costringendo a un cambio consapevole.
  it('liquidi_orario combacia con lo schema', () => {
    expect(VALORI_AMMESSI.liquidi_orario).toEqual([
      'prima_di_cena', 'a_cena', 'dopo_cena', 'prima_di_dormire',
    ])
  })
  it('salute_sintomi combacia con lo schema', () => {
    expect(SALUTE_SINTOMI.map((o) => o.value)).toEqual([
      'febbre', 'tosse', 'raffreddore', 'mal_di_gola', 'altro',
    ])
  })
  it('esito ha esattamente due valori', () => {
    expect(ESITO.map((o) => o.value)).toEqual(['asciutto', 'bagnato'])
  })
})
