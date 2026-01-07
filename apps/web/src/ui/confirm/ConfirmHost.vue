<!-- apps/web/src/ui/confirm/ConfirmHost.vue -->
<template>
  <teleport to="body">
    <div v-if="state.open" class="fixed inset-0 z-[999]">
      <div class="absolute inset-0 bg-black/40" @click="close(false)" />

      <div class="absolute inset-0 flex items-center justify-center p-4">
        <div
          class="w-[520px] max-w-[92vw] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900"
        >
          <div class="text-base font-semibold text-slate-900 dark:text-slate-100">
            {{ state.title }}
          </div>
          <div class="mt-2 text-sm text-slate-700 dark:text-slate-200">
            {{ state.message }}
          </div>

          <div class="mt-4 flex justify-end gap-2">
            <button
              class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
              @click="close(false)"
            >
              {{ state.cancelText }}
            </button>

            <button
              class="rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              :class="state.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white'"
              @click="close(true)"
            >
              {{ state.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { useConfirm } from "./useConfirm";

const { state, close } = useConfirm();
</script>
