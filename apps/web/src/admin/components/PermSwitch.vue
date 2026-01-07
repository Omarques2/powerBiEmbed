<!-- apps/web/src/admin/components/PermSwitch.vue -->
<template>
  <button
    type="button"
    class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition
           disabled:opacity-60 dark:border-slate-800"
    :class="
      modelValue
        ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100'
        : 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100'
    "
    :disabled="disabled || loading"
    @click="$emit('toggle')"
  >
    <span
      v-if="loading"
      class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80"
      aria-hidden="true"
    />
    <span v-else class="inline-block h-2 w-2 rounded-full" :class="modelValue ? 'bg-emerald-600' : 'bg-slate-500'" />
    <span>{{ modelValue ? onLabel : offLabel }}</span>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean;
  loading?: boolean;
  disabled?: boolean;
  onLabel?: string;
  offLabel?: string;
}>();

defineEmits<{
  (e: "toggle"): void;
}>();
</script>
