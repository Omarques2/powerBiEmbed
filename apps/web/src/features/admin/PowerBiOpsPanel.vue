<!-- apps/web/src/admin/PowerBiOpsPanel.vue -->
<template>
  <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
    <!-- PASSO A: Remote -->
    <section
      class="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm
             dark:border-slate-800 dark:bg-slate-900"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">Workspaces (Remote)</div>
          <div class="mt-1 text-xs text-slate-600 dark:text-slate-300">
            Workspaces que o service principal enxerga. Ao selecionar um customer, os workspaces ativos serão pré-selecionados.
          </div>
        </div>

        <button
          type="button"
          class="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50
                 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
          :disabled="loadingRemote"
          @click="loadRemoteWorkspaces"
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

      <div class="mt-3 flex items-center justify-between gap-2">
        <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
          <input v-model="selectAllRemote" type="checkbox" @change="toggleSelectAll" />
          Selecionar todos
        </label>

        <div class="text-xs text-slate-500 dark:text-slate-400">
          {{ selectedWorkspaceIds.length }} selecionados
        </div>
      </div>

      <div class="mt-3 max-h-[520px] overflow-auto space-y-2 pr-1">
        <div
          v-for="w in remoteWorkspaces"
          :key="w.id"
          class="min-w-0 rounded-xl border border-slate-200 p-2 dark:border-slate-800"
        >
          <div class="flex items-center justify-between gap-2">
            <label class="min-w-0 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
              <input v-model="selectedWorkspaceIds" type="checkbox" :value="w.id" />
              <span class="truncate">{{ w.name }}</span>
            </label>

            <button
              type="button"
              class="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] hover:bg-slate-50
                     disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
              :disabled="loadingReportsByWs[w.id]"
              @click="peekRemoteReports(w.id)"
            >
              {{ loadingReportsByWs[w.id] ? "..." : (peekReports.workspaceId === w.id ? "Fechar" : "Ver reports") }}
            </button>
          </div>

          <div
            v-if="peekReports.workspaceId === w.id"
            class="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-700
                   dark:bg-slate-950/40 dark:text-slate-200"
          >
            <div class="font-semibold">Reports</div>
            <ul class="mt-1 space-y-1">
              <li v-for="r in peekReports.items" :key="r.id" class="truncate">
                {{ r.name }}
              </li>
            </ul>
            <div v-if="!peekReports.items.length" class="mt-1 text-slate-500 dark:text-slate-400">Nenhum report.</div>
          </div>
        </div>

        <div v-if="!remoteWorkspaces.length && !loadingRemote" class="text-xs text-slate-500 dark:text-slate-400">
          Nenhum workspace remoto encontrado.
        </div>
      </div>
    </section>

    <!-- PASSO B: Sync + Catalog -->
    <section
      class="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm
             dark:border-slate-800 dark:bg-slate-900"
    >
      <div class="min-w-0">
        <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">Sync por customer</div>
        <div class="mt-1 text-xs text-slate-600 dark:text-slate-300">
          Ao selecionar um customer, o catálogo no BD é carregado automaticamente. O filtro de workspaces (Remote) é pré-selecionado com os ativos.
        </div>
      </div>

      <div class="mt-3 space-y-3">
        <div class="grid grid-cols-1 gap-2">
          <label class="text-xs font-medium text-slate-700 dark:text-slate-300">Customer</label>
          <select
            v-model="customerId"
            class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                   dark:border-slate-800 dark:bg-slate-900"
          >
            <option value="">-- selecione --</option>
            <option v-for="c in customers" :key="c.id" :value="c.id">
              {{ c.code }} — {{ c.name }} ({{ c.status }})
            </option>
          </select>
        </div>

        <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
          <input v-model="deactivateMissing" type="checkbox" :disabled="!customerId || syncing" />
          Deactivate missing (destrutivo)
        </label>

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            class="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800
                   disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white sm:w-auto"
            :disabled="!customerId || syncing"
            @click="runSync"
          >
            {{ syncing ? "Sincronizando..." : "Rodar sync" }}
          </button>

          <div class="text-xs text-slate-500 dark:text-slate-400 sm:ml-auto">
            <span v-if="selectedWorkspaceIds.length">
              Filtro: {{ selectedWorkspaceIds.length }} WS selecionados
            </span>
            <span v-else>
              Sem filtro de WS
            </span>
          </div>
        </div>

        <div v-if="syncResult" class="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
          <div class="font-semibold text-slate-900 dark:text-slate-100">Resultado do sync</div>
          <div class="mt-1 text-slate-700 dark:text-slate-200">
            workspacesSeenRemote: {{ syncResult.workspacesSeenRemote }} • workspacesUpserted: {{ syncResult.workspacesUpserted }}
          </div>
          <div class="text-slate-700 dark:text-slate-200">
            reportsUpserted: {{ syncResult.reportsUpserted }} • reportsDeactivated: {{ syncResult.reportsDeactivated }}
          </div>
        </div>

        <div
          v-if="catalogError"
          class="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700
                 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200"
        >
          {{ catalogError }}
        </div>

        <!-- Catálogo -->
        <div
          v-if="customerId"
          class="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="font-semibold text-slate-900 dark:text-slate-100">Catálogo no BD</div>
              <div class="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span v-if="catalog">{{ catalog.workspaces.length }} workspaces</span>
                <span v-else-if="loadingCatalog">Carregando...</span>
                <span v-else>Não carregado</span>
              </div>
            </div>

            <button
              type="button"
              class="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50
                     disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
              :disabled="loadingCatalog"
              title="Atualizar catálogo"
              @click="loadCatalog({ applyAutoSelection: false })"
            >
              {{ loadingCatalog ? "..." : "Atualizar" }}
            </button>
          </div>

          <div
            v-if="loadingCatalog && !catalog"
            class="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700
                   dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200"
          >
            Carregando catálogo do customer...
          </div>

          <div
            v-else-if="catalog"
            class="mt-3 space-y-2
                  lg:max-h-[520px] lg:overflow-auto lg:pr-1 lg:overscroll-contain
                  overflow-x-hidden"
          >
            <details
              v-for="w in catalog.workspaces"
              :key="w.workspaceRefId"
              class="group min-w-0 rounded-xl border border-slate-200 bg-white/0
                    dark:border-slate-800"
            >
              <!-- Header compacto + clicável -->
              <summary
                class="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 py-2
                      hover:bg-slate-50 dark:hover:bg-slate-800/40
                      [&::-webkit-details-marker]:hidden"
              >
                <div class="min-w-0">
                  <div class="flex min-w-0 items-center gap-2">
                    <div class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {{ w.name }}
                    </div>

                    <!-- Badge ativo/inativo -->
                    <span
                      v-if="!w.isActive"
                      class="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700
                            dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200"
                    >
                      inativo
                    </span>
                  </div>

                  <div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span class="font-mono break-all">{{ w.workspaceId }}</span>
                    <span class="text-slate-400 dark:text-slate-500">•</span>
                    <span>{{ (w.reports?.length ?? 0) }} reports</span>
                  </div>
                </div>

                <div class="flex shrink-0 items-center gap-2">
                  <!-- Indicador expand/collapse -->
                  <span
                    class="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700
                          dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                    aria-hidden="true"
                  >
                    <svg
                      class="h-4 w-4 transition-transform duration-200 group-open:rotate-180"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>

                  <!-- Desvincular (mantém usável no mobile; não abre/fecha o details ao clicar) -->
                  <button
                    type="button"
                    class="rounded-xl border border-rose-200 bg-rose-600 px-3 py-2 text-[11px] font-semibold text-white hover:bg-rose-500
                          disabled:opacity-60 dark:border-rose-900/40 dark:bg-rose-700 dark:hover:bg-rose-600"
                    :disabled="!w.isActive || busyUnlink.isBusy(w.workspaceRefId)"
                    title="Desvincular (revoga acesso do customer ao workspace/report)"
                    @click.stop="unlinkWorkspace(w.workspaceRefId)"
                  >
                    {{ busyUnlink.isBusy(w.workspaceRefId) ? "..." : "Desvincular" }}
                  </button>
                </div>
              </summary>

              <!-- Conteúdo expandido (reports) -->
              <div class="px-3 pb-3 pt-1">
                <div class="rounded-lg bg-slate-50 p-2 text-[11px] text-slate-700 dark:bg-slate-950/40 dark:text-slate-200">
                  <div class="flex items-center justify-between">
                    <div class="font-semibold">Reports</div>
                    <div class="text-slate-500 dark:text-slate-400">
                      {{ w.reports?.length ?? 0 }} total
                    </div>
                  </div>
                  <div class="mt-2 space-y-2">
                    <div
                      v-for="r in (w.reports ?? [])"
                      :key="r.reportRefId"
                      class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2
                             dark:border-slate-800 dark:bg-slate-950"
                    >
                      <div class="min-w-0">
                        <div class="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                          {{ r.name }}
                          <span v-if="!r.isActive" class="ml-1 text-rose-600 dark:text-rose-300">(inativo)</span>
                          <span v-else-if="!r.canView" class="ml-1 text-amber-600 dark:text-amber-300">(sem acesso)</span>
                        </div>
                        <div class="truncate text-[11px] text-slate-500 dark:text-slate-400">{{ r.reportId }}</div>
                      </div>

                      <PermSwitch
                        :model-value="r.canView"
                        :loading="busyReportPerm.isBusy(r.reportRefId)"
                        :disabled="!customerId || (!w.isActive && !r.canView)"
                        on-label="ON"
                        off-label="OFF"
                        @toggle="toggleReportAccess(w.workspaceRefId, r.reportRefId)"
                      />
                    </div>
                  </div>

                  <div v-if="(w.reports?.length ?? 0) === 0" class="mt-1 text-slate-500 dark:text-slate-400">
                    Nenhum report.
                  </div>
                </div>
              </div>
            </details>
          </div>

          <div
            v-else
            class="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700
                   dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200"
          >
            Selecione um customer para carregar o catálogo automaticamente.
          </div>
        </div>

        <div
          v-else
          class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700
                 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200"
        >
          Selecione um customer para habilitar Sync e carregar o catálogo.
        </div>
      </div>
    </section>
  </div>

  <section
    class="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm
           dark:border-slate-800 dark:bg-slate-900"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">Permissões de páginas</div>
        <div class="mt-1 text-xs text-slate-600 dark:text-slate-300">
          Crie grupos reutilizáveis e aplique permissões por customer. Use o preview para validar a página.
        </div>
      </div>

      <button
        type="button"
        class="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50
               disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
        :disabled="!pageReportRefId || loadingPageConfig"
        @click="loadPageConfig"
      >
        {{ loadingPageConfig ? "Atualizando..." : "Atualizar" }}
      </button>
    </div>

    <div
      v-if="pageError"
      class="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700
             dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
    >
      {{ pageError }}
    </div>

    <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div class="space-y-4">
        <div class="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
          <div class="grid grid-cols-1 gap-2">
            <label class="text-xs font-medium text-slate-700 dark:text-slate-300">Report (catálogo)</label>
            <select
              v-model="pageReportRefId"
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                     dark:border-slate-800 dark:bg-slate-900"
            >
              <option value="">-- selecione --</option>
              <option v-for="r in pageReportOptions" :key="r.reportRefId" :value="r.reportRefId">
                {{ r.label }}
              </option>
            </select>
            <div class="text-[11px] text-slate-500 dark:text-slate-400">
              Selecione um report do catálogo do customer. O sync grava as páginas no banco.
            </div>
          </div>

          <div class="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50
                     disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
              :disabled="!pageReportRefId || syncingPages"
              @click="syncPages"
            >
              {{ syncingPages ? "Sincronizando..." : "Sync páginas" }}
            </button>
            <span v-if="pageMetaLabel">{{ pageMetaLabel }}</span>
          </div>
        </div>

        <div class="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
          <div class="flex items-center justify-between gap-2">
            <div class="font-semibold text-slate-900 dark:text-slate-100">Grupos por report</div>
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] hover:bg-slate-50
                     disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
              :disabled="!pageReportRefId || pageModalSaving"
              @click="openGroupModal()"
            >
              Novo grupo
            </button>
          </div>

          <div v-if="!pageReportRefId" class="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Selecione um report para listar grupos.
          </div>

          <div
            v-else
            class="mt-3 space-y-2"
          >
            <div
              v-for="g in pageGroups"
              :key="g.id"
              class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2
                     dark:border-slate-800 dark:bg-slate-950"
            >
              <div class="min-w-0">
                <div class="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {{ g.name }}
                </div>
                <div class="text-[11px] text-slate-500 dark:text-slate-400">
                  {{ g.pageIds.length }} páginas • {{ g.isActive ? "ativo" : "inativo" }}
                </div>
              </div>

              <div class="flex shrink-0 items-center gap-2">
                <PermSwitch
                  :model-value="g.isActive"
                  :loading="busyGroupToggle.isBusy(g.id)"
                  :disabled="pageModalSaving"
                  on-label="ON"
                  off-label="OFF"
                  @toggle="toggleGroupActive(g)"
                />
                <button
                  type="button"
                  class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] hover:bg-slate-50
                         disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                  :disabled="pageModalSaving"
                  @click="openGroupModal(g)"
                >
                  Editar
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-100
                         disabled:opacity-60 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-900/50"
                  :disabled="busyGroupDelete.isBusy(g.id)"
                  @click="deleteGroup(g)"
                >
                  {{ busyGroupDelete.isBusy(g.id) ? "..." : "Excluir" }}
                </button>
              </div>
            </div>

            <div v-if="pageGroups.length === 0" class="text-[11px] text-slate-500 dark:text-slate-400">
              Nenhum grupo cadastrado.
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <div class="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
          <div class="font-semibold text-slate-900 dark:text-slate-100">Customer (contexto)</div>
          <div class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {{ customerLabel }}
          </div>
        </div>

        <div class="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
          <div class="font-semibold text-slate-900 dark:text-slate-100">Grupos atribuídos</div>
          <div v-if="!customerId" class="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Selecione um customer para atribuir grupos.
          </div>
          <div v-else class="mt-2 space-y-2">
            <div
              v-for="g in pageGroupsWithAccess"
              :key="g.id"
              class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2
                     dark:border-slate-800 dark:bg-slate-950"
            >
              <div class="min-w-0">
                <div class="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {{ g.name }}
                </div>
                <div class="text-[11px] text-slate-500 dark:text-slate-400">
                  {{ g.pageIds.length }} páginas
                </div>
              </div>
              <PermSwitch
                :model-value="!!g.assigned"
                :loading="busyGroupAssign.isBusy(g.id)"
                :disabled="!customerId"
                on-label="ON"
                off-label="OFF"
                @toggle="toggleGroupAssign(g)"
              />
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
          <div class="flex items-center justify-between gap-2">
            <div class="font-semibold text-slate-900 dark:text-slate-100">Páginas individuais</div>
          </div>
          <div v-if="!customerId" class="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Selecione um customer para permitir páginas específicas.
          </div>
          <div v-else class="mt-3 space-y-2">
            <div
              v-for="p in pageAccessPages"
              :key="p.id"
              class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2
                     dark:border-slate-800 dark:bg-slate-950"
            >
              <div class="min-w-0">
                <div class="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                  {{ p.displayName || p.pageName }}
                </div>
                <div class="text-[11px] text-slate-500 dark:text-slate-400">{{ p.pageName }}</div>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] hover:bg-slate-50
                         disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                  :disabled="!customerId || previewLoading"
                  @click="openPreview(p)"
                >
                  Preview
                </button>
                <PermSwitch
                  :model-value="!!p.canView"
                  :loading="busyPageAllow.isBusy(p.id)"
                  :disabled="!customerId"
                  on-label="ON"
                  off-label="OFF"
                  @toggle="togglePageAllow(p)"
                />
              </div>
            </div>

            <div v-if="pageAccessPages.length === 0" class="text-[11px] text-slate-500 dark:text-slate-400">
              Nenhuma página sincronizada.
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <div
    v-if="groupModalOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    @click.self="closeGroupModal"
  >
    <div
      class="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl
             dark:border-slate-800 dark:bg-slate-900"
    >
      <div class="flex items-center justify-between gap-3">
        <div class="text-base font-semibold text-slate-900 dark:text-slate-100">
          {{ groupModalMode === "edit" ? "Editar grupo" : "Novo grupo" }}
        </div>
        <button
          class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50
                 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          :disabled="pageModalSaving"
          @click="closeGroupModal"
        >
          Fechar
        </button>
      </div>

      <div class="mt-4 space-y-3">
        <div>
          <label class="text-xs font-medium text-slate-700 dark:text-slate-300">Nome do grupo</label>
          <input
            v-model="groupModalName"
            class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                   dark:border-slate-800 dark:bg-slate-900"
            placeholder="Ex: A.1 - Páginas essenciais"
          />
        </div>

        <div>
          <div class="text-xs font-medium text-slate-700 dark:text-slate-300">Páginas do grupo</div>
          <div
            class="mt-2 max-h-[260px] space-y-2 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2
                   dark:border-slate-800 dark:bg-slate-950/40"
          >
            <label
              v-for="p in pagePages"
              :key="p.id"
              class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200"
            >
              <input v-model="groupModalPageIds" type="checkbox" :value="p.id" />
              <span class="truncate">{{ p.displayName || p.pageName }}</span>
            </label>
            <div v-if="pagePages.length === 0" class="text-[11px] text-slate-500 dark:text-slate-400">
              Nenhuma página sincronizada.
            </div>
          </div>
        </div>

        <div
          v-if="groupModalError"
          class="text-xs text-rose-600 dark:text-rose-300"
        >
          {{ groupModalError }}
        </div>
      </div>

      <div class="mt-5 flex justify-end gap-2">
        <button
          class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50
                 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          :disabled="pageModalSaving"
          @click="closeGroupModal"
        >
          Cancelar
        </button>
        <button
          class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800
                 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          :disabled="pageModalSaving || !groupModalName.trim() || !pageReportRefId"
          @click="saveGroupModal"
        >
          {{ pageModalSaving ? "Salvando..." : "Salvar" }}
        </button>
      </div>
    </div>
  </div>

  <div
    v-if="previewOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    @click.self="closePreview"
  >
    <div
      class="w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl
             dark:border-slate-800 dark:bg-slate-900"
    >
      <div class="flex items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">Pré-visualizar página</div>
          <div class="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
            {{ previewPage?.displayName || previewPage?.pageName || "Página" }}
          </div>
        </div>
        <button
          class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50
                 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          @click="closePreview"
        >
          Fechar
        </button>
      </div>
      <div class="relative h-[70vh] bg-slate-950">
        <div ref="previewContainerEl" class="absolute inset-0" />
        <div
          v-if="previewLoading"
          class="absolute inset-0 grid place-items-center bg-black/40 text-sm text-white"
        >
          Carregando preview...
        </div>
        <div
          v-if="previewError"
          class="absolute bottom-3 left-3 right-3 rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700
                 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200"
        >
          {{ previewError }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, toRefs, watch } from "vue";
import * as pbi from "powerbi-client";
import type { CustomerCatalog, CustomerRow } from "@/features/admin/api";
import {
  getPowerBiCatalog,
  getAdminReportPreview,
  listRemoteReports,
  listRemoteWorkspaces,
  syncReportPages,
  listReportPages,
  listPageGroups,
  createPageGroup,
  updatePageGroup,
  setPageGroupPages,
  deletePageGroup,
  getCustomerPageAccess,
  setCustomerPageGroup,
  setCustomerPageAllow,
  setCustomerReportPermission,
  syncPowerBiCatalog,
  unlinkCustomerWorkspace,
} from "@/features/admin/api";
import { PermSwitch } from "@/ui/toggles";
import { useConfirm } from "@/ui/confirm/useConfirm";
import { useToast } from "@/ui/toast/useToast";
import { useBusyMap } from "@/ui/ops/useBusyMap";
import { useOptimisticMutation } from "@/ui/ops/useOptimisticMutation";
import { normalizeApiError } from "@/ui/ops/normalizeApiError";

const props = defineProps<{
  customers: CustomerRow[];
}>();
const { customers } = toRefs(props);

const { confirm } = useConfirm();
const { push } = useToast();
const { mutate } = useOptimisticMutation();

function clone<T>(v: T): T {
  return v ? (JSON.parse(JSON.stringify(v)) as T) : v;
}

// =====================
// Passo A (remote)
// =====================
const remoteWorkspaces = ref<Array<{ id: string; name: string }>>([]);
const loadingRemote = ref(false);
const remoteError = ref("");

const selectedWorkspaceIds = ref<string[]>([]);
const selectAllRemote = ref(false);

const loadingReportsByWs = reactive<Record<string, boolean>>({});
const peekReports = ref<{ workspaceId: string; items: Array<{ id: string; name: string }> }>({
  workspaceId: "",
  items: [],
});

function toggleSelectAll() {
  if (selectAllRemote.value) {
    selectedWorkspaceIds.value = remoteWorkspaces.value.map((w) => w.id);
  } else {
    selectedWorkspaceIds.value = [];
  }
}

watch(selectedWorkspaceIds, () => {
  if (!remoteWorkspaces.value.length) return;
  const all = remoteWorkspaces.value.every((w) => selectedWorkspaceIds.value.includes(w.id));
  selectAllRemote.value = all;
});

async function loadRemoteWorkspaces() {
  loadingRemote.value = true;
  remoteError.value = "";
  try {
    const ws = await listRemoteWorkspaces();
    remoteWorkspaces.value = ws.map((w) => ({ id: w.id, name: w.name }));

    // Se já temos catálogo carregado, tenta aplicar auto-seleção (sem sobrescrever seleção manual)
    applyAutoSelectionIfNeeded(false);

    const all = remoteWorkspaces.value.length > 0 && remoteWorkspaces.value.every((w) => selectedWorkspaceIds.value.includes(w.id));
    selectAllRemote.value = all;
  } catch (e: any) {
    const ne = normalizeApiError(e);
    remoteError.value = ne.message;
    push({
      kind: "error",
      title: "Falha ao carregar workspaces remotos",
      message: ne.message,
      details: ne.details,
      timeoutMs: 9000,
    });
  } finally {
    loadingRemote.value = false;
  }
}

async function peekRemoteReports(workspaceId: string) {
  if (peekReports.value.workspaceId === workspaceId) {
    peekReports.value = { workspaceId: "", items: [] };
    return;
  }

  loadingReportsByWs[workspaceId] = true;
  try {
    const items = await listRemoteReports(workspaceId);
    peekReports.value = { workspaceId, items: items.map((r) => ({ id: r.id, name: r.name })) };
  } catch (e: any) {
    const ne = normalizeApiError(e);
    push({
      kind: "error",
      title: "Falha ao carregar reports remotos",
      message: ne.message,
      details: ne.details,
      timeoutMs: 9000,
    });
  } finally {
    loadingReportsByWs[workspaceId] = false;
  }
}

// =====================
// Passo B (sync + catalog)
// =====================
const customerId = ref<string>("");
const deactivateMissing = ref(false);

const syncing = ref(false);
const syncResult = ref<null | Awaited<ReturnType<typeof syncPowerBiCatalog>>>(null);

const catalog = ref<CustomerCatalog | null>(null);
const loadingCatalog = ref(false);
const catalogError = ref("");

const busyUnlink = useBusyMap();
const busyReportPerm = useBusyMap();
const busyGroupToggle = useBusyMap();
const busyGroupDelete = useBusyMap();
const busyGroupAssign = useBusyMap();
const busyPageAllow = useBusyMap();

// Controle para não sobrescrever seleção manual constantemente
const autoAppliedForCustomerId = ref<string>("");

// Cache de IDs ativos no BD para o customer atual
const activeWorkspaceIdsForCustomer = ref<string[]>([]);

// Anti-race simples para loadCatalog
let catalogReqSeq = 0;

function computeActiveWorkspaceIds(cat: CustomerCatalog | null): string[] {
  if (!cat?.workspaces?.length) return [];
  return cat.workspaces
    .filter((w) => !!w.isActive && !!w.workspaceId)
    .map((w) => w.workspaceId as string);
}

function applyAutoSelectionIfNeeded(force: boolean) {
  if (!customerId.value) return;

  // Se já aplicou para este customer e o usuário já tem uma seleção, não sobrescreve
  const alreadyApplied = autoAppliedForCustomerId.value === customerId.value;
  if (!force && alreadyApplied && selectedWorkspaceIds.value.length > 0) return;

  const desired = activeWorkspaceIdsForCustomer.value ?? [];
  if (!desired.length) return;

  const remoteSet = new Set(remoteWorkspaces.value.map((w) => w.id));
  const next = desired.filter((id) => remoteSet.has(id));

  // Se o remoto ainda não carregou, não aplica (será aplicado quando remoto carregar)
  if (!remoteWorkspaces.value.length) return;

  selectedWorkspaceIds.value = next;
  autoAppliedForCustomerId.value = customerId.value;
}

watch(customerId, async () => {
  catalog.value = null;
  syncResult.value = null;
  catalogError.value = "";
  activeWorkspaceIdsForCustomer.value = [];

  // Reset do filtro ao trocar de customer; depois auto-seleciona os ativos
  selectedWorkspaceIds.value = [];
  selectAllRemote.value = false;
  autoAppliedForCustomerId.value = "";

  if (!customerId.value) return;

  await loadCatalog({ applyAutoSelection: true });
});

async function loadCatalog(opts?: { applyAutoSelection: boolean }) {
  if (!customerId.value) return;

  const seq = ++catalogReqSeq;
  const cid = customerId.value;

  loadingCatalog.value = true;
  catalogError.value = "";

  try {
    const res = await getPowerBiCatalog(cid);

    // Anti-race: se mudou customer no meio do await, ignora resultado
    if (seq !== catalogReqSeq || cid !== customerId.value) return;

    catalog.value = res;
    activeWorkspaceIdsForCustomer.value = computeActiveWorkspaceIds(res);

    if (opts?.applyAutoSelection) {
      applyAutoSelectionIfNeeded(true);
    } else {
      applyAutoSelectionIfNeeded(false);
    }
  } catch (e: any) {
    const ne = normalizeApiError(e);
    catalogError.value = ne.message;
    push({
      kind: "error",
      title: "Falha ao carregar catálogo",
      message: ne.message,
      details: ne.details,
      timeoutMs: 9000,
    });
  } finally {
    // evita flicker se outra req estiver em andamento
    if (seq === catalogReqSeq) loadingCatalog.value = false;
  }
}

async function runSync() {
  if (!customerId.value) return;

  if (deactivateMissing.value) {
    const ok = await confirm({
      title: "Rodar sync com desativação?",
      message:
        "Você habilitou 'Deactivate missing'. Isso pode DESATIVAR workspaces/reports que não existirem mais no remoto. " +
        "Confirme que esta ação é desejada.",
      confirmText: "Rodar sync",
      cancelText: "Cancelar",
      danger: true,
    });
    if (!ok) return;
  }

  syncing.value = true;
  syncResult.value = null;
  catalogError.value = "";

  try {
    const payload: any = {
      customerId: customerId.value,
      deactivateMissing: deactivateMissing.value,
    };
    if (selectedWorkspaceIds.value.length) payload.workspaceIds = selectedWorkspaceIds.value;

    const res = await syncPowerBiCatalog(payload);
    syncResult.value = res;

    push({
      kind: "success",
      title: "Sync concluído",
      message: `WS seen: ${res.workspacesSeenRemote}, WS upsert: ${res.workspacesUpserted}, RP upsert: ${res.reportsUpserted}, RP deact: ${res.reportsDeactivated}`,
    });

    // Recarrega catálogo após sync, mas sem sobrescrever seleção manual
    await loadCatalog({ applyAutoSelection: false });
  } catch (e: any) {
    const ne = normalizeApiError(e);
    catalogError.value = ne.message;
    push({ kind: "error", title: "Falha no sync", message: ne.message, details: ne.details, timeoutMs: 9000 });
  } finally {
    syncing.value = false;
  }
}

async function unlinkWorkspace(workspaceRefId: string) {
  if (!customerId.value || !catalog.value) return;

  const ws = catalog.value.workspaces.find((x) => x.workspaceRefId === workspaceRefId);
  const label = ws?.name ?? workspaceRefId;

  // IMPORTANTE: esse é o ID remoto (o mesmo usado em selectedWorkspaceIds / remoteWorkspaces)
  const remoteWorkspaceId = (ws?.workspaceId ?? "") as string;

  const ok = await confirm({
    title: "Desvincular workspace?",
    message:
      `Você está prestes a desvincular "${label}". ` +
      "Isso revoga o acesso do customer ao workspace e aos reports. Esta ação é destrutiva.",
    confirmText: "Desvincular",
    cancelText: "Cancelar",
    danger: true,
  });
  if (!ok) return;

  await mutate<{
    catalogSnap: CustomerCatalog | null;
    selectedSnap: string[];
    activeIdsSnap: string[];
    peekSnap: { workspaceId: string; items: Array<{ id: string; name: string }> };
  }, any>({
    key: workspaceRefId,
    busy: busyUnlink,

    optimistic: () => {
      const snap = {
        catalogSnap: clone(catalog.value),
        selectedSnap: [...selectedWorkspaceIds.value],
        activeIdsSnap: [...activeWorkspaceIdsForCustomer.value],
        peekSnap: clone(peekReports.value),
      };

      // 1) Atualiza o catálogo local (como você já faz)
      if (catalog.value) {
        const next = clone(catalog.value);
        next.workspaces = (next.workspaces ?? []).map((w) => {
          if (w.workspaceRefId !== workspaceRefId) return w;
          return {
            ...w,
            isActive: false,
            reports: (w.reports ?? []).map((r) => ({ ...r, canView: false })),
          };
        });
        catalog.value = next;
      }

      // 2) Ajusta a seleção remota: remove o workspace desvinculado do filtro
      if (remoteWorkspaceId) {
        selectedWorkspaceIds.value = selectedWorkspaceIds.value.filter((id) => id !== remoteWorkspaceId);

        // mantém consistência do cache de "ativos" (efeito visual imediato)
        activeWorkspaceIdsForCustomer.value = activeWorkspaceIdsForCustomer.value.filter((id) => id !== remoteWorkspaceId);

        // se estava com peek aberto nesse workspace, fecha
        if (peekReports.value.workspaceId === remoteWorkspaceId) {
          peekReports.value = { workspaceId: "", items: [] };
        }
      }

      return snap;
    },

    request: async () => unlinkCustomerWorkspace(customerId.value, workspaceRefId),

    rollback: (snap) => {
      catalog.value = snap.catalogSnap;
      selectedWorkspaceIds.value = snap.selectedSnap;
      activeWorkspaceIdsForCustomer.value = snap.activeIdsSnap;
      peekReports.value = snap.peekSnap;
    },

    toast: {
      success: { title: "Workspace desvinculado", message: label },
      error: { title: "Falha ao desvincular workspace" },
    },
  });

  // Recarrega catálogo (sem sobrescrever seleção manual geral),
  // mas agora a seleção já está "limpa" do workspace removido.
  await loadCatalog({ applyAutoSelection: false });
}


async function toggleReportAccess(workspaceRefId: string, reportRefId: string) {
  if (!customerId.value || !catalog.value) return;

  const ws = catalog.value.workspaces.find((x) => x.workspaceRefId === workspaceRefId);
  const report = ws?.reports?.find((x) => x.reportRefId === reportRefId);
  if (!ws || !report) return;

  const nextCanView = !report.canView;

  await mutate<
    { catalogSnap: CustomerCatalog | null; activeIdsSnap: string[] },
    any
  >({
    key: reportRefId,
    busy: busyReportPerm,

    optimistic: () => {
      const snap = {
        catalogSnap: clone(catalog.value),
        activeIdsSnap: [...activeWorkspaceIdsForCustomer.value],
      };

      if (catalog.value) {
        const next = clone(catalog.value);
        next.workspaces = (next.workspaces ?? []).map((w) => {
          if (w.workspaceRefId !== workspaceRefId) return w;
          return {
            ...w,
            isActive: nextCanView ? true : w.isActive,
            reports: (w.reports ?? []).map((r) =>
              r.reportRefId === reportRefId ? { ...r, canView: nextCanView } : r,
            ),
          };
        });
        catalog.value = next;
        activeWorkspaceIdsForCustomer.value = computeActiveWorkspaceIds(next);
      }

      return snap;
    },

    request: async () => setCustomerReportPermission(customerId.value, reportRefId, nextCanView),

    rollback: (snap) => {
      catalog.value = snap.catalogSnap;
      activeWorkspaceIdsForCustomer.value = snap.activeIdsSnap;
    },

    toast: {
      success: { title: "Report atualizado", message: `${report.name}: ${nextCanView ? "ON" : "OFF"}` },
      error: { title: "Falha ao atualizar report" },
    },
  });
}

onMounted(async () => {
  await loadRemoteWorkspaces();
});

// =====================
// Pages + Groups (admin)
// =====================
const pageReportRefId = ref<string>("");
const pagePages = ref<Array<{ id: string; pageName: string; displayName: string | null }>>([]);
const pageGroups = ref<Array<{ id: string; name: string; isActive: boolean; pageIds: string[] }>>([]);
const pageAccessPages = ref<Array<{ id: string; pageName: string; displayName: string | null; canView?: boolean }>>([]);
const pageGroupsWithAccess = ref<Array<{ id: string; name: string; isActive: boolean; pageIds: string[]; assigned?: boolean }>>([]);
const loadingPageConfig = ref(false);
const pageError = ref("");
const syncingPages = ref(false);

const groupModalOpen = ref(false);
const groupModalMode = ref<"create" | "edit">("create");
const groupModalName = ref("");
const groupModalPageIds = ref<string[]>([]);
const groupModalError = ref("");
const pageModalSaving = ref(false);
const editingGroupId = ref<string | null>(null);

const previewOpen = ref(false);
const previewLoading = ref(false);
const previewError = ref("");
const previewPage = ref<{ id: string; pageName: string; displayName: string | null } | null>(null);
const previewContainerEl = ref<HTMLDivElement | null>(null);
let previewService: pbi.service.Service | null = null;

const pageReportOptions = computed(() => {
  const ws = catalog.value?.workspaces ?? [];
  return ws.flatMap((w) =>
    (w.reports ?? []).map((r) => ({
      reportRefId: r.reportRefId,
      label: `${w.name} / ${r.name}`,
    })),
  );
});

const pageMetaLabel = computed(() => {
  if (!pageReportRefId.value || !pageReportOptions.value.length) return "";
  const opt = pageReportOptions.value.find((r) => r.reportRefId === pageReportRefId.value);
  return opt?.label ?? "";
});

const customerLabel = computed(() => {
  if (!customerId.value) return "Nenhum customer selecionado";
  const row = customers.value.find((c) => c.id === customerId.value);
  if (!row) return `Customer ${customerId.value}`;
  return `${row.code} — ${row.name} (${row.status})`;
});

watch(customerId, () => {
  pageReportRefId.value = "";
  pagePages.value = [];
  pageGroups.value = [];
  pageAccessPages.value = [];
  pageGroupsWithAccess.value = [];
  pageError.value = "";
});

watch(pageReportOptions, () => {
  if (!pageReportRefId.value && pageReportOptions.value.length > 0) {
    pageReportRefId.value = pageReportOptions.value[0]?.reportRefId ?? "";
  }
});

watch(pageReportRefId, () => {
  if (pageReportRefId.value) {
    void loadPageConfig();
  }
});

async function loadPageConfig() {
  if (!pageReportRefId.value) return;
  loadingPageConfig.value = true;
  pageError.value = "";
  try {
    const [pagesRes, groupsRes] = await Promise.all([
      listReportPages(pageReportRefId.value),
      listPageGroups(pageReportRefId.value),
    ]);

    pagePages.value = pagesRes
      .filter((p) => p.isActive)
      .map((p) => ({
        id: p.id,
        pageName: p.pageName,
        displayName: p.displayName,
      }));
    pageGroups.value = groupsRes;

    if (customerId.value) {
      const access = await getCustomerPageAccess(customerId.value, pageReportRefId.value);
      pageAccessPages.value = access.pages.filter((p) => p.isActive);
      pageGroupsWithAccess.value = access.groups;
    } else {
      pageAccessPages.value = pagePages.value.map((p) => ({ ...p, canView: false }));
      pageGroupsWithAccess.value = pageGroups.value.map((g) => ({ ...g, assigned: false }));
    }
  } catch (e: any) {
    const ne = normalizeApiError(e);
    pageError.value = ne.message;
    push({
      kind: "error",
      title: "Falha ao carregar páginas",
      message: ne.message,
      details: ne.details,
      timeoutMs: 9000,
    });
  } finally {
    loadingPageConfig.value = false;
  }
}

async function syncPages() {
  if (!pageReportRefId.value) return;
  syncingPages.value = true;
  pageError.value = "";
  try {
    await syncReportPages(pageReportRefId.value);
    await loadPageConfig();
    push({ kind: "success", title: "Páginas sincronizadas", message: "Lista atualizada." });
  } catch (e: any) {
    const ne = normalizeApiError(e);
    pageError.value = ne.message;
    push({
      kind: "error",
      title: "Falha ao sincronizar páginas",
      message: ne.message,
      details: ne.details,
      timeoutMs: 9000,
    });
  } finally {
    syncingPages.value = false;
  }
}

function openGroupModal(group?: { id: string; name: string; pageIds: string[] }) {
  groupModalMode.value = group ? "edit" : "create";
  groupModalName.value = group?.name ?? "";
  groupModalPageIds.value = group?.pageIds ? [...group.pageIds] : [];
  groupModalError.value = "";
  editingGroupId.value = group?.id ?? null;
  groupModalOpen.value = true;
}

function closeGroupModal() {
  if (pageModalSaving.value) return;
  groupModalOpen.value = false;
}

async function saveGroupModal() {
  if (!pageReportRefId.value) return;
  const name = groupModalName.value.trim();
  if (!name) {
    groupModalError.value = "Informe um nome para o grupo.";
    return;
  }

  pageModalSaving.value = true;
  groupModalError.value = "";
  try {
    if (groupModalMode.value === "create") {
      await createPageGroup(pageReportRefId.value, {
        name,
        pageIds: groupModalPageIds.value,
      });
    } else if (editingGroupId.value) {
      await updatePageGroup(editingGroupId.value, { name });
      await setPageGroupPages(editingGroupId.value, groupModalPageIds.value);
    }
    await loadPageConfig();
    groupModalOpen.value = false;
    push({ kind: "success", title: "Grupo salvo", message: name });
  } catch (e: any) {
    const ne = normalizeApiError(e);
    groupModalError.value = ne.message;
    push({ kind: "error", title: "Falha ao salvar grupo", message: ne.message });
  } finally {
    pageModalSaving.value = false;
  }
}

async function deleteGroup(group: { id: string; name: string }) {
  const ok = await confirm({
    title: "Excluir grupo?",
    message: `Você está prestes a excluir "${group.name}".`,
    confirmText: "Excluir",
    cancelText: "Cancelar",
    danger: true,
  });
  if (!ok) return;

  await mutate({
    key: group.id,
    busy: busyGroupDelete,
    request: async () => deletePageGroup(group.id),
    toast: {
      success: { title: "Grupo removido", message: group.name },
      error: { title: "Falha ao remover grupo" },
    },
  });
  await loadPageConfig();
}

async function toggleGroupActive(group: { id: string; isActive: boolean }) {
  await mutate({
    key: group.id,
    busy: busyGroupToggle,
    request: async () => updatePageGroup(group.id, { isActive: !group.isActive }),
    toast: {
      success: { title: "Grupo atualizado", message: group.isActive ? "Desativado" : "Ativado" },
      error: { title: "Falha ao atualizar grupo" },
    },
  });
  await loadPageConfig();
}

async function toggleGroupAssign(group: { id: string; assigned?: boolean }) {
  if (!customerId.value) return;
  await mutate({
    key: group.id,
    busy: busyGroupAssign,
    request: async () => setCustomerPageGroup(customerId.value, group.id, !group.assigned),
    toast: {
      success: { title: "Grupo aplicado", message: !group.assigned ? "ON" : "OFF" },
      error: { title: "Falha ao aplicar grupo" },
    },
  });
  await loadPageConfig();
}

async function togglePageAllow(page: { id: string; canView?: boolean }) {
  if (!customerId.value) return;
  await mutate({
    key: page.id,
    busy: busyPageAllow,
    request: async () => setCustomerPageAllow(customerId.value, page.id, !page.canView),
    toast: {
      success: { title: "Página atualizada", message: !page.canView ? "ON" : "OFF" },
      error: { title: "Falha ao atualizar página" },
    },
  });
  await loadPageConfig();
}

async function openPreview(page: { id: string; pageName: string; displayName: string | null }) {
  if (!pageReportRefId.value) return;
  if (!customerId.value) {
    push({
      kind: "info",
      title: "Selecione um customer",
      message: "Para pré-visualizar, selecione um customer como contexto.",
    });
    return;
  }

  previewOpen.value = true;
  previewLoading.value = true;
  previewError.value = "";
  previewPage.value = page;

  try {
    const cfg = await getAdminReportPreview(pageReportRefId.value, { customerId: customerId.value });
    await nextTick();
    if (!previewContainerEl.value) throw new Error("Container não encontrado");
    if (!previewService) {
      previewService = new pbi.service.Service(
        pbi.factories.hpmFactory,
        pbi.factories.wpmpFactory,
        pbi.factories.routerFactory,
      );
    }
    previewService.reset(previewContainerEl.value);
    previewService.embed(previewContainerEl.value, {
      type: "report",
      tokenType: pbi.models.TokenType.Embed,
      accessToken: cfg.embedToken,
      embedUrl: cfg.embedUrl,
      id: cfg.reportId,
      pageName: page.pageName,
      settings: { panes: { pageNavigation: { visible: false }, filters: { visible: false } } },
    });
  } catch (e: any) {
    const ne = normalizeApiError(e);
    previewError.value = ne.message;
  } finally {
    previewLoading.value = false;
  }
}

function closePreview() {
  if (previewService && previewContainerEl.value) {
    previewService.reset(previewContainerEl.value);
  }
  previewOpen.value = false;
  previewPage.value = null;
  previewError.value = "";
}
</script>
