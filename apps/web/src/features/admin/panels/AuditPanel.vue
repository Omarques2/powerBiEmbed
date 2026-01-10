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
        :disabled="loadingInitial || !!busy.map.refresh"
        @click="refresh"
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
        :disabled="loadingInitial || page <= 1 || !!busy.map['page-prev']"
        @click="loadPrev"
      >
        ←
      </button>

      <div>Página {{ page }} (total: {{ total }})</div>

      <button
        type="button"
        class="rounded-lg border px-2 py-1 disabled:opacity-60 dark:border-slate-800"
        :disabled="loadingInitial || page * pageSize >= total || !!busy.map['page-next']"
        @click="loadNext"
      >
        →
      </button>
    </div>

    <div v-if="loadingAny" class="text-xs text-slate-500 dark:text-slate-400">Carregando…</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { listAuditLogs, type AuditRow } from "@/features/admin/api";
import { useToast } from "@/ui/toast/useToast";
import { normalizeApiError, useBusyMap } from "@/ui/ops";

const { push } = useToast();
const busy = useBusyMap();
const loadingInitial = ref(false);
const loadingAny = computed(() => loadingInitial.value || Object.keys(busy.map).length > 0);
const err = ref("");

const rows = ref<AuditRow[]>([]);
const page = ref(1);
const pageSize = ref(50);
const total = ref(0);
const hasLoaded = ref(false);
let requestId = 0;

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

async function load(p = 1, opts?: { source?: "initial" | "action" }) {
  const source = opts?.source ?? "action";
  const isInitial = source === "initial";
  const currentRequest = ++requestId;

  if (isInitial) {
    err.value = "";
    loadingInitial.value = true;
  }
  try {
    const res = await listAuditLogs({ page: p, pageSize: pageSize.value });
    if (currentRequest !== requestId) return;
    rows.value = res.rows ?? [];
    total.value = res.total ?? 0;
    page.value = res.page ?? p;
    err.value = "";
    hasLoaded.value = true;
  } catch (e: any) {
    if (currentRequest !== requestId) return;
    const ne = normalizeApiError(e);
    if (!hasLoaded.value && isInitial) {
      err.value = ne.message;
    } else {
      push({ kind: "error", title: "Falha ao carregar auditoria", message: ne.message, details: ne.details });
    }
  } finally {
    if (isInitial) loadingInitial.value = false;
  }
}

async function refresh() {
  await busy.run("refresh", () => load(page.value, { source: "action" }));
}

async function loadPrev() {
  if (page.value <= 1) return;
  await busy.run("page-prev", () => load(page.value - 1, { source: "action" }));
}

async function loadNext() {
  if (page.value * pageSize.value >= total.value) return;
  await busy.run("page-next", () => load(page.value + 1, { source: "action" }));
}

onMounted(() => load(1, { source: "initial" }));
</script>
