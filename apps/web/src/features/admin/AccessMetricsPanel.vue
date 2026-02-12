<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm xl:flex-row xl:items-end xl:justify-between">
      <div>
        <div class="text-sm font-semibold text-foreground">Métricas de acesso</div>
        <div class="mt-1 text-xs text-muted-foreground">
          Logins por período, usuários ativos e eventos recentes de autenticação.
        </div>
      </div>

      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label class="text-xs text-muted-foreground">
          Janela
          <UiSelect v-model="windowValue" data-testid="metrics-window" class="mt-1 min-w-[120px]">
            <option v-for="item in windowOptions" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
          </UiSelect>
        </label>

        <label class="text-xs text-muted-foreground">
          Bucket
          <UiSelect v-model="bucketValue" data-testid="metrics-bucket" class="mt-1 min-w-[120px]">
            <option v-for="item in bucketOptions" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
          </UiSelect>
        </label>

        <label class="text-xs text-muted-foreground">
          Timezone
          <UiSelect v-model="timezoneValue" data-testid="metrics-timezone" class="mt-1 min-w-[180px]">
            <option v-for="tz in timezoneOptions" :key="tz.value" :value="tz.value">
              {{ tz.label }}
            </option>
          </UiSelect>
        </label>

        <UiButton
          type="button"
          size="sm"
          class="h-9 self-end"
          :disabled="loading"
          data-testid="metrics-apply"
          @click="refresh"
        >
          Atualizar
        </UiButton>
      </div>
    </div>

    <div
      v-if="error"
      class="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
      data-testid="metrics-error"
    >
      {{ error }}
    </div>

    <div v-if="loading" class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="metrics-loading">
      <div v-for="idx in 8" :key="idx" class="h-24 animate-pulse rounded-xl border border-border bg-muted/40" />
    </div>

    <template v-else-if="metrics">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div class="text-xs text-muted-foreground">Usuários ativos (15m)</div>
          <div class="mt-2 text-2xl font-semibold text-foreground" data-testid="kpi-active-now">
            {{ metrics.kpis.activeNow }}
          </div>
        </div>

        <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div class="text-xs text-muted-foreground">Logins no período</div>
          <div class="mt-2 text-2xl font-semibold text-foreground">{{ metrics.kpis.totalLoginsWindow }}</div>
        </div>

        <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div class="text-xs text-muted-foreground">Usuários únicos</div>
          <div class="mt-2 text-2xl font-semibold text-foreground">{{ metrics.kpis.uniqueLoginsWindow }}</div>
        </div>

        <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div class="text-xs text-muted-foreground">Média de logins/hora</div>
          <div class="mt-2 text-2xl font-semibold text-foreground">{{ metrics.kpis.avgLoginsPerHour }}</div>
        </div>

        <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div class="text-xs text-muted-foreground">Falhas de autenticação</div>
          <div class="mt-2 text-2xl font-semibold text-foreground">{{ metrics.kpis.failedAuthWindow }}</div>
        </div>

        <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div class="text-xs text-muted-foreground">Views de relatório</div>
          <div class="mt-2 text-2xl font-semibold text-foreground">{{ metrics.kpis.reportViewsWindow }}</div>
        </div>

        <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div class="text-xs text-muted-foreground">Customers com acesso</div>
          <div class="mt-2 text-2xl font-semibold text-foreground">{{ metrics.kpis.uniqueCustomersWindow }}</div>
        </div>

        <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div class="text-xs text-muted-foreground">Relatórios acessados</div>
          <div class="mt-2 text-2xl font-semibold text-foreground">{{ metrics.kpis.uniqueReportsWindow }}</div>
        </div>
      </div>

      <div v-if="isEmptyState" class="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground" data-testid="metrics-empty">
        Sem dados de login para o período selecionado.
      </div>

      <div v-else class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div class="xl:col-span-2">
          <div class="space-y-4">
            <LineChartSimple
              title="Logins por bucket"
              :points="chartPoints"
            />
            <LineChartSimple
              title="Views de relatório por bucket"
              :points="reportViewChartPoints"
            />
          </div>
        </div>

        <div class="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div class="mb-2 text-sm font-semibold text-foreground">Top usuários</div>
          <div class="overflow-auto">
            <table class="min-w-full text-left text-sm">
              <thead class="text-xs text-muted-foreground">
                <tr>
                  <th class="py-2 pr-3">Usuário</th>
                  <th class="py-2 pr-3">Logins</th>
                  <th class="py-2 pr-0">Último login</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr v-for="user in metrics.topUsers" :key="`${user.userId ?? user.email ?? 'unknown'}-${user.loginCount}`">
                  <td class="py-2 pr-3">
                    <div class="text-sm font-medium text-foreground">
                      {{ user.displayName ?? "—" }}
                    </div>
                    <div class="text-xs text-muted-foreground">
                      {{ user.email ?? user.userId ?? "—" }}
                    </div>
                  </td>
                  <td class="py-2 pr-3 text-foreground">{{ user.loginCount }}</td>
                  <td class="py-2 pr-0 text-xs text-muted-foreground">
                    {{ user.lastLoginAt ? fmtDate(user.lastLoginAt) : "—" }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div class="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div class="mb-2 text-sm font-semibold text-foreground">Acessos por customer</div>
          <div class="overflow-auto">
            <table class="min-w-full text-left text-sm">
              <thead class="text-xs text-muted-foreground">
                <tr>
                  <th class="py-2 pr-3">Customer</th>
                  <th class="py-2 pr-3">Acessos</th>
                  <th class="py-2 pr-3">Usuários</th>
                  <th class="py-2 pr-0">Último acesso</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr v-for="row in metrics.breakdowns.byCustomer" :key="row.customerId ?? row.customerCode ?? 'unknown'">
                  <td class="py-2 pr-3">
                    <div class="text-sm font-medium text-foreground">{{ row.customerName ?? "—" }}</div>
                    <div class="text-xs text-muted-foreground">{{ row.customerCode ?? row.customerId ?? "—" }}</div>
                  </td>
                  <td class="py-2 pr-3 text-foreground">{{ row.accessCount }}</td>
                  <td class="py-2 pr-3 text-foreground">{{ row.uniqueUsers }}</td>
                  <td class="py-2 pr-0 text-xs text-muted-foreground">{{ row.lastAccessAt ? fmtDate(row.lastAccessAt) : "—" }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div class="mb-2 text-sm font-semibold text-foreground">Acessos por relatório</div>
          <div class="overflow-auto">
            <table class="min-w-full text-left text-sm">
              <thead class="text-xs text-muted-foreground">
                <tr>
                  <th class="py-2 pr-3">Relatório</th>
                  <th class="py-2 pr-3">Acessos</th>
                  <th class="py-2 pr-3">Users/Customers</th>
                  <th class="py-2 pr-0">Último acesso</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr v-for="row in metrics.breakdowns.byReport" :key="row.reportRefId ?? row.reportId ?? 'unknown'">
                  <td class="py-2 pr-3">
                    <div class="text-sm font-medium text-foreground">{{ row.reportName ?? "—" }}</div>
                    <div class="text-xs text-muted-foreground">{{ row.workspaceName ?? row.workspaceId ?? "—" }}</div>
                  </td>
                  <td class="py-2 pr-3 text-foreground">{{ row.accessCount }}</td>
                  <td class="py-2 pr-3 text-xs text-foreground">{{ row.uniqueUsers }} / {{ row.uniqueCustomers }}</td>
                  <td class="py-2 pr-0 text-xs text-muted-foreground">{{ row.lastAccessAt ? fmtDate(row.lastAccessAt) : "—" }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div class="mb-2 text-sm font-semibold text-foreground">Eventos recentes de autenticação</div>
        <div class="overflow-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="text-xs text-muted-foreground">
              <tr>
                <th class="py-2 pr-3">Quando</th>
                <th class="py-2 pr-3">Ação</th>
                <th class="py-2 pr-3">Usuário</th>
                <th class="py-2 pr-0">IP</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr v-for="event in metrics.recentAuthEvents" :key="event.id">
                <td class="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">{{ fmtDate(event.createdAt) }}</td>
                <td class="py-2 pr-3 text-foreground">{{ event.action }}</td>
                <td class="py-2 pr-3">
                  <div class="text-sm font-medium text-foreground">{{ event.actor?.displayName ?? "—" }}</div>
                  <div class="text-xs text-muted-foreground">{{ event.actor?.email ?? event.actorUserId ?? "—" }}</div>
                </td>
                <td class="py-2 pr-0 text-xs text-muted-foreground">{{ event.ip ?? "—" }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  type AdminAccessMetricsDTO,
  type AdminMetricBucket,
  type AdminMetricWindow,
  getAdminAccessMetrics,
} from "@/features/admin/api/metrics";
import { normalizeApiError } from "@/ui/ops";
import { useToast } from "@/ui/toast/useToast";
import { Button as UiButton, Select as UiSelect } from "@/components/ui";
import LineChartSimple from "@/features/admin/components/LineChartSimple.vue";

const { push } = useToast();

const loading = ref(false);
const error = ref("");
const hasLoaded = ref(false);
const metrics = ref<AdminAccessMetricsDTO | null>(null);

const detectedTimezone = detectDefaultTimezone();
const windowValue = ref<AdminMetricWindow>("24h");
const bucketValue = ref<AdminMetricBucket>("hour");
const timezoneValue = ref(detectedTimezone);

const windowOptions: Array<{ value: AdminMetricWindow; label: string }> = [
  { value: "1h", label: "1h" },
  { value: "6h", label: "6h" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

const bucketOptions: Array<{ value: AdminMetricBucket; label: string }> = [
  { value: "hour", label: "Hora" },
  { value: "day", label: "Dia" },
];

const timezoneOptions = Array.from(
  new Set([detectedTimezone, "America/Sao_Paulo", "UTC", "America/New_York"]),
).map((value) => ({ value, label: value }));

function detectDefaultTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
  } catch {
    return "America/Sao_Paulo";
  }
}

const chartPoints = computed(() => {
  return (metrics.value?.series.loginsByBucket ?? []).map((item) => ({
    label: fmtBucketLabel(item.bucketStart),
    value: item.value,
  }));
});

const reportViewChartPoints = computed(() => {
  return (metrics.value?.series.reportViewsByBucket ?? []).map((item) => ({
    label: fmtBucketLabel(item.bucketStart),
    value: item.value,
  }));
});

const isEmptyState = computed(() => {
  if (!metrics.value) return false;
  const hasAnyLogin = metrics.value.series.loginsByBucket.some((point) => point.value > 0);
  const hasAnyReportView = metrics.value.series.reportViewsByBucket.some((point) => point.value > 0);
  return (
    !hasAnyLogin &&
    !hasAnyReportView &&
    metrics.value.topUsers.length === 0 &&
    metrics.value.breakdowns.byCustomer.length === 0 &&
    metrics.value.breakdowns.byReport.length === 0
  );
});

function fmtBucketLabel(iso: string) {
  try {
    const date = new Date(iso);
    if (bucketValue.value === "day") {
      return new Intl.DateTimeFormat("pt-BR", {
        timeZone: timezoneValue.value,
        day: "2-digit",
        month: "2-digit",
      }).format(date);
    }
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: timezoneValue.value,
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    }).format(date);
  } catch {
    return iso;
  }
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: timezoneValue.value });
  } catch {
    return iso;
  }
}

async function load(opts?: { source?: "initial" | "action" }) {
  const source = opts?.source ?? "action";
  const isInitial = source === "initial";
  if (isInitial) error.value = "";
  loading.value = true;
  try {
    metrics.value = await getAdminAccessMetrics({
      window: windowValue.value,
      bucket: bucketValue.value,
      timezone: timezoneValue.value,
      topLimit: 10,
    });
    error.value = "";
    hasLoaded.value = true;
  } catch (e: any) {
    const ne = normalizeApiError(e);
    if (!hasLoaded.value && isInitial) {
      error.value = ne.message;
    } else {
      push({
        kind: "error",
        title: "Falha ao carregar métricas",
        message: ne.message,
        details: ne.details,
        timeoutMs: 9000,
      });
    }
  } finally {
    loading.value = false;
  }
}

async function refresh() {
  await load({ source: "action" });
}

defineExpose({
  refresh,
});

onMounted(() => {
  load({ source: "initial" });
});
</script>
