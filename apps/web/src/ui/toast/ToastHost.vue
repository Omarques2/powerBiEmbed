<!-- apps/web/src/ui/toast/ToastHost.vue -->
<template>
  <div class="fixed right-4 top-4 z-[1000] flex w-[420px] max-w-[92vw] flex-col gap-3">
    <div
      v-for="t in state.items"
      :key="t.id"
      class="rounded-2xl border bg-white p-3 shadow-lg dark:bg-slate-900"
      :class="toastBorder(t.kind)"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <span
              v-if="t.loading"
              class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700 dark:border-slate-700 dark:border-t-slate-200"
              aria-hidden="true"
            />
            {{ t.title }}
          </div>
          <div v-if="t.message" class="mt-1 text-sm text-slate-700 dark:text-slate-200">
            {{ t.message }}
          </div>

          <details v-if="t.details" class="mt-2">
            <summary class="cursor-pointer text-xs text-slate-600 dark:text-slate-300">Ver detalhes</summary>
            <pre class="mt-2 max-h-64 overflow-auto rounded-xl bg-slate-50 p-2 text-xs text-slate-900 dark:bg-slate-950 dark:text-slate-100">{{
              pretty(t.details)
            }}</pre>
          </details>
        </div>

        <button
          class="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
          @click="remove(t.id)"
        >
          Fechar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from "./useToast";

const { state, remove } = useToast();

function toastBorder(kind: "success" | "error" | "info") {
  if (kind === "success") return "border-emerald-200 dark:border-emerald-900";
  if (kind === "error") return "border-rose-200 dark:border-rose-900";
  return "border-slate-200 dark:border-slate-800";
}

function pretty(v: any) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
</script>
