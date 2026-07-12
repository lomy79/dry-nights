<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { useAuthStore } from '@/stores/auth'
import { useBambinoStore } from '@/stores/bambino'
import { useNottiStore } from '@/stores/notti'
import { cosaManca, dateNottiRilevanti } from '@/domain/cosaManca'
import { nottePassata, giornoEffettivo } from '@/domain/dataNotte'
import { contestoVuoto } from '@/domain/contesto'
import { statoSaluteEffettivo } from '@/domain/saluteScadenza'
import EsitoCard from '@/components/notte/EsitoCard.vue'
import ContestoEditor from '@/components/notte/ContestoEditor.vue'
import SaluteReset from '@/components/notte/SaluteReset.vue'
import SaluteControllo from '@/components/notte/SaluteControllo.vue'

const router = useRouter()
const auth = useAuthStore()
const bambino = useBambinoStore()
const notti = useNottiStore()

// `oggi` stabile per la sessione: momento e date-notte non cambiano sotto i piedi.
// dnPassata usa il giorno effettivo (prima delle 5 = notte precedente).
const oggi = new Date()
const dnPassata = nottePassata(giornoEffettivo(oggi))
const errore = ref('')
const copiato = ref(false)

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

async function confermaSalute(payload) {
  errore.value = ''
  try {
    await bambino.impostaSalute(payload)
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
      <div style="display: flex; gap: 1rem; flex-shrink: 0">
        <router-link class="btn-link" :to="{ name: 'storico' }">Storico</router-link>
        <button class="btn-link" @click="mostraInvito">Invita</button>
        <button class="btn-link" @click="esci">Esci</button>
      </div>
    </header>
    <p v-if="bambino.bambinoAttivo" class="muted">
      Profilo di <strong>{{ bambino.bambinoAttivo.nome }}</strong>.
    </p>

    <!-- Priorità: reset salute scaduta -->
    <SaluteReset v-if="manca.saluteReset" @conferma="confermaSalute" />

    <!-- MATTINA: esito della notte passata (resta aperto fino a "Ho finito") -->
    <EsitoCard
      v-if="manca.momento === 'mattina'"
      :record="recPassata"
      titolo="Com’è andata questa notte?"
      etichetta="Questa notte"
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

    <!-- SERA: recuperi (esiti mancanti recenti) -->
    <EsitoCard
      v-for="r in manca.recuperi"
      :key="r.dataNotte"
      :record="r.record"
      :titolo="`Com’è andata ${etichettaNotte(r.dataNotte)}?`"
      :etichetta="capitalizza(etichettaNotte(r.dataNotte))"
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
    </div>

    <!-- Salute del giorno: sempre aggiornabile (se non è già forzato il reset) -->
    <SaluteControllo
      v-if="!manca.saluteReset"
      :effettivo="saluteEffettiva"
      @conferma="confermaSalute"
    />

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
