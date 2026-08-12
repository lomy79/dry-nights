<script setup>
/**
 * Le settimane come barre impilate. SVG scritto a mano: il progetto ha cinque
 * dipendenze in tutto e una libreria di grafici peserebbe più di tutte insieme
 * per disegnare dei rettangoli.
 *
 * Ogni barra è alta quanto le notti della settimana, non quanto una percentuale:
 * una settimana con due sole notti registrate DEVE apparire più corta, altrimenti
 * il grafico dichiara che di quella settimana sappiamo quanto sappiamo delle
 * altre. Le notti sconosciute sono tratteggiate: presenti e dichiarate, mai un
 * vuoto che si legge come "asciutto".
 */
import { computed } from 'vue'
import { parseISO, format } from 'date-fns'
import { it } from 'date-fns/locale'

const props = defineProps({
  settimane: { type: Array, required: true },
  ampiezza: { type: Number, default: 7 },
})

const PASSO = 46
const LARGHEZZA_BARRA = 26
const ALTEZZA = 112
const BASE = 126 // linea di terra: sotto resta lo spazio dell'etichetta

const larghezza = computed(() => Math.max(props.settimane.length * PASSO, PASSO))

/** Geometria dei segmenti impilati, dal basso: asciutte, bagnate, sconosciute. */
const barre = computed(() =>
  props.settimane.map((s, i) => {
    const unita = ALTEZZA / props.ampiezza
    const x = i * PASSO + (PASSO - LARGHEZZA_BARRA) / 2
    let y = BASE
    const segmenti = []
    for (const [tipo, quante] of [
      ['asciutte', s.asciutte],
      ['bagnate', s.bagnate],
      ['sconosciute', s.sconosciute],
    ]) {
      if (quante <= 0) continue
      const h = quante * unita
      y -= h
      segmenti.push({ tipo, x, y, h })
    }
    return {
      chiave: s.a,
      x,
      segmenti,
      etichetta: format(parseISO(s.a), 'd MMM', { locale: it }),
      titolo: `Settimana al ${s.a}: ${s.asciutte} asciutte, ${s.bagnate} bagnate, ${s.sconosciute} sconosciute`,
      rapporto: s.note > 0 ? `${s.asciutte}/${s.note}` : '—',
    }
  }),
)
</script>

<template>
  <figure class="grafico">
    <svg
      :viewBox="`0 0 ${larghezza} 148`"
      :style="{ minWidth: larghezza + 'px' }"
      role="img"
      aria-label="Notti asciutte per settimana"
    >
      <defs>
        <pattern
          id="tratteggio"
          width="6"
          height="6"
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
        >
          <rect width="6" height="6" fill="#fff" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="#e3ded7" stroke-width="3" />
        </pattern>
      </defs>

      <g v-for="b in barre" :key="b.chiave">
        <title>{{ b.titolo }}</title>
        <rect
          v-for="s in b.segmenti"
          :key="s.tipo"
          :x="s.x"
          :y="s.y"
          :width="LARGHEZZA_BARRA"
          :height="s.h"
          :class="'seg-' + s.tipo"
          rx="3"
        />
        <text :x="b.x + LARGHEZZA_BARRA / 2" y="142" class="etichetta">{{ b.etichetta }}</text>
        <text :x="b.x + LARGHEZZA_BARRA / 2" y="10" class="rapporto">{{ b.rapporto }}</text>
      </g>
    </svg>

    <figcaption class="legenda">
      <span><i class="q leg-asciutte" />asciutte</span>
      <span><i class="q leg-bagnate" />bagnate</span>
      <span><i class="q leg-sconosciute" />sconosciute</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.grafico {
  margin: 0;
  /* Molte settimane: si scorre. Comprimerle fino a farle combaciare sarebbe
     un grafico che sta nello schermo e non si legge più. */
  overflow-x: auto;
}
svg {
  display: block;
  height: 148px;
}
.seg-asciutte {
  fill: var(--accento);
}
.seg-bagnate {
  fill: var(--accento-chiaro);
}
.seg-sconosciute {
  fill: url(#tratteggio);
}
.etichetta,
.rapporto {
  font-size: 10px;
  text-anchor: middle;
  fill: var(--tenue);
}
.rapporto {
  font-weight: 600;
  fill: var(--testo);
}
.legenda {
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem;
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--tenue);
}
.legenda span {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.q {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 3px;
  border: 1px solid var(--bordo);
}
.leg-asciutte {
  background: var(--accento);
}
.leg-bagnate {
  background: var(--accento-chiaro);
}
.leg-sconosciute {
  background: repeating-linear-gradient(45deg, #fff 0 2px, var(--bordo) 2px 4px);
}
</style>
