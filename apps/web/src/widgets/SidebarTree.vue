<template>
  <div class="p-4 overflow-auto">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-sm font-semibold text-slate-900">Workspaces</h2>
      <button
        class="text-xs px-2 py-1 rounded-lg border bg-white text-slate-700 hover:bg-slate-50"
        :disabled="loadingWorkspaces"
        @click="loadWorkspaces"
      >
        {{ loadingWorkspaces ? "..." : "Recarregar" }}
      </button>
    </div>

    <div v-if="error" class="mt-3 text-xs text-red-700 whitespace-pre-wrap">{{ error }}</div>

    <div class="mt-3 space-y-2">
      <button
        v-for="w in workspaces"
        :key="w.workspaceId"
        class="w-full text-left rounded-xl px-3 py-2 border bg-white hover:bg-slate-50"
        :class="w.workspaceId === selectedWorkspaceId ? 'border-slate-900' : 'border-slate-200'"
        @click="selectWorkspace(w.workspaceId)"
      >
        <div class="text-sm font-medium text-slate-900 truncate">{{ w.name }}</div>
        <div class="text-xs text-slate-500 truncate">ID: {{ w.workspaceId }}</div>
      </button>
    </div>

    <div v-if="selectedWorkspaceId" class="mt-5">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-semibold text-slate-900">Reports</h3>
        <button
          class="text-xs px-2 py-1 rounded-lg border bg-white text-slate-700 hover:bg-slate-50"
          :disabled="loadingReports"
          @click="loadReports(selectedWorkspaceId)"
        >
          {{ loadingReports ? "..." : "Recarregar" }}
        </button>
      </div>

      <div class="mt-3 space-y-2">
        <button
          v-for="r in reports"
          :key="r.id"
          class="w-full text-left rounded-xl px-3 py-2 border bg-white hover:bg-slate-50"
          :class="r.id === selectedReportId ? 'border-slate-900' : 'border-slate-200'"
          @click="selectReport(r)"
        >
          <div class="text-sm font-medium text-slate-900 truncate">{{ r.name }}</div>
          <div class="text-xs text-slate-500 truncate">ReportId: {{ r.id }}</div>
        </button>

        <div v-if="!loadingReports && reports.length === 0" class="text-xs text-slate-600">
          Nenhum report autorizado neste workspace.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { http } from "@/api/http";

type Workspace = { workspaceId: string; name: string; customerId?: string };
type Report = { id: string; name: string; datasetId?: string; workspaceId: string };

const props = defineProps<{
  selectedWorkspaceId: string | null;
  selectedReportId: string | null;
}>();

const emit = defineEmits<{
  (e: "select-workspace", workspaceId: string): void;
  (e: "select-report", payload: { workspaceId: string; reportId: string }): void;
}>();

const workspaces = ref<Workspace[]>([]);
const reports = ref<Report[]>([]);
const loadingWorkspaces = ref(false);
const loadingReports = ref(false);
const error = ref("");

async function loadWorkspaces() {
  error.value = "";
  loadingWorkspaces.value = true;
  try {
    const res = await http.get<Workspace[]>("/powerbi/workspaces");
    workspaces.value = res.data;

    // auto-select (opcional) para UX
    if (!props.selectedWorkspaceId) {
    const first = workspaces.value[0];
    if (first) emit("select-workspace", first.workspaceId);
    }
  } catch (e: any) {
    error.value = `Falha ao listar workspaces: ${e?.message ?? String(e)}`;
  } finally {
    loadingWorkspaces.value = false;
  }
}

async function loadReports(workspaceId: string) {
  error.value = "";
  loadingReports.value = true;
  try {
    const res = await http.get<Report[]>("/powerbi/reports", { params: { workspaceId } });
    reports.value = res.data;
  } catch (e: any) {
    error.value = `Falha ao listar reports: ${e?.message ?? String(e)}`;
  } finally {
    loadingReports.value = false;
  }
}

function selectWorkspace(workspaceId: string) {
  emit("select-workspace", workspaceId);
}

function selectReport(r: Report) {
  emit("select-report", { workspaceId: r.workspaceId, reportId: r.id });
}

watch(
  () => props.selectedWorkspaceId,
  async (wsId) => {
    reports.value = [];
    if (wsId) await loadReports(wsId);
  },
  { immediate: true }
);

onMounted(async () => {
  await loadWorkspaces();
});
</script>
