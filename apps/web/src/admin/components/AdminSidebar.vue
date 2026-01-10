<!-- apps/web/src/admin/components/AdminSidebar.vue -->
<template>
  <!-- ROOT ÚNICO: importante para o AdminView conseguir controlar layout (grid/flex/w/shrink/etc) -->
  <aside class="min-w-0" v-bind="$attrs">
    <!-- MOBILE: Tabs horizontais (compacto) -->
    <div class="lg:hidden">
      <div
        class="rounded-2xl border border-slate-200 bg-white/80 p-2 shadow-sm backdrop-blur
               dark:border-slate-800 dark:bg-slate-900/70"
      >
        <div class="flex items-center justify-between gap-2 px-1">
          <div class="min-w-0">
            <div class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              Admin
            </div>
            <div class="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {{ activeLabel }}
            </div>
          </div>

          <div
            class="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600
                   dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            Ops
          </div>
        </div>

        <div
          class="mt-2 flex gap-2 overflow-x-auto pb-1 pr-1 [-webkit-overflow-scrolling:touch]"
          aria-label="Admin tabs"
        >
          <button
            v-for="i in items"
            :key="i.key"
            type="button"
            class="shrink-0 rounded-full border px-3 py-2 text-xs font-medium transition
                   active:scale-[0.98]"
            :class="activeKey === i.key
              ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'"
            @click="$emit('select', i.key)"
            :aria-current="activeKey === i.key ? 'page' : undefined"
          >
            {{ i.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- DESKTOP: comportamento original (no fluxo normal, sem sticky) -->
    <div
      class="hidden lg:block rounded-2xl border border-slate-200 bg-white p-3 shadow-sm
             dark:border-slate-800 dark:bg-slate-900"
    >
      <div class="flex items-center justify-between">
        <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">Admin Panel</div>
        <div class="text-[11px] text-slate-500 dark:text-slate-400">Ops</div>
      </div>

      <div class="mt-3 space-y-1">
        <button
          v-for="i in items"
          :key="i.key"
          type="button"
          class="w-full rounded-xl px-3 py-2 text-left text-sm transition
                 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-700"
          :class="activeKey === i.key
            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
            : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'"
          @click="$emit('select', i.key)"
          :aria-current="activeKey === i.key ? 'page' : undefined"
        >
          {{ i.label }}
        </button>
      </div>

      <div
        class="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600
               dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300"
      >
        Dica: use <span class="font-semibold">Ctrl+K</span> para buscar (se habilitado).
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from "vue";

export type AdminTabKey =
  | "overview"
  | "pending"
  | "active"
  | "customers"
  | "security"
  | "audit"
  | "powerbi";

const props = defineProps<{
  activeKey: AdminTabKey;
  items: Array<{ key: AdminTabKey; label: string }>;
}>();

defineEmits<{
  (e: "select", key: AdminTabKey): void;
}>();

const activeLabel = computed(() => {
  return props.items.find((x) => x.key === props.activeKey)?.label ?? "";
});
</script>
