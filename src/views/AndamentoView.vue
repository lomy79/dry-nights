<script setup>
/**
 * Andamento — il primo sbocco dei dati raccolti.
 *
 * Tono: nessuna striscia di giorni da non interrompere, nessun record da
 * battere, nessun rosso. Una notte bagnata è un dato. Il numero che si vede per
 * primo è accompagnato dalla copertura, perché una percentuale senza il suo
 * denominatore è la bugia più facile da raccontarsi.
 */
import { ref, computed, watch, onMounted } from 'vue'
import { parseISO, format } from 'date-fns'
import { it } from 'date-fns/locale'
import { useNottiStore } from '@/stores/notti'
import { useBambinoStore } from '@/stores/bambino'
import { giornoEffettivo, dataNotteIndietro } from '@/domain/dataNotte'
import { riepilogo, perSettimana, inizioDiario, restringiPeriodo } from '@/domain/statistiche'
import { valutaFattori, fattorePiuVicino } from '@/domain/correlazioni'
import { etichettaValore } from '@/domain/costanti'
import { nottiConta } from '@/lib/formato'
import BarreSettimane from '@/components/report/BarreSettimane.vue'
import BloccoCopertura from '@/components/report/BloccoCopertura.vue'
import BloccoCorrelazione from '@/components/report/BloccoCorrelazione.vue'

const notti = useNottiStore()
const bambino = useBambinoStore()

const PERIODI = [
  { chiave: '30', etichetta: '30 giorni', giorni: 30 },
  { chiave: '90', etichetta: '90 giorni', giorni: 90 },
  { chiave: 'tutto', etichetta: 'Dall’inizio', giorni: null },
]

const scelta = ref('30')
const caricamento = ref(true)
const errore = ref('')

const oggi = giornoEffettivo(new Date())

/** Il giorno da cui esiste il diario: prima non ci sono notti da sapere. */
const inizio = computed(() =>
  inizioDiario(notti.perData, bambino.bambinoAttivo?.created_at ?? null),
)

/** Il periodo richiesto dai chip, prima di sapere quando comincia il diario. */
const richiesto = computed(() => {
  const p = PERIODI.find((x) => x.chiave === scelta.value)
  const giorni = p.giorni ?? 3650
  return { da: dataNotteIndietro(oggi, giorni - 1), a: oggi }
})

/**
 * Il periodo davvero misurato. Senza il taglio, "ultimi 90 giorni" su un diario
 * di venti dichiarerebbe 70 notti sconosciute e una copertura del 19%: non un
 * dato mancante, ma tempo in cui l'app non esisteva.
 */
const periodo = computed(() => restringiPeriodo(richiesto.value, inizio.value))

const riep = computed(() => riepilogo(notti.perData, periodo.value))
const settimane = computed(() => perSettimana(notti.perData, periodo.value))
const fattori = computed(() => valutaFattori(notti.perData, periodo.value))
const inRaccolta = computed(() => fattori.value.filter((f) => f.stato === 'raccolta').length)
const vicino = computed(() => fattorePiuVicino(fattori.value))

/** Una distribuzione { valore: n } in righe ordinate, con le etichette di dominio. */
function righe(campo, mappa) {
  return Object.entries(mappa)
    .sort((a, b) => b[1] - a[1])
    .map(([valore, n]) => ({ valore, n, etichetta: etichettaValore(campo, valore) }))
}

const etichettaPeriodo = computed(() => {
  const f = (d) => format(parseISO(d), 'd MMM', { locale: it })
  return `${f(periodo.value.da)} – ${f(periodo.value.a)}`
})

async function carica() {
  caricamento.value = true
  errore.value = ''
  try {
    // Si carica il periodo RICHIESTO, non quello ristretto: il taglio si calcola
    // sui record, e per conoscerli bisogna prima averli chiesti.
    await notti.caricaIntervallo(richiesto.value.da, richiesto.value.a)
  } catch (e) {
    errore.value = e?.message ?? 'Non è stato possibile caricare le notti.'
  } finally {
    caricamento.value = false
  }
}

onMounted(carica)
watch(scelta, carica)
</script>

<template>
  <main>
    <header class="testa">
      <h1>Andamento</h1>
      <router-link class="btn-link" :to="{ name: 'oggi' }">Oggi</router-link>
    </header>

    <div class="chips periodo">
      <button
        v-for="p in PERIODI"
        :key="p.chiave"
        type="button"
        class="chip"
        :class="{ 'chip-on': scelta === p.chiave }"
        @click="scelta = p.chiave"
      >
        {{ p.etichetta }}
      </button>
    </div>
    <p class="muted intervallo">
      {{ etichettaPeriodo }}
      <template v-if="periodo.ristretto">
        — il diario comincia qui, prima non c’erano notti da sapere.
      </template>
    </p>

    <p v-if="caricamento" class="muted">Carico…</p>
    <p v-if="errore" class="error">{{ errore }}</p>

    <template v-if="!caricamento">
      <BloccoCopertura :riepilogo="riep" />

      <template v-if="riep.note > 0">
        <section class="card">
          <h2 class="titolo-card">Settimana per settimana</h2>
          <BarreSettimane :settimane="settimane" />
        </section>

        <section class="card">
          <h2 class="titolo-card">Quando bagna</h2>
          <p v-if="riep.bagnate === 0" class="muted">
            Nessuna notte bagnata nel periodo.
          </p>
          <template v-else>
            <div class="gruppo" v-if="righe('gravita', riep.gravita).length">
              <span class="etichetta">Quanto</span>
              <ul class="conteggi">
                <li v-for="r in righe('gravita', riep.gravita)" :key="r.valore">
                  <span>{{ r.etichetta }}</span><b>{{ r.n }}</b>
                </li>
              </ul>
            </div>
            <p v-if="riep.episodi.notti > 0" class="muted nota">
              Episodi per notte: {{ riep.episodi.media.toFixed(1) }} in media, massimo
              {{ riep.episodi.massimo }} (su {{ nottiConta(riep.episodi.notti) }} in cui è
              stato registrato).
            </p>
          </template>
        </section>

        <section class="card" v-if="righe('minzione', riep.minzione).length">
          <h2 class="titolo-card">Si è alzato</h2>
          <!-- "Da solo" è il progresso vero: percepire lo stimolo nel sonno.
               "Accompagnato" misura la sveglia del genitore, non il bambino. -->
          <ul class="conteggi">
            <li v-for="r in righe('minzione', riep.minzione)" :key="r.valore">
              <span>{{ r.etichetta }}</span><b>{{ r.n }}</b>
            </li>
          </ul>
        </section>

        <section
          class="card"
          v-if="
            righe('alvo', riep.alvo).length ||
            righe('sintomi_diurni', riep.sintomiDiurni).length ||
            righe('interventi', riep.interventi).length
          "
        >
          <h2 class="titolo-card">La giornata</h2>
          <p class="muted nota">Sono le domande che il pediatra farà per prime.</p>
          <div class="gruppo" v-if="righe('alvo', riep.alvo).length">
            <span class="etichetta">Alvo</span>
            <ul class="conteggi">
              <li v-for="r in righe('alvo', riep.alvo)" :key="r.valore">
                <span>{{ r.etichetta }}</span><b>{{ r.n }}</b>
              </li>
            </ul>
          </div>
          <div class="gruppo" v-if="righe('sintomi_diurni', riep.sintomiDiurni).length">
            <span class="etichetta">Sintomi diurni</span>
            <ul class="conteggi">
              <li v-for="r in righe('sintomi_diurni', riep.sintomiDiurni)" :key="r.valore">
                <span>{{ r.etichetta }}</span><b>{{ r.n }}</b>
              </li>
            </ul>
          </div>
          <div class="gruppo" v-if="righe('interventi', riep.interventi).length">
            <span class="etichetta">Interventi</span>
            <ul class="conteggi">
              <li v-for="r in righe('interventi', riep.interventi)" :key="r.valore">
                <span>{{ r.etichetta }}</span><b>{{ r.n }}</b>
              </li>
            </ul>
          </div>
        </section>
      </template>

      <section class="card">
        <h2 class="titolo-card">Cosa emerge</h2>
        <p class="muted nota">
          Confronti fra le notti in cui una cosa è successa e quelle in cui non è
          successa. Restano nascosti finché i due gruppi non hanno abbastanza notti:
          su pochi dati qualunque differenza è compatibile col caso, e una barra
          disegnata su otto notti sembra una risposta senza esserlo.
        </p>
        <!-- Con zero notti utili tutti i fattori sono a pari merito e "il più
             vicino" non indicherebbe niente: la riga compare quando c'è una gara. -->
        <p v-if="vicino && vicino.usate > 0" class="muted nota">
          Il più vicino è <strong>{{ vicino.etichetta.toLowerCase() }}</strong
          >: mancano {{ nottiConta(vicino.mancanti) }}.
          <template v-if="inRaccolta > 1">
            Gli altri {{ inRaccolta - 1 }} sono più indietro.
          </template>
        </p>

        <BloccoCorrelazione v-for="f in fattori" :key="f.chiave" :valutazione="f" />
      </section>
    </template>
  </main>
</template>

<style scoped>
.testa {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.periodo {
  margin-top: 0.3rem;
}
.intervallo {
  font-size: 0.85rem;
  margin: 0.45rem 0 0;
}
.conteggi {
  list-style: none;
  margin: 0;
  padding: 0;
}
.conteggi li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--bordo);
  font-size: 0.95rem;
}
.conteggi li:last-child {
  border-bottom: none;
}
.nota {
  font-size: 0.86rem;
  line-height: 1.45;
  margin: 0 0 0.7rem;
}
h2.titolo-card {
  font-size: 1.15rem;
}
</style>
