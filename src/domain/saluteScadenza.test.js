import { describe, it, expect } from 'vitest'
import {
  statoSaluteEffettivo,
  richiedeReset,
  snapshotSalutePerNotte,
  FINESTRA_SALUTE_GIORNI,
} from './saluteScadenza.js'

const confermato = '2026-07-10' // stato impostato il 10 luglio

const malato = {
  salute_stato: 'malato',
  salute_sintomi: ['febbre', 'tosse'],
  salute_confermato_il: confermato,
}

describe('scadenza flag salute (Decisione 7)', () => {
  it('la finestra di default è 3 giorni', () => {
    expect(FINESTRA_SALUTE_GIORNI).toBe(3)
  })

  it("'sano' non scade mai", () => {
    const sano = { salute_stato: 'sano', salute_sintomi: [], salute_confermato_il: null }
    const eff = statoSaluteEffettivo(sano, '2026-09-01')
    expect(eff).toEqual({ stato: 'sano', sintomi: [], scaduto: false })
  })

  it('malato entro la finestra resta malato con i suoi sintomi', () => {
    // 10 -> 13 = 3 giorni, al limite incluso.
    const eff = statoSaluteEffettivo(malato, '2026-07-13')
    expect(eff.stato).toBe('malato')
    expect(eff.sintomi).toEqual(['febbre', 'tosse'])
    expect(eff.scaduto).toBe(false)
  })

  it('malato il giorno stesso della conferma è valido', () => {
    const eff = statoSaluteEffettivo(malato, '2026-07-10')
    expect(eff.stato).toBe('malato')
  })

  it('oltre la finestra diventa sconosciuto, mai sano né il vecchio sintomo', () => {
    // 10 -> 14 = 4 giorni, oltre i 3.
    const eff = statoSaluteEffettivo(malato, '2026-07-14')
    expect(eff.stato).toBe('sconosciuto')
    expect(eff.sintomi).toEqual([])
    expect(eff.scaduto).toBe(true)
  })

  it('le notti PRIMA della conferma sono sconosciute, non malate', () => {
    const eff = statoSaluteEffettivo(malato, '2026-07-08')
    expect(eff.stato).toBe('sconosciuto')
    expect(eff.scaduto).toBe(false)
  })

  it('stato malato senza data di conferma → sconosciuto (non ci si fida)', () => {
    const eff = statoSaluteEffettivo(
      { salute_stato: 'malato', salute_sintomi: ['febbre'], salute_confermato_il: null },
      '2026-07-12',
    )
    expect(eff.stato).toBe('sconosciuto')
    expect(eff.scaduto).toBe(true)
  })
})

describe('reset obbligato (Decisione 7)', () => {
  it('non serve reset quando è sano', () => {
    expect(richiedeReset({ salute_stato: 'sano' }, '2026-07-30')).toBe(false)
  })

  it('non serve reset finché è dentro la finestra', () => {
    expect(richiedeReset(malato, '2026-07-12')).toBe(false)
  })

  it('serve reset quando lo stato malato è scaduto', () => {
    expect(richiedeReset(malato, '2026-07-20')).toBe(true)
  })
})

describe('snapshot salute sulla scheda notte', () => {
  it('congela lo stato effettivo di QUELLA notte (dentro finestra)', () => {
    expect(snapshotSalutePerNotte(malato, '2026-07-11')).toEqual({
      salute_stato: 'malato',
      salute_sintomi: ['febbre', 'tosse'],
    })
  })

  it('per una notte oltre la finestra salva sconosciuto senza sintomi', () => {
    expect(snapshotSalutePerNotte(malato, '2026-07-25')).toEqual({
      salute_stato: 'sconosciuto',
      salute_sintomi: [],
    })
  })
})
