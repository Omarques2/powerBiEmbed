<!-- apps/web/src/views/AdminView.vue -->
<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
    <div class="w-full px-2 py-3 sm:px-4 sm:py-4 lg:px-6">
      <!-- GLOBAL TOPBAR (spans sidebar + content) -->
      <AdminTopBar
        class="mb-3 sm:mb-4"
        :section="title"
        :subtitle="''"
        :loadingAny="loadingAny"
        :showSearch="false"
        @reload="reloadCurrentTab"
        @back="goBack"
        @search="noopSearch"
      />

      <div class="flex flex-col gap-3 lg:flex-row lg:gap-4">
        <!-- Sidebar -->
        <aside class="lg:w-[260px] xl:w-[280px]">
          <AdminSidebar
            :items="sidebarItems"
            :activeKey="tab"
            @select="onSelectTab"
          />
        </aside>

        <!-- Content -->
        <main class="min-w-0 flex-1">
          <div
            v-if="error"
            class="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700
                   dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200"
          >
            {{ error }}
          </div>

          <!-- ========================= -->
          <!-- TAB: OVERVIEW -->
          <!-- ========================= -->
          <div v-if="tab === 'overview'">
            <OverviewPanel />
          </div>

          <!-- ========================= -->
          <!-- TAB: CUSTOMERS -->
          <!-- ========================= -->
          <div v-else-if="tab === 'customers'">
            <CustomersPanel
              :customers="customersActiveFirst"
              :loading="loadingCustomers"
              :error="error"
              :refresh="loadCustomers"
              :upsertCustomerLocal="upsertCustomerLocal"
              :patchCustomerLocal="patchCustomerLocal"
            />
          </div>

          <!-- ========================= -->
          <!-- TAB: PENDING -->
          <!-- ========================= -->
          <div v-else-if="tab === 'pending'">
            <PendingUsersTab
              :loadingPending="loadingPending"
              :savingPending="savingPending"
              :pending="pending"
              :customers="customersActiveFirst"
              :selectedPending="selectedPending"
              :pendingCustomerId="pendingCustomerId"
              :pendingRole="pendingRole"
              :pendingGrantCustomerWorkspaces="pendingGrantCustomerWorkspaces"
              :pendingActionMsg="pendingActionMsg"
              :fmtDate="fmtDate"
              @selectPending="selectedPending = $event"
              @update:pendingCustomerId="pendingCustomerId = $event"
              @update:pendingRole="pendingRole = $event"
              @update:pendingGrantCustomerWorkspaces="pendingGrantCustomerWorkspaces = $event"
              @approve="approvePending"
              @disable="disablePending"
            />
          </div>

          <!-- ========================= -->
          <!-- TAB: POWER BI OPS -->
          <!-- ========================= -->
          <div v-else-if="tab === 'powerbi'">
            <PowerBiOpsPanel :customers="customersActiveFirst" />
          </div>

          <!-- ========================= -->
          <!-- TAB: SECURITY -->
          <!-- ========================= -->
          <div v-else-if="tab === 'security'">
            <SecurityPlatformAdminsPanel />
          </div>

          <!-- ========================= -->
          <!-- TAB: ACTIVE USERS + PERMS -->
          <!-- ========================= -->
          <ActiveUsersPermsPanel v-else-if="tab === 'active'" />

          <!-- ========================= -->
          <!-- TAB: AUDIT -->
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
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

import AdminSidebar, { type AdminTabKey } from "@/features/admin/components/AdminSidebar.vue";
import AdminTopBar from "@/features/admin/components/AdminTopBar.vue";

import PendingUsersTab from "@/features/admin/tabs/PendingUsersTab.vue";
import AuditTab from "@/features/admin/tabs/AuditTab.vue";
import OverviewPanel from "@/features/admin/OverviewPanel.vue";
import ActiveUsersPermsPanel from "@/features/admin/panels/ActiveUsersPermsPanel.vue";

import {
  type CustomerRow,
  type PendingUserRow,
  type MembershipRole,
  type AuditRow,
  listCustomers,
  listPendingUsers,
  activateUser,
  disableUser,
  listAuditLogs,
} from "@/features/admin/api";

import PowerBiOpsPanel from "@/features/admin/PowerBiOpsPanel.vue";
import CustomersPanel from "@/features/admin/CustomersPanel.vue";
import SecurityPlatformAdminsPanel from "@/features/admin/SecurityPlatformAdminsPanel.vue";

import { useConfirm } from "@/ui/confirm/useConfirm";
import { useToast } from "@/ui/toast/useToast";
import { normalizeApiError } from "@/ui/ops/normalizeApiError";

const router = useRouter();
const { confirm } = useConfirm();
const { push } = useToast();

// ------------------------------------
// Tabs (sidebar-driven)
// ------------------------------------
const sidebarItems: Array<{ key: AdminTabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "customers", label: "Customers" },
  { key: "pending", label: "Pending users" },
  { key: "powerbi", label: "Power BI Ops" },
  { key: "security", label: "Security" },
  { key: "active", label: "Active users + perms" },
  { key: "audit", label: "Audit" },
];

const tab = ref<AdminTabKey>("overview");

function onSelectTab(key: AdminTabKey) {
  tab.value = key;
}

function patchCustomerLocal(customerId: string, patch: Partial<CustomerRow>) {
  customers.value = customers.value.map((c) =>
    c.id === customerId ? ({ ...c, ...patch } as CustomerRow) : c
  );
}

function upsertCustomerLocal(row: CustomerRow) {
  const idx = customers.value.findIndex((c) => c.id === row.id);
  if (idx >= 0) {
    const next = [...customers.value];
    next[idx] = row;
    customers.value = next;
  } else {
    customers.value = [row, ...customers.value];
  }
}

// ------------------------------------
// Header helpers
// ------------------------------------
const title = computed(() => {
  switch (tab.value) {
    case "overview": return "Overview";
    case "customers": return "Customers";
    case "pending": return "Usuários pendentes";
    case "powerbi": return "Power BI Ops";
    case "security": return "Security";
    case "active": return "Usuários ativos + permissões";
    case "audit": return "Auditoria";
    default: return "Admin";
  }
});

function noopSearch() {}

function goBack() {
  router.replace("/app");
}

// ------------------------------------
// Global-ish state
// ------------------------------------
const error = ref("");

// ---------- CUSTOMERS ----------
const loadingCustomers = ref(false);
const customers = ref<CustomerRow[]>([]);

async function loadCustomers() {
  loadingCustomers.value = true;
  error.value = "";
  try {
    customers.value = await listCustomers();
  } catch (e: any) {
    const ne = normalizeApiError(e);
    error.value = ne.message;
    push({
      kind: "error",
      title: "Falha ao carregar customers",
      message: ne.message,
      details: ne.details,
      timeoutMs: 9000,
    });
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
const pendingGrantCustomerWorkspaces = ref<boolean>(true);
const pendingActionMsg = ref("");

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
    const ne = normalizeApiError(e);
    error.value = ne.message;
    push({
      kind: "error",
      title: "Falha ao carregar pendências",
      message: ne.message,
      details: ne.details,
      timeoutMs: 9000,
    });
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
    push({ kind: "success", title: "Usuário ativado", message: selectedPending.value.email ?? selectedPending.value.id });

    await loadPending();
  } catch (e: any) {
    const ne = normalizeApiError(e);
    error.value = ne.message;
    push({
      kind: "error",
      title: "Falha ao ativar usuário",
      message: ne.message,
      details: ne.details,
      timeoutMs: 9000,
    });
  } finally {
    savingPending.value = false;
  }
}

async function disablePending() {
  if (!selectedPending.value) return;

  const ok = await confirm({
    title: "Desativar usuário?",
    message: "Você está prestes a desativar este usuário. Esta ação é destrutiva e pode afetar acessos existentes.",
    confirmText: "Desativar",
    cancelText: "Cancelar",
    danger: true,
  });
  if (!ok) return;

  savingPending.value = true;
  error.value = "";
  pendingActionMsg.value = "";

  try {
    await disableUser(selectedPending.value.id);
    pendingActionMsg.value = "Usuário desativado.";
    push({ kind: "success", title: "Usuário desativado", message: selectedPending.value.email ?? selectedPending.value.id });

    await loadPending();
  } catch (e: any) {
    const ne = normalizeApiError(e);
    error.value = ne.message;
    push({
      kind: "error",
      title: "Falha ao desativar usuário",
      message: ne.message,
      details: ne.details,
      timeoutMs: 9000,
    });
  } finally {
    savingPending.value = false;
  }
}

// ---------- AUDIT ----------
const loadingAudit = ref(false);

const auditFilter = ref<{ action: string; entityType: string; entityId: string }>({
  action: "",
  entityType: "",
  entityId: "",
});

const auditPaged = ref<{ page: number; pageSize: number; total: number; rows: AuditRow[] }>({
  page: 1,
  pageSize: 25,
  total: 0,
  rows: [],
});

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

async function loadAudit(page: number) {
  loadingAudit.value = true;
  error.value = "";
  try {
    auditPaged.value = await listAuditLogs({
      page,
      pageSize: auditPaged.value.pageSize,
      action: auditFilter.value.action || undefined,
      entityType: auditFilter.value.entityType || undefined,
      entityId: auditFilter.value.entityId || undefined,
    });
  } catch (e: any) {
    const ne = normalizeApiError(e);
    error.value = ne.message;
    push({
      kind: "error",
      title: "Falha ao carregar auditoria",
      message: ne.message,
      details: ne.details,
      timeoutMs: 9000,
    });
  } finally {
    loadingAudit.value = false;
  }
}

// “any loading” (TopBar)
const loadingAny = computed(() =>
  loadingCustomers.value ||
  loadingPending.value ||
  savingPending.value ||
  loadingAudit.value
);

async function reloadCurrentTab() {
  error.value = "";
  if (tab.value === "pending") return loadPending();
  if (tab.value === "customers") return loadCustomers();
  if (tab.value === "powerbi") return loadCustomers();
  if (tab.value === "audit") return loadAudit(auditPaged.value.page || 1);
}

watch(tab, async (t) => {
  error.value = "";

  if ((t === "customers" || t === "powerbi") && customers.value.length === 0 && !loadingCustomers.value) {
    await loadCustomers();
  }

  if (t === "pending" && pending.value.length === 0 && !loadingPending.value) {
    await loadPending();
  }

  if (t === "audit" && auditPaged.value.rows.length === 0 && !loadingAudit.value) {
    await loadAudit(1);
  }
});

onMounted(async () => {
  await loadPending();
});
</script>
