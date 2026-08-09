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

/**
 * Le righe raggruppate come sono raggruppate nella testa di chi legge: prima
 * com'è andata, poi la serata che l'ha preceduta, poi la giornata. Una lista
 * unica e piatta mescolava l'esito — il dato — col contesto facoltativo, e a
 * colpo d'occhio sembravano la stessa cosa.
 * Le sezioni senza nemmeno una riga valorizzata spariscono: il riepilogo mostra
 * ciò che c'è, non l'elenco di ciò che manca.
 */
const sezioni = computed(() => {
  const r = props.record
  if (!r) return []

  const liquidiPerFascia = riassuntoLiquidi(r.liquidi).map(({ orario, tipi }) =>
    riga(etichettaValore('liquidi_orario', orario), etichetteValori('liquidi_tipo', tipi)),
  )

  const gruppi = [
    {
      titolo: 'La notte',
      righe: [
        riga('Esito', etichettaValore('esito', r.esito)),
        riga('Quanto', etichettaValore('gravita', r.gravita)),
        r.episodi ? riga('Episodi', String(r.episodi)) : null,
        riga('Si è alzato', etichettaValore('minzione', r.minzione)),
        r.numero_risvegli ? riga('Risvegli', String(r.numero_risvegli)) : null,
        riga('Umore', etichettaValore('umore_bambino', r.umore_bambino)),
      ],
    },
    {
      titolo: 'La serata prima',
      righe: [
        r.pipi_prima_dormire != null
          ? riga('Pipì prima di dormire', r.pipi_prima_dormire ? 'Sì' : 'No')
          : null,
        riga('Liquidi in tutto', etichettaValore('liquidi_quantita', r.liquidi_quantita)),
        ...liquidiPerFascia,
        riga('Cibi sospetti', etichetteValori('cibi_sospetti', r.cibi_sospetti)),
      ],
    },
    {
      titolo: 'La giornata',
      righe: [
        riga('Alvo', etichettaValore('alvo', r.alvo)),
        riga('Sintomi diurni', etichetteValori('sintomi_diurni', r.sintomi_diurni)),
        riga('Interventi', etichetteValori('interventi', r.interventi)),
        riga('Salute', etichettaValore('salute_stato', r.salute_stato)),
        riga('Sintomi', etichetteValori('salute_sintomi', r.salute_sintomi)),
      ],
    },
    {
      titolo: 'Note',
      righe: [riga('Note', r.note)],
    },
  ]

  return gruppi
    .map((g) => ({ ...g, righe: g.righe.filter(Boolean) }))
    .filter((g) => g.righe.length > 0)
})

const vuota = computed(() => sezioni.value.length === 0)
</script>

<template>
  <div>
    <section v-for="s in sezioni" :key="s.titolo" class="sezione">
      <h4>{{ s.titolo }}</h4>
      <dl class="scheda">
        <template v-for="r in s.righe" :key="r.etichetta">
          <dt>{{ r.etichetta }}</dt>
          <dd>{{ r.valore }}</dd>
        </template>
      </dl>
    </section>
    <p v-if="vuota" class="muted" style="margin: 0">Nessun dettaglio registrato.</p>
  </div>
</template>

<style scoped>
.sezione + .sezione {
  margin-top: 1.1rem;
  padding-top: 0.9rem;
  border-top: 1px solid var(--bordo);
}

/* Piccolo e in maiuscoletto: separa senza competere coi valori, che sono la
   cosa da leggere. In un riepilogo il titolo serve a orientarsi, non a essere
   letto per primo. */
h4 {
  margin: 0 0 0.45rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--tenue);
}

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
