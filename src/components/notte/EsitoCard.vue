<script setup>
import { ref, computed, watch } from 'vue'
import EsitoEditor from './EsitoEditor.vue'
import { ESITO } from '@/domain/costanti'

// Card dell'esito con conferma esplicita.
// Stati: editor (scegli/correggi) → "Ho finito" → riepilogo → "Modifica".
// La card NON sparisce da sola quando salvi: così puoi aggiungere i dettagli del
// "bagnato" e correggere un tap sbagliato. La conferma è un gesto voluto.
const props = defineProps({
  record: { type: Object, default: null },
  titolo: { type: String, required: true },
  etichetta: { type: String, default: 'Questa notte' },
})
const emit = defineEmits(['salva'])

// Se manca l'esito → apri l'editor; se c'è già → parti dal riepilogo.
const modifica = ref(props.record?.esito == null)
const interagito = ref(false)

// Il record può arrivare/aggiornarsi in modo asincrono (caricamento, Realtime
// dell'altro genitore). Finché NON ho interagito io, adeguo lo stato al dato:
// esito presente → riepilogo, assente → editor. Se sto editando, non mi ribalta.
watch(
  () => props.record?.esito,
  (val) => {
    if (!interagito.value) modifica.value = val == null
  },
)

const esitoLabel = computed(
  () => ESITO.find((o) => o.value === props.record?.esito)?.label ?? '',
)

function onSalva(patch) {
  interagito.value = true
  modifica.value = true // resta aperta per dettagli/correzione
  emit('salva', patch)
}
</script>

<template>
  <div class="card">
    <!-- Riepilogo compatto -->
    <div v-if="!modifica && record?.esito" class="recap">
      <p style="margin: 0">
        {{ etichetta }}: <strong>{{ esitoLabel }}</strong> 🌱
      </p>
      <button class="btn-link" @click="modifica = true">Modifica</button>
    </div>

    <!-- Editor -->
    <template v-else>
      <h2 style="margin-top: 0; font-size: 1.1rem">{{ titolo }}</h2>
      <EsitoEditor :record="record" @salva="onSalva" />
      <button
        v-if="record?.esito"
        type="button"
        class="btn btn-primary"
        style="margin-top: 0.9rem"
        @click="modifica = false"
      >
        Ho finito
      </button>
    </template>
  </div>
</template>
