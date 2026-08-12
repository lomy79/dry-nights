<script setup>
/**
 * La copertura, cioè il denominatore.
 *
 * Sta in cima e non in fondo di proposito: "80% di notti asciutte" calcolato su
 * 5 notti registrate su 30 non è un risultato, ed è la percentuale che un
 * genitore riferirebbe al pediatra in perfetta buona fede. Il numero grande e il
 * numero che lo qualifica devono stare nello stesso sguardo.
 */
import { computed } from 'vue'
import { percento, nottiConta } from '@/lib/formato'

const props = defineProps({ riepilogo: { type: Object, required: true } })

/** Sotto i due terzi di copertura il quadro è troppo bucato per essere letto. */
const SOGLIA_ATTENDIBILE = 2 / 3

const scarsa = computed(
  () => props.riepilogo.notti > 0 && props.riepilogo.copertura < SOGLIA_ATTENDIBILE,
)
</script>

<template>
  <div class="card">
    <p class="titolo-card">Notti asciutte</p>

    <p class="numerone">
      {{ percento(riepilogo.quotaAsciutte, 'non si sa ancora') }}
      <span v-if="riepilogo.note > 0" class="muted denominatore">
        {{ riepilogo.asciutte }} su {{ nottiConta(riepilogo.note) }} note
      </span>
    </p>

    <p class="muted copertura">
      Registrate {{ riepilogo.note }} notti su {{ riepilogo.notti }} ({{
        percento(riepilogo.copertura)
      }}).
      <template v-if="riepilogo.sconosciute > 0">
        {{ nottiConta(riepilogo.sconosciute) }} senza dato:
        <strong>sconosciute</strong>, non asciutte.
      </template>
    </p>

    <p v-if="scarsa" class="avviso">
      Con questa copertura la percentuale dice poco: le notti mancanti potrebbero
      essere andate in qualunque modo. Non è un rimprovero, è il motivo per cui
      arrivano i promemoria.
    </p>
  </div>
</template>

<style scoped>
.numerone {
  margin: 0;
  font-size: 2.1rem;
  font-weight: 650;
  line-height: 1.1;
  color: var(--accento);
}
/* Il qualificatore non è una nota a piè di pagina: sta attaccato al numero. */
.denominatore {
  display: block;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--tenue);
  margin-top: 0.15rem;
}
.copertura {
  font-size: 0.9rem;
  margin: 0.7rem 0 0;
}
.avviso {
  margin-top: 0.8rem;
}
</style>
