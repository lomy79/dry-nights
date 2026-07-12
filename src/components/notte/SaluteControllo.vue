<script setup>
import { ref, computed } from 'vue'
import SaluteSelettore from './SaluteSelettore.vue'
import { etichetteValori } from '@/domain/costanti'

// Controllo salute sempre accessibile: mostra lo stato corrente e permette di
// aggiornarlo un giorno qualsiasi ("oggi ha la febbre"). Persistente e con
// scadenza sono gestiti a monte (Decisione 7); qui è solo l'ingresso quotidiano.
const props = defineProps({
  // Stato EFFETTIVO calcolato a monte: { stato, sintomi }.
  effettivo: { type: Object, required: true },
})
const emit = defineEmits(['conferma'])

const aperto = ref(false)

const testo = computed(() => {
  const e = props.effettivo
  if (e.stato === 'malato') {
    const s = etichetteValori('salute_sintomi', e.sintomi)
    return s.length ? `🤒 ${s.join(', ')}` : '🤒 Non in forma'
  }
  if (e.stato === 'sconosciuto') return '❔ Non impostata'
  return '🙂 Sano'
})

function conferma(payload) {
  aperto.value = false
  emit('conferma', payload)
}
</script>

<template>
  <div class="card">
    <div class="recap">
      <p style="margin: 0">Salute oggi: <strong>{{ testo }}</strong></p>
      <button class="btn-link" @click="aperto = !aperto">
        {{ aperto ? 'Chiudi' : 'Aggiorna' }}
      </button>
    </div>
    <div v-if="aperto" style="margin-top: 0.7rem">
      <SaluteSelettore :sintomi-iniziali="effettivo.sintomi" @conferma="conferma" />
    </div>
  </div>
</template>
