import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

/**
 * Sessione utente (Supabase Auth, magic link).
 * `init()` è idempotente: la prima chiamata legge la sessione e si mette in
 * ascolto dei cambi; le successive riusano la stessa promise. La route guard
 * la attende prima di decidere dove mandare l'utente.
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const ready = ref(false)
  let initPromise = null

  const isAuthed = computed(() => !!user.value)

  async function init() {
    if (initPromise) return initPromise
    initPromise = (async () => {
      // Recupera l'eventuale sessione esistente (anche quella appena creata dal
      // magic link: supabase-js legge il token dall'URL di ritorno da solo).
      const { data } = await supabase.auth.getSession()
      user.value = data.session?.user ?? null
      supabase.auth.onAuthStateChange((_event, session) => {
        user.value = session?.user ?? null
      })
      ready.value = true
    })()
    return initPromise
  }

  /** Invia il magic link. Al click nella mail l'utente torna su `origin`. */
  async function inviaMagicLink(email) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) throw error
  }

  async function logout() {
    await supabase.auth.signOut()
    user.value = null
  }

  return { user, ready, isAuthed, init, inviaMagicLink, logout }
})
