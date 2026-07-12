import { describe, it, expect } from 'vitest'
import {
  cosaManca,
  momentoDelGiorno,
  dateNottiRilevanti,
} from './cosaManca.js'

// Riferimento: 12 luglio 2026.
const mattina = new Date(2026, 6, 12, 8, 0, 0)
const sera = new Date(2026, 6, 12, 21, 0, 0)

describe('momentoDelGiorno', () => {
  it('prima del cutoff è mattina, dopo è sera', () => {
    expect(momentoDelGiorno(mattina)).toBe('mattina')
    expect(momentoDelGiorno(sera)).toBe('sera')
  })
  it('nelle ore piccole (prima delle 5) è ancora sera, non mattina', () => {
    expect(momentoDelGiorno(new Date(2026, 6, 13, 2, 0, 0))).toBe('sera')
    expect(momentoDelGiorno(new Date(2026, 6, 13, 5, 0, 0))).toBe('mattina')
  })
})

describe('confine notturno (00:00–05:00): la notte è ancora in corso', () => {
  // Alle 2 del 13: giorno effettivo = 12. Non deve chiedere l'esito della notte
  // del 13 (che non è finita); resta in "sera" con contesto per la notte in corso.
  const notte = new Date(2026, 6, 13, 2, 0, 0)

  it('è sera e non chiede l’esito prematuro', () => {
    const r = cosaManca({ oggi: notte, records: {} })
    expect(r.momento).toBe('sera')
    expect(r.esito).toBeNull()
  })

  it('il contesto prospettico punta alla notte in corso (13), non alla 14', () => {
    const r = cosaManca({ oggi: notte, records: {} })
    expect(r.contestoProsp.dataNotte).toBe('2026-07-13')
  })

  it('il recupero riguarda la notte appena finita (12) e precedenti', () => {
    const r = cosaManca({ oggi: notte, records: {}, finestraRecupero: 2 })
    const date = r.recuperi.map((x) => x.dataNotte)
    expect(date).toContain('2026-07-12')
    expect(date).not.toContain('2026-07-13') // in corso, non recuperabile
  })
})

describe('MATTINA — esito della notte passata', () => {
  it('se manca l’esito, chiede di registrarlo per la notte di oggi', () => {
    const r = cosaManca({ oggi: mattina, records: {} })
    expect(r.momento).toBe('mattina')
    expect(r.esito.dataNotte).toBe('2026-07-12')
    expect(r.contestoProsp).toBeNull()
  })

  it('di mattina propone anche il recupero delle notti recenti mancanti', () => {
    // La notte di oggi è la card principale; ieri e l'altroieri (se mancanti)
    // compaiono come recuperi, ma NON oggi (per non duplicarlo).
    const r = cosaManca({ oggi: mattina, records: {}, finestraRecupero: 2 })
    const date = r.recuperi.map((x) => x.dataNotte)
    expect(date).not.toContain('2026-07-12')
    expect(date).toEqual(expect.arrayContaining(['2026-07-11', '2026-07-10']))
  })

  it('di mattina non recupera le notti già registrate', () => {
    const r = cosaManca({
      oggi: mattina,
      records: { '2026-07-11': { esito: 'asciutto' } },
      finestraRecupero: 2,
    })
    const date = r.recuperi.map((x) => x.dataNotte)
    expect(date).not.toContain('2026-07-11')
    expect(date).toContain('2026-07-10')
  })

  it('se l’esito c’è già, non lo richiede (non chiedere due volte)', () => {
    const records = { '2026-07-12': { esito: 'asciutto' } }
    const r = cosaManca({ oggi: mattina, records })
    expect(r.esito).toBeNull()
  })

  it('chiede il contesto retrospettivo solo se del tutto vuoto', () => {
    const vuoto = cosaManca({ oggi: mattina, records: {} })
    expect(vuoto.contestoRetro?.dataNotte).toBe('2026-07-12')

    // Compilato a metà la sera prima → la mattina non insiste.
    const mezzo = cosaManca({
      oggi: mattina,
      records: { '2026-07-12': { liquidi_quantita: 'molti' } },
    })
    expect(mezzo.contestoRetro).toBeNull()
  })
})

describe('SERA — contesto in arrivo e recupero', () => {
  it('offre il contesto prospettico per la notte in arrivo (domani)', () => {
    const r = cosaManca({ oggi: sera, records: {} })
    expect(r.momento).toBe('sera')
    expect(r.contestoProsp.dataNotte).toBe('2026-07-13')
    expect(r.contestoProsp.stato).toBe('vuoto')
  })

  it('ripropone anche di sera il contesto di ieri notte se rimasto vuoto', () => {
    const r = cosaManca({ oggi: sera, records: {} })
    expect(r.contestoRetro?.dataNotte).toBe('2026-07-12') // la notte appena passata
  })

  it('non ripropone il contesto di ieri notte se già compilato (anche a metà)', () => {
    const r = cosaManca({
      oggi: sera,
      records: { '2026-07-12': { cibi_sospetti: ['fritto'] } },
    })
    expect(r.contestoRetro).toBeNull()
  })

  it('recupera l’esito della notte di oggi se non registrato al mattino', () => {
    const r = cosaManca({ oggi: sera, records: {} })
    const date = r.recuperi.map((x) => x.dataNotte)
    expect(date).toContain('2026-07-12') // "com'è andata la scorsa notte?"
  })

  it('non mette tra i recuperi le notti già registrate', () => {
    const records = {
      '2026-07-12': { esito: 'bagnato' }, // stanotte già fatta
      '2026-07-11': {}, // ieri mancante
    }
    const r = cosaManca({ oggi: sera, records })
    const date = r.recuperi.map((x) => x.dataNotte)
    expect(date).not.toContain('2026-07-12')
    expect(date).toContain('2026-07-11')
  })

  it('non recupera oltre la finestra', () => {
    const r = cosaManca({ oggi: sera, records: {}, finestraRecupero: 2 })
    const date = r.recuperi.map((x) => x.dataNotte)
    // Entro finestra: 12 (oggi), 11, 10. Non 09.
    expect(date).toEqual(expect.arrayContaining(['2026-07-12', '2026-07-11', '2026-07-10']))
    expect(date).not.toContain('2026-07-09')
  })
})

describe('reset salute (Decisione 7)', () => {
  const saluteScaduta = {
    salute_stato: 'malato',
    salute_sintomi: ['febbre'],
    salute_confermato_il: '2026-07-01', // molto oltre la finestra
  }
  it('segnala il reset quando il flag salute è scaduto', () => {
    const r = cosaManca({ oggi: mattina, statoSalute: saluteScaduta })
    expect(r.saluteReset).toBe(true)
  })
  it('nessun reset se sano', () => {
    const r = cosaManca({ oggi: mattina, statoSalute: { salute_stato: 'sano' } })
    expect(r.saluteReset).toBe(false)
  })
})

describe('dateNottiRilevanti', () => {
  it('include notte in arrivo, passata e finestra di recupero', () => {
    const date = dateNottiRilevanti(mattina, 2)
    expect(date).toEqual(
      expect.arrayContaining(['2026-07-13', '2026-07-12', '2026-07-11', '2026-07-10']),
    )
  })
})
