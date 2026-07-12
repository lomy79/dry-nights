<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

// Login senza password: si inserisce l'email, arriva un link, si clicca.
const auth = useAuthStore()
const email = ref('')
const stato = ref('idle') // idle | invio | inviato | errore
const messaggioErrore = ref('')

const emailValida = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())

async function invia() {
  if (!emailValida()) {
    messaggioErrore.value = 'Controlla l’indirizzo email.'
    stato.value = 'errore'
    return
  }
  stato.value = 'invio'
  messaggioErrore.value = ''
  try {
    await auth.inviaMagicLink(email.value.trim())
    stato.value = 'inviato'
  } catch (e) {
    messaggioErrore.value = e?.message ?? 'Qualcosa non ha funzionato, riprova.'
    stato.value = 'errore'
  }
}
</script>

<template>
  <main>
    <h1>Notti serene</h1>

    <template v-if="stato === 'inviato'">
      <div class="card">
        <p>📬 Ti ho mandato un link a <strong>{{ email }}</strong>.</p>
        <p class="muted">
          Aprilo su questo telefono per entrare. Se non lo trovi, controlla lo spam.
        </p>
        <button class="btn-link" @click="stato = 'idle'">Usa un’altra email</button>
      </div>
    </template>

    <template v-else>
      <p class="muted">Accedi con la tua email. Nessuna password da ricordare.</p>
      <form class="card" @submit.prevent="invia">
        <label class="field">
          <span>Email</span>
          <input
            v-model="email"
            type="email"
            inputmode="email"
            autocomplete="email"
            placeholder="tu@esempio.it"
            :disabled="stato === 'invio'"
          />
        </label>
        <button class="btn btn-primary" type="submit" :disabled="stato === 'invio'">
          {{ stato === 'invio' ? 'Invio…' : 'Invia il link di accesso' }}
        </button>
        <p v-if="messaggioErrore" class="error">{{ messaggioErrore }}</p>
      </form>
    </template>
  </main>
</template>
