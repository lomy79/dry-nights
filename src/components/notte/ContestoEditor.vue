<script setup>
import { computed } from 'vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import {
  LIQUIDI_QUANTITA,
  LIQUIDI_TIPO,
  LIQUIDI_ORARIO,
  CIBI_SOSPETTI,
} from '@/domain/costanti'
import { tipiPerOrario, impostaOrario } from '@/domain/liquidi'

// Contesto serale (sez. 3). Ogni modifica emette un patch parziale.
// Le bevande sono correlate alla fascia: per ogni fascia scegli cosa ha bevuto,
// così "the prima di cena / acqua a cena / latte dopo cena" resta distinto.
const props = defineProps({
  record: { type: Object, default: null },
})
const emit = defineEmits(['salva'])

const PIPI = [
  { value: true, label: 'Sì' },
  { value: false, label: 'No' },
]

const pipi = computed(() => props.record?.pipi_prima_dormire ?? null)
const quantita = computed(() => props.record?.liquidi_quantita ?? null)
const cibi = computed(() => props.record?.cibi_sospetti ?? [])
const liquidi = computed(() => props.record?.liquidi ?? {})

function salvaCampo(campo, valore) {
  emit('salva', { [campo]: valore })
}
function salvaFascia(orario, tipi) {
  // Aggiorna solo quella fascia, mantenendo le altre.
  emit('salva', { liquidi: impostaOrario(liquidi.value, orario, tipi) })
}
</script>

<template>
  <div>
    <div class="gruppo">
      <span class="etichetta">Ha fatto pipì prima di dormire?</span>
      <ChipGroup
        :options="PIPI"
        :model-value="pipi"
        @update:model-value="(v) => salvaCampo('pipi_prima_dormire', v)"
      />
    </div>

    <div class="gruppo">
      <span class="etichetta">Quanti liquidi in tutto la sera?</span>
      <ChipGroup
        :options="LIQUIDI_QUANTITA"
        :model-value="quantita"
        @update:model-value="(v) => salvaCampo('liquidi_quantita', v)"
      />
    </div>

    <div class="gruppo">
      <span class="etichetta">Cosa ha bevuto, e quando?</span>
      <div v-for="fascia in LIQUIDI_ORARIO" :key="fascia.value" class="fascia">
        <span class="fascia-nome">{{ fascia.label }}</span>
        <ChipGroup
          :options="LIQUIDI_TIPO"
          :model-value="tipiPerOrario(liquidi, fascia.value)"
          multi
          @update:model-value="(v) => salvaFascia(fascia.value, v)"
        />
      </div>
    </div>

    <div class="gruppo">
      <span class="etichetta">Cibi sospetti a cena?</span>
      <ChipGroup
        :options="CIBI_SOSPETTI"
        :model-value="cibi"
        multi
        @update:model-value="(v) => salvaCampo('cibi_sospetti', v)"
      />
    </div>
  </div>
</template>

<style scoped>
.fascia {
  margin: 0.6rem 0;
}
.fascia-nome {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--testo);
  margin-bottom: 0.3rem;
}
</style>
