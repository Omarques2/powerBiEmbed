<!-- apps/web/src/admin/components/AdminSidebar.vue -->
<template>
  <aside class="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div class="flex items-center justify-between">
      <div class="text-sm font-semibold">Admin Panel</div>
      <div class="text-[11px] text-slate-500 dark:text-slate-400">Ops</div>
    </div>

    <div class="mt-3 space-y-1">
      <button
        v-for="i in items"
        :key="i.key"
        type="button"
        class="w-full rounded-xl px-3 py-2 text-left text-sm"
        :class="activeKey === i.key
          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
          : 'hover:bg-slate-50 dark:hover:bg-slate-800'"
        @click="$emit('select', i.key)"
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
  </aside>
</template>

<script setup lang="ts">
export type AdminTabKey =
  | "overview"
  | "pending"
  | "active"
  | "customers"
  | "security"
  | "audit"
  | "powerbi";

defineProps<{
  activeKey: AdminTabKey;
  items: Array<{ key: AdminTabKey; label: string }>;
}>();

defineEmits<{
  (e: "select", key: AdminTabKey): void;
}>();
</script>
