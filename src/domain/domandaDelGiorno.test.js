import { describe, it, expect } from 'vitest'
import {
  prossimaDomanda,
  giorniDallUltimaRisposta,
  CADENZA,
  GIORNI_RINVIO,
} from './domandaDelGiorno.js'

// 12 agosto 2026: mattina alle 8, sera alle 22.
const MATTINA = new Date(2026, 7, 12, 8, 0)
const SERA = new Date(2026, 7, 12, 22, 0)
const NOTTE_PASSATA = '2026-08-12'
const NOTTE_ARRIVO = '2026-08-13'

/** Mappa di record a partire da coppie [data, campi]. */
function mappa(...coppie) {
  return Object.fromEntries(coppie.map(([dn, campi]) => [dn, { data_notte: dn, ...campi }]))
}

describe('giorniDallUltimaRisposta', () => {
  it('mai risposto = infinito', () => {
    expect(giorniDallUltimaRisposta({}, 'alvo', '2026-08-12')).toBe(Infinity)
  })

  it('un array vuoto non è una risposta', () => {
    const r = mappa(['2026-08-11', { sintomi_diurni: [] }])
    expect(giorniDallUltimaRisposta(r, 'sintomi_diurni', '2026-08-12')).toBe(Infinity)
  })

  it('"nessuno" invece è una risposta a tutti gli effetti', () => {
    const r = mappa(['2026-08-11', { sintomi_diurni: ['nessuno'] }])
    // Scritta sulla notte dell'11, cioè rispondendo la sera del 10: due giorni fa.
    expect(giorniDallUltimaRisposta(r, 'sintomi_diurni', '2026-08-12')).toBe(2)
  })

  it('la risposta di stasera vale zero giorni, non uno', () => {
    // Si scrive sulla notte in arrivo, ma parla della giornata che sta finendo.
    const r = mappa(['2026-08-13', { alvo: 'regolare' }])
    expect(giorniDallUltimaRisposta(r, 'alvo', '2026-08-12')).toBe(0)
  })

  it('prende la risposta più recente e ignora il futuro', () => {
    const r = mappa(
      ['2026-08-05', { alvo: 'regolare' }],
      ['2026-08-10', { alvo: 'stitico' }],
      ['2026-08-20', { alvo: 'regolare' }], // notte futura: non conta
    )
    expect(giorniDallUltimaRisposta(r, 'alvo', '2026-08-12')).toBe(3)
  })
})

describe('prossimaDomanda — le domande sulla notte', () => {
  it('senza esito non si chiede nulla: la domanda giusta è ancora l’esito', () => {
    const records = mappa([NOTTE_PASSATA, { liquidi_quantita: 'molti' }])
    expect(prossimaDomanda({ oggi: MATTINA, records })).toBeNull()
  })

  it('notte bagnata senza gravità: chiede la gravità', () => {
    const records = mappa([NOTTE_PASSATA, { esito: 'bagnato' }])
    const d = prossimaDomanda({ oggi: MATTINA, records })
    expect(d.chiave).toBe('gravita')
    expect(d.dataNotte).toBe(NOTTE_PASSATA)
    expect(d.tipo).toBe('singola')
  })

  it('notte asciutta: la gravità non si chiede, si passa alla minzione', () => {
    const records = mappa([NOTTE_PASSATA, { esito: 'asciutto' }])
    expect(prossimaDomanda({ oggi: MATTINA, records }).chiave).toBe('minzione')
  })

  it('una alla volta: risposta la gravità, tocca alla minzione', () => {
    const records = mappa([NOTTE_PASSATA, { esito: 'bagnato', gravita: 'media' }])
    expect(prossimaDomanda({ oggi: MATTINA, records }).chiave).toBe('minzione')
  })

  it('notte completa di mattina: nessuna domanda', () => {
    const records = mappa([NOTTE_PASSATA, { esito: 'asciutto', minzione: 'nessuna' }])
    expect(prossimaDomanda({ oggi: MATTINA, records })).toBeNull()
  })

  it('le domande sulla notte battono quelle lente anche di sera', () => {
    const records = mappa([NOTTE_PASSATA, { esito: 'bagnato' }])
    expect(prossimaDomanda({ oggi: SERA, records }).chiave).toBe('gravita')
  })
})

describe('prossimaDomanda — le domande lente', () => {
  const notteFatta = mappa([NOTTE_PASSATA, { esito: 'asciutto', minzione: 'nessuna' }])

  it('di mattina non si chiedono: la giornata non è ancora successa', () => {
    expect(prossimaDomanda({ oggi: MATTINA, records: notteFatta })).toBeNull()
  })

  it('mai risposte: si comincia dall’alvo', () => {
    const d = prossimaDomanda({ oggi: SERA, records: notteFatta })
    expect(d.chiave).toBe('alvo')
    // Si attacca alla notte IN ARRIVO: la giornata appena finita precede quella notte.
    expect(d.dataNotte).toBe(NOTTE_ARRIVO)
  })

  it('risposto l’alvo, la sera dopo tocca ai sintomi diurni', () => {
    const records = { ...notteFatta, ...mappa([NOTTE_ARRIVO, { alvo: 'regolare' }]) }
    expect(prossimaDomanda({ oggi: SERA, records }).chiave).toBe('sintomi_diurni')
  })

  it('tutte risposte oggi: silenzio', () => {
    const records = {
      ...notteFatta,
      ...mappa([
        NOTTE_ARRIVO,
        { alvo: 'regolare', sintomi_diurni: ['nessuno'], interventi: ['nessuno'] },
      ]),
    }
    expect(prossimaDomanda({ oggi: SERA, records })).toBeNull()
  })

  it('l’alvo torna la TERZA sera dopo, non la quinta', () => {
    // Cadenza 3 vuol dire tre giorni: rispondo la sera del 9, la domanda
    // ritorna la sera del 12. Contare dalla notte su cui è scritta la risposta,
    // e pretendere di superare la cadenza invece di raggiungerla, spostava il
    // ritorno di due sere: un campo chiesto la metà delle volte previste.
    const lenteFatte = { sintomi_diurni: ['nessuno'], interventi: ['nessuno'] }
    const sera = (giorno) => ({
      ...notteFatta,
      ...mappa([giorno, { alvo: 'regolare', ...lenteFatte }]),
    })
    expect(prossimaDomanda({ oggi: SERA, records: sera('2026-08-12') })).toBeNull() // sera dell'11
    expect(prossimaDomanda({ oggi: SERA, records: sera('2026-08-11') })).toBeNull() // sera del 10
    expect(prossimaDomanda({ oggi: SERA, records: sera('2026-08-10') }).chiave).toBe('alvo')
  })

  it('l’alvo torna dopo la sua cadenza, gli interventi no', () => {
    const vecchio = '2026-08-08' // 4 giorni prima
    const records = {
      ...notteFatta,
      ...mappa([vecchio, { alvo: 'regolare', sintomi_diurni: ['nessuno'], interventi: ['allarme'] }]),
    }
    expect(CADENZA.alvo).toBeLessThan(4)
    expect(CADENZA.interventi).toBeGreaterThan(4)
    expect(prossimaDomanda({ oggi: SERA, records }).chiave).toBe('alvo')
  })

  it('a parità di ritardo vince l’ordine di priorità, non il caso', () => {
    // Entrambi mai risposti: l'alvo è il più utile clinicamente e viene prima.
    const records = notteFatta
    expect(prossimaDomanda({ oggi: SERA, records }).chiave).toBe('alvo')
  })

  it('vince il più in ritardo rispetto alla PROPRIA cadenza', () => {
    const records = {
      ...notteFatta,
      ...mappa(
        ['2026-08-11', { alvo: 'regolare' }], // ieri: in regola (cadenza 3)
        ['2026-07-13', { sintomi_diurni: ['urgenza'] }], // 30 giorni fa: 23 di ritardo
        ['2026-08-10', { interventi: ['allarme'] }], // 2 giorni fa: in regola (cadenza 14)
      ),
    }
    expect(prossimaDomanda({ oggi: SERA, records }).chiave).toBe('sintomi_diurni')
  })

  it('un campo mai risposto batte uno risposto un mese fa', () => {
    // "Mai" è un ritardo infinito, ed è giusto che vinca: un buco totale vale
    // più di un aggiornamento vecchio.
    const records = {
      ...notteFatta,
      ...mappa(['2026-07-13', { sintomi_diurni: ['urgenza'], alvo: 'regolare' }]),
    }
    expect(prossimaDomanda({ oggi: SERA, records }).chiave).toBe('interventi')
  })
})

describe('prossimaDomanda — il rinvio', () => {
  const records = mappa([NOTTE_PASSATA, { esito: 'bagnato' }])

  it('"non ora" mette a tacere quella domanda e passa alla successiva', () => {
    const d = prossimaDomanda({
      oggi: MATTINA,
      records,
      rinviate: { gravita: '2026-08-12' },
    })
    expect(d.chiave).toBe('minzione')
  })

  it('il rinvio scade', () => {
    const scaduto = '2026-08-12'
    const dopo = new Date(2026, 7, 12 + GIORNI_RINVIO, 8, 0)
    const recordsIeri = mappa(['2026-08-15', { esito: 'bagnato' }])
    expect(
      prossimaDomanda({ oggi: dopo, records: recordsIeri, rinviate: { gravita: scaduto } }).chiave,
    ).toBe('gravita')
  })

  it('rinviate tutte: nessuna domanda, e nessuna insistenza', () => {
    const d = prossimaDomanda({
      oggi: MATTINA,
      records,
      rinviate: { gravita: '2026-08-12', minzione: '2026-08-12' },
    })
    expect(d).toBeNull()
  })
})
