/**
 * Iscrizione del TELEFONO ai promemoria push.
 *
 * Il browser genera una "subscription" (un endpoint del push service piu' due
 * chiavi di cifratura) e noi la depositiamo su Supabase: da li' la Edge
 * Function la usera' per bussare al telefono anche ad app chiusa.
 *
 * E' per dispositivo, non per account: telefono e tablet dello stesso genitore
 * sono due subscription. Gli ORARI invece sono per genitore (notification_prefs).
 */

import { supabase } from './supabase'

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY

/** True se il browser sa fare push. */
export function pushSupportato() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** True se la chiave pubblica VAPID e' stata messa nel .env. */
export function vapidConfigurato() {
  return !!VAPID_PUBLIC
}

/** 'default' | 'granted' | 'denied' */
export function permessoNotifiche() {
  if (typeof Notification === 'undefined') return 'default'
  return Notification.permission
}

/** La chiave VAPID viaggia in base64url; il browser la vuole in byte. */
function base64UrlToUint8Array(base64Url) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function stessiByte(a, b) {
  if (!a || !b || a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

/**
 * La subscription e' legata alla chiave VAPID con cui e' nata. Passando da
 * staging a produzione (chiavi diverse) quella vecchia resta valida ma nessuno
 * puo' piu' usarla: va rifatta, altrimenti il telefono tace in silenzio.
 */
function chiaveDiversa(subscription) {
  const attuale = subscription?.options?.applicationServerKey
  if (!attuale) return true
  return !stessiByte(new Uint8Array(attuale), base64UrlToUint8Array(VAPID_PUBLIC))
}

/**
 * `serviceWorker.ready` non ha timeout: se il service worker non si registra
 * (in `npm run dev` senza devOptions, o per un errore di rete) la promise resta
 * appesa PER SEMPRE e l'interfaccia mostra un caricamento infinito. Meglio
 * arrendersi e dire cosa non va.
 */
const ATTESA_SW_MS = 10000

async function registrazioneServiceWorker() {
  let scaduto
  const timeout = new Promise((_, reject) => {
    scaduto = setTimeout(
      () => reject(new Error('Il service worker non si è avviato.')),
      ATTESA_SW_MS,
    )
  })
  try {
    return await Promise.race([navigator.serviceWorker.ready, timeout])
  } finally {
    clearTimeout(scaduto)
  }
}

/**
 * La subscription di QUESTO dispositivo, se c'e'.
 * Senza service worker restituisce null invece di esplodere: all'avvio significa
 * solo "non attivo qui", che e' esattamente quello che la UI deve mostrare.
 */
export async function sottoscrizioneCorrente() {
  if (!pushSupportato()) return null
  try {
    const registrazione = await registrazioneServiceWorker()
    return registrazione.pushManager.getSubscription()
  } catch {
    return null
  }
}

/**
 * Passa dalla RPC e non da un upsert diretto: l'endpoint è unico per browser,
 * non per account. Se sullo stesso telefono è già entrato l'altro genitore, la
 * riga esiste ma è invisibile alle nostre RLS, e l'upsert fallirebbe con un
 * errore incomprensibile. La funzione SECURITY DEFINER la riassegna.
 */
async function salvaSuSupabase(subscription) {
  const json = subscription.toJSON()
  const { error } = await supabase.rpc('registra_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth_key: json.keys?.auth,
    p_user_agent: navigator.userAgent?.slice(0, 300) ?? null,
  })
  if (error) throw error
}

/**
 * Attiva i promemoria su questo dispositivo: chiede il permesso, crea la
 * subscription e la salva. Il permesso va chiesto da un gesto dell'utente
 * (un tap), altrimenti il browser lo nega d'ufficio.
 */
export async function attivaSuQuestoDispositivo() {
  if (!pushSupportato()) throw new Error('Questo browser non supporta le notifiche push.')
  if (!vapidConfigurato()) {
    throw new Error('Manca VITE_VAPID_PUBLIC_KEY: vedi docs/notifiche-push.md.')
  }

  const permesso = await Notification.requestPermission()
  if (permesso !== 'granted') {
    throw new Error(
      permesso === 'denied'
        ? 'Le notifiche sono bloccate per questo sito: riattivale dalle impostazioni del browser.'
        : 'Permesso non concesso.',
    )
  }

  let registrazione
  try {
    registrazione = await registrazioneServiceWorker()
  } catch {
    // Qui invece l'errore va detto: hai premuto un bottone e non è successo nulla.
    throw new Error(
      import.meta.env.DEV
        ? 'Service worker non disponibile. In sviluppo serve `devOptions.enabled` ' +
          'in vite.config.js, oppure prova con `npm run build && npm run preview`.'
        : 'Il service worker non si è avviato: ricarica la pagina e riprova.',
    )
  }

  let subscription = await registrazione.pushManager.getSubscription()

  if (subscription && chiaveDiversa(subscription)) {
    await subscription.unsubscribe()
    subscription = null
  }
  if (!subscription) {
    subscription = await registrazione.pushManager.subscribe({
      // Obbligatorio: ogni push deve produrre una notifica visibile. Niente
      // push silenziosi, ed e' giusto cosi'.
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC),
    })
  }

  await salvaSuSupabase(subscription)
  return subscription
}

/** Spegne i promemoria su questo dispositivo (gli altri restano attivi). */
export async function disattivaSuQuestoDispositivo() {
  const subscription = await sottoscrizioneCorrente()
  if (!subscription) return

  // Prima il database: se cancellassimo solo lato browser, il server
  // continuerebbe a spingere verso un endpoint fantasma.
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', subscription.endpoint)
  if (error) throw error

  await subscription.unsubscribe()
}
