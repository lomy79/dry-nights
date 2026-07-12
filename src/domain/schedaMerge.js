/**
 * Fusione dei contributi alla scheda notte (Decisione 6).
 *
 * I due momenti (sera = contesto, mattina = esito) scrivono normalmente CAMPI
 * DIVERSI dello stesso record: vanno FUSI. Per il caso raro di scrittura
 * sullo stesso campo (offline / simultaneo) la regola è LAST-WRITE-WINS.
 *
 * Due strumenti:
 *  - applicaPatch(base, patch): il flusso normale. Ogni momento invia solo i
 *    campi che intende impostare; quelli assenti (undefined) non toccano il resto.
 *  - mergeSchede(a, b): il caso di conflitto tra due versioni complete, risolto
 *    con l'orologio (updated_at) campo per campo.
 */

/** Un valore "conta" se è impostato: non undefined/null, e se array non vuoto. */
export function haValore(v) {
  if (v === undefined || v === null) return false
  if (Array.isArray(v)) return v.length > 0
  return true
}

/**
 * Applica un patch parziale a una scheda base.
 * - Le chiavi con valore `undefined` nel patch vengono IGNORATE (non le tocchi).
 * - `null` è invece un valore reale (serve a cancellare esplicitamente un campo,
 *   es. azzerare `gravita` quando l'esito passa da 'bagnato' ad 'asciutto').
 * Questo realizza "campi distinti si fondono": chi scrive la sera e chi la
 * mattina manda patch disgiunti e non si pesta i piedi.
 */
export function applicaPatch(base, patch) {
  const out = { ...(base ?? {}) }
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (v === undefined) continue
    out[k] = v
  }
  return out
}

/**
 * Coerenza esito/gravità, come il CHECK dello schema: se non è 'bagnato',
 * gravità/episodi non si applicano. Da usare quando si costruisce il patch
 * dell'esito, così non si salvano combinazioni che il DB rifiuterebbe.
 */
export function normalizzaEsito(patch) {
  const out = { ...patch }
  if (out.esito && out.esito !== 'bagnato') {
    out.gravita = null
    out.episodi = null
  }
  return out
}

const CAMPI_SCHEDA = [
  'esito', 'gravita', 'episodi', 'minzione', 'numero_risvegli',
  'pipi_prima_dormire', 'liquidi_quantita', 'liquidi_tipo', 'liquidi_orario',
  'cibi_sospetti', 'alvo', 'sintomi_diurni', 'interventi',
  'salute_stato', 'salute_sintomi', 'note', 'umore_bambino',
]

/**
 * Fonde due versioni complete della stessa scheda (stesso child_id + data_notte)
 * in conflitto offline. Per ogni campo:
 *  - se solo una versione ha un valore → vince quella (unione dei campi distinti);
 *  - se entrambe hanno un valore → vince la più recente per `updated_at`
 *    (last-write-wins sul campo condiviso).
 * `a` e `b` devono avere `updated_at` (ISO string o Date).
 */
export function mergeSchede(a, b) {
  const piuRecente = new Date(a.updated_at) >= new Date(b.updated_at) ? a : b
  const menoRecente = piuRecente === a ? b : a
  const out = { ...menoRecente, ...piuRecente }

  for (const campo of CAMPI_SCHEDA) {
    const vRecente = piuRecente[campo]
    const vAltro = menoRecente[campo]
    // Il più recente vince solo se ha davvero un valore; altrimenti non deve
    // cancellare un dato valido scritto dall'altro momento.
    out[campo] = haValore(vRecente) ? vRecente : vAltro
  }
  return out
}
