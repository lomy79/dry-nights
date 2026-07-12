<script setup>
import { computed } from 'vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import { GRAVITA, MINZIONE } from '@/domain/costanti'

// Editor dell'esito, guidato dal record esistente (nessuno stato locale: ogni
// tap emette un patch, il record aggiornato ritorna dai props → niente drift,
// e il Realtime dell'altro genitore si riflette subito).
const props = defineProps({
  record: { type: Object, default: null },
})
const emit = defineEmits(['salva'])

const esito = computed(() => props.record?.esito ?? null)
const gravita = computed(() => props.record?.gravita ?? null)
const episodi = computed(() => props.record?.episodi ?? null)
const minzione = computed(() => props.record?.minzione ?? null)

function scegliEsito(v) {
  // Un tap conta subito. 'asciutto' azzera i campi del bagnato (coerenza col DB).
  emit('salva', { esito: v })
}
function setGravita(v) {
  emit('salva', { gravita: v })
}
function setEpisodi(n) {
  emit('salva', { episodi: Math.max(1, n) })
}
function setMinzione(v) {
  emit('salva', { minzione: v })
}
</script>

<template>
  <div>
    <div class="duetto">
      <button
        type="button"
        class="scelta-grande"
        :class="{ on: esito === 'asciutto' }"
        @click="scegliEsito('asciutto')"
      >
        😴 Asciutto
      </button>
      <button
        type="button"
        class="scelta-grande"
        :class="{ on: esito === 'bagnato' }"
        @click="scegliEsito('bagnato')"
      >
        💧 Bagnato
      </button>
    </div>

    <!-- Dettagli solo se bagnato: progressive disclosure -->
    <template v-if="esito === 'bagnato'">
      <div class="gruppo">
        <span class="etichetta">Quanto?</span>
        <ChipGroup :options="GRAVITA" :model-value="gravita" @update:model-value="setGravita" />
      </div>

      <div class="gruppo">
        <span class="etichetta">Quante volte?</span>
        <div class="stepper">
          <button type="button" @click="setEpisodi((episodi ?? 1) - 1)" aria-label="meno">−</button>
          <strong>{{ episodi ?? 1 }}</strong>
          <button type="button" @click="setEpisodi((episodi ?? 1) + 1)" aria-label="più">+</button>
        </div>
      </div>

      <div class="gruppo">
        <span class="etichetta">Si è alzato?</span>
        <ChipGroup :options="MINZIONE" :model-value="minzione" @update:model-value="setMinzione" />
      </div>
    </template>
  </div>
</template>
