/**
 * Specchio lato client dei valori ammessi dallo schema Postgres (docs/schema.sql).
 *
 * REGOLA: i `value` qui devono combaciare ESATTAMENTE con gli enum e con i CHECK
 * degli array nello schema. Se cambi un valore qui senza cambiarlo nel DB (o
 * viceversa), l'insert verrà rifiutato dal vincolo. Questo file è l'unico posto
 * in cui vivono quei valori lato client: UI e validazioni leggono da qui.
 *
 * I `label` sono per la UI (italiano) e non toccano il DB.
 */

// v2: bevande correlate alla fascia oraria (campo `liquidi` come mappa fascia->tipi).
export const SCHEMA_VERSION = 2

// Chi ha inserito il dato (campo concettuale del modello dati, sez. 1).
export const INSERITO_DA = [
  { value: 'genitore', label: 'Genitore' },
  { value: 'bambino', label: 'Bambino' },
]

// --- Esito (sez. 2) — enum a scelta singola ---
export const ESITO = [
  { value: 'asciutto', label: 'Asciutto' },
  { value: 'bagnato', label: 'Bagnato' },
]

export const GRAVITA = [
  { value: 'piccola', label: 'Piccola (una macchia)' },
  { value: 'media', label: 'Media' },
  { value: 'zuppo', label: 'Letto intero' },
]

export const MINZIONE = [
  { value: 'nessuna', label: 'Ha dormito senza alzarsi' },
  { value: 'da_solo', label: 'Si è alzato da solo' },
  { value: 'accompagnato_svegliato', label: 'Accompagnato / svegliato' },
]

// --- Contesto serale (sez. 3) ---
export const LIQUIDI_QUANTITA = [
  { value: 'pochi', label: 'Pochi' },
  { value: 'medi', label: 'Medi' },
  { value: 'molti', label: 'Molti' },
]

export const LIQUIDI_TIPO = [
  { value: 'acqua', label: 'Acqua' },
  { value: 'latte', label: 'Latte' },
  { value: 'zuccherate', label: 'Bevande zuccherate' },
  { value: 'caffeina_teina', label: 'Caffeina / teina' },
  { value: 'altro', label: 'Altro' },
]

export const LIQUIDI_ORARIO = [
  { value: 'prima_di_cena', label: 'Prima di cena' },
  { value: 'a_cena', label: 'A cena' },
  { value: 'dopo_cena', label: 'Dopo cena' },
  { value: 'prima_di_dormire', label: 'Subito prima di dormire' },
]

export const CIBI_SOSPETTI = [
  { value: 'fritto', label: 'Fritto' },
  { value: 'molto_salato', label: 'Molto salato' },
  { value: 'piccante', label: 'Piccante' },
  { value: 'frutta_acquosa', label: 'Frutta molto acquosa' },
  { value: 'nessuno', label: 'Nessuno' },
]

// --- Contesto clinico (sez. 4) ---
export const ALVO = [
  { value: 'regolare', label: 'Regolare' },
  { value: 'stitico', label: 'Stitico / feci dure' },
  { value: 'nessuna_evacuazione', label: 'Nessuna evacuazione' },
  { value: 'diarrea', label: 'Diarrea' },
]

export const SINTOMI_DIURNI = [
  { value: 'urgenza', label: 'Urgenza' },
  { value: 'minzioni_frequenti', label: 'Minzioni molto frequenti' },
  { value: 'incidenti_giorno', label: 'Incidenti di giorno' },
  { value: 'nessuno', label: 'Nessuno' },
]

export const INTERVENTI = [
  { value: 'sveglia_lifting', label: 'Sveglia / lifting notturno' },
  { value: 'allarme', label: 'Allarme enuresi' },
  { value: 'terapia', label: 'Terapia in corso' },
  { value: 'nessuno', label: 'Nessuno' },
]

// --- Salute (sez. 4 + Decisione 7) ---
// Lo stato è a scelta singola; i sintomi sono multi-scelta e hanno senso solo
// quando lo stato è 'malato'.
export const SALUTE_STATO = [
  { value: 'sano', label: 'Sano' },
  { value: 'malato', label: 'Non del tutto in forma' },
  { value: 'sconosciuto', label: 'Sconosciuto' },
]

export const SALUTE_SINTOMI = [
  { value: 'febbre', label: 'Febbre' },
  { value: 'tosse', label: 'Tosse' },
  { value: 'raffreddore', label: 'Raffreddore / naso chiuso' },
  { value: 'mal_di_gola', label: 'Mal di gola' },
  { value: 'altro', label: 'Altro' },
]

// --- Tono (sez. 5) ---
export const UMORE = [
  { value: 'contento', label: '🙂 Contento' },
  { value: 'neutro', label: '😐 Neutro' },
  { value: 'turbato', label: '😔 Turbato' },
]

/**
 * Mappa campo → valori ammessi, usata dalle validazioni. Rispecchia i CHECK
 * dello schema. Cambiare qui SENZA cambiare lo schema fa fallire l'insert.
 */
export const VALORI_AMMESSI = {
  esito: ESITO.map((o) => o.value),
  gravita: GRAVITA.map((o) => o.value),
  minzione: MINZIONE.map((o) => o.value),
  liquidi_quantita: LIQUIDI_QUANTITA.map((o) => o.value),
  liquidi_tipo: LIQUIDI_TIPO.map((o) => o.value),
  liquidi_orario: LIQUIDI_ORARIO.map((o) => o.value),
  cibi_sospetti: CIBI_SOSPETTI.map((o) => o.value),
  alvo: ALVO.map((o) => o.value),
  sintomi_diurni: SINTOMI_DIURNI.map((o) => o.value),
  interventi: INTERVENTI.map((o) => o.value),
  salute_stato: SALUTE_STATO.map((o) => o.value),
  salute_sintomi: SALUTE_SINTOMI.map((o) => o.value),
}

/** Mappa campo → lista di opzioni {value,label}, per tradurre i valori in UI. */
export const OPZIONI = {
  esito: ESITO,
  gravita: GRAVITA,
  minzione: MINZIONE,
  liquidi_quantita: LIQUIDI_QUANTITA,
  liquidi_tipo: LIQUIDI_TIPO,
  liquidi_orario: LIQUIDI_ORARIO,
  cibi_sospetti: CIBI_SOSPETTI,
  alvo: ALVO,
  sintomi_diurni: SINTOMI_DIURNI,
  interventi: INTERVENTI,
  salute_stato: SALUTE_STATO,
  salute_sintomi: SALUTE_SINTOMI,
  umore_bambino: UMORE,
}

/** Etichetta leggibile di un valore a scelta singola (fallback: il valore stesso). */
export function etichettaValore(campo, valore) {
  if (valore == null) return null
  return OPZIONI[campo]?.find((o) => o.value === valore)?.label ?? String(valore)
}

/** Etichette leggibili di un campo multi-scelta (array). */
export function etichetteValori(campo, valori) {
  if (!Array.isArray(valori)) return []
  return valori.map((v) => etichettaValore(campo, v))
}

/** True se `valore` è tra quelli ammessi per un campo a scelta singola. */
export function valoreValido(campo, valore) {
  const ammessi = VALORI_AMMESSI[campo]
  if (!ammessi) throw new Error(`Campo sconosciuto: ${campo}`)
  return valore == null || ammessi.includes(valore)
}

/** True se tutti gli elementi di `valori` (array) sono ammessi per un campo multi-scelta. */
export function valoriMultiValidi(campo, valori) {
  const ammessi = VALORI_AMMESSI[campo]
  if (!ammessi) throw new Error(`Campo sconosciuto: ${campo}`)
  if (valori == null) return true
  if (!Array.isArray(valori)) return false
  return valori.every((v) => ammessi.includes(v))
}
