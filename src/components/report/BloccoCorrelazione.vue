<script setup>
/**
 * Un fattore messo a confronto con l'esito, nei suoi tre stati (Decisione 12).
 *
 * Il caso normale, per mesi, sarà 'raccolta': un contatore invece di un numero.
 * È voluto. Una barra disegnata su otto notti sembra una risposta e non lo è, e
 * qui la risposta sbagliata non costa un grafico brutto: costa che qualcuno tolga
 * il latte della sera a un bambino per via di sette notti.
 */
import { computed } from 'vue'
import { percento, punti, nottiConta } from '@/lib/formato'

const props = defineProps({ valutazione: { type: Object, required: true } })

const v = computed(() => props.valutazione)

/** Quanto è pieno il contatore: il gruppo più scarso sulla soglia. */
const avanzamento = computed(() => {
  const minore = Math.min(v.value.con.n, v.value.senza.n)
  return Math.min(1, minore / v.value.soglia)
})

/**
 * Cosa manca, detto per esteso e per ciascuno dei due gruppi.
 *
 * Prima diceva "mancano 10 notti fra le notti in cui succede", che si legge come
 * "dieci notti mancano all'appello fra quelle in cui succede" — un conteggio
 * dentro un gruppo, non notti ancora da vivere. E quando i gruppi erano vuoti
 * tutti e due nominava solo il più scarso, quindi prometteva metà del lavoro.
 *
 * Quando mancano entrambe si nominano entrambe nella stessa frase: è il caso di
 * partenza, e chi legge deve sapere subito che riempire una metà sola non basta.
 */
const cheCosaManca = computed(() => {
  const { mancaCon, mancaSenza } = v.value
  const n = (q) => (q === 1 ? '1 notte' : `${q} notti`)

  if (mancaCon > 0 && mancaSenza > 0) {
    return `mancano ${n(mancaCon)} in cui succede e ${n(mancaSenza)} in cui non succede`
  }
  const solo = mancaCon > 0 ? mancaCon : mancaSenza
  const quando = mancaCon > 0 ? 'in cui succede' : 'in cui non succede'
  return `${solo === 1 ? 'manca' : 'mancano'} ${n(solo)} ${quando}`
})

const intervallo = (i) => (i ? `${percento(i.basso)}–${percento(i.alto)}` : '—')
</script>

<template>
  <div class="fattore">
    <p class="nome">{{ v.etichetta }}</p>

    <!-- 1. Raccolta: niente percentuali, solo la distanza dalla soglia. -->
    <template v-if="v.stato === 'raccolta'">
      <!-- Due righe parallele, non una frase con dentro due numeri: qui si legge
           di sfuggita, e "0 notti in cui succede · 0 notti in cui no" costringeva
           a rileggere per capire quale zero fosse quale. -->
      <dl class="conteggi muted">
        <div><dt>Succede</dt><dd>{{ nottiConta(v.con.n) }}</dd></div>
        <div><dt>Non succede</dt><dd>{{ nottiConta(v.senza.n) }}</dd></div>
      </dl>
      <div class="barra" role="img" :aria-label="`avanzamento ${Math.round(avanzamento * 100)}%`">
        <span :style="{ width: `${avanzamento * 100}%` }" />
      </div>
      <p class="muted spiega">
        Per confrontarle servono {{ v.soglia }} notti per gruppo, perché il confronto
        ha bisogno di tutte e due le metà: <strong>{{ cheCosaManca }}</strong
        >.
      </p>
    </template>

    <!-- 2 e 3. Numeri visibili: sempre con l'intervallo accanto. -->
    <template v-else>
      <dl class="confronto">
        <div>
          <dt>Quando succede</dt>
          <dd>
            {{ percento(v.con.quota) }} bagnate
            <span class="muted">({{ intervallo(v.con.intervallo) }} · {{ v.con.n }} notti)</span>
          </dd>
        </div>
        <div>
          <dt>Quando no</dt>
          <dd>
            {{ percento(v.senza.quota) }} bagnate
            <span class="muted">({{ intervallo(v.senza.intervallo) }} · {{ v.senza.n }} notti)</span>
          </dd>
        </div>
      </dl>

      <p v-if="v.stato === 'netta'" class="verdetto">
        Differenza osservata: <strong>{{ punti(v.differenza.differenza) }} punti</strong>
        (fra {{ punti(v.differenza.basso) }} e {{ punti(v.differenza.alto) }}).
        È un confronto fra le notti registrate, non un esperimento: dice che le due
        situazioni sono andate diversamente, non perché.
      </p>
      <p v-else class="muted spiega">
        Differenza osservata {{ punti(v.differenza.differenza) }} punti, ma l'incertezza
        va da {{ punti(v.differenza.basso) }} a {{ punti(v.differenza.alto) }}: con
        questi dati le due situazioni potrebbero ancora essere uguali.
      </p>
    </template>
  </div>
</template>

<style scoped>
.fattore {
  padding: 0.9rem 0;
  border-bottom: 1px solid var(--bordo);
}
.fattore:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.nome {
  margin: 0 0 0.35rem;
  font-weight: 600;
}
.conteggi {
  margin: 0 0 0.45rem;
  font-size: 0.88rem;
  display: grid;
  gap: 0.1rem 1rem;
}
.conteggi > div {
  display: flex;
  justify-content: space-between;
  max-width: 16rem;
}
.conteggi dt,
.conteggi dd {
  margin: 0;
}
.conteggi dd {
  font-variant-numeric: tabular-nums;
}
/* Il contatore è l'unica cosa che si muove ogni settimana: è il motivo per cui
   vale la pena compilare anche stasera. */
.barra {
  height: 6px;
  background: var(--sfondo);
  border: 1px solid var(--bordo);
  border-radius: 999px;
  overflow: hidden;
}
.barra span {
  display: block;
  height: 100%;
  background: var(--accento-chiaro);
}
.spiega {
  margin: 0.45rem 0 0;
  font-size: 0.86rem;
  line-height: 1.4;
}
.confronto {
  margin: 0;
  display: grid;
  gap: 0.35rem;
}
.confronto dt {
  font-size: 0.85rem;
  color: var(--tenue);
}
.confronto dd {
  margin: 0;
  font-size: 0.95rem;
}
.confronto dd .muted {
  font-size: 0.82rem;
}
.verdetto {
  margin: 0.55rem 0 0;
  font-size: 0.88rem;
  line-height: 1.45;
  background: var(--accento-chiaro);
  border-radius: 10px;
  padding: 0.6rem 0.7rem;
}
</style>
