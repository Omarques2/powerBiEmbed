<!-- apps/web/src/views/AdminView.vue -->
<template>
  <div class="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div class="mx-auto max-w-[1400px] px-3 py-4">
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <!-- SIDEBAR (layout-only) -->
        <AdminSidebar
          :activeKey="tab"
          :items="sidebarItems"
          @select="onSelectTab"
        />

        <!-- MAIN -->
        <main class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <!-- TOP BAR (layout-only) -->
          <AdminTopBar
            :title="title"
            :subtitle="subtitle"
            :loadingAny="loadingAny"
            :showSearch="false"
            @reload="reloadCurrentTab"
            @back="goBack"
            @search="noopSearch"
          />

          <!-- ERROR -->
          <div
            v-if="error"
            class="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700
                   dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200"
          >
            {{ error }}
          </div>

          <!-- ========================= -->
          <!-- TAB: OVERVIEW (placeholder) -->
          <!-- ========================= -->
          <div v-if="tab === 'overview'" class="mt-6">
            <OverviewPanel />
          </div>

          <!-- ========================= -->
          <!-- TAB: PENDING USERS (extracted) -->
          <!-- ========================= -->
          <PendingUsersTab
            v-else-if="tab === 'pending'"
            :pending="pending"
            :loadingPending="loadingPending"
            :savingPending="savingPending"
            :selectedPending="selectedPending"
            :customers="customersActiveFirst"
            :pendingCustomerId="pendingCustomerId"
            :pendingRole="pendingRole"
            :pendingGrantCustomerWorkspaces="pendingGrantCustomerWorkspaces"
            :pendingActionMsg="pendingActionMsg"
            :fmtDate="fmtDate"
            @selectPending="selectPending"
            @update:pendingCustomerId="pendingCustomerId = $event"
            @update:pendingRole="pendingRole = $event"
            @update:pendingGrantCustomerWorkspaces="pendingGrantCustomerWorkspaces = $event"
            @approve="approvePending"
            @disable="disablePending"
          />

          <!-- ========================= -->
          <!-- TAB: CUSTOMERS -->
          <!-- ========================= -->
          <div v-else-if="tab === 'customers'" class="mt-6">
            <CustomersPanel
              :customers="customersActiveFirst"
              :loading="loadingCustomers"
              :error="error"
              :refresh="loadCustomers"
            />
          </div>

          <!-- ========================= -->
          <!-- TAB: SECURITY -->
          <!-- ========================= -->
          <div v-else-if="tab === 'security'" class="mt-6">
            <SecurityPlatformAdminsPanel />
          </div>

          <!-- ========================= -->
          <!-- TAB: POWER BI OPS -->
          <!-- ========================= -->
          <div v-else-if="tab === 'powerbi'" class="mt-6">
            <PowerBiOpsPanel :customers="customersActiveFirst" />
          </div>

          <!-- ========================= -->
          <!-- TAB: ACTIVE USERS + PERMS (extracted) -->
          <!-- ========================= -->
          <ActiveUsersPermsTab
            v-else-if="tab === 'active'"
            :loadingActive="loadingActive"
            :activeQuery="activeQuery"
            :activePaged="activePaged"
            :selectedActive="selectedActive"
            :loadingPerms="loadingPerms"
            :savingPerm="savingPerm"
            :perms="perms"
            :permsCustomerId="permsCustomerId"
            :permsMembershipOptions="permsMembershipOptions"
            :grantReportsOnWorkspaceEnable="grantReportsOnWorkspaceEnable"
            :permMsg="permMsg"
            :fmtDate="fmtDate"
            @update:activeQuery="activeQuery = $event"
            @loadActiveUsers="loadActiveUsers"
            @selectActive="selectActive"
            @reloadPerms="reloadPerms"
            @refreshSelectedUser="refreshSelectedUser"
            @update:permsCustomerId="permsCustomerId = $event"
            @update:grantReportsOnWorkspaceEnable="grantReportsOnWorkspaceEnable = $event"
            @toggleWorkspace="toggleWorkspace"
            @toggleReport="toggleReport"
          />

          <!-- ========================= -->
          <!-- TAB: AUDIT (extracted) -->
          <!-- ========================= -->
          <AuditTab
            v-else-if="tab === 'audit'"
            :loadingAudit="loadingAudit"
            :auditPaged="auditPaged"
            :auditFilter="auditFilter"
            :fmtDate="fmtDate"
            @update:auditFilter="auditFilter = $event"
            @loadAudit="loadAudit"
          />

          <div v-else class="mt-6 text-sm text-slate-600 dark:text-slate-300">
            Aba desconhecida.
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

import AdminSidebar, { type AdminTabKey } from "../admin/components/AdminSidebar.vue";
import AdminTopBar from "../admin/components/AdminTopBar.vue";

import PendingUsersTab from "../admin/tabs/PendingUsersTab.vue";
import ActiveUsersPermsTab from "../admin/tabs/ActiveUsersPermsTab.vue";
import AuditTab from "../admin/tabs/AuditTab.vue";
import OverviewPanel from "../admin/OverviewPanel.vue";

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
import CustomersPanel from "../admin/CustomersPanel.vue";
import SecurityPlatformAdminsPanel from "../admin/SecurityPlatformAdminsPanel.vue";

const router = useRouter();

// ------------------------------------
// Tabs (sidebar-driven)
// ------------------------------------
const sidebarItems: Array<{ key: AdminTabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "pending", label: "Identity · Pendentes" },
  { key: "active", label: "Identity · Usuários ativos" },
  { key: "customers", label: "Customers" },
  { key: "security", label: "Security" },
  { key: "audit", label: "Audit" },
  { key: "powerbi", label: "Power BI Ops" },
];

const tab = ref<AdminTabKey>("pending");

function onSelectTab(k: AdminTabKey) {
  tab.value = k;
}

const title = computed(() => {
  switch (tab.value) {
    case "overview": return "Overview";
    case "pending": return "Usuários pendentes";
    case "active": return "Usuários ativos";
    case "customers": return "Customers";
    case "security": return "Security";
    case "audit": return "Auditoria";
    case "powerbi": return "Power BI Ops";
    default: return "Admin";
  }
});

const subtitle = computed(() => {
  switch (tab.value) {
    case "overview": return "Centro operacional (em evolução).";
    case "pending": return "Aprovar/ativar e atribuir memberships.";
    case "active": return "Gerenciar memberships e permissões de Power BI.";
    case "customers": return "Cadastro e status de customers.";
    case "security": return "Platform admins e operações de risco.";
    case "audit": return "Rastreabilidade de ações administrativas.";
    case "powerbi": return "Sincronização e catálogo Power BI.";
    default: return "";
  }
});

function noopSearch() {
  // Nesta fase mantive desligado (showSearch=false).
  // Você pluga aqui GlobalSearchPalette quando estiver pronto.
}

function goBack() {
  router.replace("/app");
}

// ------------------------------------
// Shared state
// ------------------------------------
const error = ref("");

// ---------- typed perms payload ----------
type MembershipRole = "owner" | "admin" | "member" | "viewer";

type MembershipRow = {
  customerId: string;
  role: MembershipRole;
  isActive: boolean;
  customer: { id: string; code: string; name: string; status: string };
};

type ReportPermRow = {
  reportRefId: string;
  reportId: string;
  name: string;
  canView: boolean;
};

type WorkspacePermRow = {
  workspaceRefId: string;
  workspaceId: string;
  name: string;
  canView: boolean;
  reports: ReportPermRow[];
};

type UserPermissionsResponse = {
  memberships: MembershipRow[];
  workspaces: WorkspacePermRow[];
};

// ---------- shared helpers ----------
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

// customers are shared across tabs (pending/customers/powerbi)
const loadingCustomers = ref(false);
const customers = ref<CustomerRow[]>([]);

const loadingAny = computed(() =>
  loadingCustomers.value ||
  loadingPending.value ||
  loadingActive.value ||
  loadingPerms.value ||
  loadingAudit.value
);

// ---------- CUSTOMERS ----------
async function loadCustomers() {
  loadingCustomers.value = true;
  error.value = "";
  try {
    customers.value = await listCustomers();
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? String(e);
  } finally {
    loadingCustomers.value = false;
  }
}

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

// ---------- PENDING ----------
const loadingPending = ref(false);
const savingPending = ref(false);

const pending = ref<PendingUserRow[]>([]);
const selectedPending = ref<PendingUserRow | null>(null);

const pendingCustomerId = ref<string>("");
const pendingRole = ref<MembershipRole>("viewer");
const pendingGrantCustomerWorkspaces = ref(true);
const pendingActionMsg = ref("");

function selectPending(u: PendingUserRow) {
  selectedPending.value = u;
  pendingCustomerId.value = "";
  pendingRole.value = "viewer";
  pendingGrantCustomerWorkspaces.value = true;
  pendingActionMsg.value = "";
}

async function loadPending() {
  loadingPending.value = true;
  error.value = "";
  try {
    const [p, c] = await Promise.all([listPendingUsers(), listCustomers()]);
    pending.value = p;
    customers.value = c;

    if (selectedPending.value && !pending.value.find((x) => x.id === selectedPending.value!.id)) {
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
const perms = ref<UserPermissionsResponse | null>(null);
const permsCustomerId = ref<string>("");
const permMsg = ref("");
const grantReportsOnWorkspaceEnable = ref(true);

const permsMembershipOptions = computed<MembershipRow[]>(() => {
  const ms = perms.value?.memberships ?? [];
  const active = ms.filter((m: MembershipRow) => m.isActive);
  return active.length ? active : ms;
});

async function loadActiveUsers(page = 1) {
  loadingActive.value = true;
  error.value = "";
  try {
    const data = await listActiveUsers(activeQuery.value, page, activePaged.value.pageSize);
    activePaged.value = data as any;

    if (selectedActive.value && !data.rows.find((x: any) => x.id === selectedActive.value!.id)) {
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

function pickDefaultCustomerId(memberships: MembershipRow[], preferred?: string): string {
  const active = memberships.filter((m) => m.isActive);
  const allowed = new Set(active.map((m) => m.customerId));

  if (preferred && (allowed.size === 0 || allowed.has(preferred))) return preferred;

  const firstActive = active[0];
  if (firstActive) return firstActive.customerId;

  const firstAny = memberships[0];
  return firstAny?.customerId ?? "";
}

async function refreshSelectedUser() {
  if (!selectedActive.value) return;

  loadingPerms.value = true;
  error.value = "";
  permMsg.value = "";

  const userId = selectedActive.value.id;
  const currentCustomerId = permsCustomerId.value || undefined;

  try {
    const base = (await getUserPermissions(userId, currentCustomerId)) as unknown as UserPermissionsResponse;

    const desired = pickDefaultCustomerId(base.memberships ?? [], permsCustomerId.value);
    permsCustomerId.value = desired;

    if (desired && desired !== currentCustomerId) {
      perms.value = (await getUserPermissions(userId, desired)) as unknown as UserPermissionsResponse;
    } else {
      perms.value = base;
    }
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? String(e);
  } finally {
    loadingPerms.value = false;
  }
}

async function reloadPerms() {
  if (!selectedActive.value) return;

  loadingPerms.value = true;
  error.value = "";
  permMsg.value = "";

  const userId = selectedActive.value.id;
  const preferredCustomerId = permsCustomerId.value || undefined;

  try {
    const base = (await getUserPermissions(userId, preferredCustomerId)) as unknown as UserPermissionsResponse;

    const desired = pickDefaultCustomerId(base.memberships ?? [], permsCustomerId.value);
    permsCustomerId.value = desired;

    if (desired && desired !== preferredCustomerId) {
      perms.value = (await getUserPermissions(userId, desired)) as unknown as UserPermissionsResponse;
    } else {
      perms.value = base;
    }
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? String(e);
  } finally {
    loadingPerms.value = false;
  }
}

async function toggleWorkspace(ws: WorkspacePermRow) {
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

async function toggleReport(r: ReportPermRow) {
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
    auditPaged.value = data as any;
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
  if (tab.value === "customers") return loadCustomers();
  if (tab.value === "powerbi") return loadCustomers();
  if (tab.value === "security") return;
  if (tab.value === "active") {
    await loadActiveUsers(activePaged.value.page || 1);
    if (selectedActive.value) await reloadPerms();
    return;
  }
  if (tab.value === "audit") return loadAudit(auditPaged.value.page || 1);
  if (tab.value === "overview") return;
}

watch(tab, async (t) => {
  error.value = "";

  if ((t === "customers" || t === "powerbi") && customers.value.length === 0 && !loadingCustomers.value) {
    await loadCustomers();
  }

  if (t === "pending" && pending.value.length === 0) await loadPending();
  if (t === "active" && activePaged.value.rows.length === 0) await loadActiveUsers(1);
  if (t === "audit" && auditPaged.value.rows.length === 0) await loadAudit(1);
});

onMounted(async () => {
  await loadPending(); // já traz customers também
});
</script>
