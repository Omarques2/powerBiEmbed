<!-- apps/web/src/features/admin/UsersPanel.vue -->
<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div class="flex flex-wrap items-center gap-2">
      <button
        v-for="t in tabs"
        :key="t.key"
        type="button"
        class="rounded-full border px-4 py-2 text-xs font-semibold transition"
        :class="activeTab === t.key
          ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800'"
        @click="activeTab = t.key"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- TAB: Pending -->
    <div
      v-if="activeTab === 'pending'"
      class="mt-4"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">Usuários pendentes</div>
          <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ pending.length }} pendente(s)</div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <div v-if="selectedPending" class="text-xs text-slate-500 dark:text-slate-400">
            Selecionado: {{ selectedPending.email ?? selectedPending.display_name ?? selectedPending.id }}
          </div>
          <button
            type="button"
            class="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500
                   disabled:opacity-60"
            :disabled="!selectedPending || pendingSaving"
            @click="openActivateModal"
          >
            Ativar
          </button>
          <button
            type="button"
            class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700
                   hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
            :disabled="!selectedPending || pendingSaving"
            @click="openRejectModal"
          >
            Recusar
          </button>
        </div>
      </div>

      <div
        v-if="pendingLoading"
        class="mt-3 text-xs text-slate-500 dark:text-slate-400"
      >
        Carregando...
      </div>
      <div
        v-if="pendingError"
        class="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700
               dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
      >
        {{ pendingError }}
      </div>

      <div class="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
        <button
          v-for="u in pending"
          :key="u.id"
          type="button"
          class="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm
                 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
          :class="selectedPending?.id === u.id ? 'ring-2 ring-emerald-400/50' : ''"
          @click="selectedPending = u"
        >
          <div class="min-w-0">
            <div class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {{ u.display_name ?? "—" }}
            </div>
            <div class="truncate text-xs text-slate-600 dark:text-slate-300">
              {{ u.email ?? "sem email" }}
            </div>
            <div class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              criado: {{ fmtDate(u.created_at) }}
            </div>
          </div>
        </button>
      </div>

      <div
        v-if="!pending.length && !pendingLoading"
        class="py-6 text-center text-xs text-slate-500 dark:text-slate-400"
      >
        Nenhum usuário pendente.
      </div>
    </div>

    <!-- TAB: Users -->
    <div
      v-else-if="activeTab === 'users'"
      class="mt-4"
    >
      <div class="flex flex-wrap items-end gap-3">
        <div class="min-w-[220px] flex-1">
          <label class="text-xs font-medium text-slate-700 dark:text-slate-300">Buscar</label>
          <input
            v-model="activeQuery"
            class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                   dark:border-slate-800 dark:bg-slate-950"
            placeholder="Nome ou email"
            @keydown.enter.prevent="loadActiveUsers(1)"
          />
        </div>

        <div class="relative min-w-[220px] flex-1">
          <label class="text-xs font-medium text-slate-700 dark:text-slate-300">Filtro de customers</label>
          <button
            type="button"
            class="mt-1 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                   text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200
                   dark:hover:bg-slate-900"
            @click="customerFilterOpen = !customerFilterOpen"
          >
            <span class="truncate">
              {{ activeCustomerIds.length ? `${activeCustomerIds.length} selecionado(s)` : "Todos os customers" }}
            </span>
            <span class="text-xs">▼</span>
          </button>

          <div
            v-if="customerFilterOpen"
            class="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-lg
                   dark:border-slate-800 dark:bg-slate-950"
          >
            <div class="max-h-40 space-y-2 overflow-auto">
              <label
                v-for="c in customers"
                :key="c.id"
                class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200"
              >
                <input
                  v-model="activeCustomerIds"
                  type="checkbox"
                  :value="c.id"
                  class="h-4 w-4"
                />
                <span class="truncate">{{ c.name }} ({{ c.code }})</span>
              </label>
              <div v-if="!customers.length" class="text-[11px] text-slate-500 dark:text-slate-400">
                Nenhum customer encontrado.
              </div>
            </div>

            <div class="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <button
                type="button"
                class="rounded-md border border-slate-200 px-2 py-1 dark:border-slate-800"
                @click="activeCustomerIds = []"
              >
                Limpar
              </button>
              <button
                type="button"
                class="rounded-md border border-slate-200 px-2 py-1 dark:border-slate-800"
                @click="customerFilterOpen = false"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50
                   disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            :disabled="activeLoading"
            @click="loadActiveUsers(1)"
          >
            Buscar
          </button>
        </div>
      </div>

      <div
        v-if="activeError"
        class="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700
               dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
      >
        {{ activeError }}
      </div>

        <div
          v-if="activeLoading"
          class="mt-3 text-xs text-slate-500 dark:text-slate-400"
        >
          Carregando...
        </div>

      <div class="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
        <table class="w-full table-fixed text-left text-sm">
          <thead class="bg-slate-50 text-xs text-slate-600 dark:bg-slate-950/40 dark:text-slate-300">
            <tr>
              <th class="px-4 py-3">Usuário</th>
              <th class="w-44 px-4 py-3">Último login</th>
              <th class="w-32 px-4 py-3">Status</th>
              <th class="w-28 px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
            <tr
              v-for="u in activeUsers.rows"
              :key="u.id"
              class="hover:bg-slate-50/60 dark:hover:bg-slate-950/40"
            >
              <td class="px-4 py-3">
                <div class="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {{ u.display_name ?? "—" }}
                </div>
                <div class="truncate text-xs text-slate-600 dark:text-slate-300">
                  {{ u.email ?? "sem email" }}
                </div>
              </td>
              <td class="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                {{ u.last_login_at ? fmtDate(u.last_login_at) : "—" }}
              </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <PermSwitch
                      :model-value="u.status === 'active'"
                      :loading="!!statusBusy[u.id]"
                      :disabled="u.isPlatformAdmin || !!statusBusy[u.id]"
                      on-label="Ativo"
                      off-label="Inativo"
                      @toggle="toggleUserStatus(u)"
                    />
                    <span
                      v-if="u.isPlatformAdmin"
                      class="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200"
                      title="Platform admin não pode ser desativado"
                    >
                      admin
                    </span>
                  </div>
                </td>
              <td class="px-4 py-3 text-right">
                <button
                  type="button"
                  class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50
                         dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                  @click="openUserModal(u)"
                >
                  Editar
                </button>
              </td>
            </tr>

            <tr v-if="!activeUsers.rows.length && !activeLoading">
              <td colspan="4" class="px-4 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Nenhum usuário encontrado.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
        <button
          type="button"
          class="rounded-lg border px-2 py-1 dark:border-slate-800"
          :disabled="activeUsers.page <= 1 || activeLoading"
          @click="loadActiveUsers(activeUsers.page - 1)"
        >
          ←
        </button>
        <div>Página {{ activeUsers.page }}</div>
        <button
          type="button"
          class="rounded-lg border px-2 py-1 dark:border-slate-800"
          :disabled="activeLoading || activeUsers.page * activeUsers.pageSize >= activeUsers.total"
          @click="loadActiveUsers(activeUsers.page + 1)"
        >
          →
        </button>
      </div>
    </div>

    <!-- TAB: Admins -->
    <div v-else>
      <SecurityPlatformAdminsPanel />
    </div>
  </div>

  <!-- Activate modal -->
  <div v-if="activateModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">Ativar usuário</div>
          <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Selecione o customer e o papel de acesso.
          </div>
        </div>
        <button
          type="button"
          class="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-800"
          :disabled="pendingSaving"
          @click="closeActivateModal"
        >
          Fechar
        </button>
      </div>

      <div class="mt-4 space-y-3">
        <div>
          <label class="text-xs font-medium text-slate-700 dark:text-slate-300">Customer</label>
          <select
            v-model="activateCustomerId"
            class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                   dark:border-slate-800 dark:bg-slate-950"
          >
            <option value="">-- selecione --</option>
            <option v-for="c in customers" :key="c.id" :value="c.id">
              {{ c.name }} ({{ c.code }})
            </option>
          </select>
        </div>

        <div>
          <label class="text-xs font-medium text-slate-700 dark:text-slate-300">Role</label>
          <select
            v-model="activateRole"
            class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                   dark:border-slate-800 dark:bg-slate-950"
          >
            <option value="viewer">viewer</option>
            <option value="member">member</option>
            <option value="admin">admin</option>
            <option value="owner">owner</option>
          </select>
        </div>

        <div v-if="pendingActionMsg" class="text-xs text-slate-500 dark:text-slate-400">
          {{ pendingActionMsg }}
        </div>
      </div>

      <div class="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50
                 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
          :disabled="pendingSaving"
          @click="closeActivateModal"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500
                 disabled:opacity-60"
          :disabled="pendingSaving || !activateCustomerId"
          @click="approvePending"
        >
          {{ pendingSaving ? "Salvando..." : "Ativar" }}
        </button>
      </div>
    </div>
  </div>

  <!-- User modal -->
  <div v-if="userModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div class="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div class="flex items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">Usuário</div>
          <div class="mt-1 truncate text-xs font-medium text-slate-700 dark:text-slate-200">
            {{ userModalUser?.display_name ?? "—" }}
          </div>
          <div class="truncate text-xs text-slate-500 dark:text-slate-400">
            {{ userModalUser?.email ?? "sem email" }}
          </div>
        </div>
        <button
          type="button"
          class="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-800"
          @click="closeUserModal"
        >
          Fechar
        </button>
      </div>

      <div class="max-h-[calc(92vh-92px)] overflow-y-auto">
        <div class="space-y-4 p-4">
          <div class="rounded-2xl border border-slate-200 p-4 text-sm dark:border-slate-800">
            <div class="text-xs font-semibold text-slate-700 dark:text-slate-300">Contexto do customer</div>
            <div class="mt-3 flex flex-wrap items-end gap-2">
              <div class="min-w-[220px] flex-1">
                <label class="text-xs font-medium text-slate-700 dark:text-slate-300">Customer</label>
                <select
                  v-model="userModalCustomerId"
                  class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                         dark:border-slate-800 dark:bg-slate-950"
                  @change="loadUserPerms"
                >
                  <option
                    v-for="m in userMembershipOptions"
                    :key="m.customerId"
                    :value="m.customerId"
                  >
                    {{ m.customer?.name ?? m.customerId }} ({{ m.customer?.code ?? "" }})
                  </option>
                </select>
              </div>
              <button
                type="button"
                class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50
                       dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                @click="membershipModalOpen = true"
              >
                + Customer
              </button>
            </div>

            <div class="mt-3 text-xs text-slate-500 dark:text-slate-400">
              O usuário só pode acessar o que o customer permite.
            </div>
          </div>

          <div v-if="userPermsError" class="text-xs text-rose-600 dark:text-rose-300">
            {{ userPermsError }}
          </div>

            <div
              v-else-if="showUserPermsSkeleton"
              class="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-2"
            >
              <div class="min-h-0 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="animate-pulse space-y-3">
                  <div class="h-4 w-36 rounded bg-slate-200 dark:bg-slate-800"></div>
                  <div class="h-3 w-28 rounded bg-slate-200 dark:bg-slate-800"></div>
                  <div class="space-y-2">
                    <div class="h-12 rounded-xl bg-slate-200 dark:bg-slate-800"></div>
                    <div class="h-12 rounded-xl bg-slate-200 dark:bg-slate-800"></div>
                    <div class="h-12 rounded-xl bg-slate-200 dark:bg-slate-800"></div>
                  </div>
                </div>
              </div>

              <div class="min-h-0 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="animate-pulse space-y-3">
                  <div class="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800"></div>
                  <div class="h-10 rounded-xl bg-slate-200 dark:bg-slate-800"></div>
                  <div class="space-y-2">
                    <div class="h-10 rounded-xl bg-slate-200 dark:bg-slate-800"></div>
                    <div class="h-10 rounded-xl bg-slate-200 dark:bg-slate-800"></div>
                    <div class="h-10 rounded-xl bg-slate-200 dark:bg-slate-800"></div>
                  </div>
                </div>
              </div>
            </div>

            <div
              v-else-if="userPerms"
              class="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-2"
            >
            <div class="min-h-0 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <div class="flex items-center justify-between gap-2">
                <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">Workspaces e reports</div>
                <button
                  type="button"
                  class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] hover:bg-slate-50
                         dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                  :disabled="userPermsLoading"
                  @click="loadUserPerms"
                >
                  {{ userPermsLoading ? "..." : "Recarregar" }}
                </button>
              </div>

              <div v-if="!visibleWorkspaces.length" class="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Nenhum workspace disponível para este customer.
              </div>

              <div v-else class="mt-3 min-h-0 space-y-2 overflow-auto pr-1 lg:max-h-[56vh]">
                <div
                  v-for="ws in visibleWorkspaces"
                  :key="ws.workspaceRefId"
                  class="rounded-2xl border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0">
                      <div class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {{ ws.name }}
                      </div>
                      <div class="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {{ ws.reports.length }} reports
                      </div>
                    </div>

                    <PermSwitch
                      :model-value="ws.canView"
                      :loading="!!wsBusy[ws.workspaceRefId]"
                      :disabled="userPermsSaving"
                      on-label="Workspace: ON"
                      off-label="Workspace: OFF"
                      @toggle="toggleUserWorkspace(ws.workspaceRefId)"
                    />
                  </div>

                  <div class="mt-2 space-y-1">
                    <div
                      v-for="r in ws.reports"
                      :key="r.reportRefId"
                      class="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2
                             dark:border-slate-800 dark:bg-slate-950"
                    >
                      <div class="min-w-0">
                        <div class="truncate text-xs font-medium text-slate-900 dark:text-slate-100">{{ r.name }}</div>
                        <div class="truncate text-[11px] text-slate-500 dark:text-slate-400">{{ r.reportId }}</div>
                      </div>
                      <PermSwitch
                        :model-value="r.canView"
                        :loading="!!reportBusy[r.reportRefId]"
                        :disabled="userPermsSaving || (!ws.canView && !r.canView)"
                        on-label="ON"
                        off-label="OFF"
                        @toggle="toggleUserReport(ws.workspaceRefId, r.reportRefId)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="min-h-0 rounded-2xl border border-slate-200 p-4 text-xs dark:border-slate-800">
              <div class="flex items-center justify-between gap-2">
                <div class="font-semibold text-slate-900 dark:text-slate-100">Páginas por report</div>
                <button
                  type="button"
                  class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] hover:bg-slate-50
                         dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                  :disabled="!pageReportRefId || pageAccessLoading"
                  @click="loadUserPageAccess"
                >
                  {{ pageAccessLoading ? "..." : "Atualizar" }}
                </button>
              </div>

              <div class="mt-2">
                <label class="text-[11px] font-medium text-slate-700 dark:text-slate-300">Report</label>
                <select
                  v-model="pageReportRefId"
                  class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                         dark:border-slate-800 dark:bg-slate-950"
                >
                  <option value="">-- selecione --</option>
                  <option v-for="opt in userReportOptions" :key="opt.reportRefId" :value="opt.reportRefId">
                    {{ opt.label }}
                  </option>
                </select>
              </div>

              <div v-if="pageAccessError" class="mt-2 text-[11px] text-rose-600 dark:text-rose-300">
                {{ pageAccessError }}
              </div>

              <div v-if="!pageReportRefId" class="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                Selecione um report para ajustar páginas.
              </div>

              <div
                v-else-if="pageAccessLoading"
                class="mt-2 text-[11px] text-slate-500 dark:text-slate-400"
              >
                Carregando páginas...
              </div>

              <div
                v-else-if="pageAccess"
                class="mt-3 space-y-3"
              >
                <div>
                  <div class="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Grupos</div>
                  <div class="mt-2 space-y-2">
                    <div
                      v-for="g in pageAccess.groups"
                      :key="g.id"
                      class="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2
                             dark:border-slate-800 dark:bg-slate-950"
                    >
                      <div class="min-w-0">
                        <div class="truncate text-xs font-medium text-slate-900 dark:text-slate-100">{{ g.name }}</div>
                        <div class="text-[11px] text-slate-500 dark:text-slate-400">
                          {{ g.pageIds.length }} páginas
                        </div>
                      </div>
                      <PermSwitch
                        :model-value="!!g.assigned"
                        :loading="!!pageGroupBusy[g.id]"
                        on-label="ON"
                        off-label="OFF"
                        @toggle="toggleUserGroup(g)"
                      />
                    </div>
                    <div v-if="!pageAccess.groups.length" class="text-[11px] text-slate-500 dark:text-slate-400">
                      Nenhum grupo cadastrado.
                    </div>
                  </div>
                </div>

                <div>
                    <div class="flex items-center justify-between gap-2">
                      <div class="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Páginas permitidas</div>
                      <button
                        type="button"
                        class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] hover:bg-slate-50
                               disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                        :disabled="pageAccessLoading || !pageAccess.pages.length"
                        @click="selectAllUserPages"
                      >
                        Selecionar todas
                      </button>
                    </div>
                  <div class="mt-2 space-y-2">
                    <div
                      v-for="p in pageAccess.pages"
                      :key="p.id"
                      class="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2
                             dark:border-slate-800 dark:bg-slate-950"
                    >
                      <div class="min-w-0">
                        <div class="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                          {{ p.displayName || p.pageName }}
                        </div>
                        <div class="text-[11px] text-slate-500 dark:text-slate-400">{{ p.pageName }}</div>
                      </div>
                      <PermSwitch
                        :model-value="!!p.canView"
                        :loading="!!pageAllowBusy[p.id]"
                        on-label="ON"
                        off-label="OFF"
                        @toggle="toggleUserPageAllow(p)"
                      />
                    </div>
                    <div v-if="!pageAccess.pages.length" class="text-[11px] text-slate-500 dark:text-slate-400">
                      Nenhuma página sincronizada.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Membership modal -->
  <div v-if="membershipModalOpen" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div class="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">Memberships</div>
          <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Gerencie customers vinculados ao usuário.
          </div>
        </div>
        <button
          type="button"
          class="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-800"
          @click="membershipModalOpen = false"
        >
          Fechar
        </button>
      </div>

      <div class="mt-3">
        <UserMembershipEditor
          v-if="userModalUser && userPerms"
          v-model:memberships="userPerms.memberships"
          :user-id="userModalUser.id"
          @changed="onMembershipsChanged"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import SecurityPlatformAdminsPanel from "@/features/admin/SecurityPlatformAdminsPanel.vue";
import { useToast } from "@/ui/toast/useToast";
import { useConfirm } from "@/ui/confirm/useConfirm";
import { normalizeApiError } from "@/ui/ops";
import { PermSwitch } from "@/ui/toggles";

import UserMembershipEditor from "@/features/admin/UserMembershipEditor.vue";
import {
  listCustomers,
  listPendingUsers,
  listActiveUsers,
  getUserById,
  activateUser,
  disableUser,
  type CustomerRow,
  type PendingUserRow,
  type ActiveUserRow,
  type MembershipRole,
} from "@/features/admin/api";
import {
  getUserPermissions,
  setWorkspacePermission,
  setReportPermission,
  type UserPermissionsResponse,
} from "@/features/admin/api/permissions";
import {
  getUserPageAccess,
  getCustomerPageAccess,
  getPowerBiCatalog,
  setUserPageAllow,
  setUserPageGroup,
  type PageGroup,
  type ReportPage,
} from "@/features/admin/api/powerbi";

const { push } = useToast();
const { confirm } = useConfirm();

const tabs = [
  { key: "pending", label: "Pendentes" },
  { key: "users", label: "Usuários" },
  { key: "admins", label: "Admins" },
] as const;

type UsersTabKey = typeof tabs[number]["key"];
const activeTab = ref<UsersTabKey>("pending");

const customers = ref<CustomerRow[]>([]);

// Pending
const pending = ref<PendingUserRow[]>([]);
const pendingLoading = ref(false);
const pendingError = ref("");
const pendingSaving = ref(false);
const selectedPending = ref<PendingUserRow | null>(null);
const pendingActionMsg = ref("");

const activateModalOpen = ref(false);
const activateCustomerId = ref("");
const activateRole = ref<MembershipRole>("viewer");

// Active users
const activeQuery = ref("");
const activeCustomerIds = ref<string[]>([]);
const customerFilterOpen = ref(false);
const activeLoading = ref(false);
const activeError = ref("");
const activeUsers = reactive<{ page: number; pageSize: number; total: number; rows: ActiveUserRow[] }>({
  page: 1,
  pageSize: 25,
  total: 0,
  rows: [],
});
const statusBusy = reactive<Record<string, boolean>>({});

// User modal
const userModalOpen = ref(false);
const userModalUser = ref<ActiveUserRow | null>(null);
const userPerms = ref<UserPermissionsResponse | null>(null);
const userPermsLoading = ref(false);
const userPermsError = ref("");
const userPermsSaving = ref(false);
const userModalCustomerId = ref("");
const membershipModalOpen = ref(false);
const customerCatalogLoaded = ref(false);
const customerAllowedWorkspaceIds = ref<string[]>([]);
const customerAllowedReportIds = ref<string[]>([]);

const showUserPermsSkeleton = computed(
  () => userPermsLoading.value || !userPerms.value || !userModalCustomerId.value,
);

const wsBusy = reactive<Record<string, boolean>>({});
const reportBusy = reactive<Record<string, boolean>>({});

const pageReportRefId = ref("");
const pageAccess = ref<{ pages: ReportPage[]; groups: PageGroup[] } | null>(null);
const pageAccessLoading = ref(false);
const pageAccessError = ref("");
const pageGroupBusy = reactive<Record<string, boolean>>({});
const pageAllowBusy = reactive<Record<string, boolean>>({});

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

async function loadCustomers() {
  try {
    customers.value = await listCustomers();
  } catch (e: any) {
    const ne = normalizeApiError(e);
    push({ kind: "error", title: "Falha ao carregar customers", message: ne.message, details: ne.details });
  }
}

async function loadPending() {
  pendingLoading.value = true;
  pendingError.value = "";
  try {
    pending.value = await listPendingUsers();
  } catch (e: any) {
    const ne = normalizeApiError(e);
    pendingError.value = ne.message;
    push({ kind: "error", title: "Falha ao carregar pendentes", message: ne.message, details: ne.details });
  } finally {
    pendingLoading.value = false;
  }
}

function openActivateModal() {
  if (!selectedPending.value) return;
  activateCustomerId.value = "";
  activateRole.value = "viewer";
  pendingActionMsg.value = "";
  activateModalOpen.value = true;
}

function openRejectModal() {
  void disableSelectedPending();
}

function closeActivateModal() {
  if (pendingSaving.value) return;
  activateModalOpen.value = false;
}

async function approvePending() {
  if (!selectedPending.value || !activateCustomerId.value) return;
  pendingSaving.value = true;
  pendingActionMsg.value = "";
  try {
    await activateUser(selectedPending.value.id, {
      customerId: activateCustomerId.value,
      role: activateRole.value,
    });
    pendingActionMsg.value = "Usuário ativado com sucesso.";
    push({ kind: "success", title: "Usuário ativado", message: selectedPending.value.email ?? selectedPending.value.id });

    const activated = await getUserById(selectedPending.value.id);

    activateModalOpen.value = false;
    selectedPending.value = null;

    await loadPending();
    activeTab.value = "users";
    await loadActiveUsers(1);
    await openUserModal(activated);
  } catch (e: any) {
    const ne = normalizeApiError(e);
    pendingActionMsg.value = ne.message;
    push({ kind: "error", title: "Falha ao ativar usuário", message: ne.message, details: ne.details });
  } finally {
    pendingSaving.value = false;
  }
}

async function disableSelectedPending() {
  if (!selectedPending.value) return;
  const ok = await confirm({
    title: "Desativar usuário?",
    message: "Você está prestes a desativar este usuário.",
    confirmText: "Desativar",
    cancelText: "Cancelar",
    danger: true,
  });
  if (!ok) return;

  pendingSaving.value = true;
  try {
    await disableUser(selectedPending.value.id);
    push({ kind: "success", title: "Usuário desativado", message: selectedPending.value.email ?? selectedPending.value.id });
    selectedPending.value = null;
    await loadPending();
  } catch (e: any) {
    const ne = normalizeApiError(e);
    push({ kind: "error", title: "Falha ao desativar usuário", message: ne.message, details: ne.details });
  } finally {
    pendingSaving.value = false;
  }
}

async function loadActiveUsers(page = 1) {
  activeLoading.value = true;
  activeError.value = "";
  try {
    const res = await listActiveUsers(activeQuery.value, page, activeUsers.pageSize, activeCustomerIds.value);
    activeUsers.rows = res.rows ?? [];
    activeUsers.total = res.total ?? 0;
    activeUsers.page = res.page ?? page;
    activeUsers.pageSize = res.pageSize ?? activeUsers.pageSize;

  } catch (e: any) {
    const ne = normalizeApiError(e);
    activeError.value = ne.message;
    push({ kind: "error", title: "Falha ao listar usuários", message: ne.message, details: ne.details });
  } finally {
    activeLoading.value = false;
  }
}

async function toggleUserStatus(user: ActiveUserRow) {
  if (user.isPlatformAdmin) return;
  if (user.status !== "active") return;

  const confirmed = await confirm({
    title: "Desativar usuário",
    message: "Este usuário perderá acesso imediatamente. Deseja continuar?",
    confirmText: "Desativar",
    danger: true,
  });

  if (!confirmed) return;

  statusBusy[user.id] = true;
  try {
    await disableUser(user.id);
    push({ kind: "success", title: "Usuário desativado", message: "O acesso foi revogado com sucesso." });
    await loadActiveUsers(activeUsers.page || 1);
  } catch (e: any) {
    const ne = normalizeApiError(e);
    push({ kind: "error", title: "Falha ao desativar usuário", message: ne.message, details: ne.details });
  } finally {
    statusBusy[user.id] = false;
  }
}

async function openUserModal(u: ActiveUserRow) {
  userModalUser.value = u;
  userModalOpen.value = true;
  await loadUserPerms();
}

function closeUserModal() {
  userModalOpen.value = false;
  userModalUser.value = null;
  userPerms.value = null;
  userPermsError.value = "";
  userPermsLoading.value = false;
  pageReportRefId.value = "";
  pageAccess.value = null;
  customerCatalogLoaded.value = false;
  customerAllowedWorkspaceIds.value = [];
  customerAllowedReportIds.value = [];
}

const userMembershipOptions = computed(() => userPerms.value?.memberships ?? []);

function pickDefaultCustomerId() {
  const ms = userPerms.value?.memberships ?? [];
  const active = ms.find((m) => m.isActive && (m.customer?.status ?? "inactive") === "active");
  return active?.customerId ?? ms[0]?.customerId ?? "";
}

async function loadUserPerms() {
  if (!userModalUser.value) return;
  userPermsLoading.value = true;
  userPermsError.value = "";
  try {
    const res = await getUserPermissions(userModalUser.value.id, userModalCustomerId.value || undefined);
    userPerms.value = res;
    if (!userModalCustomerId.value) userModalCustomerId.value = pickDefaultCustomerId();
    if (userModalCustomerId.value) await loadCustomerCatalog(userModalCustomerId.value);
    syncPageReportSelection();
  } catch (e: any) {
    const ne = normalizeApiError(e);
    userPermsError.value = ne.message;
    push({ kind: "error", title: "Falha ao carregar permissões", message: ne.message, details: ne.details });
  } finally {
    userPermsLoading.value = false;
  }
}

async function loadCustomerCatalog(customerId: string) {
  customerCatalogLoaded.value = false;
  customerAllowedWorkspaceIds.value = [];
  customerAllowedReportIds.value = [];
  try {
    const catalog = await getPowerBiCatalog(customerId);
    const workspaceIds = new Set<string>();
    const reportIds = new Set<string>();
    for (const ws of catalog.workspaces) {
      const allowedReports = ws.reports.filter((r) => r.canView);
      if (allowedReports.length) workspaceIds.add(ws.workspaceRefId);
      for (const report of allowedReports) reportIds.add(report.reportRefId);
    }
    customerAllowedWorkspaceIds.value = Array.from(workspaceIds);
    customerAllowedReportIds.value = Array.from(reportIds);
  } catch (e: any) {
    const ne = normalizeApiError(e);
    push({ kind: "error", title: "Falha ao carregar catálogo", message: ne.message, details: ne.details });
  } finally {
    customerCatalogLoaded.value = true;
  }
}

const visibleWorkspaces = computed(() => {
  if (!userPerms.value) return [];
  if (!customerCatalogLoaded.value) return userPerms.value.workspaces;
  const allowedWorkspaces = new Set(customerAllowedWorkspaceIds.value);
  const allowedReports = new Set(customerAllowedReportIds.value);
  return userPerms.value.workspaces
    .filter((ws) => allowedWorkspaces.has(ws.workspaceRefId))
    .map((ws) => ({
      ...ws,
      reports: ws.reports.filter((r) => allowedReports.has(r.reportRefId)),
    }));
});

const userReportOptions = computed(() => {
  return visibleWorkspaces.value.flatMap((w) =>
    w.reports.map((r) => ({ reportRefId: r.reportRefId, label: `${w.name} / ${r.name}` })),
  );
});

function syncPageReportSelection() {
  const options = userReportOptions.value;
  if (!options.length) {
    pageReportRefId.value = "";
    pageAccess.value = null;
    return;
  }
  if (!options.some((o) => o.reportRefId === pageReportRefId.value)) {
    pageReportRefId.value = options[0]?.reportRefId ?? "";
  }
}

watch(pageReportRefId, async () => {
  if (!pageReportRefId.value || !userModalUser.value) {
    pageAccess.value = null;
    return;
  }
  await loadUserPageAccess();
});

watch(userReportOptions, syncPageReportSelection);

async function loadUserPageAccess() {
  if (!userModalUser.value || !pageReportRefId.value) return;
  pageAccessLoading.value = true;
  pageAccessError.value = "";
  try {
    const [customerAccess, userAccess] = await Promise.all([
      userModalCustomerId.value
        ? getCustomerPageAccess(userModalCustomerId.value, pageReportRefId.value)
        : Promise.resolve(null),
      getUserPageAccess(userModalUser.value.id, pageReportRefId.value),
    ]);
    if (!customerAccess) {
      pageAccess.value = userAccess;
      return;
    }
    const allowedPageIds = new Set(
      customerAccess.pages.filter((p) => p.canView).map((p) => p.id),
    );
    const allowedGroupIds = new Set(
      customerAccess.groups
        .filter((g) => g.assigned ?? g.isActive)
        .map((g) => g.id),
    );
    pageAccess.value = {
      pages: userAccess.pages.filter((p) => allowedPageIds.has(p.id)),
      groups: userAccess.groups.filter((g) => allowedGroupIds.has(g.id)),
    };
  } catch (e: any) {
    const ne = normalizeApiError(e);
    pageAccessError.value = ne.message;
    push({ kind: "error", title: "Falha ao carregar páginas", message: ne.message, details: ne.details });
  } finally {
    pageAccessLoading.value = false;
  }
}

watch(activeCustomerIds, () => {
  if (activeTab.value === "users") loadActiveUsers(1);
});

watch(activeTab, (t) => {
  if (t === "pending" && !pending.value.length && !pendingLoading.value) loadPending();
  if (t === "users" && !activeUsers.rows.length && !activeLoading.value) loadActiveUsers(1);
});

function findWorkspace(wsRefId: string) {
  return userPerms.value?.workspaces.find((w) => w.workspaceRefId === wsRefId) ?? null;
}

function findReport(wsRefId: string, reportRefId: string) {
  const ws = findWorkspace(wsRefId);
  return ws?.reports.find((r) => r.reportRefId === reportRefId) ?? null;
}

async function toggleUserWorkspace(wsRefId: string) {
  if (!userModalUser.value || !userPerms.value || !userModalCustomerId.value) return;
  const ws = findWorkspace(wsRefId);
  if (!ws) return;

  const next = !ws.canView;
  const prev = ws.canView;
  wsBusy[wsRefId] = true;
  userPermsSaving.value = true;

  ws.canView = next;

  try {
    await setWorkspacePermission(userModalUser.value.id, userModalCustomerId.value, wsRefId, next, true);
  } catch (e: any) {
    ws.canView = prev;
    const ne = normalizeApiError(e);
    push({ kind: "error", title: "Falha ao atualizar workspace", message: ne.message, details: ne.details });
  } finally {
    wsBusy[wsRefId] = false;
    userPermsSaving.value = false;
  }
}

async function toggleUserReport(wsRefId: string, reportRefId: string) {
  if (!userModalUser.value || !userModalCustomerId.value) return;
  const report = findReport(wsRefId, reportRefId);
  if (!report) return;

  const next = !report.canView;
  const prev = report.canView;
  reportBusy[reportRefId] = true;
  userPermsSaving.value = true;

  report.canView = next;

  try {
    await setReportPermission(userModalUser.value.id, userModalCustomerId.value, reportRefId, next);
  } catch (e: any) {
    report.canView = prev;
    const ne = normalizeApiError(e);
    push({ kind: "error", title: "Falha ao atualizar report", message: ne.message, details: ne.details });
  } finally {
    reportBusy[reportRefId] = false;
    userPermsSaving.value = false;
  }
}

async function toggleUserGroup(group: PageGroup) {
  if (!userModalUser.value) return;
  const next = !group.assigned;
  const prev = group.assigned;
  pageGroupBusy[group.id] = true;
  group.assigned = next;
  try {
    await setUserPageGroup(userModalUser.value.id, group.id, next);
  } catch (e: any) {
    group.assigned = prev;
    const ne = normalizeApiError(e);
    push({ kind: "error", title: "Falha ao aplicar grupo", message: ne.message, details: ne.details });
  } finally {
    pageGroupBusy[group.id] = false;
  }
}

async function toggleUserPageAllow(page: ReportPage) {
  if (!userModalUser.value) return;
  const next = !page.canView;
  const prev = page.canView;
  pageAllowBusy[page.id] = true;
  page.canView = next;
  try {
    await setUserPageAllow(userModalUser.value.id, page.id, next);
  } catch (e: any) {
    page.canView = prev;
    const ne = normalizeApiError(e);
    push({ kind: "error", title: "Falha ao atualizar página", message: ne.message, details: ne.details });
  } finally {
    pageAllowBusy[page.id] = false;
  }
}

async function selectAllUserPages() {
  if (!userModalUser.value || !pageAccess.value) return;
  const toEnable = pageAccess.value.pages.filter((p) => !p.canView);
  if (!toEnable.length) return;

  pageAccess.value = {
    ...pageAccess.value,
    pages: pageAccess.value.pages.map((p) => ({ ...p, canView: true })),
  };

  toEnable.forEach((p) => {
    pageAllowBusy[p.id] = true;
  });

  try {
    await Promise.all(toEnable.map((p) => setUserPageAllow(userModalUser.value!.id, p.id, true)));
    push({ kind: "success", title: "Paginas ativadas", message: "Todas as paginas foram liberadas." });
  } catch (e: any) {
    const ne = normalizeApiError(e);
    push({ kind: "error", title: "Falha ao ativar paginas", message: ne.message, details: ne.details });
    await loadUserPageAccess();
  } finally {
    toEnable.forEach((p) => {
      pageAllowBusy[p.id] = false;
    });
  }
}

async function onMembershipsChanged() {
  await loadUserPerms();
}

defineExpose({
  refresh: async () => {
    if (activeTab.value === "pending") await loadPending();
    if (activeTab.value === "users") await loadActiveUsers(activeUsers.page || 1);
  },
});

onMounted(async () => {
  await Promise.all([loadCustomers(), loadPending()]);
});
</script>
