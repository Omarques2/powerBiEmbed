<!-- apps/web/src/ui/toggles/PermSwitch.vue -->
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
    :aria-pressed="modelValue"
    @click="onClick"
  >
    <span
      v-if="loading"
      class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80"
      aria-hidden="true"
    />

    <span
      v-else
      class="inline-block h-2 w-2 rounded-full"
      :class="modelValue ? 'bg-emerald-600 dark:bg-emerald-300' : 'bg-slate-500 dark:bg-slate-300'"
      aria-hidden="true"
    />

    <span class="whitespace-nowrap">
      {{ modelValue ? onLabel : offLabel }}
    </span>
  </button>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    loading?: boolean;
    disabled?: boolean;
    onLabel?: string;
    offLabel?: string;
  }>(),
  {
    loading: false,
    disabled: false,
    onLabel: "On",
    offLabel: "Off",
  },
);

const emit = defineEmits<{
  (e: "toggle"): void;
}>();

function onClick() {
  // proteção extra (além do disabled do button)
  if (props.disabled || props.loading) return;
  emit("toggle");
}
</script>
