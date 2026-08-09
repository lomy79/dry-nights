<script setup>
import { ref, computed } from 'vue'
import { LIQUIDI_TIPO, LIQUIDI_RISPOSTA } from '@/domain/costanti'
import { tipiPerOrario, riassuntoFascia } from '@/domain/liquidi'

/**
 * Una fascia oraria delle bevande.
 *
 * Può stare aperta (il caso di "a cena", l'unico momento che un genitore vede
 * quasi sempre) o richiusa in una riga con il riepilogo di cosa è stato scelto.
 * Richiusa non nasconde niente: mostra la risposta, e il trattino dice "questa
 * è ancora aperta" senza doverlo scrivere.
 *
 * I chip sono a mano e non un ChipGroup perché qui serve sapere QUALE voce è
 * stata toccata: 'Niente' e 'Non so' scacciano le bevande e viceversa, e la
 * regola vive in toggleVoce() (src/domain/liquidi.js).
 */
const props = defineProps({
  orario: { type: String, required: true },
  etichetta: { type: String, required: true },
  icona: { type: String, default: '' },
  liquidi: { type: Object, default: () => ({}) },
  sempreAperta: { type: Boolean, default: false },
})
const emit = defineEmits(['toggle'])

const apertaAMano = ref(false)
const aperta = computed(() => props.sempreAperta || apertaAMano.value)
const voci = computed(() => tipiPerOrario(props.liquidi, props.orario))
const riassunto = computed(() => riassuntoFascia(props.liquidi, props.orario))

function acceso(valore) {
  return voci.value.includes(valore)
}
</script>

<template>
  <div class="fascia">
    <button
      v-if="!sempreAperta"
      type="button"
      class="testa"
      :aria-expanded="aperta"
      @click="apertaAMano = !apertaAMano"
    >
      <span class="freccia" aria-hidden="true">{{ aperta ? '▾' : '▸' }}</span>
      <span class="nome">{{ icona }} {{ etichetta }}</span>
      <span class="riassunto" :class="{ vuoto: !riassunto }">{{ riassunto ?? '—' }}</span>
    </button>
    <span v-else class="nome nome-sola">{{ icona }} {{ etichetta }}</span>

    <div v-if="aperta" class="corpo">
      <div class="chips">
        <button
          v-for="o in LIQUIDI_TIPO"
          :key="o.value"
          type="button"
          class="chip"
          :class="{ 'chip-on': acceso(o.value) }"
          @click="emit('toggle', o.value)"
        >
          {{ o.label }}
        </button>
      </div>
      <!-- Staccate dalle bevande: stessa domanda, natura diversa. -->
      <div class="chips risposte">
        <button
          v-for="o in LIQUIDI_RISPOSTA"
          :key="o.value"
          type="button"
          class="chip chip-risposta"
          :class="{ 'chip-on': acceso(o.value) }"
          @click="emit('toggle', o.value)"
        >
          {{ o.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fascia {
  margin: 0.5rem 0;
}

.testa {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  width: 100%;
  padding: 0.55rem 0;
  border: none;
  background: none;
  text-align: left;
  color: var(--testo);
}

.freccia {
  color: var(--tenue);
  font-size: 0.8rem;
  flex-shrink: 0;
}

/* Più piccolo del titolo di sezione: sta sotto di lui, e si deve vedere. */
.nome {
  font-size: 0.85rem;
  font-weight: 600;
}

.nome-sola {
  display: block;
  margin-bottom: 0.4rem;
}

/* La risposta è allineata a destra: si legge la colonna, non le singole righe. */
.riassunto {
  margin-left: auto;
  font-size: 0.85rem;
  color: var(--tenue);
  text-align: right;
}

.riassunto.vuoto {
  color: var(--bordo);
}

.corpo {
  margin: 0.15rem 0 0.7rem;
}

.risposte {
  margin-top: 0.4rem;
}

/* Più tenui delle bevande: sono un ripiego, non la risposta che speriamo. */
.chip-risposta {
  font-size: 0.85rem;
  padding: 0.45rem 0.75rem;
  color: var(--tenue);
  border-style: dashed;
}

.chip-risposta.chip-on {
  color: var(--accento);
  border-style: solid;
}
</style>
