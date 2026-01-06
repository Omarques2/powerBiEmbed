<template>
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <!-- PASSO A -->
    <section
      class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">Workspaces</div>
          <div class="mt-1 text-xs text-slate-600 dark:text-slate-300">
            Workspaces que o service principal enxerga.
          </div>
        </div>

        <button
          type="button"
          class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50
                 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
          :disabled="loadingRemote"
          @click="loadRemoteWorkspaces()"
        >
          {{ loadingRemote ? "Carregando..." : "Recarregar" }}
        </button>
      </div>

      <div
        v-if="remoteError"
        class="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700
               dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200"
      >
        {{ remoteError }}
      </div>

      <div class="mt-3 space-y-2">
        <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
          <input type="checkbox" v-model="selectAllRemote" @change="toggleSelectAll" />
          Selecionar todos (para sync)
        </label>

        <div class="max-h-[420px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <div v-if="remoteWorkspaces.length === 0" class="p-3 text-xs text-slate-500 dark:text-slate-400">
            Nenhum workspace remoto carregado.
          </div>

          <label
            v-for="w in remoteWorkspaces"
            :key="w.id"
            class="flex cursor-pointer items-center gap-2 border-b border-slate-200 p-2 text-xs last:border-b-0
                   hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
          >
            <input type="checkbox" :value="w.id" v-model="selectedWorkspaceIds" />
            <span class="min-w-0 flex-1">
              <div class="truncate font-medium text-slate-900 dark:text-slate-100">{{ w.name }}</div>
              <div class="truncate text-[11px] text-slate-500 dark:text-slate-400">{{ w.id }}</div>
            </span>

            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] hover:bg-slate-50
                     disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
              @click.prevent="peekRemoteReports(w.id)"
              :disabled="loadingReportsByWs[w.id]"
              title="Ver reports remotos"
            >
              {{ loadingReportsByWs[w.id] ? "..." : "Reports" }}
            </button>
          </label>
        </div>

        <div
          v-if="peekReports.workspaceId"
          class="mt-3 rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800"
        >
          <div class="font-semibold text-slate-900 dark:text-slate-100">Reports (remoto)</div>
          <div class="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
            {{ peekReports.workspaceId }}
          </div>

          <div v-if="peekReports.items.length === 0" class="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Nenhum report (ou sem permissão de listar).
          </div>

          <ul v-else class="mt-2 space-y-1">
            <li v-for="r in peekReports.items" :key="r.id" class="truncate">
              <span class="font-medium">{{ r.name ?? r.id }}</span>
              <span class="text-slate-500 dark:text-slate-400"> — {{ r.id }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- PASSO B -->
    <section
      class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div>
        <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">Sync por customer</div>
        <div class="mt-1 text-xs text-slate-600 dark:text-slate-300">
          Persiste workspaces/reports no BD (bi_workspaces / bi_reports).
        </div>
      </div>

      <div class="mt-3 space-y-3">
        <div>
          <label class="block text-xs font-medium text-slate-700 dark:text-slate-300">Customer</label>
          <select
            v-model="customerId"
            class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                   dark:border-slate-800 dark:bg-slate-900"
          >
            <option value="" disabled>Selecione…</option>
            <option v-for="c in customers" :key="c.id" :value="c.id">
              {{ c.name }} ({{ c.code }})
            </option>
          </select>
        </div>

        <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
          <input type="checkbox" v-model="deactivateMissing" />
          deactivateMissing (marcar como inativo o que sumiu)
        </label>

        <div class="text-[11px] text-slate-500 dark:text-slate-400">
          Sync usará <span class="font-medium">workspaces selecionados no Passo A</span>.
          Se nenhum selecionado, sincroniza todos os remotos.
        </div>

        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800
                   disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            :disabled="!customerId || syncing"
            @click="runSync()"
          >
            {{ syncing ? "Sincronizando..." : "Rodar sync" }}
          </button>

          <button
            type="button"
            class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50
                   disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            :disabled="!customerId || loadingCatalog"
            @click="loadCatalog()"
            title="Recarregar catálogo do BD"
          >
            {{ loadingCatalog ? "..." : "Ver BD" }}
          </button>
        </div>

        <div v-if="syncResult" class="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
          <div class="font-semibold text-slate-900 dark:text-slate-100">Resultado</div>
          <div class="mt-1 text-slate-700 dark:text-slate-200">
            workspacesSeenRemote: <span class="font-medium">{{ syncResult.workspacesSeenRemote }}</span><br />
            workspacesUpserted: <span class="font-medium">{{ syncResult.workspacesUpserted }}</span><br />
            reportsUpserted: <span class="font-medium">{{ syncResult.reportsUpserted }}</span><br />
            reportsDeactivated: <span class="font-medium">{{ syncResult.reportsDeactivated }}</span>
          </div>
        </div>

        <div
          v-if="catalogError"
          class="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700
                 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200"
        >
          {{ catalogError }}
        </div>

        <div v-if="catalog" class="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
          <div class="flex items-center justify-between">
            <div class="font-semibold text-slate-900 dark:text-slate-100">Catálogo no BD</div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400">
              {{ catalog.workspaces.length }} workspaces
            </div>
          </div>

          <div class="mt-2 max-h-[360px] overflow-auto space-y-2">
            <div
              v-for="w in catalog.workspaces"
              :key="w.workspaceRefId"
              class="rounded-xl border border-slate-200 p-2 dark:border-slate-800"
            >
              <!-- HEADER DO CARD (aqui vai o botão) -->
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="truncate font-medium text-slate-900 dark:text-slate-100">
                    {{ w.name }}
                    <span class="ml-2 text-[11px]" :class="w.isActive ? 'text-emerald-600' : 'text-slate-500'">
                      {{ w.isActive ? "active" : "inactive" }}
                    </span>
                  </div>
                  <div class="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {{ w.workspaceId }}
                  </div>
                  <div class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {{ w.reports.length }} reports
                  </div>
                </div>

                <button
                  type="button"
                  class="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] hover:bg-slate-50
                         disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                  :disabled="!customerId || !w.isActive || unlinking[w.workspaceRefId]"
                  @click.stop="unlinkWorkspace(w.workspaceRefId)"
                  title="Desvincular (desativa workspace, reports e revoga permissões)"
                >
                  {{ unlinking[w.workspaceRefId] ? "..." : "Desvincular" }}
                </button>
              </div>

              <ul class="mt-2 space-y-1">
                <li v-for="r in w.reports.slice(0, 8)" :key="r.reportRefId" class="truncate text-[11px]">
                  {{ r.name }}
                  <span class="text-slate-500 dark:text-slate-400">— {{ r.reportId }}</span>
                </li>
              </ul>

              <div v-if="w.reports.length > 8" class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                +{{ w.reports.length - 8 }}…
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- PASSO C -->
    <section
      class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div>
        <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">Usuários ativos</div>
        <div class="mt-1 text-xs text-slate-600 dark:text-slate-300">
          Base para permissões (listActiveUsers).
        </div>
      </div>

      <div class="mt-3 space-y-3">
        <div class="flex gap-2">
          <input
            v-model="userSearch"
            type="text"
            class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                   dark:border-slate-800 dark:bg-slate-900"
            placeholder="Buscar por nome/email…"
          />
          <button
            type="button"
            class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800
                   disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            :disabled="loadingUsers"
            @click="loadUsers()"
          >
            {{ loadingUsers ? "..." : "Buscar" }}
          </button>
        </div>

        <div
          v-if="permError"
          class="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700
                 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200"
        >
          {{ permError }}
        </div>

        <div class="max-h-[520px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <div v-if="users.length === 0" class="p-3 text-xs text-slate-500 dark:text-slate-400">
            Nenhum usuário encontrado.
          </div>

          <div
            v-for="u in users"
            :key="u.id"
            class="border-b border-slate-200 p-3 text-xs last:border-b-0 dark:border-slate-800"
          >
            <div class="truncate font-medium text-slate-900 dark:text-slate-100">
              {{ (u as any).name ?? (u as any).displayName ?? (u as any).email ?? u.id }}
            </div>
            <div class="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {{ (u as any).email ?? (u as any).upn ?? "" }}
            </div>
            <div class="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {{ u.id }}
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from "vue";
import type { CustomerRow, ActiveUserRow } from "./adminApi";
import {
  listRemoteWorkspaces,
  listRemoteReports,
  syncPowerBiCatalog,
  getPowerBiCatalog,
  listActiveUsers,
  unlinkCustomerWorkspace,
} from "./adminApi";

const props = defineProps<{
  customers: CustomerRow[];
}>();

// Passo A
const remoteWorkspaces = ref<Array<{ id: string; name: string }>>([]);
const loadingRemote = ref(false);
const remoteError = ref("");

const selectedWorkspaceIds = ref<string[]>([]);
const selectAllRemote = ref(false);

const loadingReportsByWs = reactive<Record<string, boolean>>({});
const peekReports = ref<{ workspaceId: string; items: any[] }>({ workspaceId: "", items: [] });

function toggleSelectAll() {
  if (selectAllRemote.value) {
    selectedWorkspaceIds.value = remoteWorkspaces.value.map((w) => w.id);
  } else {
    selectedWorkspaceIds.value = [];
  }
}

watch(selectedWorkspaceIds, () => {
  selectAllRemote.value =
    remoteWorkspaces.value.length > 0 &&
    selectedWorkspaceIds.value.length === remoteWorkspaces.value.length;
});

watch(remoteWorkspaces, () => {
  // Remove seleções que não existem mais após reload
  const valid = new Set(remoteWorkspaces.value.map((w) => w.id));
  selectedWorkspaceIds.value = selectedWorkspaceIds.value.filter((id) => valid.has(id));

  // Se “Selecionar todos” estiver marcado, re-seleciona tudo do novo snapshot
  if (selectAllRemote.value) {
    selectedWorkspaceIds.value = remoteWorkspaces.value.map((w) => w.id);
  }
});

async function loadRemoteWorkspaces() {
  loadingRemote.value = true;
  remoteError.value = "";
  try {
    const ws = await listRemoteWorkspaces();
    remoteWorkspaces.value = ws.map((w) => ({ id: w.id, name: w.name }));
  } catch (e: any) {
    remoteError.value = e?.response?.data?.message ?? e?.message ?? "Falha ao carregar workspaces remotos";
  } finally {
    loadingRemote.value = false;
  }
}

async function peekRemoteReports(workspaceId: string) {
  loadingReportsByWs[workspaceId] = true;
  try {
    const reps = await listRemoteReports(workspaceId);
    peekReports.value = { workspaceId, items: reps };
  } catch {
    peekReports.value = { workspaceId, items: [] };
  } finally {
    loadingReportsByWs[workspaceId] = false;
  }
}

// Passo B
const customerId = ref("");
const deactivateMissing = ref(false);
const syncing = ref(false);
const syncResult = ref<any>(null);

const loadingCatalog = ref(false);
const catalogError = ref("");
const catalog = ref<any>(null);

const unlinking = reactive<Record<string, boolean>>({});

async function unlinkWorkspace(workspaceRefId: string) {
  if (!customerId.value) return;
  unlinking[workspaceRefId] = true;
  try {
    await unlinkCustomerWorkspace(customerId.value, workspaceRefId);
    await loadCatalog();
  } catch (e: any) {
    catalogError.value = e?.response?.data?.message ?? e?.message ?? "Falha ao desvincular workspace";
  } finally {
    unlinking[workspaceRefId] = false;
  }
}

async function runSync() {
  if (!customerId.value) return;
  syncing.value = true;
  syncResult.value = null;
  catalogError.value = "";
  try {
    const payload: any = {
      customerId: customerId.value,
      deactivateMissing: deactivateMissing.value,
    };
    if (selectedWorkspaceIds.value.length) payload.workspaceIds = selectedWorkspaceIds.value;

    syncResult.value = await syncPowerBiCatalog(payload);
    await loadCatalog();
  } catch (e: any) {
    catalogError.value = e?.response?.data?.message ?? e?.message ?? "Falha no sync";
  } finally {
    syncing.value = false;
  }
}

async function loadCatalog() {
  if (!customerId.value) return;
  loadingCatalog.value = true;
  catalogError.value = "";
  try {
    catalog.value = await getPowerBiCatalog(customerId.value);
  } catch (e: any) {
    catalogError.value = e?.response?.data?.message ?? e?.message ?? "Falha ao carregar catálogo do BD";
  } finally {
    loadingCatalog.value = false;
  }
}

// Passo C
const userSearch = ref("");
const users = ref<ActiveUserRow[]>([]);
const loadingUsers = ref(false);
const permError = ref("");

async function loadUsers() {
  loadingUsers.value = true;
  permError.value = "";
  try {
    const res = await listActiveUsers(userSearch.value, 1, 25);
    users.value = res.rows;
  } catch (e: any) {
    permError.value = e?.response?.data?.message ?? e?.message ?? "Falha ao buscar usuários";
  } finally {
    loadingUsers.value = false;
  }
}

onMounted(async () => {
  await loadRemoteWorkspaces();
  await loadUsers();
});
</script>
