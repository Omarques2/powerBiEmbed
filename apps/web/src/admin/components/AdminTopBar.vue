<!-- apps/web/src/admin/components/AdminTopBar.vue -->
<template>
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ title }}</div>
      <div class="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{{ subtitle }}</div>
    </div>

    <div class="flex items-center gap-2">
      <button
        type="button"
        class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50
               disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
        :disabled="loadingAny"
        @click="$emit('reload')"
      >
        {{ loadingAny ? "Carregando..." : "Recarregar" }}
      </button>

      <button
        v-if="showSearch"
        type="button"
        class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50
               dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
        @click="$emit('search')"
      >
        Buscar (Ctrl+K)
      </button>

      <button
        type="button"
        class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800
               dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        @click="$emit('back')"
      >
        Voltar
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  subtitle: string;
  loadingAny: boolean;
  showSearch?: boolean;
}>();

defineEmits<{
  (e: "reload"): void;
  (e: "back"): void;
  (e: "search"): void;
}>();
</script>
