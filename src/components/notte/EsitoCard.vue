<script setup>
import { ref, computed, watch } from 'vue'
import EsitoEditor from './EsitoEditor.vue'
import NotaCampo from './NotaCampo.vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import { ESITO, UMORE } from '@/domain/costanti'

// Card dell'esito con conferma esplicita.
// Stati: editor (scegli/correggi) → "Ho finito" → riepilogo → "Modifica".
// La card NON sparisce da sola quando salvi: così puoi aggiungere i dettagli del
// "bagnato" e correggere un tap sbagliato. La conferma è un gesto voluto.
const props = defineProps({
  record: { type: Object, default: null },
  titolo: { type: String, required: true },
  etichetta: { type: String, default: 'Questa notte' },
  // Arrivi da "Bagnato" sulla notifica: l'esito è già salvato, ma la card deve
  // restare aperta sui dettagli invece di chiudersi subito in riepilogo.
  forzaEditor: { type: Boolean, default: false },
})
const emit = defineEmits(['salva'])

// Se manca l'esito → apri l'editor; se c'è già → parti dal riepilogo.
const modifica = ref(props.forzaEditor || props.record?.esito == null)
const interagito = ref(false)

// Il record può arrivare/aggiornarsi in modo asincrono (caricamento, Realtime
// dell'altro genitore). Finché NON ho interagito io, adeguo lo stato al dato:
// esito presente → riepilogo, assente → editor. Se sto editando, non mi ribalta.
// Con `forzaEditor` non si adegua mai: l'esito arriva dalla notifica, e se
// chiudessimo i dettagli non li vedresti proprio.
watch(
  () => props.record?.esito,
  (val) => {
    if (!interagito.value && !props.forzaEditor) modifica.value = val == null
  },
)

const esitoLabel = computed(
  () => ESITO.find((o) => o.value === props.record?.esito)?.label ?? '',
)
const nota = computed(() => props.record?.note ?? null)
const umore = computed(() => props.record?.umore_bambino ?? null)

function onSalva(patch) {
  interagito.value = true
  modifica.value = true // resta aperta per dettagli/correzione
  emit('salva', patch)
}

// Nota e umore non sono "l'esito": non devono riaprire né tenere aperta la card,
// quindi passano dritti senza toccare `modifica`.
function salvaNota(testo) {
  emit('salva', { note: testo })
}
function salvaUmore(v) {
  emit('salva', { umore_bambino: v })
}
</script>

<template>
  <div class="card">
    <!-- Riepilogo compatto -->
    <template v-if="!modifica && record?.esito">
      <div class="recap">
        <p style="margin: 0">
          {{ etichetta }}: <strong>{{ esitoLabel }}</strong> 🌱
        </p>
        <button class="btn-link" @click="modifica = true">Modifica</button>
      </div>
      <!-- La nota resta leggibile e aggiungibile anche a card chiusa: è lo
           spazio per ciò che ti torna in mente più tardi. -->
      <NotaCampo
        :testo="nota"
        :etichetta="`Nota su ${etichetta.toLowerCase()}`"
        @salva="salvaNota"
      />
    </template>

    <!-- Editor -->
    <template v-else>
      <h2 style="margin-top: 0; font-size: 1.1rem">{{ titolo }}</h2>
      <EsitoEditor :record="record" @salva="onSalva" />

      <!-- Umore: solo dopo l'esito, per non appesantire i due tap del mattino.
           Dà colore alla notte senza trasformarla in una bocciatura (sez. 5). -->
      <div v-if="record?.esito" class="gruppo">
        <span class="etichetta">Com’è il suo umore?</span>
        <ChipGroup :options="UMORE" :model-value="umore" @update:model-value="salvaUmore" />
      </div>

      <NotaCampo
        :testo="nota"
        :etichetta="`Nota su ${etichetta.toLowerCase()}`"
        @salva="salvaNota"
      />

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
