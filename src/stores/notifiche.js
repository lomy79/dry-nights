import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import {
  pushSupportato,
  vapidConfigurato,
  permessoNotifiche,
  sottoscrizioneCorrente,
  attivaSuQuestoDispositivo,
  disattivaSuQuestoDispositivo,
} from '@/lib/push'
import { ORE_PROMEMORIA_DEFAULT, arrotondaAlQuarto, oraDaDb } from '@/domain/promemoria'

/**
 * Promemoria push: stato di QUESTO dispositivo + orari del genitore.
 *
 * Due piani diversi che la UI deve tenere distinti:
 *  - l'interruttore "ricevi qui" vale per il telefono che hai in mano;
 *  - gli orari valgono per te, su tutti i tuoi dispositivi.
 */
export const useNotificheStore = defineStore('notifiche', () => {
  const supportato = ref(pushSupportato())
  const vapidOk = ref(vapidConfigurato())
  const permesso = ref(permessoNotifiche())
  const attivoQui = ref(false)
  const prefs = ref({
    sera_attiva: true,
    ora_sera: ORE_PROMEMORIA_DEFAULT.sera,
    mattina_attiva: true,
    ora_mattina: ORE_PROMEMORIA_DEFAULT.mattina,
  })
  const caricato = ref(false)
  const inCorso = ref(false)
  const errore = ref('')

  const bloccatoDalBrowser = computed(() => permesso.value === 'denied')
  const disponibile = computed(() => supportato.value && vapidOk.value)

  /** Questo dispositivo è iscritto E il server lo sa? Servono entrambe. */
  async function verificaDispositivo() {
    const subscription = await sottoscrizioneCorrente()
    if (!subscription) return false
    const { count, error } = await supabase
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('endpoint', subscription.endpoint)
    if (error) throw error
    return (count ?? 0) > 0
  }

  async function carica() {
    errore.value = ''
    permesso.value = permessoNotifiche()
    try {
      const { data, error } = await supabase
        .from('notification_prefs')
        .select('*')
        .maybeSingle()
      if (error) throw error
      if (data) {
        prefs.value = {
          sera_attiva: data.sera_attiva,
          ora_sera: oraDaDb(data.ora_sera) ?? ORE_PROMEMORIA_DEFAULT.sera,
          mattina_attiva: data.mattina_attiva,
          ora_mattina: oraDaDb(data.ora_mattina) ?? ORE_PROMEMORIA_DEFAULT.mattina,
        }
      }
      // Senza riga in tabella restano i default: viene creata al primo salvataggio
      // (o dal trigger, alla prima iscrizione di un dispositivo).
      if (disponibile.value) attivoQui.value = await verificaDispositivo()
    } catch (e) {
      errore.value = e?.message ?? 'Non è stato possibile leggere le impostazioni.'
    } finally {
      caricato.value = true
    }
  }

  async function attiva() {
    errore.value = ''
    inCorso.value = true
    try {
      await attivaSuQuestoDispositivo()
      attivoQui.value = true
      // La RPC ha appena seminato le preferenze coi default: rileggile, così la
      // UI mostra gli orari veri del server e non quelli supposti.
      await carica()
    } catch (e) {
      errore.value = e?.message ?? 'Non è stato possibile attivare le notifiche.'
    } finally {
      permesso.value = permessoNotifiche()
      inCorso.value = false
    }
  }

  async function disattiva() {
    errore.value = ''
    inCorso.value = true
    try {
      await disattivaSuQuestoDispositivo()
      attivoQui.value = false
    } catch (e) {
      errore.value = e?.message ?? 'Non è stato possibile disattivare le notifiche.'
    } finally {
      inCorso.value = false
    }
  }

  /**
   * Salva orari e interruttori. Gli orari vengono allineati al quarto d'ora:
   * il cron gira ogni 15 minuti, promettere le 23:07 sarebbe una bugia.
   */
  async function salvaPrefs(patch) {
    errore.value = ''
    const nuove = { ...prefs.value, ...patch }
    try {
      nuove.ora_sera = arrotondaAlQuarto(nuove.ora_sera)
      nuove.ora_mattina = arrotondaAlQuarto(nuove.ora_mattina)
    } catch {
      errore.value = 'Orario non valido.'
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    const uid = userData?.user?.id
    if (!uid) {
      errore.value = 'Sessione non disponibile.'
      return
    }

    const { data, error } = await supabase
      .from('notification_prefs')
      .upsert({ user_id: uid, ...nuove }, { onConflict: 'user_id' })
      .select()
      .single()
    if (error) {
      errore.value = error.message
      return
    }
    prefs.value = {
      sera_attiva: data.sera_attiva,
      ora_sera: oraDaDb(data.ora_sera) ?? nuove.ora_sera,
      mattina_attiva: data.mattina_attiva,
      ora_mattina: oraDaDb(data.ora_mattina) ?? nuove.ora_mattina,
    }
  }

  function reset() {
    attivoQui.value = false
    caricato.value = false
    errore.value = ''
  }

  return {
    supportato,
    vapidOk,
    permesso,
    attivoQui,
    prefs,
    caricato,
    inCorso,
    errore,
    disponibile,
    bloccatoDalBrowser,
    carica,
    attiva,
    disattiva,
    salvaPrefs,
    reset,
  }
})
