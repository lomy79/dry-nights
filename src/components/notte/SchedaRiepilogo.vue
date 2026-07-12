<script setup>
import { computed } from 'vue'
import { etichettaValore, etichetteValori } from '@/domain/costanti'
import { riassuntoLiquidi } from '@/domain/liquidi'

// Dettaglio in sola lettura di una scheda notte: mostra solo i campi valorizzati.
const props = defineProps({
  record: { type: Object, default: null },
})

function riga(etichetta, valore) {
  if (valore == null || valore === '' || (Array.isArray(valore) && valore.length === 0)) {
    return null
  }
  return { etichetta, valore: Array.isArray(valore) ? valore.join(', ') : valore }
}

const righe = computed(() => {
  const r = props.record
  if (!r) return []
  const out = []

  // Esito
  out.push(riga('Esito', etichettaValore('esito', r.esito)))
  out.push(riga('Quanto', etichettaValore('gravita', r.gravita)))
  if (r.episodi) out.push(riga('Episodi', String(r.episodi)))
  out.push(riga('Si è alzato', etichettaValore('minzione', r.minzione)))
  if (r.numero_risvegli) out.push(riga('Risvegli', String(r.numero_risvegli)))

  // Contesto serale
  if (r.pipi_prima_dormire != null) {
    out.push(riga('Pipì prima di dormire', r.pipi_prima_dormire ? 'Sì' : 'No'))
  }
  out.push(riga('Liquidi la sera', etichettaValore('liquidi_quantita', r.liquidi_quantita)))
  // Bevande correlate: una riga per fascia, con i tipi bevuti in quella fascia.
  for (const { orario, tipi } of riassuntoLiquidi(r.liquidi)) {
    out.push(riga(etichettaValore('liquidi_orario', orario), etichetteValori('liquidi_tipo', tipi)))
  }
  out.push(riga('Cibi sospetti', etichetteValori('cibi_sospetti', r.cibi_sospetti)))

  // Clinico
  out.push(riga('Alvo', etichettaValore('alvo', r.alvo)))
  out.push(riga('Sintomi diurni', etichetteValori('sintomi_diurni', r.sintomi_diurni)))
  out.push(riga('Interventi', etichetteValori('interventi', r.interventi)))

  // Salute
  out.push(riga('Salute', etichettaValore('salute_stato', r.salute_stato)))
  out.push(riga('Sintomi', etichetteValori('salute_sintomi', r.salute_sintomi)))

  // Note e tono
  out.push(riga('Umore', etichettaValore('umore_bambino', r.umore_bambino)))
  out.push(riga('Note', r.note))

  return out.filter(Boolean)
})
</script>

<template>
  <dl class="scheda">
    <template v-for="r in righe" :key="r.etichetta">
      <dt>{{ r.etichetta }}</dt>
      <dd>{{ r.valore }}</dd>
    </template>
    <p v-if="righe.length === 0" class="muted" style="margin: 0">
      Nessun dettaglio registrato.
    </p>
  </dl>
</template>

<style scoped>
.scheda {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.35rem 1rem;
  margin: 0;
}
dt {
  color: var(--tenue);
  font-size: 0.9rem;
}
dd {
  margin: 0;
  font-size: 0.95rem;
}
</style>
