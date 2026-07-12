import { createClient } from '@supabase/supabase-js'

// Client singleton. Legge le chiavi da .env (fuori da Git).
// VITE_SUPABASE_PUBLISHABLE_KEY deve contenere la PUBLISHABLE key
// (sb_publishable_...), mai la secret. La sicurezza dei dati è garantita dalle
// RLS (docs/schema.sql), non dal segreto: la publishable key sta sul client.
const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const mancanti = !url || !publishableKey
if (mancanti) {
  // Senza .env non crashiamo: usiamo placeholder validi così l'app carica
  // comunque (la schermata di login appare) e solo le chiamate di rete falliscono.
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY mancanti. ' +
      'Copia .env.example in .env e riempi i valori (vedi docs/setup-supabase.md). ' +
      'Finché mancano, login e dati non funzioneranno.',
  )
}

// Placeholder in formato valido: createClient() rifiuta un URL vuoto e
// bloccherebbe l'intera app all'avvio.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  publishableKey || 'sb_publishable_placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
)

/** True se le chiavi Supabase non sono configurate (utile per avvisi in UI). */
export const supabaseConfigurato = !mancanti
