<script setup>
import SaluteSelettore from './SaluteSelettore.vue'

// Reset del flag salute alla scadenza (Decisione 7). Si riparte SEMPRE da una
// scelta attiva: o "è tornato sano", o si riseleziona il sintomo se persiste.
const emit = defineEmits(['conferma'])
</script>

<template>
  <div class="card avviso">
    <p style="margin-top: 0">
      Ci siamo persi come sta il bambino in questi giorni. Prima di continuare,
      diamo un aggiornamento — così i dati restano veri.
    </p>
    <SaluteSelettore @conferma="(p) => emit('conferma', p)" />
  </div>
</template>
