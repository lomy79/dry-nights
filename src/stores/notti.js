import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useBambinoStore } from './bambino'
import { applicaPatch, normalizzaEsito } from '@/domain/schedaMerge'
import { snapshotSalutePerNotte, nottiDaCorreggereRientro } from '@/domain/saluteScadenza'
import { SCHEMA_VERSION } from '@/domain/costanti'

/**
 * Le schede notte del bambino attivo, indicizzate per data_notte.
 * Un record si scrive in più momenti (sera/mattina) come PATCH parziali sullo
 * stesso record (upsert su child_id+data_notte). Realtime tiene allineato
 * l'altro telefono.
 */
export const useNottiStore = defineStore('notti', () => {
  const perData = ref({}) // { 'YYYY-MM-DD': record }
  let canale = null

  /** Carica (o ricarica) i record per un elenco di date-notte. */
  async function caricaDate(dateNotti) {
    const bambino = useBambinoStore()
    if (!bambino.bambinoAttivo || dateNotti.length === 0) return
    const { data, error } = await supabase
      .from('night_records')
      .select('*')
      .eq('child_id', bambino.bambinoAttivo.id)
      .in('data_notte', dateNotti)
    if (error) throw error
    const mappa = { ...perData.value }
    for (const r of data ?? []) mappa[r.data_notte] = r
    perData.value = mappa
  }

  function record(dataNotte) {
    return perData.value[dataNotte] ?? null
  }

  /** Carica le ultime `limite` notti registrate (per lo storico). */
  async function caricaRecenti(limite = 60) {
    const bambino = useBambinoStore()
    if (!bambino.bambinoAttivo) return []
    const { data, error } = await supabase
      .from('night_records')
      .select('*')
      .eq('child_id', bambino.bambinoAttivo.id)
      .order('data_notte', { ascending: false })
      .limit(limite)
    if (error) throw error
    const mappa = { ...perData.value }
    for (const r of data ?? []) mappa[r.data_notte] = r
    perData.value = mappa
    return data ?? []
  }

  /**
   * Carica tutte le notti di un intervallo di date (estremi inclusi).
   *
   * Diversa da `caricaRecenti`, che prende le ultime N righe REGISTRATE: per un
   * report serve il periodo di calendario, buchi compresi. Le notti mancanti non
   * tornano dal server — è proprio la loro assenza a renderle "sconosciute"
   * (Decisione 2) — e a contarle è `statistiche.js` confrontando con le date.
   */
  async function caricaIntervallo(da, a) {
    const bambino = useBambinoStore()
    if (!bambino.bambinoAttivo) return []
    const { data, error } = await supabase
      .from('night_records')
      .select('*')
      .eq('child_id', bambino.bambinoAttivo.id)
      .gte('data_notte', da)
      .lte('data_notte', a)
      .order('data_notte', { ascending: true })
    if (error) throw error
    const mappa = { ...perData.value }
    for (const r of data ?? []) mappa[r.data_notte] = r
    perData.value = mappa
    return data ?? []
  }

  /**
   * Applica un patch parziale alla scheda di `dataNotte` e la salva.
   * Fonde coi campi già presenti (Decisione 6) e normalizza l'esito (azzera
   * gravità/episodi se non è 'bagnato', come il CHECK dello schema).
   */
  async function salvaPatch(dataNotte, patch) {
    const bambino = useBambinoStore()
    if (!bambino.bambinoAttivo) throw new Error('Nessun bambino attivo')
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData?.user?.id ?? null

    const esistente = perData.value[dataNotte] ?? null
    const fuso = applicaPatch(esistente ?? {}, normalizzaEsito(patch))

    // Congela lo stato di salute effettivo di QUELLA notte (per le correlazioni),
    // a meno che il patch non stia già impostando la salute esplicitamente.
    const conSnapshot =
      patch.salute_stato === undefined
        ? { ...fuso, ...snapshotSalutePerNotte(bambino.statoAttivo, dataNotte) }
        : fuso

    const daSalvare = {
      ...conSnapshot,
      child_id: bambino.bambinoAttivo.id,
      data_notte: dataNotte,
      schema_version: SCHEMA_VERSION,
      updated_by: uid,
      ...(esistente ? {} : { created_by: uid }),
    }

    const { data, error } = await supabase
      .from('night_records')
      .upsert(daSalvare, { onConflict: 'child_id,data_notte' })
      .select()
      .single()
    if (error) throw error
    perData.value = { ...perData.value, [dataNotte]: data }
    return data
  }

  /**
   * Rientro a "sano" retroattivo (Decisione 7): dalle notti con data >= `daData`,
   * quelle marcate "malato" tornano "sano" (i loro snapshot erano congelati e
   * non si aggiornerebbero da soli). Le notti prima di `daData` restano malato.
   */
  async function correggiSaluteRetro(daData) {
    const bambino = useBambinoStore()
    if (!bambino.bambinoAttivo) return []
    // Le notti da correggere secondo la regola pura (usata anche nei test).
    const daCorreggere = nottiDaCorreggereRientro(perData.value, daData)
    // Correzione lato DB (filtro server: copre anche eventuali notti non in cache).
    const { error } = await supabase
      .from('night_records')
      .update({ salute_stato: 'sano', salute_sintomi: [] })
      .eq('child_id', bambino.bambinoAttivo.id)
      .gte('data_notte', daData)
      .eq('salute_stato', 'malato')
    if (error) throw error
    // Allinea la cache locale in modo coerente con la regola.
    const mappa = { ...perData.value }
    for (const dn of daCorreggere) {
      mappa[dn] = { ...mappa[dn], salute_stato: 'sano', salute_sintomi: [] }
    }
    perData.value = mappa
    return daCorreggere
  }

  /** Realtime: ricevi le modifiche fatte dall'altro genitore. */
  function sottoscrivi() {
    const bambino = useBambinoStore()
    if (!bambino.bambinoAttivo) return
    disiscrivi()
    canale = supabase
      .channel('notti-' + bambino.bambinoAttivo.id)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'night_records',
          filter: `child_id=eq.${bambino.bambinoAttivo.id}`,
        },
        (payload) => {
          const r = payload.new
          if (r && r.data_notte) {
            perData.value = { ...perData.value, [r.data_notte]: r }
          }
        },
      )
      .subscribe()
  }

  function disiscrivi() {
    if (canale) {
      supabase.removeChannel(canale)
      canale = null
    }
  }

  function reset() {
    perData.value = {}
    disiscrivi()
  }

  return {
    perData,
    caricaDate,
    caricaRecenti,
    caricaIntervallo,
    record,
    salvaPatch,
    correggiSaluteRetro,
    sottoscrivi,
    disiscrivi,
    reset,
  }
})
