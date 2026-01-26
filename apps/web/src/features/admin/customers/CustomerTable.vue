<template>
  <div class="mt-4 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
    <table class="w-full table-fixed text-left text-sm">
      <thead class="bg-slate-50 text-xs text-slate-600 dark:bg-slate-950/40 dark:text-slate-300">
        <tr>
          <th class="w-40 px-4 py-3">Code</th>
          <th class="px-4 py-3">Nome</th>
          <th class="w-36 px-4 py-3">Status</th>
          <th class="w-28 px-4 py-3 text-right"></th>
        </tr>
      </thead>

      <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
        <tr v-for="c in rows" :key="c.id" class="hover:bg-slate-50/60 dark:hover:bg-slate-950/30">
          <td class="px-4 py-3 font-mono text-xs text-slate-900 dark:text-slate-100">
            <div class="truncate">{{ c.code }}</div>
          </td>

          <td class="px-4 py-3 text-slate-900 dark:text-slate-100">
            <div class="truncate">{{ c.name }}</div>
          </td>

          <td class="px-4 py-3">
            <PermSwitch
              :model-value="c.status === 'active'"
              :loading="isBusy(c.id)"
              on-label="Ativo"
              off-label="Inativo"
              @toggle="$emit('toggle-status', c)"
            />
          </td>

          <td class="px-4 py-3">
            <div class="flex items-center justify-end gap-2">
              <button
                type="button"
                class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50
                       disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                :disabled="isBusy(c.id)"
                @click="$emit('edit', c)"
              >
                Editar
              </button>
            </div>
          </td>
        </tr>

        <tr v-if="!rows.length">
          <td colspan="4" class="px-4 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            Nenhum customer encontrado.
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { CustomerRow } from "@/features/admin/api";
import { PermSwitch } from "@/ui/toggles";

defineProps<{
  rows: CustomerRow[];
  isBusy: (id: string) => boolean;
}>();

defineEmits<{
  (e: "edit", value: CustomerRow): void;
  (e: "toggle-status", value: CustomerRow): void;
}>();
</script>
