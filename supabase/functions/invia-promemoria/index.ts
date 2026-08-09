/**
 * invia-promemoria — la sveglia dei promemoria push.
 *
 * pg_cron la chiama ogni 15 minuti. Lei NON decide chi avvisare: quella regola
 * vive in SQL (promemoria_da_inviare, docs/migrations/003-notifiche-push.sql),
 * accanto ai dati. Qui si fa solo la parte che il database non sa fare: cifrare
 * il payload e parlare col push service del telefono.
 *
 * Autenticazione: header `x-cron-secret`. La funzione è deployata con
 * --no-verify-jwt perché a chiamarla è il database, non un utente loggato.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type Promemoria = {
  subscription_id: string
  endpoint: string
  p256dh: string
  auth_key: string
  momento: 'sera' | 'mattina'
  child_id: string
  nome_bambino: string
  data_notte: string
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:promemoria@notti-serene.app'
const CRON_SECRET = Deno.env.get('CRON_SECRET')!

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/**
 * Il testo della notifica. Tono senza colpa: è un promemoria, non un richiamo —
 * niente "non hai ancora...", niente conteggi di giorni saltati.
 */
function testo(p: Promemoria) {
  if (p.momento === 'mattina') {
    return {
      titolo: 'Buongiorno 🌙',
      corpo: `Com’è andata la notte di ${p.nome_bambino}? Rispondi con un tap.`,
    }
  }
  return {
    titolo: 'Buonanotte 🌙',
    corpo: `Vuoi segnare cena e liquidi di ${p.nome_bambino} per stanotte?`,
  }
}

/** Endpoint morto: il telefono ha disinstallato o revocato. Si cancella. */
async function scartaSubscription(id: string, motivo: string) {
  await admin.from('push_subscriptions').delete().eq('id', id)
  console.log(`subscription ${id} rimossa (${motivo})`)
}

/**
 * Errore probabilmente passeggero: si toglie la riga di log così il giro di
 * cron successivo, ancora dentro la finestra di un'ora, riprova.
 */
async function permettiRitentativo(p: Promemoria, errore: string) {
  await admin
    .from('notification_log')
    .delete()
    .eq('subscription_id', p.subscription_id)
    .eq('momento', p.momento)
    .eq('data_notte', p.data_notte)
  await admin
    .from('push_subscriptions')
    .update({ last_error_at: new Date().toISOString(), last_error: errore.slice(0, 500) })
    .eq('id', p.subscription_id)
}

async function invia(p: Promemoria) {
  const { titolo, corpo } = testo(p)
  const payload = JSON.stringify({
    titolo,
    corpo,
    momento: p.momento,
    notte: p.data_notte,
  })

  try {
    await webpush.sendNotification(
      { endpoint: p.endpoint, keys: { p256dh: p.p256dh, auth: p.auth_key } },
      payload,
      // TTL: se il telefono è spento più a lungo, la notifica non serve più.
      // Un promemoria della sera che arriva il giorno dopo è solo rumore.
      { TTL: p.momento === 'mattina' ? 6 * 3600 : 4 * 3600 },
    )
    await admin
      .from('push_subscriptions')
      .update({ last_ok_at: new Date().toISOString(), last_error: null })
      .eq('id', p.subscription_id)
    return { ok: true }
  } catch (e) {
    const status = (e as { statusCode?: number })?.statusCode
    const messaggio = (e as Error)?.message ?? String(e)

    if (status === 404 || status === 410) {
      await scartaSubscription(p.subscription_id, `HTTP ${status}`)
    } else {
      await permettiRitentativo(p, messaggio)
    }
    console.error(`invio fallito (${status ?? 'n/d'}): ${messaggio}`)
    return { ok: false, status, messaggio }
  }
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('non autorizzato', { status: 401 })
  }

  // Modalità prova: ignora orari, silenzio e log e manda un push a tutti i
  // dispositivi iscritti. Serve a verificare la catena subito dopo il setup,
  // senza aspettare le 23. La usa scripts/setup-notifiche.sh.
  let prova = false
  try {
    prova = (await req.json())?.prova === true
  } catch {
    /* body vuoto: giro normale */
  }

  let daInviare: Promemoria[] = []

  if (prova) {
    const { data, error } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth_key')
    if (error) return new Response(error.message, { status: 500 })
    daInviare = (data ?? []).map((s) => ({
      subscription_id: s.id,
      endpoint: s.endpoint,
      p256dh: s.p256dh,
      auth_key: s.auth_key,
      momento: 'mattina' as const,
      child_id: '',
      nome_bambino: 'prova',
      data_notte: new Date().toISOString().slice(0, 10),
    }))
  } else {
    const { data, error } = await admin.rpc('promemoria_da_inviare')
    if (error) return new Response(error.message, { status: 500 })
    daInviare = (data ?? []) as Promemoria[]
  }

  if (daInviare.length === 0) {
    return Response.json({ inviati: 0, falliti: 0 })
  }

  const esiti = await Promise.all(daInviare.map(invia))
  const inviati = esiti.filter((e) => e.ok).length

  return Response.json({
    inviati,
    falliti: esiti.length - inviati,
    prova,
  })
})
