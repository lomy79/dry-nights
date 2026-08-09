import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'
import { router } from './router'
import './styles/base.css'

// Registra src/sw.js (precache + ricezione dei promemoria push). `immediate`
// perche' senza service worker attivo non esiste subscription possibile: il
// permesso alle notifiche verrebbe chiesto per poi fallire.
registerSW({ immediate: true })

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
