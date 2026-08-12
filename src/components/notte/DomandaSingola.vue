<script setup>
/**
 * Una domanda sola, con la sua risposta a portata di pollice.
 *
 * Volutamente non è un modulo: niente titolo di sezione, niente "salva", niente
 * secondo campo che compare dopo il primo. Si risponde con un tap e sparisce —
 * o si rimanda, che è una risposta anche quella e non deve costare più di un
 * tap dell'altra. Il "perché" sta sotto in piccolo: chiedere la pancia a un
 * genitore che non sa cosa c'entri con la pipì a letto è il modo migliore per
 * farsi rispondere a caso.
 */
import ChipGroup from '@/components/ui/ChipGroup.vue'

const props = defineProps({
  domanda: { type: Object, required: true },
})
const emit = defineEmits(['rispondi', 'rinvia'])

function scelto(valore) {
  // Il multi emette a ogni tocco: il campo si aggiorna per intero ogni volta,
  // così "urgenza + incidenti" non richiede un pulsante di conferma.
  emit('rispondi', { campo: props.domanda.campo, valore })
}
</script>

<template>
  <div class="card domanda">
    <div class="recap">
      <p class="testo">{{ domanda.testo }}</p>
      <button type="button" class="btn-link" @click="emit('rinvia', domanda.chiave)">
        Non ora
      </button>
    </div>

    <ChipGroup
      :options="domanda.opzioni"
      :model-value="domanda.valore"
      :multi="domanda.tipo === 'multi'"
      @update:model-value="scelto"
    />

    <p v-if="domanda.nota" class="muted perche">{{ domanda.nota }}</p>
  </div>
</template>

<style scoped>
/* Bordo pieno e fondo bianco come le card che contano: è una domanda sola, non
   un di più. Ma niente titolo in grande — non è una sezione, è una frase. */
.domanda {
  border-left: 3px solid var(--accento-chiaro);
}
.testo {
  margin: 0 0 0.7rem;
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.3;
}
.recap {
  align-items: flex-start;
}
.perche {
  margin: 0.75rem 0 0;
  font-size: 0.83rem;
  line-height: 1.45;
}
</style>
