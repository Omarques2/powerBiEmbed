<!-- apps/web/src/admin/panels/PendingUsersPanel.vue -->
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
      <div class="text-xs text-slate-600 dark:text-slate-300">Usuários pendentes</div>
      <button
        type="button"
        class="rounded-xl border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50
               disabled:opacity-60 dark:border-slate-800 dark:hover:bg-slate-800"
        :disabled="loading"
        @click="refresh"
      >
        Atualizar
      </button>
    </div>

    <div class="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs text-slate-600 dark:bg-slate-950/30 dark:text-slate-300">
          <tr>
            <th class="px-3 py-2 text-left">Email</th>
            <th class="px-3 py-2 text-left">Nome</th>
            <th class="px-3 py-2 text-left">Criado</th>
            <th class="px-3 py-2 text-right">Ações</th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="u in rows"
            :key="u.id"
            class="border-t border-slate-200 dark:border-slate-800"
          >
            <td class="px-3 py-2">{{ u.email ?? "—" }}</td>
            <td class="px-3 py-2">{{ u.display_name ?? "—" }}</td>
            <td class="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
              {{ formatDate(u.created_at) }}
            </td>
            <td class="px-3 py-2 text-right">
              <button
                type="button"
                class="rounded-xl border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50
                       dark:border-slate-800 dark:hover:bg-slate-800"
                @click="$emit('openUser', u.id)"
              >
                Abrir
              </button>
            </td>
          </tr>

          <tr v-if="!rows.length">
            <td colspan="4" class="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Nenhum pendente.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="loading" class="text-xs text-slate-500 dark:text-slate-400">
      Carregando…
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { listPendingUsers, type PendingUserRow } from "@/features/admin/api";
import { useToast } from "@/ui/toast/useToast";
import { normalizeApiError, useBusyMap } from "@/ui/ops";

defineEmits<{
  (e: "openUser", userId: string): void;
}>();

const { push } = useToast();
const busy = useBusyMap();
const loadingInitial = ref(false);
const loading = computed(() => loadingInitial.value || !!busy.map.refresh);
const err = ref("");
const rows = ref<PendingUserRow[]>([]);
const hasLoaded = ref(false);

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

async function load(opts?: { source?: "initial" | "action" }) {
  const source = opts?.source ?? "action";
  const isInitial = source === "initial";
  if (isInitial) {
    err.value = "";
    loadingInitial.value = true;
  }
  try {
    rows.value = await listPendingUsers();
    err.value = "";
    hasLoaded.value = true;
  } catch (e: any) {
    const ne = normalizeApiError(e);
    if (!hasLoaded.value && isInitial) {
      err.value = ne.message;
    } else {
      push({ kind: "error", title: "Falha ao listar pendentes", message: ne.message, details: ne.details });
    }
  } finally {
    if (isInitial) loadingInitial.value = false;
  }
}

async function refresh() {
  await busy.run("refresh", () => load({ source: "action" }));
}

onMounted(() => load({ source: "initial" }));
</script>
