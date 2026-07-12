import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useBambinoStore } from './bambino'
import { applicaPatch, normalizzaEsito } from '@/domain/schedaMerge'
import { snapshotSalutePerNotte } from '@/domain/saluteScadenza'
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
    record,
    salvaPatch,
    sottoscrivi,
    disiscrivi,
    reset,
  }
})
