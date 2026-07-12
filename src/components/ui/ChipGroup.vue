<script setup>
// Gruppo di chip selezionabili, singola o multi-scelta.
// v-model: stringa/valore (singola) oppure array (multi).
const props = defineProps({
  options: { type: Array, required: true }, // [{ value, label }]
  modelValue: { default: null },
  multi: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

function selezionato(v) {
  return props.multi
    ? (props.modelValue ?? []).includes(v)
    : props.modelValue === v
}

function toggle(v) {
  if (props.multi) {
    const cur = props.modelValue ?? []
    emit(
      'update:modelValue',
      cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    )
  } else {
    // Ritap = deseleziona (torna a "non risposto").
    emit('update:modelValue', props.modelValue === v ? null : v)
  }
}
</script>

<template>
  <div class="chips">
    <button
      v-for="o in options"
      :key="String(o.value)"
      type="button"
      class="chip"
      :class="{ 'chip-on': selezionato(o.value) }"
      @click="toggle(o.value)"
    >
      {{ o.label }}
    </button>
  </div>
</template>
