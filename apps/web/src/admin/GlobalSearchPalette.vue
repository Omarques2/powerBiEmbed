<!-- apps/web/src/admin/GlobalSearchPalette.vue -->
<template>
  <teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[1000]">
      <div class="absolute inset-0 bg-black/40" @click="close"></div>

      <div class="absolute left-1/2 top-16 w-[min(720px,92vw)] -translate-x-1/2">
        <div class="rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <!-- Header / Input -->
          <div class="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
            <input
              ref="inputEl"
              v-model="q"
              type="text"
              class="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
              placeholder="Buscar: usuários, customers, workspaces, reports…"
              @keydown.down.prevent="move(1)"
              @keydown.up.prevent="move(-1)"
              @keydown.enter.prevent="pickActive"
              @keydown.esc.prevent="close"
            />
            <div class="text-[11px] text-slate-500 dark:text-slate-400">ESC</div>
          </div>

          <!-- Body -->
          <div class="max-h-[60vh] overflow-auto p-2">
            <div
              v-if="error"
              class="rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
            >
              {{ error }}
            </div>

            <div v-else-if="loading" class="p-3 text-xs text-slate-500 dark:text-slate-400">
              Buscando…
            </div>

            <div v-else class="space-y-2">
              <SearchSection
                title="Users"
                :items="items.users"
                :activeIndex="activeIndex"
                :offset="offsets.users"
                @pick="pick"
              />
              <SearchSection
                title="Customers"
                :items="items.customers"
                :activeIndex="activeIndex"
                :offset="offsets.customers"
                @pick="pick"
              />
              <SearchSection
                title="Power BI · Workspaces"
                :items="items.workspaces"
                :activeIndex="activeIndex"
                :offset="offsets.workspaces"
                @pick="pick"
              />
              <SearchSection
                title="Power BI · Reports"
                :items="items.reports"
                :activeIndex="activeIndex"
                :offset="offsets.reports"
                @pick="pick"
              />

              <div v-if="total === 0" class="p-3 text-xs text-slate-500 dark:text-slate-400">
                Nenhum resultado.
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div
            class="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400"
          >
            <div>Enter para abrir · ↑↓ navegar</div>
            <div>Ctrl+K para abrir</div>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";
import { globalSearch } from "./adminApi";
import SearchSection, { type SearchItem } from "./components/SearchSection.vue";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "pick", item: SearchItem): void;
}>();

const open = computed(() => props.modelValue);
const inputEl = ref<HTMLInputElement | null>(null);

const q = ref("");
const loading = ref(false);
const error = ref("");

const items = reactive({
  users: [] as SearchItem[],
  customers: [] as SearchItem[],
  workspaces: [] as SearchItem[],
  reports: [] as SearchItem[],
});

const activeIndex = ref(0);

const total = computed(
  () => items.users.length + items.customers.length + items.workspaces.length + items.reports.length,
);

const offsets = computed(() => {
  const oUsers = 0;
  const oCustomers = oUsers + items.users.length;
  const oWs = oCustomers + items.customers.length;
  const oReports = oWs + items.workspaces.length;
  return {
    users: oUsers,
    customers: oCustomers,
    workspaces: oWs,
    reports: oReports,
  };
});

function resetResults() {
  items.users = [];
  items.customers = [];
  items.workspaces = [];
  items.reports = [];
  activeIndex.value = 0;
}

function close() {
  emit("update:modelValue", false);
  q.value = "";
  error.value = "";
  resetResults();
}

function move(delta: number) {
  if (total.value <= 0) return;
  activeIndex.value = (activeIndex.value + delta + total.value) % total.value;
}

function getByLinearIndex(i: number): SearchItem | null {
  if (i < items.users.length) return items.users[i] ?? null;
  i -= items.users.length;

  if (i < items.customers.length) return items.customers[i] ?? null;
  i -= items.customers.length;

  if (i < items.workspaces.length) return items.workspaces[i] ?? null;
  i -= items.workspaces.length;

  if (i < items.reports.length) return items.reports[i] ?? null;

  return null;
}

function pickActive() {
  const it = getByLinearIndex(activeIndex.value);
  if (it) pick(it);
}

function pick(it: SearchItem) {
  emit("pick", it);
  close();
}

let debounceTimer: number | undefined;

async function doSearch() {
  const qq = q.value.trim();

  if (!qq) {
    error.value = "";
    resetResults();
    return;
  }

  loading.value = true;
  error.value = "";

  try {
    const res = await globalSearch(qq, 8);

    items.users = (res.users ?? []).map((u: any) => ({
      type: "user",
      id: u.id,
      title: u.email ?? u.displayName ?? u.id,
      subtitle: `${u.displayName ?? "—"} · ${u.status ?? "—"}`,
    }));

    items.customers = (res.customers ?? []).map((c: any) => ({
      type: "customer",
      id: c.id,
      title: `${c.code} · ${c.name}`,
      subtitle: c.status ?? "—",
    }));

    items.workspaces = (res.powerbi?.workspaces ?? []).map((w: any) => ({
      type: "workspace",
      id: w.id,
      title: w.name,
      subtitle: `workspaceId: ${w.workspaceId}`,
    }));

    items.reports = (res.powerbi?.reports ?? []).map((r: any) => ({
      type: "report",
      id: r.id,
      title: r.name,
      subtitle: `reportId: ${r.reportId} · dataset: ${r.datasetId ?? "—"}`,
    }));

    activeIndex.value = 0;
  } catch (e: any) {
    error.value = e?.message ?? "Falha ao buscar";
  } finally {
    loading.value = false;
  }
}

watch(
  () => q.value,
  () => {
    if (debounceTimer) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(doSearch, 180);
  },
);

watch(
  () => open.value,
  async (v) => {
    if (!v) return;
    await nextTick();
    inputEl.value?.focus();
  },
);
</script>
