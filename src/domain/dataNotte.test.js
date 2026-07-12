import { describe, it, expect } from 'vitest'
import {
  toDataNotte,
  nottePassata,
  notteInArrivo,
  serataTocca,
  giorniDaNotte,
  puoRecuperare,
  dataNotteIndietro,
  giornoEffettivo,
  FINESTRA_RECUPERO_GIORNI,
  ORA_INIZIO_GIORNO,
} from './dataNotte.js'

// Data di riferimento fissa: sabato 12 luglio 2026, mezzogiorno locale.
const oggi = new Date(2026, 6, 12, 12, 0, 0)

describe('convenzione data (Decisione 1)', () => {
  it('data_notte = data del mattino del risveglio', () => {
    expect(toDataNotte(oggi)).toBe('2026-07-12')
  })

  it('accetta anche una stringa ISO date-only', () => {
    expect(toDataNotte('2026-07-12')).toBe('2026-07-12')
  })

  it('rifiuta input non valido', () => {
    expect(() => toDataNotte('non-una-data')).toThrow()
  })
})

describe('le due notti che la sera tocca (sez. 6)', () => {
  it('la notte appena passata ha come mattino oggi', () => {
    expect(nottePassata(oggi)).toBe('2026-07-12')
  })

  it('la notte in arrivo ha come mattino domani', () => {
    expect(notteInArrivo(oggi)).toBe('2026-07-13')
  })

  it('serataTocca separa esito (ieri notte) e contesto (stanotte)', () => {
    // Il bug silenzioso: attribuire il contesto serale alla notte dell'esito.
    expect(serataTocca(oggi)).toEqual({
      esito: '2026-07-12',
      contesto: '2026-07-13',
    })
  })

  it('esito e contesto della stessa sera sono date DIVERSE', () => {
    const { esito, contesto } = serataTocca(oggi)
    expect(esito).not.toBe(contesto)
  })
})

describe('finestra di recupero serale (sez. 6 + Decisione 2)', () => {
  it('la finestra di default è 2 giorni', () => {
    expect(FINESTRA_RECUPERO_GIORNI).toBe(2)
  })

  it('giorniDaNotte conta i giorni di calendario', () => {
    expect(giorniDaNotte('2026-07-12', oggi)).toBe(0)
    expect(giorniDaNotte('2026-07-11', oggi)).toBe(1)
    expect(giorniDaNotte('2026-07-10', oggi)).toBe(2)
  })

  it('si può recuperare entro la finestra (0,1,2 giorni)', () => {
    expect(puoRecuperare('2026-07-12', oggi)).toBe(true)
    expect(puoRecuperare('2026-07-11', oggi)).toBe(true)
    expect(puoRecuperare('2026-07-10', oggi)).toBe(true)
  })

  it('oltre la finestra la notte resta sconosciuta (no recupero)', () => {
    // L'esempio del documento: chiedere "martedì?" il venerdì è inutile.
    expect(puoRecuperare('2026-07-09', oggi)).toBe(false)
  })

  it('una notte nel futuro non è recuperabile', () => {
    expect(puoRecuperare('2026-07-13', oggi)).toBe(false)
  })
})

describe('utilità storico', () => {
  it('dataNotteIndietro torna N giorni prima', () => {
    expect(dataNotteIndietro(oggi, 7)).toBe('2026-07-05')
  })
})

describe('giorno effettivo (il giorno inizia al risveglio, non a mezzanotte)', () => {
  it('l’ora di inizio è le 5', () => {
    expect(ORA_INIZIO_GIORNO).toBe(5)
  })

  it('dopo il risveglio il giorno effettivo è quello di calendario', () => {
    expect(giornoEffettivo(new Date(2026, 6, 13, 8, 0, 0))).toBe('2026-07-13')
    expect(giornoEffettivo(new Date(2026, 6, 13, 21, 0, 0))).toBe('2026-07-13')
  })

  it('tra mezzanotte e le 5 resta il giorno precedente (notte in corso)', () => {
    expect(giornoEffettivo(new Date(2026, 6, 13, 2, 0, 0))).toBe('2026-07-12')
    expect(giornoEffettivo(new Date(2026, 6, 13, 4, 59, 0))).toBe('2026-07-12')
  })

  it('alle 5 in punto scatta il nuovo giorno', () => {
    expect(giornoEffettivo(new Date(2026, 6, 13, 5, 0, 0))).toBe('2026-07-13')
  })
})

describe('robustezza sui cambi di mese/anno', () => {
  it('la notte in arrivo scavalca il fine mese', () => {
    expect(notteInArrivo(new Date(2026, 6, 31, 22, 0, 0))).toBe('2026-08-01')
  })

  it('la notte in arrivo scavalca il fine anno', () => {
    expect(notteInArrivo(new Date(2026, 11, 31, 23, 30, 0))).toBe('2027-01-01')
  })
})
