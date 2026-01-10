<!-- apps/web/src/admin/components/AddMembershipModal.vue -->
<template>
  <teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[950]">
      <div class="absolute inset-0 bg-black/30" @click="emitClose"></div>

      <div
        class="absolute left-1/2 top-1/2 w-[min(720px,92vw)] -translate-x-1/2 -translate-y-1/2
               rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              Adicionar customer (membership)
            </div>
            <div class="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Cria/reativa membership e, opcionalmente, concede permissões do catálogo (workspaces/reports) do customer.
            </div>
          </div>

          <button
            type="button"
            class="rounded-xl border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
            :disabled="busy"
            @click="emitClose"
          >
            Fechar
          </button>
        </div>

        <div
          v-if="error"
          class="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700
                 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
        >
          {{ error }}
        </div>

        <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <div class="mb-1 text-xs text-slate-600 dark:text-slate-300">Customer</div>
            <select
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                     dark:border-slate-800 dark:bg-slate-950"
              v-model="customerId"
              :disabled="busy"
            >
              <option value="">Selecione…</option>
              <option v-for="c in availableCustomers" :key="c.id" :value="c.id">
                {{ c.name }} ({{ c.code }})
              </option>
            </select>
            <div class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Apenas customers ativos e que ainda não estão na lista do usuário.
            </div>
          </div>

          <div>
            <div class="mb-1 text-xs text-slate-600 dark:text-slate-300">Role</div>
            <select
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                     dark:border-slate-800 dark:bg-slate-950"
              v-model="role"
              :disabled="busy"
            >
              <option value="viewer">viewer</option>
              <option value="member">member</option>
              <option value="admin">admin</option>
              <option value="owner">owner</option>
            </select>
          </div>

          <div class="md:col-span-2">
            <label class="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input type="checkbox" class="h-4 w-4" v-model="grantAll" :disabled="busy" />
              Conceder workspaces/reports do customer automaticamente
            </label>
          </div>
        </div>

        <div class="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50
                   disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            :disabled="busy"
            @click="emitClose"
          >
            Cancelar
          </button>

          <button
            type="button"
            class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800
                   disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            :disabled="busy || !customerId"
            @click="submit"
          >
            {{ busy ? "Salvando..." : "Adicionar" }}
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { MembershipRole } from "@/features/admin/api";

type CustomerRow = { id: string; code: string; name: string; status: string };

const props = defineProps<{
  open: boolean;
  busy: boolean;
  customers: CustomerRow[];
  existingCustomerIds: string[];
  error?: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "submit", payload: { customerId: string; role: MembershipRole; grantCustomerWorkspaces: boolean }): void;
}>();

const customerId = ref("");
const role = ref<MembershipRole>("viewer");
const grantAll = ref(true);

watch(
  () => props.open,
  (v) => {
    if (!v) return;
    // reset “quando abre”
    customerId.value = "";
    role.value = "viewer";
    grantAll.value = true;
  },
);

const existingSet = computed(() => new Set(props.existingCustomerIds));
const availableCustomers = computed(() =>
  props.customers
    .filter((c) => c.status === "active")
    .filter((c) => !existingSet.value.has(c.id)),
);

function emitClose() {
  emit("close");
}

function submit() {
  if (!customerId.value) return;
  emit("submit", { customerId: customerId.value, role: role.value, grantCustomerWorkspaces: grantAll.value });
}
</script>
