<script setup>
// Guscio minimale: le viste vivono nel router.
// Il tono "senza colpa" parte da qui — nessuno stato di allarme, colori quieti.
</script>

<template>
  <div class="app-shell">
    <router-view />
  </div>
</template>

<style scoped>
.app-shell {
  max-width: 560px;
  margin: 0 auto;
  min-height: 100dvh;
  padding: env(safe-area-inset-top) 1rem env(safe-area-inset-bottom);
}
</style>
