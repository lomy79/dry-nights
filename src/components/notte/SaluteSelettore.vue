<script setup>
import { ref } from 'vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import { SALUTE_SINTOMI } from '@/domain/costanti'

// Selettore salute a SINTOMI DIRETTI (sez. 4): nessun sintomo = sano.
// Se si torna a "sta bene" dopo una malattia, chiede "da quando" (Decisione 7,
// coda retroattiva) così le notti nel mezzo si correggono.
const props = defineProps({
  sintomiIniziali: { type: Array, default: () => [] },
  eraMalato: { type: Boolean, default: false },
})
const emit = defineEmits(['conferma'])

const sintomi = ref([...props.sintomiIniziali])
const fase = ref('scelta') // 'scelta' | 'daQuando'

const GIORNI = [
  { value: 0, label: 'Oggi' },
  { value: 1, label: 'Ieri' },
  { value: 2, label: '2 giorni fa' },
  { value: 3, label: '3 giorni fa' },
]

function staBene() {
  // Se era malato, chiedi da quando (per correggere le notti nel mezzo).
  if (props.eraMalato) fase.value = 'daQuando'
  else emit('conferma', { stato: 'sano', sintomi: [], giorniFa: 0 })
}
function salvaMalato() {
  emit('conferma', { stato: 'malato', sintomi: sintomi.value, giorniFa: 0 })
}
function tornatoSanoDa(giorniFa) {
  emit('conferma', { stato: 'sano', sintomi: [], giorniFa })
}
</script>

<template>
  <div>
    <template v-if="fase === 'scelta'">
      <button type="button" class="btn" style="margin-bottom: 0.9rem" @click="staBene">
        🙂 Sta bene
      </button>

      <div class="gruppo">
        <span class="etichetta">Oppure indica i sintomi</span>
        <ChipGroup :options="SALUTE_SINTOMI" v-model="sintomi" multi />
      </div>

      <button
        type="button"
        class="btn btn-primary"
        :disabled="sintomi.length === 0"
        @click="salvaMalato"
      >
        Salva i sintomi
      </button>
    </template>

    <template v-else>
      <div class="gruppo">
        <span class="etichetta">Da quando sta bene?</span>
        <div class="chips">
          <button
            v-for="g in GIORNI"
            :key="g.value"
            type="button"
            class="chip"
            @click="tornatoSanoDa(g.value)"
          >
            {{ g.label }}
          </button>
        </div>
      </div>
      <button type="button" class="btn-link" @click="fase = 'scelta'">Indietro</button>
    </template>
  </div>
</template>
