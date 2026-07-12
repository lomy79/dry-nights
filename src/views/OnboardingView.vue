<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useBambinoStore } from '@/stores/bambino'

// Due strade: il primo genitore CREA il profilo, il secondo si UNISCE col codice.
const router = useRouter()
const bambino = useBambinoStore()

const nome = ref('')
const dataNascita = ref('')
const codice = ref('')
const occupato = ref(false)
const errore = ref('')

async function crea() {
  if (!nome.value.trim()) {
    errore.value = 'Serve almeno il nome.'
    return
  }
  occupato.value = true
  errore.value = ''
  try {
    await bambino.creaBambino(nome.value.trim(), dataNascita.value || null)
    router.replace({ name: 'oggi' })
  } catch (e) {
    errore.value = e?.message ?? 'Non è stato possibile creare il profilo.'
  } finally {
    occupato.value = false
  }
}

async function unisci() {
  if (!codice.value.trim()) {
    errore.value = 'Incolla il codice invito ricevuto.'
    return
  }
  occupato.value = true
  errore.value = ''
  try {
    await bambino.unisciciConCodice(codice.value)
    router.replace({ name: 'oggi' })
  } catch (e) {
    errore.value = e?.message ?? 'Codice non valido.'
  } finally {
    occupato.value = false
  }
}
</script>

<template>
  <main>
    <h1>Iniziamo</h1>
    <p class="muted">Crea il profilo del bambino, o unisciti a uno già esistente.</p>

    <form class="card" @submit.prevent="crea">
      <h2 style="margin-top: 0; font-size: 1.05rem">Crea il profilo</h2>
      <label class="field">
        <span>Nome del bambino</span>
        <input v-model="nome" type="text" placeholder="Es. Marco" :disabled="occupato" />
      </label>
      <label class="field">
        <span>Data di nascita (opzionale)</span>
        <input v-model="dataNascita" type="date" :disabled="occupato" />
      </label>
      <button class="btn btn-primary" type="submit" :disabled="occupato">
        Crea profilo
      </button>
    </form>

    <div class="sep">oppure</div>

    <form class="card" @submit.prevent="unisci">
      <h2 style="margin-top: 0; font-size: 1.05rem">Ho un codice invito</h2>
      <p class="muted" style="margin-top: 0">
        Se l’altro genitore ha già creato il profilo, incolla qui il codice che ti ha
        condiviso.
      </p>
      <label class="field">
        <span>Codice invito</span>
        <input v-model="codice" type="text" placeholder="xxxxxxxx-…" :disabled="occupato" />
      </label>
      <button class="btn" type="submit" :disabled="occupato">Unisciti</button>
    </form>

    <p v-if="errore" class="error">{{ errore }}</p>
  </main>
</template>
