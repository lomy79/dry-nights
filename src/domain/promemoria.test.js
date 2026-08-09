import { describe, it, expect } from 'vitest'
import {
  arrotondaAlQuarto,
  oraValida,
  oraDaDb,
  leggiDeepLinkEsito,
  ORE_PROMEMORIA_DEFAULT,
} from './promemoria.js'

// Riferimento: 12 luglio 2026, mattina. Notte appena passata = 2026-07-12.
const mattina = new Date(2026, 6, 12, 8, 0, 0)

describe('oraValida', () => {
  it('accetta gli orari veri e rifiuta il resto', () => {
    expect(oraValida('23:00')).toBe(true)
    expect(oraValida('00:00')).toBe(true)
    expect(oraValida('08:15')).toBe(true)
    expect(oraValida('24:00')).toBe(false)
    expect(oraValida('8:00')).toBe(false)
    expect(oraValida('23:60')).toBe(false)
    expect(oraValida(null)).toBe(false)
  })
})

describe('arrotondaAlQuarto', () => {
  it('porta al quarto d’ora più vicino', () => {
    expect(arrotondaAlQuarto('23:00')).toBe('23:00')
    expect(arrotondaAlQuarto('23:07')).toBe('23:00')
    expect(arrotondaAlQuarto('23:08')).toBe('23:15')
    expect(arrotondaAlQuarto('08:23')).toBe('08:30')
  })

  it('non scavalca la mezzanotte: 23:53 resta nella sera, non diventa 00:00', () => {
    // Scavalcare sposterebbe il promemoria della sera sul giorno dopo, cioè
    // sulla notte sbagliata.
    expect(arrotondaAlQuarto('23:53')).toBe('23:45')
    expect(arrotondaAlQuarto('23:59')).toBe('23:45')
  })

  it('i default sono già allineati al passo del cron', () => {
    expect(arrotondaAlQuarto(ORE_PROMEMORIA_DEFAULT.sera)).toBe(ORE_PROMEMORIA_DEFAULT.sera)
    expect(arrotondaAlQuarto(ORE_PROMEMORIA_DEFAULT.mattina)).toBe(
      ORE_PROMEMORIA_DEFAULT.mattina,
    )
  })

  it('rifiuta un orario non valido invece di inventarne uno', () => {
    expect(() => arrotondaAlQuarto('pippo')).toThrow()
  })
})

describe('oraDaDb', () => {
  it('taglia i secondi che arrivano da Postgres', () => {
    expect(oraDaDb('23:00:00')).toBe('23:00')
    expect(oraDaDb('08:30')).toBe('08:30')
    expect(oraDaDb(null)).toBeNull()
  })
})

describe('leggiDeepLinkEsito', () => {
  it('senza `notte` assume la notte appena passata', () => {
    expect(leggiDeepLinkEsito({ esito: 'asciutto' }, mattina)).toEqual({
      dataNotte: '2026-07-12',
      esito: 'asciutto',
    })
  })

  it('accetta una notte esplicita dentro la finestra di recupero', () => {
    expect(leggiDeepLinkEsito({ esito: 'bagnato', notte: '2026-07-11' }, mattina)).toEqual({
      dataNotte: '2026-07-11',
      esito: 'bagnato',
    })
  })

  it('rifiuta una notifica vecchia, fuori dalla finestra', () => {
    // Restata sulla schermata di blocco per giorni: non deve poter scrivere un
    // esito su una notte che nessuno ricorda più.
    expect(leggiDeepLinkEsito({ esito: 'asciutto', notte: '2026-07-01' }, mattina)).toBeNull()
  })

  it('rifiuta una notte nel futuro', () => {
    expect(leggiDeepLinkEsito({ esito: 'asciutto', notte: '2026-07-13' }, mattina)).toBeNull()
  })

  it('rifiuta un esito non ammesso o assente', () => {
    expect(leggiDeepLinkEsito({ esito: 'forse' }, mattina)).toBeNull()
    expect(leggiDeepLinkEsito({ esito: 'ASCIUTTO' }, mattina)).toBeNull()
    expect(leggiDeepLinkEsito({}, mattina)).toBeNull()
    expect(leggiDeepLinkEsito({ notte: '2026-07-12' }, mattina)).toBeNull()
  })

  it('rifiuta una data malformata o inesistente senza esplodere', () => {
    expect(leggiDeepLinkEsito({ esito: 'asciutto', notte: 'domani' }, mattina)).toBeNull()
    expect(leggiDeepLinkEsito({ esito: 'asciutto', notte: '2026-02-31' }, mattina)).toBeNull()
  })

  it('nelle ore piccole resta sulla notte in corso, non su quella dopo', () => {
    // Alle 2 del 13 luglio il giorno effettivo è ancora il 12: un tap sulla
    // notifica non deve attribuire l'esito alla notte del 13, non finita.
    const notteFonda = new Date(2026, 6, 13, 2, 0, 0)
    expect(leggiDeepLinkEsito({ esito: 'asciutto' }, notteFonda)).toEqual({
      dataNotte: '2026-07-12',
      esito: 'asciutto',
    })
  })
})
