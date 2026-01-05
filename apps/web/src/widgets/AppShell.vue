<template>
  <div class="min-h-screen bg-slate-100">
    <!-- Topbar (mobile) -->
    <div class="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b">
      <button
        class="rounded-lg px-3 py-2 bg-slate-900 text-white"
        @click="sidebarOpen = true"
      >
        Menu
      </button>
      <div class="text-sm font-semibold text-slate-900 truncate">PBI Embed</div>
      <button class="text-sm text-slate-700" @click="onLogout">Sair</button>
    </div>

    <div class="flex">
      <!-- Sidebar desktop -->
      <aside class="hidden lg:flex lg:flex-col w-80 min-h-screen bg-white border-r">
        <SidebarTree
          :selected-workspace-id="selectedWorkspaceId"
          :selected-report-id="selectedReportId"
          @select-workspace="onSelectWorkspace"
          @select-report="onSelectReport"
        />
        <div class="mt-auto p-4 border-t flex items-center justify-between">
          <div class="text-xs text-slate-600 truncate">{{ accountLabel }}</div>
          <button class="text-sm text-slate-700 hover:underline" @click="onLogout">Sair</button>
        </div>
      </aside>

      <!-- Drawer mobile -->
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-40 lg:hidden"
      >
        <div class="absolute inset-0 bg-black/30" @click="sidebarOpen = false"></div>
        <div class="absolute left-0 top-0 h-full w-80 bg-white border-r shadow z-50 flex flex-col">
          <div class="p-4 border-b flex items-center justify-between">
            <div class="font-semibold text-slate-900">Workspaces</div>
            <button class="text-slate-700" @click="sidebarOpen = false">Fechar</button>
          </div>

          <SidebarTree
            class="flex-1"
            :selected-workspace-id="selectedWorkspaceId"
            :selected-report-id="selectedReportId"
            @select-workspace="onSelectWorkspace"
            @select-report="(p) => { onSelectReport(p); sidebarOpen = false; }"
          />

          <div class="p-4 border-t flex items-center justify-between">
            <div class="text-xs text-slate-600 truncate">{{ accountLabel }}</div>
            <button class="text-sm text-slate-700 hover:underline" @click="onLogout">Sair</button>
          </div>
        </div>
      </div>

      <!-- Main viewer -->
      <main class="flex-1 min-h-screen p-3 lg:p-4">
        <div class="h-[calc(100vh-24px)] lg:h-[calc(100vh-32px)]">
          <PowerBiViewer
            :workspace-id="selectedWorkspaceId"
            :report-id="selectedReportId"
          />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import SidebarTree from "./SidebarTree.vue";
import PowerBiViewer from "./PowerBiViewer.vue";
import { getActiveAccount, logout } from "../auth/auth";

const sidebarOpen = ref(false);

const selectedWorkspaceId = ref<string | null>(null);
const selectedReportId = ref<string | null>(null);

function onSelectWorkspace(workspaceId: string) {
  selectedWorkspaceId.value = workspaceId;
  selectedReportId.value = null;
}

function onSelectReport(payload: { workspaceId: string; reportId: string }) {
  selectedWorkspaceId.value = payload.workspaceId;
  selectedReportId.value = payload.reportId;
}

const accountLabel = computed(() => {
  const acc = getActiveAccount();
  return acc?.username ?? acc?.name ?? "Usuário";
});

async function onLogout() {
  await logout();
}
</script>
