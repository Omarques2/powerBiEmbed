<!-- apps/web/src/admin/panels/AuditPanel.vue -->
<template>
  <div class="space-y-3">
    <div
      v-if="err"
      class="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700
             dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
    >
      {{ err }}
    </div>

    <div class="flex items-center justify-between">
      <div class="text-xs text-slate-600 dark:text-slate-300">Audit log</div>
      <button
        type="button"
        class="rounded-xl border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50
               disabled:opacity-60 dark:border-slate-800 dark:hover:bg-slate-800"
        :disabled="loading"
        @click="load(page)"
      >
        Atualizar
      </button>
    </div>

    <div class="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs text-slate-600 dark:bg-slate-950/30 dark:text-slate-300">
          <tr>
            <th class="px-3 py-2 text-left">Quando</th>
            <th class="px-3 py-2 text-left">Actor</th>
            <th class="px-3 py-2 text-left">Action</th>
            <th class="px-3 py-2 text-left">Entity</th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="r in rows"
            :key="r.id"
            class="border-t border-slate-200 dark:border-slate-800"
          >
            <td class="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
              {{ formatDate(r.createdAt) }}
            </td>

            <td class="px-3 py-2">
              <div class="text-sm">{{ r.actor?.displayName ?? "—" }}</div>
              <div class="text-xs text-slate-500 dark:text-slate-400">
                {{ r.actor?.email ?? r.actorUserId ?? "—" }}
              </div>
            </td>

            <td class="px-3 py-2 font-medium">{{ r.action }}</td>

            <td class="px-3 py-2">
              <div class="text-sm">{{ r.entityType }}</div>
              <div class="text-xs text-slate-500 dark:text-slate-400">{{ r.entityId ?? "—" }}</div>
            </td>
          </tr>

          <tr v-if="!rows.length">
            <td colspan="4" class="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Nenhum evento.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
      <button
        type="button"
        class="rounded-lg border px-2 py-1 disabled:opacity-60 dark:border-slate-800"
        :disabled="loading || page <= 1"
        @click="load(page - 1)"
      >
        ←
      </button>

      <div>Página {{ page }} (total: {{ total }})</div>

      <button
        type="button"
        class="rounded-lg border px-2 py-1 disabled:opacity-60 dark:border-slate-800"
        :disabled="loading || page * pageSize >= total"
        @click="load(page + 1)"
      >
        →
      </button>
    </div>

    <div v-if="loading" class="text-xs text-slate-500 dark:text-slate-400">Carregando…</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { listAuditLogs, type AuditRow } from "../adminApi";

const loading = ref(false);
const err = ref("");

const rows = ref<AuditRow[]>([]);
const page = ref(1);
const pageSize = ref(50);
const total = ref(0);

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

async function load(p = 1) {
  loading.value = true;
  err.value = "";
  try {
    const res = await listAuditLogs({ page: p, pageSize: pageSize.value });
    rows.value = res.rows ?? [];
    total.value = res.total ?? 0;
    page.value = res.page ?? p;
  } catch (e: any) {
    err.value = e?.message ?? "Falha ao carregar auditoria";
  } finally {
    loading.value = false;
  }
}

onMounted(() => load(1));
</script>
