<!-- apps/web/src/admin/tabs/ActiveUsersPermsTab.vue -->
<template>
  <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
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
            :value="activeQuery"
            class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                   dark:border-slate-800 dark:bg-slate-950"
            placeholder="Buscar (email ou nome)..."
            @input="$emit('update:activeQuery', ($event.target as HTMLInputElement).value)"
            @keydown.enter="$emit('loadActiveUsers', 1)"
          />
          <button
            type="button"
            class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50
                   dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            :disabled="loadingActive"
            @click="$emit('loadActiveUsers', 1)"
          >
            OK
          </button>
        </div>

        <div v-if="loadingActive" class="mt-3 text-xs text-slate-500 dark:text-slate-400">Carregando...</div>

        <div class="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
          <button
            v-for="u in activePaged.rows"
            :key="u.id"
            type="button"
            class="w-full px-2 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
            :class="selectedActive?.id === u.id ? 'bg-slate-50 dark:bg-slate-800' : ''"
            @click="$emit('selectActive', u)"
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
            type="button"
            class="rounded-lg border px-2 py-1 dark:border-slate-800"
            :disabled="activePaged.page <= 1 || loadingActive"
            @click="$emit('loadActiveUsers', activePaged.page - 1)"
          >
            ←
          </button>
          <div>Página {{ activePaged.page }}</div>
          <button
            type="button"
            class="rounded-lg border px-2 py-1 dark:border-slate-800"
            :disabled="loadingActive || activePaged.page * activePaged.pageSize >= activePaged.total"
            @click="$emit('loadActiveUsers', activePaged.page + 1)"
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
              Gerenciar memberships e acesso por workspace/report (usuário ativo).
            </div>
          </div>

          <button
            type="button"
            class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50
                   dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            :disabled="!selectedActive || loadingPerms"
            @click="$emit('reloadPerms')"
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
            <!-- Membership editor -->
            <UserMembershipEditor
              :user-id="selectedActive.id"
              :memberships="perms.memberships"
              @refresh="$emit('refreshSelectedUser')"
            />

            <!-- customer context -->
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label class="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Customer (contexto)
                </label>
                <select
                  :value="permsCustomerId"
                  class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                         dark:border-slate-800 dark:bg-slate-950"
                  @change="
                    $emit('update:permsCustomerId', ($event.target as HTMLSelectElement).value);
                    $emit('reloadPerms');
                  "
                >
                  <option v-for="m in permsMembershipOptions" :key="m.customerId" :value="m.customerId">
                    {{ m.customer.name }} ({{ m.customer.code }}) <span v-if="!m.isActive">— inativo</span>
                  </option>
                </select>
                <div class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Dica: o contexto controla quais workspaces/reports são exibidos abaixo.
                </div>
              </div>

              <div class="flex items-end">
                <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    :checked="grantReportsOnWorkspaceEnable"
                    @change="$emit('update:grantReportsOnWorkspaceEnable', ($event.target as HTMLInputElement).checked)"
                  />
                  Ao habilitar um workspace, conceder reports automaticamente
                </label>
              </div>
            </div>

            <!-- workspaces -->
            <div v-if="perms.workspaces.length === 0" class="text-sm text-slate-600 dark:text-slate-300">
              Nenhum workspace ativo encontrado para o customer selecionado.
            </div>

            <div
              v-for="ws in perms.workspaces"
              :key="ws.workspaceRefId"
              class="rounded-2xl border border-slate-200 p-3 dark:border-slate-800"
            >
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
                  type="button"
                  class="rounded-full px-4 py-2 text-sm font-medium transition"
                  :class="ws.canView
                    ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100'
                    : 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100'"
                  :disabled="savingPerm"
                  @click="$emit('toggleWorkspace', ws)"
                >
                  {{ ws.canView ? "Workspace: ON" : "Workspace: OFF" }}
                </button>
              </div>

              <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                <button
                  v-for="r in ws.reports"
                  :key="r.reportRefId"
                  type="button"
                  class="rounded-xl border px-3 py-2 text-left text-sm transition
                         dark:border-slate-800"
                  :class="r.canView
                    ? 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/15 dark:border-emerald-900/40'
                    : 'border-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-950'"
                  :disabled="savingPerm || !ws.canView"
                  @click="$emit('toggleReport', r)"
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
</template>

<script setup lang="ts">
import UserMembershipEditor from "../UserMembershipEditor.vue";
import type { ActiveUserRow } from "@/features/admin/api";

export type MembershipRole = "owner" | "admin" | "member" | "viewer";

export type MembershipRow = {
  customerId: string;
  role: MembershipRole;
  isActive: boolean;
  customer: { id: string; code: string; name: string; status: string };
};

export type ReportPermRow = {
  reportRefId: string;
  reportId: string;
  name: string;
  canView: boolean;
};

export type WorkspacePermRow = {
  workspaceRefId: string;
  workspaceId: string;
  name: string;
  canView: boolean;
  reports: ReportPermRow[];
};

export type UserPermissionsResponse = {
  memberships: MembershipRow[];
  workspaces: WorkspacePermRow[];
};

defineProps<{
  // left list
  loadingActive: boolean;
  activeQuery: string;
  activePaged: { page: number; pageSize: number; total: number; rows: ActiveUserRow[] };
  selectedActive: ActiveUserRow | null;

  // perms panel
  loadingPerms: boolean;
  savingPerm: boolean;
  perms: UserPermissionsResponse | null;
  permsCustomerId: string;
  permsMembershipOptions: MembershipRow[];
  grantReportsOnWorkspaceEnable: boolean;
  permMsg: string;

  fmtDate: (iso: string) => string;
}>();

defineEmits<{
  // left list
  (e: "update:activeQuery", v: string): void;
  (e: "loadActiveUsers", page: number): void;
  (e: "selectActive", u: ActiveUserRow): void;

  // perms
  (e: "reloadPerms"): void;
  (e: "refreshSelectedUser"): void;

  (e: "update:permsCustomerId", v: string): void;
  (e: "update:grantReportsOnWorkspaceEnable", v: boolean): void;

  (e: "toggleWorkspace", ws: WorkspacePermRow): void;
  (e: "toggleReport", r: ReportPermRow): void;
}>();
</script>
