<script setup>
import { ref, watch } from 'vue'

// Nota libera (sez. 5): lo spazio per l'imprevisto che nessun chip prevede —
// "dormito dai nonni", "febbre salita nella notte", "gita, a letto tardi".
// È l'eccezione voluta al principio "dati strutturati": non sostituisce i chip,
// raccoglie ciò che non era prevedibile.
//
// Progressive disclosure: finché è vuota resta un link, non un campo aperto che
// occupa spazio e chiede di essere riempito.
//
// Si salva all'uscita dal campo (blur), non a ogni tasto: una nota si scrive
// tutta d'un fiato, e un upsert per lettera sarebbe solo rumore.
const props = defineProps({
  testo: { type: String, default: null },
  etichetta: { type: String, default: 'Nota' },
  placeholder: { type: String, default: 'Qualcosa fuori dal solito…' },
})
const emit = defineEmits(['salva'])

const bozza = ref(props.testo ?? '')
const aperto = ref(!!props.testo)
const inFocus = ref(false)
const salvato = ref(false)

// Il record può cambiare sotto (caricamento iniziale, Realtime dell'altro
// genitore). Mi adeguo solo se NON sto scrivendo io, o cancellerei le sue parole.
watch(
  () => props.testo,
  (v) => {
    if (inFocus.value) return
    bozza.value = v ?? ''
    if (v) aperto.value = true
  },
)

function apri() {
  aperto.value = true
}

function onBlur() {
  inFocus.value = false
  const nuovo = bozza.value.trim()
  const vecchio = (props.testo ?? '').trim()
  if (nuovo === vecchio) return
  // Svuotare il campo cancella la nota: null (= "nessuna nota"), non stringa
  // vuota, così resta distinguibile da "non ancora scritta".
  emit('salva', nuovo === '' ? null : nuovo)
  salvato.value = true
  setTimeout(() => (salvato.value = false), 1600)
}
</script>

<template>
  <div class="nota">
    <button v-if="!aperto" type="button" class="btn-link" @click="apri">
      ✍️ {{ etichetta }}
    </button>

    <div v-else class="gruppo">
      <span class="etichetta">
        {{ etichetta }}
        <em v-if="salvato" class="salvato">salvata</em>
      </span>
      <textarea
        v-model="bozza"
        :placeholder="placeholder"
        rows="2"
        @focus="inFocus = true"
        @blur="onBlur"
      ></textarea>
    </div>
  </div>
</template>

<style scoped>
.nota {
  margin-top: 0.6rem;
}
.salvato {
  color: var(--accento);
  font-style: normal;
  font-size: 0.82rem;
  margin-left: 0.4rem;
}
</style>
