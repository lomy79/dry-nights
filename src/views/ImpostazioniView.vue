<script setup>
import { onMounted, computed } from 'vue'
import { useNotificheStore } from '@/stores/notifiche'
import { PASSO_MINUTI } from '@/domain/promemoria'

// Due piani distinti, e la UI lo deve dire chiaramente:
//  - l'interruttore vale per QUESTO telefono;
//  - gli orari valgono per TE, ovunque.
const notifiche = useNotificheStore()

const passoSecondi = PASSO_MINUTI * 60

// Un input time svuotato emette '': non è un errore da mostrare, è un orario
// a metà mentre lo si sta digitando. Si ignora e basta.
const oraSera = computed({
  get: () => notifiche.prefs.ora_sera,
  set: (v) => v && notifiche.salvaPrefs({ ora_sera: v }),
})
const oraMattina = computed({
  get: () => notifiche.prefs.ora_mattina,
  set: (v) => v && notifiche.salvaPrefs({ ora_mattina: v }),
})

onMounted(() => notifiche.carica())
</script>

<template>
  <main>
    <header style="display: flex; align-items: baseline; justify-content: space-between">
      <h1>Promemoria</h1>
      <router-link class="btn-link" :to="{ name: 'oggi' }">Chiudi</router-link>
    </header>

    <p class="muted">
      Due promemoria al giorno: uno la sera per la cena e i liquidi, uno la
      mattina per com’è andata. Se il dato è già stato segnato — anche
      dall’altro genitore — quel promemoria non arriva.
    </p>

    <!-- Browser che non ce la fa: dillo e basta, senza far tentare invano -->
    <div class="card" v-if="!notifiche.supportato">
      <p style="margin: 0">
        Questo browser non supporta le notifiche push. Apri l’app da Chrome su
        Android, oppure installala dalla schermata home.
      </p>
    </div>

    <div class="card" v-else-if="!notifiche.vapidOk">
      <p style="margin: 0">
        Le notifiche non sono ancora configurate su questo ambiente
        (manca la chiave <code>VITE_VAPID_PUBLIC_KEY</code>).
      </p>
      <p class="muted" style="margin-bottom: 0">Vedi <code>docs/notifiche-push.md</code>.</p>
    </div>

    <template v-else>
      <!-- Questo dispositivo -->
      <div class="card">
        <div class="recap">
          <h2 style="margin: 0; font-size: 1.05rem">Su questo telefono</h2>
          <span class="muted" style="font-size: 0.9rem">
            {{ notifiche.attivoQui ? 'Attivi ✓' : 'Non attivi' }}
          </span>
        </div>

        <p class="muted" style="margin-top: 0.4rem">
          Ogni telefono va attivato una volta. Gli altri dispositivi non vengono
          toccati.
        </p>

        <p v-if="notifiche.bloccatoDalBrowser && !notifiche.attivoQui" class="avviso">
          Le notifiche per questo sito risultano bloccate. Per riattivarle:
          icona del lucchetto nella barra degli indirizzi → Notifiche → Consenti.
        </p>

        <button
          v-if="!notifiche.attivoQui"
          type="button"
          class="btn btn-primary"
          :disabled="notifiche.inCorso || notifiche.bloccatoDalBrowser"
          @click="notifiche.attiva()"
        >
          {{ notifiche.inCorso ? 'Attivo…' : 'Attiva su questo telefono' }}
        </button>
        <button
          v-else
          type="button"
          class="btn"
          :disabled="notifiche.inCorso"
          @click="notifiche.disattiva()"
        >
          {{ notifiche.inCorso ? 'Disattivo…' : 'Disattiva su questo telefono' }}
        </button>
      </div>

      <!-- Orari: valgono per il genitore, non per il device -->
      <div class="card">
        <h2 style="margin-top: 0; font-size: 1.05rem">I tuoi orari</h2>
        <p class="muted" style="margin-top: 0">
          Valgono su tutti i tuoi dispositivi. L’altro genitore ha i suoi.
        </p>

        <div class="gruppo">
          <label class="riga">
            <input
              type="checkbox"
              :checked="notifiche.prefs.sera_attiva"
              @change="notifiche.salvaPrefs({ sera_attiva: $event.target.checked })"
            />
            <span>La sera — cena e liquidi di stasera</span>
          </label>
          <input
            type="time"
            class="ora"
            :step="passoSecondi"
            v-model="oraSera"
            :disabled="!notifiche.prefs.sera_attiva"
          />
        </div>

        <div class="gruppo">
          <label class="riga">
            <input
              type="checkbox"
              :checked="notifiche.prefs.mattina_attiva"
              @change="notifiche.salvaPrefs({ mattina_attiva: $event.target.checked })"
            />
            <span>La mattina — com’è andata la notte</span>
          </label>
          <input
            type="time"
            class="ora"
            :step="passoSecondi"
            v-model="oraMattina"
            :disabled="!notifiche.prefs.mattina_attiva"
          />
        </div>

        <p class="muted" style="font-size: 0.85rem; margin-bottom: 0">
          Gli orari si arrotondano al quarto d’ora: è la frequenza con cui il
          server controlla, prometterti le 23:07 sarebbe una bugia.
        </p>
      </div>

      <div class="card">
        <p class="muted" style="margin: 0; font-size: 0.9rem">
          La notifica del mattino ha due bottoni, <strong>Asciutto</strong> e
          <strong>Bagnato</strong>: un tap dalla schermata di blocco e la notte è
          registrata. Se rispondi “bagnato” l’app si apre sui dettagli, che
          restano comunque facoltativi.
        </p>
      </div>
    </template>

    <p v-if="notifiche.errore" class="error">{{ notifiche.errore }}</p>
  </main>
</template>

<style scoped>
.riga {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.98rem;
}

.riga input[type='checkbox'] {
  width: 1.15rem;
  height: 1.15rem;
  accent-color: var(--accento);
  flex-shrink: 0;
}

.ora {
  margin-top: 0.5rem;
  width: auto;
  min-width: 7rem;
}

.ora:disabled {
  opacity: 0.5;
}
</style>
