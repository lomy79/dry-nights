<script setup>
import { ref, computed, onMounted } from 'vue'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { useNottiStore } from '@/stores/notti'
import { dataNotteIndietro, giornoEffettivo } from '@/domain/dataNotte'
import SchedaRiepilogo from '@/components/notte/SchedaRiepilogo.vue'
import EsitoEditor from '@/components/notte/EsitoEditor.vue'
import ContestoEditor from '@/components/notte/ContestoEditor.vue'

// Storico: ultime notti come calendario continuo. I giorni senza dato sono
// "sconosciuto" (Decisione 2), non "asciutto": non falsiamo il quadro.
const GIORNI = 30
const notti = useNottiStore()
const oggi = new Date()
const caricamento = ref(true)
const errore = ref('')
const espansa = ref(null) // data_notte aperta
const modifica = ref(false) // riquadro aperto in modifica?

async function salva(dataNotte, patch) {
  errore.value = ''
  try {
    await notti.salvaPatch(dataNotte, patch)
  } catch (e) {
    errore.value = e?.message ?? 'Non è stato possibile salvare.'
  }
}

const righe = computed(() => {
  // Parte dal giorno effettivo: prima delle 5 la notte in corso non è ancora finita.
  const giorno = giornoEffettivo(oggi)
  return Array.from({ length: GIORNI }, (_, i) => {
    const dn = dataNotteIndietro(giorno, i)
    return { dataNotte: dn, record: notti.record(dn) }
  })
})

function statoEsito(record) {
  if (!record || record.esito == null) return { testo: 'sconosciuto', tono: 'ignoto' }
  if (record.esito === 'asciutto') return { testo: 'asciutto', tono: 'asciutto' }
  return { testo: 'bagnato', tono: 'bagnato' }
}

function etichettaData(dn) {
  const d = parseISO(dn)
  const testo = format(d, 'EEEE d MMMM', { locale: it })
  return testo.charAt(0).toUpperCase() + testo.slice(1)
}

function apri(dn, haRecord) {
  if (!haRecord) return
  espansa.value = espansa.value === dn ? null : dn
  modifica.value = false // si apre sempre in lettura
}

onMounted(async () => {
  try {
    await notti.caricaRecenti(90)
  } catch (e) {
    errore.value = e?.message ?? 'Errore nel caricamento dello storico.'
  } finally {
    caricamento.value = false
  }
})
</script>

<template>
  <main>
    <header style="display: flex; align-items: baseline; justify-content: space-between">
      <h1>Storico</h1>
      <router-link class="btn-link" :to="{ name: 'oggi' }">Oggi</router-link>
    </header>

    <p v-if="caricamento" class="muted">Carico…</p>
    <p v-if="errore" class="error">{{ errore }}</p>

    <ul class="storico" v-if="!caricamento">
      <li v-for="r in righe" :key="r.dataNotte">
        <button
          type="button"
          class="riga"
          :class="{ cliccabile: !!r.record }"
          @click="apri(r.dataNotte, !!r.record)"
        >
          <span class="data">{{ etichettaData(r.dataNotte) }}</span>
          <span class="badge" :class="`b-${statoEsito(r.record).tono}`">
            {{ statoEsito(r.record).testo }}
          </span>
        </button>
        <div v-if="espansa === r.dataNotte" class="dettaglio">
          <template v-if="modifica">
            <h3>Esito</h3>
            <EsitoEditor :record="r.record" @salva="(p) => salva(r.dataNotte, p)" />
            <h3>Contesto della serata prima</h3>
            <ContestoEditor :record="r.record" @salva="(p) => salva(r.dataNotte, p)" />
            <button type="button" class="btn" style="margin-top: 1rem" @click="modifica = false">
              Fatto
            </button>
          </template>
          <template v-else>
            <SchedaRiepilogo :record="r.record" />
            <button type="button" class="btn-link" @click="modifica = true">Modifica</button>
          </template>
        </div>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.storico {
  list-style: none;
  margin: 0;
  padding: 0;
}
.riga {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.8rem 0.2rem;
  background: none;
  border: none;
  border-bottom: 1px solid var(--bordo);
  text-align: left;
  color: var(--testo);
}
.riga.cliccabile {
  cursor: pointer;
}
.data {
  font-size: 0.98rem;
}
.badge {
  font-size: 0.82rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  white-space: nowrap;
}
.b-asciutto {
  background: var(--accento-chiaro);
  color: var(--accento);
}
.b-bagnato {
  background: #e7eef4;
  color: #3a5a78;
}
.b-ignoto {
  background: var(--sfondo);
  color: var(--tenue);
  border: 1px dashed var(--bordo);
}
.dettaglio {
  padding: 0.6rem 0.2rem 1rem;
  border-bottom: 1px solid var(--bordo);
}
.dettaglio h3 {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--tenue);
  margin: 1rem 0 0.5rem;
}
</style>
