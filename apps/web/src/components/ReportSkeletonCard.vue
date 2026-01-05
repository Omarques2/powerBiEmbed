<template>
  <div
    class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm
           dark:border-slate-800 dark:bg-slate-900"
  >
    <div class="mb-4 h-4 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
    <div class="mb-2 h-3 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
    <div class="mb-6 h-3 w-1/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />

    <div class="grid grid-cols-12 gap-3">
      <div class="col-span-12 md:col-span-7 h-44 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
      <div class="col-span-12 md:col-span-5 h-44 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
      <div class="col-span-12 h-56 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
    </div>

    <div v-if="$slots.footer" class="mt-4 text-xs text-slate-500 dark:text-slate-400">
      <slot name="footer" />
    </div>
  </div>
</template>
