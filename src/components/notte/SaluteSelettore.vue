<script setup>
import { ref } from 'vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import { SALUTE_SINTOMI } from '@/domain/costanti'

// Selettore condiviso dello stato di salute: sano / non in forma + sintomi.
// Emette 'conferma' con { stato, sintomi }. Nessuna conferma passiva: per dire
// "malato" bisogna scegliere almeno un sintomo (Decisione 7).
const props = defineProps({
  sintomiIniziali: { type: Array, default: () => [] },
})
const emit = defineEmits(['conferma'])

const modalita = ref(null) // null | 'malato'
const sintomi = ref([...props.sintomiIniziali])

function sano() {
  emit('conferma', { stato: 'sano', sintomi: [] })
}
function malato() {
  emit('conferma', { stato: 'malato', sintomi: sintomi.value })
}
</script>

<template>
  <div>
    <div class="duetto" v-if="modalita === null">
      <button type="button" class="scelta-grande" @click="sano">🙂 Sano</button>
      <button type="button" class="scelta-grande" @click="modalita = 'malato'">
        🤒 Non in forma
      </button>
    </div>

    <template v-else>
      <div class="gruppo">
        <span class="etichetta">Cosa ha?</span>
        <ChipGroup :options="SALUTE_SINTOMI" v-model="sintomi" multi />
      </div>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="sintomi.length === 0"
        @click="malato"
      >
        Conferma
      </button>
      <button type="button" class="btn-link" @click="modalita = null">Indietro</button>
    </template>
  </div>
</template>
