<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { useAuthStore } from '@/stores/auth'
import { useBambinoStore } from '@/stores/bambino'
import { useNottiStore } from '@/stores/notti'
import { useNotificheStore } from '@/stores/notifiche'
import { cosaManca, dateNottiRilevanti, cambiamenti } from '@/domain/cosaManca'
import { prossimaDomanda } from '@/domain/domandaDelGiorno'
import { leggiDeepLinkEsito } from '@/domain/promemoria'
import {
  nottePassata,
  notteInArrivo,
  giornoEffettivo,
  dataNotteIndietro,
} from '@/domain/dataNotte'
import { contestoVuoto } from '@/domain/contesto'
import { statoSaluteEffettivo } from '@/domain/saluteScadenza'
import { etichettaValore } from '@/domain/costanti'
import EsitoCard from '@/components/notte/EsitoCard.vue'
import ContestoEditor from '@/components/notte/ContestoEditor.vue'
import NotaCampo from '@/components/notte/NotaCampo.vue'
import SaluteReset from '@/components/notte/SaluteReset.vue'
import SaluteControllo from '@/components/notte/SaluteControllo.vue'
import DomandaSingola from '@/components/notte/DomandaSingola.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const bambino = useBambinoStore()
const notti = useNottiStore()
const notifiche = useNotificheStore()

// `oggi` non è fisso: è una FOTOGRAFIA, rifatta solo quando l'app torna in primo
// piano e solo se nel frattempo è cambiato il giorno o il momento. Dentro una
// schermata aperta resta immobile — le card non devono muoversi sotto le dita —
// ma una PWA lasciata in background dal mattino e riaperta alle 22 non può
// continuare a credere che sia mattina: è così che la domanda della sera non
// arrivava mai, senza che niente lo facesse capire.
// dnPassata usa il giorno effettivo (prima delle 5 = notte precedente).
const oggi = ref(new Date())
const dnPassata = computed(() => nottePassata(giornoEffettivo(oggi.value)))
const errore = ref('')
const copiato = ref(false)

// Tap su "Asciutto"/"Bagnato" nella notifica del mattino: il service worker non
// può scrivere sul database (non ha la sessione), quindi passa l'esito nell'URL
// e lo salviamo qui. Letto SUBITO, in modo sincrono: le card devono già sapere,
// al primo render, se restare aperte sui dettagli.
const daNotifica = leggiDeepLinkEsito(route.query, oggi.value)
const confermaNotifica = ref('')

// Solo il "bagnato" tiene la card aperta: ha dei dettagli da offrire.
// L'"asciutto" è già completo così, e chiudere è il modo di dirlo.
function apriDettagli(dataNotte) {
  return daNotifica?.esito === 'bagnato' && daNotifica.dataNotte === dataNotte
}

// Contesto retrospettivo (mattina): deciso una volta al caricamento e tenuto
// aperto finché non chiudi con "Fatto", così non sparisce dopo il primo chip.
const contestoRetroAperto = ref(false)

// Invito: appare da solo finché sei l'unico genitore, ma è nascondibile e
// sempre richiamabile (per darlo anche a nonni/babysitter).
const invitoRichiestoAMano = ref(false)
const invitoNascosto = ref(false) // scelta ricordata per bambino (localStorage)

function chiaveInvito() {
  return `drynights.invitoNascosto.${bambino.bambinoAttivo?.id ?? 'x'}`
}
const invitoVisibile = computed(
  () =>
    !!bambino.bambinoAttivo?.invite_code &&
    (invitoRichiestoAMano.value ||
      (bambino.attesaCoGenitore && !invitoNascosto.value)),
)
function mostraInvito() {
  invitoRichiestoAMano.value = true
}
function nascondiInvito() {
  invitoNascosto.value = true
  invitoRichiestoAMano.value = false
  localStorage.setItem(chiaveInvito(), '1')
}

const manca = computed(() =>
  cosaManca({
    oggi: oggi.value,
    records: notti.perData,
    statoSalute: bambino.statoAttivo,
  }),
)

const recPassata = computed(() => notti.record(dnPassata.value))

// --- Una domanda alla volta (sez. 4: i campi che il pediatra chiede per primi) ---
//
// I "non ora" vivono nel localStorage e non nel database: sono una preferenza di
// chi ha in mano il telefono in quel momento, non un dato del bambino. Se stasera
// rimando io, l'altro genitore può ancora rispondere — ed è giusto, perché magari
// lui la risposta ce l'ha.
const rinviate = ref({})

function chiaveRinvii() {
  return `drynights.domandeRinviate.${bambino.bambinoAttivo?.id ?? 'x'}`
}

const domanda = computed(() =>
  prossimaDomanda({ oggi: oggi.value, records: notti.perData, rinviate: rinviate.value }),
)

async function rispondiDomanda({ campo, valore }) {
  await salva(domanda.value.dataNotte, { [campo]: valore })
}

function rinviaDomanda(chiave) {
  rinviate.value = { ...rinviate.value, [chiave]: giornoEffettivo(oggi.value) }
  localStorage.setItem(chiaveRinvii(), JSON.stringify(rinviate.value))
}

/**
 * Le card esito da mostrare: i recuperi serali più — se stai arrivando da una
 * notifica — la notte che hai appena segnato. Senza quest'aggiunta la card
 * sparirebbe nell'istante del salvataggio (l'esito non "manca" più), e chi ha
 * risposto "bagnato" la sera non vedrebbe mai i dettagli che gli si aprono.
 */
const cardEsiti = computed(() => {
  const lista = [...manca.value.recuperi]
  if (!daNotifica) return lista
  const giàInLista = lista.some((r) => r.dataNotte === daNotifica.dataNotte)
  const giàInCima = manca.value.momento === 'mattina' && daNotifica.dataNotte === dnPassata.value
  if (!giàInLista && !giàInCima) {
    lista.unshift({
      dataNotte: daNotifica.dataNotte,
      record: notti.record(daNotifica.dataNotte),
    })
  }
  return lista
})
const saluteEffettiva = computed(() => statoSaluteEffettivo(bambino.statoAttivo, oggi.value))

function etichettaNotte(dn) {
  if (dn === dnPassata.value) return 'questa notte'
  return `la notte di ${format(parseISO(dn), 'EEEE d MMMM', { locale: it })}`
}
function capitalizza(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

async function salva(dataNotte, patch) {
  errore.value = ''
  try {
    await notti.salvaPatch(dataNotte, patch)
  } catch (e) {
    errore.value = e?.message ?? 'Non è stato possibile salvare.'
  }
}

const eraMalato = computed(() => bambino.statoAttivo?.salute_stato === 'malato')

async function confermaSalute(payload) {
  errore.value = ''
  try {
    // giorniFa: 0 = oggi; >0 = rientro a sano retroattivo ("da martedì").
    const daData = dataNotteIndietro(oggi.value, payload.giorniFa ?? 0)
    const rientroSano = payload.stato === 'sano' && eraMalato.value
    await bambino.impostaSalute({
      stato: payload.stato,
      sintomi: payload.sintomi,
      daData,
    })
    // Corregge gli snapshot delle notti nel mezzo (erano congelati "malato").
    if (rientroSano) await notti.correggiSaluteRetro(daData)
  } catch (e) {
    errore.value = e?.message ?? 'Non è stato possibile aggiornare lo stato.'
  }
}

async function copiaCodice() {
  try {
    await navigator.clipboard.writeText(bambino.bambinoAttivo?.invite_code ?? '')
    copiato.value = true
    setTimeout(() => (copiato.value = false), 2000)
  } catch {
    /* clipboard non disponibile: il codice resta visibile */
  }
}

async function esci() {
  await auth.logout()
  notti.reset()
  bambino.reset()
  // L'iscrizione push del dispositivo resta nel database: è di chi esce, e al
  // rientro ritorna attiva. Qui si azzera solo lo stato in memoria.
  notifiche.reset()
  router.replace({ name: 'login' })
}

async function caricaNotti() {
  await notti.caricaDate(dateNottiRilevanti(oggi.value))
  // Le domande lente hanno una cadenza fino a due settimane: per sapere se una
  // risposta c'è già serve più storia delle quattro notti che bastano a
  // `cosaManca`. Trenta giorni coprono la cadenza più lunga con margine.
  await notti.caricaIntervallo(
    dataNotteIndietro(giornoEffettivo(oggi.value), 30),
    notteInArrivo(giornoEffettivo(oggi.value)),
  )
}

/**
 * L'app è tornata in primo piano: la fotografia `oggi` potrebbe essere vecchia.
 *
 * Si rifà solo se è cambiato il giorno o il momento. Passare da un'altra app e
 * tornare indietro dopo dieci secondi non deve ridisegnare niente: il motivo per
 * cui `oggi` era fisso resta valido, cambia solo il fatto che "la sessione" di
 * una PWA può durare giorni. Al cambio di giorno cambiano anche le notti
 * rilevanti, quindi si ricarica prima di ridisegnare.
 */
async function rinfrescaMomento() {
  if (document.visibilityState !== 'visible') return
  const adesso = new Date()
  const { giorno: giornoNuovo, momento: momentoNuovo } = cambiamenti(oggi.value, adesso)
  if (!giornoNuovo && !momentoNuovo) return

  oggi.value = adesso
  try {
    await caricaNotti()
  } catch (e) {
    errore.value = e?.message ?? 'Errore nel caricamento.'
    return
  }
  // Solo al cambio di giorno: è una notte nuova, e la domanda è nuova con lei.
  // Al solo passaggio a "sera" no, o un contesto chiuso con "Fatto" si
  // riaprirebbe in mano a chi l'aveva appena chiuso.
  if (giornoNuovo) contestoRetroAperto.value = contestoVuoto(recPassata.value)
}

onMounted(async () => {
  document.addEventListener('visibilitychange', rinfrescaMomento)
  try {
    await bambino.caricaStato()
    await bambino.caricaMembri()
    invitoNascosto.value = localStorage.getItem(chiaveInvito()) === '1'
    try {
      rinviate.value = JSON.parse(localStorage.getItem(chiaveRinvii()) ?? '{}')
    } catch {
      rinviate.value = {} // storage sporco: si riparte, non si rompe la schermata
    }
    await caricaNotti()
    // Apri il contesto di ieri notte se è rimasto del tutto vuoto (a qualsiasi ora).
    contestoRetroAperto.value = contestoVuoto(recPassata.value)
    notti.sottoscrivi()

    // Esito arrivato dal bottone della notifica: si salva dopo il caricamento,
    // così `salvaPatch` fonde col record già esistente invece di sovrascriverlo.
    if (daNotifica) {
      await salva(daNotifica.dataNotte, { esito: daNotifica.esito })
      if (!errore.value) {
        confermaNotifica.value =
          `${capitalizza(etichettaNotte(daNotifica.dataNotte))}: ` +
          `${etichettaValore('esito', daNotifica.esito).toLowerCase()} — segnato ✓`
      }
    }
    // Via i parametri dall'URL: un refresh non deve riscrivere l'esito.
    if (Object.keys(route.query).length > 0) {
      router.replace({ name: 'oggi', query: {} })
    }
  } catch (e) {
    errore.value = e?.message ?? 'Errore nel caricamento.'
  }
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', rinfrescaMomento)
  notti.disiscrivi()
})
</script>

<template>
  <main>
    <header style="display: flex; align-items: baseline; justify-content: space-between">
      <h1>{{ manca.momento === 'mattina' ? 'Buongiorno 🌙' : 'Buonasera 🌙' }}</h1>
      <div style="display: flex; gap: 0.9rem; flex-shrink: 0; align-items: baseline">
        <router-link
          class="btn-link"
          :to="{ name: 'promemoria' }"
          title="Promemoria"
          aria-label="Promemoria"
          >🔔</router-link
        >
        <!-- Come il 🔔: le destinazioni secondarie stanno in un glifo, o la testata
             di un telefono stretto va a capo e la schermata comincia storta. -->
        <router-link
          class="btn-link"
          :to="{ name: 'andamento' }"
          title="Andamento"
          aria-label="Andamento"
          >📈</router-link
        >
        <router-link class="btn-link" :to="{ name: 'storico' }">Storico</router-link>
        <button class="btn-link" @click="mostraInvito">Invita</button>
        <button class="btn-link" @click="esci">Esci</button>
      </div>
    </header>
    <p v-if="bambino.bambinoAttivo" class="muted">
      Profilo di <strong>{{ bambino.bambinoAttivo.nome }}</strong>.
    </p>

    <!-- Conferma di ciò che è stato scritto col tap sulla notifica: senza,
         l'esito sparirebbe nel database senza che tu veda nulla. -->
    <p v-if="confermaNotifica" class="avviso">{{ confermaNotifica }}</p>

    <!-- Salute: reset forzato se scaduta (Decisione 7), altrimenti controllo quotidiano -->
    <SaluteReset v-if="manca.saluteReset" :era-malato="eraMalato" @conferma="confermaSalute" />
    <SaluteControllo
      v-else
      :effettivo="saluteEffettiva"
      :era-malato="eraMalato"
      @conferma="confermaSalute"
    />

    <!-- MATTINA: esito della notte passata (resta aperto fino a "Ho finito") -->
    <EsitoCard
      v-if="manca.momento === 'mattina'"
      :record="recPassata"
      titolo="Com’è andata questa notte?"
      etichetta="Questa notte"
      :forza-editor="apriDettagli(dnPassata)"
      @salva="(p) => salva(dnPassata, p)"
    />

    <!-- UNA domanda alla volta: quella che manca da più tempo, rimandabile.
         Sta qui, subito dopo l'esito e prima di tutto ciò che è facoltativo,
         perché è breve e perché in fondo alla pagina non la vedrebbe nessuno. -->
    <DomandaSingola
      v-if="domanda"
      :domanda="domanda"
      @rispondi="rispondiDomanda"
      @rinvia="rinviaDomanda"
    />

    <!-- Contesto di IERI NOTTE, se non compilato la sera prima (a qualsiasi ora) -->
    <div class="card card-tenue" v-if="contestoRetroAperto">
      <div class="recap">
        <h2 class="titolo-card">
          La serata di ieri <span class="facoltativo">facoltativo</span>
        </h2>
        <!-- "Non ricordo" finché è vuota: chiuderla senza compilare dev'essere
             una risposta legittima, non una rinuncia. "Fatto" suonerebbe come
             un compito lasciato a metà. -->
        <button class="btn-link" @click="contestoRetroAperto = false">
          {{ contestoVuoto(recPassata) ? 'Non ricordo' : 'Fatto' }}
        </button>
      </div>
      <p class="muted" style="margin-top: 0.4rem">
        Se te lo ricordi, aggiungilo qui — anche a memoria. Se non te lo ricordi
        va benissimo così: serve a leggere meglio i numeri, non a completare la
        scheda.
      </p>
      <ContestoEditor :record="recPassata" @salva="(p) => salva(dnPassata, p)" />
    </div>

    <!-- SERA: recuperi (esiti mancanti recenti) + la notte segnata da notifica -->
    <EsitoCard
      v-for="r in cardEsiti"
      :key="r.dataNotte"
      :record="r.record"
      :titolo="`Com’è andata ${etichettaNotte(r.dataNotte)}?`"
      :etichetta="capitalizza(etichettaNotte(r.dataNotte))"
      :forza-editor="apriDettagli(r.dataNotte)"
      @salva="(p) => salva(r.dataNotte, p)"
    />

    <!-- SERA: contesto prospettico per la notte in arrivo -->
    <div class="card" v-if="manca.contestoProsp">
      <h2 class="titolo-card">Prepariamo stanotte</h2>
      <p class="muted" style="margin-top: 0">
        Facoltativo: liquidi e cena di stasera. Serve a far emergere i pattern.
      </p>
      <ContestoEditor
        :record="manca.contestoProsp.record"
        @salva="(p) => salva(manca.contestoProsp.dataNotte, p)"
      />
      <!-- Nota ancorata alla notte IN ARRIVO: "dorme dai nonni", "a letto tardi". -->
      <NotaCampo
        :testo="manca.contestoProsp.record?.note ?? null"
        etichetta="Nota su stanotte"
        placeholder="Qualcosa di diverso stasera…"
        @salva="(t) => salva(manca.contestoProsp.dataNotte, { note: t })"
      />
    </div>

    <p v-if="errore" class="error">{{ errore }}</p>

    <!-- Invito: nascondibile, e sempre richiamabile dal link "Invita" in alto -->
    <div class="card" v-if="invitoVisibile">
      <div class="recap">
        <h2 style="margin: 0; font-size: 1.05rem">Codice invito</h2>
        <button class="btn-link" @click="nascondiInvito">Nascondi</button>
      </div>
      <p class="muted" style="margin-top: 0.4rem">
        Condividilo con chi vuoi far accedere alle notti: l’altro genitore, i
        nonni, una babysitter. Lo ritrovi quando vuoi dal link “Invita” in alto.
      </p>
      <p class="codice">{{ bambino.bambinoAttivo.invite_code }}</p>
      <button class="btn" @click="copiaCodice">
        {{ copiato ? 'Copiato ✓' : 'Copia il codice' }}
      </button>
    </div>
  </main>
</template>
