<!-- src/views/ShellView.vue -->
<template>
  <div
    class="h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 [--topbar-h:72px]"
  >
    <div class="flex h-screen overflow-hidden">
      <!-- Desktop sidebar (collapsible) -->
      <aside
        class="hidden shrink-0 border-r bg-white dark:bg-slate-900 dark:border-slate-800 lg:flex lg:flex-col transition-[width] duration-200"
        :class="sidebarOpen ? 'w-80' : 'w-[72px]'"
      >
        <SidebarContent
          mode="desktop"
          :collapsed="!sidebarOpen"
          :workspaces="workspaces"
          :reports="reports"
          :selected-workspace-id="selectedWorkspaceId"
          :selected-report="selectedReport"
          :loading-workspaces="loadingWorkspaces"
          :loading-reports="loadingReports"
          :error="error"
          :load-workspaces="loadWorkspaces"
          :load-reports="loadReports"
          :select-workspace="selectWorkspace"
          :open-report="openReport"
          :is-admin="isAdmin"
          :go-admin="goAdmin"
          :on-logout="onLogout"
          :user-name="me?.displayName ?? null"
          :user-email="me?.email ?? null"
          @toggle-collapsed="sidebarOpen = !sidebarOpen"
        />
      </aside>

      <!-- Mobile overlay -->
      <div
        v-if="drawerOpen"
        class="fixed inset-0 z-40 bg-black/40 lg:hidden"
        @click="drawerOpen = false"
      />

      <!-- Mobile drawer -->
      <aside
        class="fixed left-0 top-0 z-50 h-full w-80 max-w-[85vw] border-r bg-white dark:bg-slate-900 dark:border-slate-800 shadow-lg transition-transform lg:hidden"
        :class="drawerOpen ? 'translate-x-0' : '-translate-x-full'"
      >
        <SidebarContent
          mode="mobile"
          :collapsed="false"
          :workspaces="workspaces"
          :reports="reports"
          :selected-workspace-id="selectedWorkspaceId"
          :selected-report="selectedReport"
          :loading-workspaces="loadingWorkspaces"
          :loading-reports="loadingReports"
          :error="error"
          :load-workspaces="loadWorkspaces"
          :load-reports="loadReports"
          :select-workspace="selectWorkspace"
          :open-report="openReport"
          :is-admin="isAdmin"
          :go-admin="goAdmin"
          :on-logout="onLogout"
          :user-name="me?.displayName ?? null"
          :user-email="me?.email ?? null"
          @close="drawerOpen = false"
        />
      </aside>

      <!-- Main viewer -->
      <main class="flex min-w-0 flex-1 flex-col overflow-hidden">
        <!-- Top bar -->
        <div
          class="border-b bg-white dark:bg-slate-900 dark:border-slate-800 px-4 h-[var(--topbar-h)] flex items-center"
        >
          <div class="flex w-full items-center gap-3">
            <!-- Hamburger (mobile only) -->
            <button
              class="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white
                     hover:bg-slate-50 active:scale-[0.98] transition
                     dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 lg:hidden"
              aria-label="Abrir menu"
              title="Menu"
              @click="drawerOpen = !drawerOpen"
            >
              <HamburgerIcon class="h-5 w-5" />
            </button>

            <!-- Title / Context -->
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold">
                {{ selectedReport?.name ?? "Selecione um relatório" }}
              </div>
              <div class="truncate text-xs text-slate-500 dark:text-slate-400">
                {{ selectedWorkspace?.name ?? "Selecione um workspace" }}
              </div>
            </div>

            <!-- Actions -->
            <div class="shrink-0 flex items-center gap-2">
              <div v-if="loadingEmbed" class="hidden sm:block text-xs text-slate-500 dark:text-slate-400">
                Gerando embed token...
              </div>

              <!-- Theme toggle (isolado em componente) -->
              <ThemeToggle />

              <!-- Print BI -->
              <button
                class="inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium
                       border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] transition
                       disabled:opacity-60 disabled:cursor-not-allowed
                       dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                :disabled="!selectedReport || loadingEmbed || printing || !reportReady"
                @click="printBiArea"
              >
                <svg
                  class="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 9V4h12v5" />
                  <path d="M6 18h12v2H6z" />
                  <path d="M6 14h12v4H6z" />
                  <path d="M6 11H5a3 3 0 0 0-3 3v3h4" />
                  <path d="M18 11h1a3 3 0 0 1 3 3v3h-4" />
                </svg>
                <span class="hidden md:inline">
                  {{ printing ? "Abrindo..." : "Imprimir PDF" }}
                </span>
              </button>

              <!-- Refresh -->
              <button
                class="inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium
                       border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] transition
                       disabled:opacity-60 disabled:cursor-not-allowed
                       dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                :disabled="!selectedReport || loadingEmbed"
                @click="refreshEmbed"
              >
                <IconRefresh class="h-5 w-5" :class="loadingEmbed ? 'animate-spin' : ''" />
                <span class="hidden md:inline">
                  {{ loadingEmbed ? "Recarregando…" : "Recarregar" }}
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Viewer area (centralizado + sem scroll) -->
        <div class="flex-1 min-h-0 overflow-hidden bg-slate-50 dark:bg-slate-950 p-2 sm:p-3 lg:p-4">
          <div class="h-full w-full overflow-hidden flex items-center justify-center">
            <div
              ref="stageEl"
              class="print-bi-area relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm
                     dark:border-slate-800 dark:bg-slate-900
                     aspect-video
                     max-h-[calc(100dvh-var(--topbar-h)-1rem)]
                     sm:max-h-[calc(100dvh-var(--topbar-h)-1.5rem)]
                     lg:aspect-auto lg:h-full lg:max-h-full"
            >
              <div ref="containerEl" class="absolute inset-0" />

              <div v-if="!selectedReport" class="absolute inset-0 grid place-items-center p-6">
                <div class="w-[min(760px,94%)]">
                  <div class="mb-4">
                    <div class="text-sm font-medium text-slate-700 dark:text-slate-200">
                      Selecione um relatório
                    </div>
                    <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Escolha um workspace e um report no menu lateral para renderizar o Power BI.
                    </div>
                  </div>

                  <ReportSkeletonCard>
                    <template #footer>
                      Dica: use “Recarregar workspaces” se não aparecer nada.
                    </template>
                  </ReportSkeletonCard>
                </div>
              </div>

              <div
                v-if="selectedReport && loadingEmbed"
                class="absolute inset-0 z-10 grid place-items-center bg-white/70 dark:bg-slate-950/60 backdrop-blur-sm"
              >
                <div class="w-[min(760px,94%)]">
                  <div class="mb-4 flex items-center gap-3">
                    <div
                      class="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900
                             dark:border-slate-700 dark:border-t-slate-200"
                    />
                    <div class="text-sm font-medium text-slate-700 dark:text-slate-200">
                      Carregando relatório…
                    </div>
                  </div>

                  <ReportSkeletonCard>
                    <template #footer>
                      Gerando embed token e inicializando o Power BI…
                    </template>
                  </ReportSkeletonCard>
                </div>
              </div>

              <div
                v-if="error && selectedReport"
                class="absolute bottom-3 left-3 right-3 z-20 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 shadow
                       dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200"
              >
                {{ error }}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import * as pbi from "powerbi-client";

import ThemeToggle from "@/ui/theme/ThemeToggle.vue";

import { http } from "@/api/http";
import { logout } from "../auth/auth";
import HamburgerIcon from "../components/icons/HamburgerIcon.vue";
import SidebarContent from "../components/SidebarContent.vue";
import ReportSkeletonCard from "../components/ReportSkeletonCard.vue";
import IconRefresh from "../components/icons/IconRefresh.vue";

type Workspace = { id?: string; workspaceId?: string; name?: string };
type Report = { id: string; name?: string; workspaceId?: string };
type MeResponse = {
  email: string | null;
  displayName: string | null;
  status: "pending" | "active" | "disabled";
  rawStatus?: string;
  memberships?: any[];
};

const router = useRouter();

const me = ref<MeResponse | null>(null);
const isAdmin = ref(false);

const drawerOpen = ref(false);
const sidebarOpen = ref(true);

const workspaces = ref<Workspace[]>([]);
const reports = ref<Report[]>([]);

const selectedWorkspace = ref<Workspace | null>(null);
const selectedWorkspaceId = ref<string | null>(null);
const selectedReport = ref<Report | null>(null);

const loadingWorkspaces = ref(false);
const loadingReports = ref(false);
const loadingEmbed = ref(false);
const error = ref("");

const stageEl = ref<HTMLDivElement | null>(null);
const containerEl = ref<HTMLDivElement | null>(null);
const printing = ref(false);
const reportReady = ref(false);
const lastRenderAt = ref(0);

let powerbiService: pbi.service.Service | null = null;
let resizeObs: ResizeObserver | null = null;
let embeddedReport: pbi.Report | null = null;

function createPowerBiService() {
  return new pbi.service.Service(
    pbi.factories.hpmFactory,
    pbi.factories.wpmpFactory,
    pbi.factories.routerFactory
  );
}

function resetEmbed() {
  try {
    if (powerbiService && containerEl.value) powerbiService.reset(containerEl.value);
  } catch {
    // ignore reset errors
  }
  embeddedReport = null;
}

async function applyReportLayout() {
  if (!embeddedReport) return;

  const displayOption = pbi.models.DisplayOption.FitToPage;

  try {
    await embeddedReport.updateSettings({
      layoutType: pbi.models.LayoutType.Custom,
      customLayout: { displayOption },
    } as any);
  } catch {
    // ignore layout errors
  }
}

function resizeEmbedded() {
  try {
    if (!powerbiService || !containerEl.value || !selectedReport.value) return;

    const svc = powerbiService as any;
    if (typeof svc.resize === "function") {
      svc.resize(containerEl.value);
    }
    void applyReportLayout();
  } catch {
    // ignore resize errors
  }
}

function addResizeHandlers() {
  window.addEventListener("resize", resizeEmbedded);

  if (typeof ResizeObserver !== "undefined" && stageEl.value) {
    resizeObs = new ResizeObserver(() => resizeEmbedded());
    resizeObs.observe(stageEl.value);
  }
}

function removeResizeHandlers() {
  window.removeEventListener("resize", resizeEmbedded);
  if (resizeObs) {
    resizeObs.disconnect();
    resizeObs = null;
  }
}

function waitForReportRender(timeoutMs = 8000): Promise<boolean> {
  if (reportReady.value && Date.now() - lastRenderAt.value < 15_000) {
    return Promise.resolve(true);
  }

  if (!embeddedReport) return Promise.resolve(false);

  return new Promise((resolve) => {
    let done = false;
    const timer = window.setTimeout(() => {
      if (done) return;
      done = true;
      embeddedReport?.off("rendered", onRendered);
      resolve(false);
    }, timeoutMs);

    const onRendered = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      embeddedReport?.off("rendered", onRendered);
      resolve(true);
    };

    embeddedReport.on("rendered", onRendered);
  });
}

async function printBiArea() {
  if (!selectedReport.value || loadingEmbed.value) return;
  if (printing.value) return;
  printing.value = true;

  const ready = await waitForReportRender();
  if (!ready) {
    error.value = "Relatorio ainda esta carregando. Tente novamente em alguns segundos.";
    printing.value = false;
    return;
  }

  try {
    if (embeddedReport && typeof embeddedReport.print === "function") {
      await embeddedReport.print();
      return;
    }
    throw new Error("Print nao suportado pelo embed.");
  } catch (e: any) {
    error.value = `Falha ao imprimir: ${e?.message ?? String(e)}`;
  } finally {
    printing.value = false;
  }
}

watch(sidebarOpen, () => {
  window.setTimeout(() => resizeEmbedded(), 260);
});

watch(drawerOpen, () => {
  window.setTimeout(() => resizeEmbedded(), 80);
});

watch(sidebarOpen, (open) => {
  if (!open && selectedWorkspaceId.value && reports.value.length === 0) {
    void loadReports(selectedWorkspaceId.value);
  }
});

async function loadWorkspaces() {
  error.value = "";
  loadingWorkspaces.value = true;
  try {
    const res = await http.get("/powerbi/workspaces");
    workspaces.value = res.data;

    if (workspaces.value.length > 0 && !selectedWorkspaceId.value) {
      await selectWorkspace(workspaces.value[0]!);
    }
  } catch (e: any) {
    error.value = `Falha ao listar workspaces: ${e?.response?.data?.message ?? e?.message ?? String(e)}`;
  } finally {
    loadingWorkspaces.value = false;
  }
}

async function loadReports(workspaceId: string) {
  error.value = "";
  loadingReports.value = true;
  try {
    const res = await http.get("/powerbi/reports", { params: { workspaceId } });
    reports.value = res.data;

    if (selectedReport.value && !reports.value.find((r) => r.id === selectedReport.value!.id)) {
      selectedReport.value = null;
      resetEmbed();
    }
  } catch (e: any) {
    error.value = `Falha ao listar reports: ${e?.response?.data?.message ?? e?.message ?? String(e)}`;
  } finally {
    loadingReports.value = false;
  }
}

async function selectWorkspace(w: Workspace) {
  const id = (w.workspaceId ?? w.id) as string;
  if (!id) return;

  if (selectedWorkspaceId.value !== id) {
    selectedWorkspace.value = w;
    selectedWorkspaceId.value = id;

    selectedReport.value = null;
    reports.value = [];
    resetEmbed();

    await loadReports(id);
  } else {
    if (!sidebarOpen.value && reports.value.length === 0) await loadReports(id);
  }
}

async function openReport(r: Report) {
  error.value = "";
  selectedReport.value = r;
  loadingEmbed.value = true;
  reportReady.value = false;

  try {
    resetEmbed();

    const workspaceId = r.workspaceId ?? selectedWorkspaceId.value;
    if (!workspaceId) throw new Error("Workspace não selecionado.");

    const cfgRes = await http.get("/powerbi/embed-config", {
      params: { workspaceId, reportId: r.id },
    });

    const cfg = cfgRes.data;

    const embedConfig: pbi.IEmbedConfiguration = {
      type: "report",
      tokenType: pbi.models.TokenType.Embed,
      accessToken: cfg.embedToken,
      embedUrl: cfg.embedUrl,
      id: cfg.reportId,
      settings: {
        panes: { filters: { visible: false }, pageNavigation: { visible: true } },
      },
    };

    if (!powerbiService) powerbiService = createPowerBiService();
    if (!containerEl.value) throw new Error("Container do embed não encontrado.");

    const report = powerbiService.embed(containerEl.value, embedConfig) as pbi.Report;
    embeddedReport = report;

    report.off("error");
    report.off("loaded");
    report.off("rendered");

    report.on("loaded", async () => {
      loadingEmbed.value = false;
      await applyReportLayout();
      window.setTimeout(() => resizeEmbedded(), 0);
    });

    report.on("rendered", () => {
      loadingEmbed.value = false;
      reportReady.value = true;
      lastRenderAt.value = Date.now();
      window.setTimeout(() => resizeEmbedded(), 0);
    });

    report.on("error", (event: any) => {
      console.error("Power BI error:", event?.detail ?? event);
      error.value = `Erro do Power BI: ${JSON.stringify(event?.detail ?? event)}`;
      loadingEmbed.value = false;
      reportReady.value = false;
    });
  } catch (e: any) {
    error.value = `Falha ao embutir report: ${e?.response?.data?.message ?? e?.message ?? String(e)}`;
    loadingEmbed.value = false;
    reportReady.value = false;
  }
}

async function refreshEmbed() {
  if (!selectedReport.value) return;
  await openReport(selectedReport.value);
}

async function onLogout() {
  await logout();
}

async function loadMe() {
  try {
    const res = await http.get("/users/me");
    me.value = res.data;
  } catch {
    me.value = null;
  }
}

async function checkAdmin() {
  try {
    await http.get("/admin/me");
    isAdmin.value = true;
  } catch {
    isAdmin.value = false;
  }
}

async function goAdmin() {
  await router.push("/admin");
}

onMounted(async () => {
  addResizeHandlers();

  powerbiService = createPowerBiService();

  await loadMe();

  if (!me.value) {
    await router.replace("/login");
    return;
  }

  if (me.value.status !== "active") {
    await router.replace("/pending");
    return;
  }

  await checkAdmin();
  await loadWorkspaces();
});

onBeforeUnmount(() => {
  removeResizeHandlers();
  resetEmbed();
});
</script>
