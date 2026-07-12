import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useBambinoStore } from '@/stores/bambino'

// Poche viste. OggiView è la home guidata da "cosa manca".
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'oggi',
      component: () => import('@/views/OggiView.vue'),
      meta: { richiedeAuth: true, richiedeBambino: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/onboarding',
      name: 'onboarding',
      component: () => import('@/views/OnboardingView.vue'),
      meta: { richiedeAuth: true },
    },
    {
      path: '/storico',
      name: 'storico',
      component: () => import('@/views/StoricoView.vue'),
      meta: { richiedeAuth: true, richiedeBambino: true },
    },
  ],
})

// Carica i bambini una sola volta per navigazione (le guard sono async).
async function assicuraBambiniCaricati(bambino) {
  if (!bambino.caricato) {
    try {
      await bambino.carica()
    } catch (e) {
      console.error('[router] caricamento bambini fallito:', e)
    }
  }
}

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.init()

  // Non autenticato su pagina protetta → login.
  if (to.meta.richiedeAuth && !auth.isAuthed) {
    return { name: 'login' }
  }

  // Già autenticato ma sulla pagina di login → home.
  if (auth.isAuthed && to.name === 'login') {
    return { name: 'oggi' }
  }

  if (auth.isAuthed) {
    const bambino = useBambinoStore()

    // Pagina che richiede un bambino ma non ne hai → onboarding.
    if (to.meta.richiedeBambino) {
      await assicuraBambiniCaricati(bambino)
      if (!bambino.haBambino) return { name: 'onboarding' }
    }

    // Sei sull'onboarding ma un bambino ce l'hai già → home.
    if (to.name === 'onboarding') {
      await assicuraBambiniCaricati(bambino)
      if (bambino.haBambino) return { name: 'oggi' }
    }
  }

  return true
})
