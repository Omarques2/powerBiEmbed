<template>
  <div class="min-h-screen bg-slate-50 p-6 dark:bg-slate-950">
    <div class="mx-auto max-w-6xl">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h1 class="text-xl font-semibold text-slate-900 dark:text-slate-100">Admin</h1>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Usuários, permissões e auditoria.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50
                   dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            :disabled="loadingAny"
            @click="reloadCurrentTab"
          >
            {{ loadingAny ? "Carregando..." : "Recarregar" }}
          </button>

          <button
            class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800
                   dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            @click="goBack"
          >
            Voltar
          </button>
        </div>
      </div>

      <div
        v-if="error"
        class="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700
               dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200"
      >
        {{ error }}
      </div>

      <!-- Tabs -->
      <div class="mt-6 flex flex-wrap gap-2">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="rounded-full border px-4 py-2 text-sm font-medium transition
                 dark:border-slate-800"
          :class="tab === t.key
            ? 'border-slate-900 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'"
          @click="tab = t.key"
        >
          {{ t.label }}
        </button>
      </div>

      <!-- ========================= -->
      <!-- TAB: PENDING USERS -->
      <!-- ========================= -->
      <div v-if="tab === 'pending'" class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div class="lg:col-span-2">
          <div
            class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm
                   dark:border-slate-800 dark:bg-slate-900"
          >
            <div class="flex items-center justify-between">
              <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Usuários pendentes ({{ pending.length }})
              </div>
            </div>

            <div v-if="pending.length === 0 && !loadingPending" class="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Nenhum usuário pendente no momento.
            </div>

            <div class="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
              <button
                v-for="u in pending"
                :key="u.id"
                class="w-full px-2 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                :class="selectedPending?.id === u.id ? 'bg-slate-50 dark:bg-slate-800' : ''"
                @click="selectPending(u)"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <div class="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {{ u.display_name ?? "—" }}
                    </div>
                    <div class="truncate text-xs text-slate-600 dark:text-slate-300">
                      {{ u.email ?? "sem email" }}
                    </div>
                  </div>

                  <div class="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                    {{ fmtDate(u.created_at) }}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        <div>
          <div
            class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm
                   dark:border-slate-800 dark:bg-slate-900"
          >
            <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Aprovação
            </div>

            <div v-if="!selectedPending" class="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Selecione um usuário pendente à esquerda.
            </div>

            <div v-else class="mt-3 space-y-3">
              <div class="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
                <div class="font-medium text-slate-900 dark:text-slate-100">
                  {{ selectedPending.display_name ?? "—" }}
                </div>
                <div class="text-xs text-slate-600 dark:text-slate-300">
                  {{ selectedPending.email ?? "sem email" }}
                </div>
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-700 dark:text-slate-300">Customer</label>
                <select
                  v-model="pendingCustomerId"
                  class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                         dark:border-slate-800 dark:bg-slate-900"
                >
                  <option value="" disabled>Selecione…</option>
                  <option v-for="c in customersActiveFirst" :key="c.id" :value="c.id">
                    {{ c.name }} ({{ c.code }}) — {{ c.status }}
                  </option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-700 dark:text-slate-300">Role</label>
                <select
                  v-model="pendingRole"
                  class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                         dark:border-slate-800 dark:bg-slate-900"
                >
                  <option value="viewer">viewer</option>
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                  <option value="owner">owner</option>
                </select>
              </div>

              <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input type="checkbox" v-model="pendingGrantCustomerWorkspaces" />
                Conceder workspaces do customer automaticamente
              </label>

              <div class="flex gap-2">
                <button
                  class="flex-1 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800
                         disabled:opacity-60 disabled:cursor-not-allowed
                         dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                  :disabled="savingPending || !pendingCustomerId"
                  @click="approvePending"
                >
                  {{ savingPending ? "Ativando..." : "Ativar" }}
                </button>

                <button
                  class="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 hover:bg-red-100
                         disabled:opacity-60 disabled:cursor-not-allowed
                         dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/55"
                  :disabled="savingPending"
                  @click="disablePending"
                >
                  {{ savingPending ? "..." : "Desativar" }}
                </button>
              </div>

              <div v-if="pendingActionMsg" class="text-xs text-slate-600 dark:text-slate-300">
                {{ pendingActionMsg }}
              </div>
            </div>
          </div>

          <div class="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Observação: esta aba aprova “pendentes”. Para permissões finas, use “Usuários ativos”.
          </div>
        </div>
      </div>

      <div v-if="tab === 'powerbi'" class="mt-6">
        <PowerBiOpsPanel :customers="customersActiveFirst" />
      </div>

      <!-- ========================= -->
      <!-- TAB: ACTIVE USERS + PERMS -->
      <!-- ========================= -->
      <div v-if="tab === 'active'" class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- Active list -->
        <div class="lg:col-span-1">
          <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div class="flex items-center justify-between gap-2">
              <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Usuários ativos
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-400">
                {{ activePaged.total }}
              </div>
            </div>

            <div class="mt-3 flex gap-2">
              <input
                v-model="activeQuery"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                       dark:border-slate-800 dark:bg-slate-950"
                placeholder="Buscar (email ou nome)..."
                @keydown.enter="loadActiveUsers(1)"
              />
              <button
                class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50
                       dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                :disabled="loadingActive"
                @click="loadActiveUsers(1)"
              >
                OK
              </button>
            </div>

            <div v-if="loadingActive" class="mt-3 text-xs text-slate-500 dark:text-slate-400">Carregando...</div>

            <div class="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
              <button
                v-for="u in activePaged.rows"
                :key="u.id"
                class="w-full px-2 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                :class="selectedActive?.id === u.id ? 'bg-slate-50 dark:bg-slate-800' : ''"
                @click="selectActive(u)"
              >
                <div class="min-w-0">
                  <div class="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {{ u.display_name ?? "—" }}
                  </div>
                  <div class="truncate text-xs text-slate-600 dark:text-slate-300">
                    {{ u.email ?? "sem email" }}
                  </div>
                  <div class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    last login: {{ u.last_login_at ? fmtDate(u.last_login_at) : "—" }}
                  </div>
                </div>
              </button>
            </div>

            <!-- pagination -->
            <div class="mt-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
              <button
                class="rounded-lg border px-2 py-1 dark:border-slate-800"
                :disabled="activePaged.page <= 1 || loadingActive"
                @click="loadActiveUsers(activePaged.page - 1)"
              >
                ←
              </button>
              <div>Página {{ activePaged.page }}</div>
              <button
                class="rounded-lg border px-2 py-1 dark:border-slate-800"
                :disabled="loadingActive || activePaged.page * activePaged.pageSize >= activePaged.total"
                @click="loadActiveUsers(activePaged.page + 1)"
              >
                →
              </button>
            </div>
          </div>
        </div>

        <!-- Permissions panel -->
        <div class="lg:col-span-2">
          <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Permissões
                </div>
                <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Gerenciar acesso por workspace e report (usuário ativo).
                </div>
              </div>

              <button
                class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50
                       dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                :disabled="!selectedActive || loadingPerms"
                @click="reloadPerms"
              >
                Recarregar permissões
              </button>
            </div>

            <div v-if="!selectedActive" class="mt-4 text-sm text-slate-600 dark:text-slate-300">
              Selecione um usuário ativo na lista à esquerda.
            </div>

            <div v-else class="mt-4">
              <div class="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
                <div class="font-medium text-slate-900 dark:text-slate-100">
                  {{ selectedActive.display_name ?? "—" }}
                </div>
                <div class="text-xs text-slate-600 dark:text-slate-300">
                  {{ selectedActive.email ?? "sem email" }}
                </div>
              </div>

              <div v-if="loadingPerms" class="mt-4 text-xs text-slate-500 dark:text-slate-400">
                Carregando permissões...
              </div>

              <div v-else-if="perms" class="mt-4 space-y-4">
                <!-- customer context -->
                <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label class="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Customer (contexto)
                    </label>
                    <select
                      v-model="permsCustomerId"
                      class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                             dark:border-slate-800 dark:bg-slate-950"
                      @change="reloadPerms"
                    >
                      <option v-for="m in perms.memberships" :key="m.customerId" :value="m.customerId">
                        {{ m.customer.name }} ({{ m.customer.code }})
                      </option>
                    </select>
                    <div class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      Dica: memberships ativas definem quais customers fazem sentido para o usuário.
                    </div>
                  </div>

                  <div class="flex items-end">
                    <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                      <input type="checkbox" v-model="grantReportsOnWorkspaceEnable" />
                      Ao habilitar um workspace, conceder reports automaticamente
                    </label>
                  </div>
                </div>

                <!-- workspaces -->
                <div v-if="perms.workspaces.length === 0" class="text-sm text-slate-600 dark:text-slate-300">
                  Nenhum workspace ativo encontrado para o customer selecionado.
                </div>

                <div v-for="ws in perms.workspaces" :key="ws.workspaceRefId" class="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                  <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0">
                      <div class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {{ ws.name }}
                      </div>
                      <div class="truncate text-xs text-slate-500 dark:text-slate-400">
                        workspaceId: {{ ws.workspaceId }}
                      </div>
                    </div>

                    <button
                      class="rounded-full px-4 py-2 text-sm font-medium transition"
                      :class="ws.canView
                        ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100'
                        : 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100'"
                      :disabled="savingPerm"
                      @click="toggleWorkspace(ws)"
                    >
                      {{ ws.canView ? "Workspace: ON" : "Workspace: OFF" }}
                    </button>
                  </div>

                  <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                    <button
                      v-for="r in ws.reports"
                      :key="r.reportRefId"
                      class="rounded-xl border px-3 py-2 text-left text-sm transition
                             dark:border-slate-800"
                      :class="r.canView
                        ? 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/15 dark:border-emerald-900/40'
                        : 'border-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-950'"
                      :disabled="savingPerm || !ws.canView"
                      @click="toggleReport(r)"
                      :title="!ws.canView ? 'Habilite o workspace primeiro' : ''"
                    >
                      <div class="truncate font-medium text-slate-900 dark:text-slate-100">
                        {{ r.name }}
                      </div>
                      <div class="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                        {{ r.canView ? "Report: ON" : "Report: OFF" }} — {{ r.reportId }}
                      </div>
                    </button>
                  </div>
                </div>

                <div v-if="permMsg" class="text-xs text-slate-600 dark:text-slate-300">
                  {{ permMsg }}
                </div>
              </div>
            </div>
          </div>

          <div class="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Nota: seu runtime enforcement já está correto (BiAuthz exige workspace + report). Aqui só damos tooling para o admin.
          </div>
        </div>
      </div>

      <!-- ========================= -->
      <!-- TAB: AUDIT -->
      <!-- ========================= -->
      <div v-if="tab === 'audit'" class="mt-6">
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Auditoria
              </div>
              <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Paginação por data desc. Use filtros para reduzir volume.
              </div>
            </div>

            <div class="flex flex-wrap gap-2">
              <input v-model="auditFilter.action" class="rounded-xl border px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950" placeholder="action" />
              <input v-model="auditFilter.entityType" class="rounded-xl border px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950" placeholder="entityType" />
              <input v-model="auditFilter.entityId" class="rounded-xl border px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950" placeholder="entityId" />
              <button
                class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50
                       dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                :disabled="loadingAudit"
                @click="loadAudit(1)"
              >
                Filtrar
              </button>
            </div>
          </div>

          <div v-if="loadingAudit" class="mt-3 text-xs text-slate-500 dark:text-slate-400">Carregando...</div>

          <div v-else class="mt-4 overflow-auto">
            <table class="min-w-full text-left text-sm">
              <thead class="text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th class="py-2 pr-4">Quando</th>
                  <th class="py-2 pr-4">Actor</th>
                  <th class="py-2 pr-4">Action</th>
                  <th class="py-2 pr-4">Entity</th>
                  <th class="py-2 pr-4">IP</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                <tr v-for="r in auditPaged.rows" :key="r.id">
                  <td class="py-2 pr-4 whitespace-nowrap">{{ fmtDate(r.createdAt) }}</td>
                  <td class="py-2 pr-4">
                    <div class="text-sm text-slate-900 dark:text-slate-100">
                      {{ r.actor?.displayName ?? "—" }}
                    </div>
                    <div class="text-xs text-slate-500 dark:text-slate-400">
                      {{ r.actor?.email ?? r.actorUserId ?? "—" }}
                    </div>
                  </td>
                  <td class="py-2 pr-4 font-medium text-slate-900 dark:text-slate-100">{{ r.action }}</td>
                  <td class="py-2 pr-4">
                    <div class="text-sm text-slate-900 dark:text-slate-100">{{ r.entityType }}</div>
                    <div class="text-xs text-slate-500 dark:text-slate-400">{{ r.entityId ?? "—" }}</div>
                  </td>
                  <td class="py-2 pr-4 text-xs text-slate-500 dark:text-slate-400">{{ r.ip ?? "—" }}</td>
                </tr>
              </tbody>
            </table>

            <div class="mt-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
              <button
                class="rounded-lg border px-2 py-1 dark:border-slate-800"
                :disabled="auditPaged.page <= 1 || loadingAudit"
                @click="loadAudit(auditPaged.page - 1)"
              >
                ←
              </button>
              <div>Página {{ auditPaged.page }} ({{ auditPaged.total }})</div>
              <button
                class="rounded-lg border px-2 py-1 dark:border-slate-800"
                :disabled="loadingAudit || auditPaged.page * auditPaged.pageSize >= auditPaged.total"
                @click="loadAudit(auditPaged.page + 1)"
              >
                →
              </button>
            </div>
          </div>
        </div>

        <div class="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Próximo upgrade fácil: ao clicar na linha, abrir um drawer/modal mostrando before/after JSON formatado.
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  type CustomerRow,
  type PendingUserRow,
  activateUser,
  disableUser,
  listCustomers,
  listPendingUsers,
  listActiveUsers,
  getUserPermissions,
  setWorkspacePermission,
  setReportPermission,
  listAuditLogs,
  type ActiveUserRow,
} from "../admin/adminApi";
import PowerBiOpsPanel from "../admin/PowerBiOpsPanel.vue";

const router = useRouter();

const tabs = [
  { key: "pending", label: "Pendentes" },
  { key: "active", label: "Usuários ativos" },
  { key: "audit", label: "Auditoria" },
  { key: "powerbi", label: "Power BI" },
] as const;

type TabKey = typeof tabs[number]["key"];
const tab = ref<TabKey>("pending");

const error = ref("");

// ---------- shared helpers ----------
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function goBack() {
  router.replace("/app");
}

const loadingAny = computed(() => loadingPending.value || loadingActive.value || loadingPerms.value || loadingAudit.value);

// ---------- PENDING ----------
const loadingPending = ref(false);
const savingPending = ref(false);

const pending = ref<PendingUserRow[]>([]);
const customers = ref<CustomerRow[]>([]);
const selectedPending = ref<PendingUserRow | null>(null);

const pendingCustomerId = ref<string>("");
const pendingRole = ref<"owner" | "admin" | "member" | "viewer">("viewer");
const pendingGrantCustomerWorkspaces = ref(true);
const pendingActionMsg = ref("");

const customersActiveFirst = computed(() => {
  const arr = [...customers.value];
  arr.sort((a, b) => {
    const aa = a.status === "active" ? 0 : 1;
    const bb = b.status === "active" ? 0 : 1;
    if (aa !== bb) return aa - bb;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });
  return arr;
});

function selectPending(u: PendingUserRow) {
  selectedPending.value = u;
  pendingCustomerId.value = "";
  pendingRole.value = "viewer";
  pendingGrantCustomerWorkspaces.value = true;
  pendingActionMsg.value = "";
}

async function loadPending() {
  loadingPending.value = true;
  try {
    const [p, c] = await Promise.all([listPendingUsers(), listCustomers()]);
    pending.value = p;
    customers.value = c;

    if (selectedPending.value && !pending.value.find(x => x.id === selectedPending.value!.id)) {
      selectedPending.value = null;
      pendingCustomerId.value = "";
    }
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? String(e);
  } finally {
    loadingPending.value = false;
  }
}

async function approvePending() {
  if (!selectedPending.value || !pendingCustomerId.value) return;

  savingPending.value = true;
  error.value = "";
  pendingActionMsg.value = "";
  try {
    await activateUser(selectedPending.value.id, {
      customerId: pendingCustomerId.value,
      role: pendingRole.value,
      grantCustomerWorkspaces: pendingGrantCustomerWorkspaces.value,
    });
    pendingActionMsg.value = "Usuário ativado com sucesso.";
    await loadPending();
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? String(e);
  } finally {
    savingPending.value = false;
  }
}

async function disablePending() {
  if (!selectedPending.value) return;
  const ok = window.confirm("Confirmar desativação deste usuário?");
  if (!ok) return;

  savingPending.value = true;
  error.value = "";
  pendingActionMsg.value = "";
  try {
    await disableUser(selectedPending.value.id);
    pendingActionMsg.value = "Usuário desativado.";
    await loadPending();
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? String(e);
  } finally {
    savingPending.value = false;
  }
}

// ---------- ACTIVE + PERMS ----------
const loadingActive = ref(false);
const activeQuery = ref("");
const activePaged = ref({ page: 1, pageSize: 25, total: 0, rows: [] as ActiveUserRow[] });

const selectedActive = ref<ActiveUserRow | null>(null);

const loadingPerms = ref(false);
const savingPerm = ref(false);
const perms = ref<any | null>(null);
const permsCustomerId = ref<string>("");
const permMsg = ref("");
const grantReportsOnWorkspaceEnable = ref(true);

async function loadActiveUsers(page = 1) {
  loadingActive.value = true;
  error.value = "";
  try {
    const data = await listActiveUsers(activeQuery.value, page, activePaged.value.pageSize);
    activePaged.value = data;

    if (selectedActive.value && !data.rows.find(x => x.id === selectedActive.value!.id)) {
      selectedActive.value = null;
      perms.value = null;
      permsCustomerId.value = "";
    }
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? String(e);
  } finally {
    loadingActive.value = false;
  }
}

async function selectActive(u: ActiveUserRow) {
  selectedActive.value = u;
  permMsg.value = "";
  await reloadPerms();
}

async function reloadPerms() {
  if (!selectedActive.value) return;
  loadingPerms.value = true;
  error.value = "";
  permMsg.value = "";
  try {
    const data = await getUserPermissions(selectedActive.value.id, permsCustomerId.value || undefined);
    perms.value = data;

    // define customer default (primeiro membership)
    if (!permsCustomerId.value) {
      const first = data.memberships?.[0]?.customerId ?? "";
      permsCustomerId.value = first;
      if (first) {
        const again = await getUserPermissions(selectedActive.value.id, first);
        perms.value = again;
      }
    }
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? String(e);
  } finally {
    loadingPerms.value = false;
  }
}

async function toggleWorkspace(ws: any) {
  if (!selectedActive.value) return;
  savingPerm.value = true;
  error.value = "";
  permMsg.value = "";
  try {
    const next = !ws.canView;
    const res = await setWorkspacePermission(
      selectedActive.value.id,
      ws.workspaceRefId,
      next,
      grantReportsOnWorkspaceEnable.value,
    );

    permMsg.value = next
      ? `Workspace habilitado. Reports afetados: ${res.reportsAffected ?? 0}.`
      : `Workspace desabilitado. Reports desabilitados: ${res.reportsAffected ?? 0}.`;

    await reloadPerms();
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? String(e);
  } finally {
    savingPerm.value = false;
  }
}

async function toggleReport(r: any) {
  if (!selectedActive.value) return;
  savingPerm.value = true;
  error.value = "";
  permMsg.value = "";
  try {
    await setReportPermission(selectedActive.value.id, r.reportRefId, !r.canView);
    permMsg.value = !r.canView ? "Report habilitado." : "Report desabilitado.";
    await reloadPerms();
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? String(e);
  } finally {
    savingPerm.value = false;
  }
}

// ---------- AUDIT ----------
const loadingAudit = ref(false);
const auditPaged = ref({ page: 1, pageSize: 50, total: 0, rows: [] as any[] });

const auditFilter = ref({
  action: "",
  entityType: "",
  entityId: "",
});

async function loadAudit(page = 1) {
  loadingAudit.value = true;
  error.value = "";
  try {
    const data = await listAuditLogs({
      page,
      pageSize: auditPaged.value.pageSize,
      action: auditFilter.value.action || undefined,
      entityType: auditFilter.value.entityType || undefined,
      entityId: auditFilter.value.entityId || undefined,
    });
    auditPaged.value = data;
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? String(e);
  } finally {
    loadingAudit.value = false;
  }
}

// ---------- tab lifecycle ----------
async function reloadCurrentTab() {
  error.value = "";
  if (tab.value === "pending") return loadPending();
  if (tab.value === "active") {
    await loadActiveUsers(activePaged.value.page || 1);
    if (selectedActive.value) await reloadPerms();
    return;
  }
  if (tab.value === "audit") return loadAudit(auditPaged.value.page || 1);
}

watch(tab, async (t) => {
  error.value = "";
  if (t === "pending" && pending.value.length === 0) await loadPending();
  if (t === "active" && activePaged.value.rows.length === 0) await loadActiveUsers(1);
  if (t === "audit" && auditPaged.value.rows.length === 0) await loadAudit(1);
});

onMounted(async () => {
  await loadPending();
});
</script>
