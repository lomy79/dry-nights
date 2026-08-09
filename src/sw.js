/**
 * Service worker dell'app.
 *
 * Oltre al precache (che prima generava vite-plugin-pwa da solo), qui vive la
 * ricezione dei promemoria push: e' l'unico pezzo di codice che gira quando
 * l'app e' chiusa e il telefono in tasca.
 *
 * I bottoni della notifica del mattino non salvano da qui: il service worker
 * non ha la sessione Supabase, quindi non puo' scrivere sul database. Passa
 * l'esito all'app via URL (`?esito=...&notte=...`) e a salvarlo e' l'app
 * all'avvio (src/domain/promemoria.js -> leggiDeepLinkEsito).
 */

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

const ICONA = '/icons/icon-192.png'

/**
 * Il payload arriva cifrato dalla Edge Function. Se per qualsiasi motivo non e'
 * leggibile mostriamo comunque qualcosa: una notifica generica e' meglio di una
 * notifica muta (su Android un push senza showNotification viene punito).
 */
function leggiPayload(event) {
  const fallback = {
    titolo: 'Notti serene',
    corpo: 'C’è una scheda da completare.',
    momento: null,
    notte: null,
  }
  try {
    return { ...fallback, ...(event.data?.json() ?? {}) }
  } catch {
    return fallback
  }
}

self.addEventListener('push', (event) => {
  const dati = leggiPayload(event)

  // I due bottoni solo al mattino: e' l'unico momento in cui la risposta sta
  // tutta in una scelta secca. La sera il contesto ha troppe sfumature per
  // stare in un bottone, quindi la notifica serale apre e basta.
  const azioni =
    dati.momento === 'mattina'
      ? [
          { action: 'asciutto', title: '😴 Asciutto' },
          { action: 'bagnato', title: '💧 Bagnato' },
        ]
      : []

  event.waitUntil(
    self.registration.showNotification(dati.titolo, {
      body: dati.corpo,
      icon: ICONA,
      badge: ICONA,
      lang: 'it',
      // Stesso tag = la nuova sostituisce la vecchia invece di impilarsi.
      tag: `promemoria-${dati.momento ?? 'x'}-${dati.notte ?? 'x'}`,
      renotify: true,
      // Niente vibrazione né requireInteraction: e' un promemoria, non un
      // allarme. Deve poter essere ignorato senza sforzo.
      data: { momento: dati.momento, notte: dati.notte },
      actions: azioni,
    }),
  )
})

/** Porta l'utente su `url`, riusando la finestra gia' aperta se c'e'. */
async function apriApp(url) {
  const finestre = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })
  for (const finestra of finestre) {
    if (new URL(finestra.url).origin !== self.location.origin) continue
    try {
      // navigate() ricarica la pagina sull'URL nuovo: cosi' l'app rilegge i
      // parametri all'avvio, esattamente come in un'apertura da zero.
      const navigata = await finestra.navigate(url)
      return (navigata ?? finestra).focus()
    } catch {
      // Alcuni browser rifiutano navigate() su client non controllati.
      return finestra.focus()
    }
  }
  return self.clients.openWindow(url)
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const { momento, notte } = event.notification.data ?? {}
  const parametri = new URLSearchParams()

  // Tap su un bottone: l'esito viaggia nell'URL e lo salva l'app.
  // Tap sul corpo della notifica: si apre e basta, nessun dato scritto per te.
  if (event.action === 'asciutto' || event.action === 'bagnato') {
    parametri.set('esito', event.action)
    if (notte) parametri.set('notte', notte)
  } else if (momento) {
    parametri.set('da', momento)
  }

  const query = parametri.toString()
  event.waitUntil(apriApp(query ? `/?${query}` : '/'))
})
