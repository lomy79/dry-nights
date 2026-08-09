<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { useAuthStore } from '@/stores/auth'
import { useBambinoStore } from '@/stores/bambino'
import { useNottiStore } from '@/stores/notti'
import { useNotificheStore } from '@/stores/notifiche'
import { cosaManca, dateNottiRilevanti } from '@/domain/cosaManca'
import { leggiDeepLinkEsito } from '@/domain/promemoria'
import { nottePassata, giornoEffettivo, dataNotteIndietro } from '@/domain/dataNotte'
import { contestoVuoto } from '@/domain/contesto'
import { statoSaluteEffettivo } from '@/domain/saluteScadenza'
import { etichettaValore } from '@/domain/costanti'
import EsitoCard from '@/components/notte/EsitoCard.vue'
import ContestoEditor from '@/components/notte/ContestoEditor.vue'
import NotaCampo from '@/components/notte/NotaCampo.vue'
import SaluteReset from '@/components/notte/SaluteReset.vue'
import SaluteControllo from '@/components/notte/SaluteControllo.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const bambino = useBambinoStore()
const notti = useNottiStore()
const notifiche = useNotificheStore()

// `oggi` stabile per la sessione: momento e date-notte non cambiano sotto i piedi.
// dnPassata usa il giorno effettivo (prima delle 5 = notte precedente).
const oggi = new Date()
const dnPassata = nottePassata(giornoEffettivo(oggi))
const errore = ref('')
const copiato = ref(false)

// Tap su "Asciutto"/"Bagnato" nella notifica del mattino: il service worker non
// può scrivere sul database (non ha la sessione), quindi passa l'esito nell'URL
// e lo salviamo qui. Letto SUBITO, in modo sincrono: le card devono già sapere,
// al primo render, se restare aperte sui dettagli.
const daNotifica = leggiDeepLinkEsito(route.query, oggi)
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
    oggi,
    records: notti.perData,
    statoSalute: bambino.statoAttivo,
  }),
)

const recPassata = computed(() => notti.record(dnPassata))

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
  const giàInCima = manca.value.momento === 'mattina' && daNotifica.dataNotte === dnPassata
  if (!giàInLista && !giàInCima) {
    lista.unshift({
      dataNotte: daNotifica.dataNotte,
      record: notti.record(daNotifica.dataNotte),
    })
  }
  return lista
})
const saluteEffettiva = computed(() => statoSaluteEffettivo(bambino.statoAttivo, oggi))

function etichettaNotte(dn) {
  if (dn === dnPassata) return 'questa notte'
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
    const daData = dataNotteIndietro(oggi, payload.giorniFa ?? 0)
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

onMounted(async () => {
  try {
    await bambino.caricaStato()
    await bambino.caricaMembri()
    invitoNascosto.value = localStorage.getItem(chiaveInvito()) === '1'
    await notti.caricaDate(dateNottiRilevanti(oggi))
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

onUnmounted(() => notti.disiscrivi())
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

    <!-- Contesto di IERI NOTTE, se non compilato la sera prima (a qualsiasi ora) -->
    <div class="card" v-if="contestoRetroAperto">
      <div class="recap">
        <h2 style="margin: 0; font-size: 1.1rem">La serata di ieri</h2>
        <button class="btn-link" @click="contestoRetroAperto = false">Fatto</button>
      </div>
      <p class="muted" style="margin-top: 0.4rem">
        Ieri sera non è stato segnato cosa ha mangiato e bevuto. Se te lo ricordi,
        aggiungilo qui — anche a memoria. Aiuta a leggere i numeri.
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
      <h2 style="margin-top: 0; font-size: 1.1rem">Prepariamo stanotte</h2>
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
