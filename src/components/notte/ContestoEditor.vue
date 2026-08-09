<script setup>
import { computed } from 'vue'
import ChipGroup from '@/components/ui/ChipGroup.vue'
import FasciaLiquidi from './FasciaLiquidi.vue'
import { LIQUIDI_QUANTITA, CIBI_SOSPETTI } from '@/domain/costanti'
import { toggleVoce } from '@/domain/liquidi'

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

/**
 * Le fasce, ordinate per quanto un genitore le sa davvero — non solo per quanto
 * pesano in clinica. "A cena" è l'unico momento in cui c'è quasi sempre, quindi
 * sta in alto e aperta; le altre si aprono al bisogno. Alle 17 il bambino era a
 * scuola o dai nonni: pretendere quel dato in primo piano lo farebbe inventare.
 */
const FASCE_CHIUSE = [
  { value: 'prima_di_cena', label: 'Prima di cena', icona: '' },
  { value: 'dopo_cena', label: 'Dopo cena', icona: '' },
  // Il modello dati la indica come il caso più a rischio: l'icona è lì per
  // ricordarlo anche quando la riga è richiusa.
  { value: 'prima_di_dormire', label: 'Subito prima di dormire', icona: '🌙' },
]

function salvaCampo(campo, valore) {
  emit('salva', { [campo]: valore })
}
function toggleFascia(orario, voce) {
  // Aggiorna solo quella fascia, mantenendo le altre.
  emit('salva', { liquidi: toggleVoce(liquidi.value, orario, voce) })
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

    <div class="gruppo gruppo-bevande">
      <span class="etichetta etichetta-sezione">Cosa ha bevuto, e quando?</span>

      <div class="blocco">
        <FasciaLiquidi
          orario="a_cena"
          etichetta="A cena"
          :liquidi="liquidi"
          sempre-aperta
          @toggle="(v) => toggleFascia('a_cena', v)"
        />

        <div class="altre-fasce">
          <FasciaLiquidi
            v-for="f in FASCE_CHIUSE"
            :key="f.value"
            :orario="f.value"
            :etichetta="f.label"
            :icona="f.icona"
            :liquidi="liquidi"
            @toggle="(v) => toggleFascia(f.value, v)"
          />
        </div>
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
/* Più aria sopra: è una sezione composta, non l'ennesima domanda della lista. */
.gruppo-bevande {
  margin-top: 1.4rem;
}

/* Le fasce richiuse stanno insieme, staccate da "a cena": si legge una lista di
   righe, non quattro blocchi che si contendono l'attenzione. */
.altre-fasce {
  margin-top: 0.5rem;
  border-top: 1px solid var(--bordo);
}

.altre-fasce > :deep(.fascia + .fascia) {
  border-top: 1px solid var(--bordo);
}
</style>
