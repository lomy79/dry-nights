import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'

const CHIAVE_ATTIVO = 'drynights.bambinoAttivo'

/**
 * Bambino/i condivisi tra i due genitori + stato salute corrente.
 * L'elenco arriva già filtrato dalle RLS (vedo solo i bambini di cui sono
 * membro). Creazione e adesione passano dalle due RPC SECURITY DEFINER
 * (create_child / join_child) definite in docs/schema.sql.
 */
export const useBambinoStore = defineStore('bambino', () => {
  const bambini = ref([])
  const bambinoAttivoId = ref(localStorage.getItem(CHIAVE_ATTIVO) || null)
  const statoAttivo = ref(null) // riga child_active_states (salute)
  const numMembri = ref(1) // quanti genitori collegati al bambino attivo
  const caricato = ref(false)

  const bambinoAttivo = computed(
    () =>
      bambini.value.find((b) => b.id === bambinoAttivoId.value) ??
      bambini.value[0] ??
      null,
  )
  const haBambino = computed(() => bambini.value.length > 0)
  // L'altro genitore si è già unito? Serve a mostrare l'invito solo se serve.
  const attesaCoGenitore = computed(() => numMembri.value < 2)

  function impostaAttivo(id) {
    bambinoAttivoId.value = id
    if (id) localStorage.setItem(CHIAVE_ATTIVO, id)
  }

  async function carica() {
    const { data, error } = await supabase
      .from('children')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) throw error
    bambini.value = data ?? []
    if (!bambini.value.some((b) => b.id === bambinoAttivoId.value)) {
      impostaAttivo(bambini.value[0]?.id ?? null)
    }
    caricato.value = true
    if (bambinoAttivo.value) {
      await caricaStato()
      await caricaMembri()
    }
  }

  async function caricaStato() {
    if (!bambinoAttivo.value) return
    const { data, error } = await supabase
      .from('child_active_states')
      .select('*')
      .eq('child_id', bambinoAttivo.value.id)
      .maybeSingle()
    if (error) throw error
    statoAttivo.value = data
  }

  /** Conta i genitori collegati al bambino attivo (per l'invito). */
  async function caricaMembri() {
    if (!bambinoAttivo.value) return
    const { count, error } = await supabase
      .from('child_members')
      .select('*', { count: 'exact', head: true })
      .eq('child_id', bambinoAttivo.value.id)
    if (error) throw error
    numMembri.value = count ?? 1
  }

  async function creaBambino(nome, dataNascita) {
    const { data, error } = await supabase.rpc('create_child', {
      p_nome: nome,
      p_data_nascita: dataNascita || null,
    })
    if (error) throw error
    await carica()
    if (data?.id) impostaAttivo(data.id)
    return data
  }

  async function unisciciConCodice(codice) {
    const { data, error } = await supabase.rpc('join_child', {
      p_invite_code: codice.trim(),
    })
    if (error) throw error
    await carica()
    if (data?.id) impostaAttivo(data.id)
    return data
  }

  /**
   * Imposta/conferma lo stato di salute persistente (Decisione 7).
   * `salute_confermato_il` = oggi: fa ripartire la finestra di validità. Al
   * reset si passa sempre da una riselezione attiva (rimettere ≠ confermare).
   */
  async function impostaSalute({ stato, sintomi = [] }) {
    if (!bambinoAttivo.value) throw new Error('Nessun bambino attivo')
    const oggiISO = format(new Date(), 'yyyy-MM-dd')
    const { data, error } = await supabase
      .from('child_active_states')
      .upsert(
        {
          child_id: bambinoAttivo.value.id,
          salute_stato: stato,
          salute_sintomi: stato === 'sano' ? [] : sintomi,
          salute_confermato_il: oggiISO,
        },
        { onConflict: 'child_id' },
      )
      .select()
      .single()
    if (error) throw error
    statoAttivo.value = data
    return data
  }

  /** Al logout azzera lo stato in memoria (i dati restano nel DB). */
  function reset() {
    bambini.value = []
    statoAttivo.value = null
    numMembri.value = 1
    caricato.value = false
  }

  return {
    bambini,
    bambinoAttivoId,
    bambinoAttivo,
    statoAttivo,
    numMembri,
    attesaCoGenitore,
    caricato,
    haBambino,
    impostaAttivo,
    carica,
    caricaStato,
    caricaMembri,
    creaBambino,
    unisciciConCodice,
    impostaSalute,
    reset,
  }
})
