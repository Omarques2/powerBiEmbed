<!-- apps/web/src/admin/CustomersPanel.vue -->
<template>
  <section class="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">Customers</div>
        <div class="mt-1 text-xs text-slate-600 dark:text-slate-300">
          Criar/editar customers e ativar/inativar com padrão operacional (optimistic + rollback + toast + busy por item).
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <button
          type="button"
          class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50
                 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
          :disabled="!!loading"
          @click="refreshSafe"
        >
          {{ loading ? "Carregando..." : "Recarregar" }}
        </button>

        <button
          type="button"
          class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800
                 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          @click="openCreate"
        >
          + Novo customer
        </button>
      </div>
    </div>

    <div v-if="errorText" class="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
      {{ errorText }}
    </div>

    <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        v-model="q"
        class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
        placeholder="Buscar por code/nome"
      />
      <div class="shrink-0 text-xs text-slate-500 dark:text-slate-400">
        {{ filtered.length }} / {{ customers.length }}
      </div>
    </div>

    <div class="mt-4 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
      <table class="w-full table-fixed text-left text-sm">
        <thead class="bg-slate-50 text-xs text-slate-600 dark:bg-slate-950/40 dark:text-slate-300">
          <tr>
            <th class="w-40 px-4 py-3">Code</th>
            <th class="px-4 py-3">Nome</th>
            <th class="w-28 px-4 py-3">Status</th>
            <th class="w-44 px-4 py-3 text-right"></th>
          </tr>
        </thead>

        <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
          <tr v-for="c in filtered" :key="c.id" class="hover:bg-slate-50/60 dark:hover:bg-slate-950/30">
            <td class="px-4 py-3 font-mono text-xs text-slate-900 dark:text-slate-100">
              <div class="truncate">{{ c.code }}</div>
            </td>

            <td class="px-4 py-3 text-slate-900 dark:text-slate-100">
              <div class="truncate">{{ c.name }}</div>
            </td>

            <td class="px-4 py-3">
              <span
                class="inline-flex items-center rounded-full border px-2 py-1 text-[11px]"
                :class="c.status === 'active'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200'"
              >
                {{ c.status }}
              </span>
            </td>

            <td class="px-4 py-3">
              <div class="flex items-center justify-end gap-2">
                <button
                  type="button"
                  class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50
                         disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                  :disabled="busy.isBusy(c.id)"
                  @click="openEdit(c)"
                >
                  Editar
                </button>

                <button
                  type="button"
                  class="rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-60"
                  :class="c.status === 'active'
                    ? 'border border-rose-200 bg-rose-600 text-white hover:bg-rose-500 dark:border-rose-900/40 dark:bg-rose-700 dark:hover:bg-rose-600'
                    : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200'"
                  :disabled="busy.isBusy(c.id)"
                  @click="toggleStatus(c)"
                >
                  {{ busy.isBusy(c.id) ? "..." : (c.status === "active" ? "Desativar" : "Ativar") }}
                </button>
              </div>
            </td>
          </tr>

          <tr v-if="!filtered.length">
            <td colspan="4" class="px-4 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Nenhum customer encontrado.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- MODAL create/edit -->
    <div v-if="modalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div class="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {{ editing ? "Editar customer" : "Novo customer" }}
            </div>
            <div class="mt-1 text-xs text-slate-600 dark:text-slate-300">
              {{ editing ? "Atualiza nome/código." : "Cria um novo customer." }}
            </div>
          </div>

          <button
            type="button"
            class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50
                   disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            :disabled="saving"
            @click="closeModal"
          >
            Fechar
          </button>
        </div>

        <div class="mt-4 grid grid-cols-1 gap-3">
          <div>
            <label class="text-xs font-medium text-slate-700 dark:text-slate-300">Code</label>
            <input
              v-model="form.code"
              class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
              :disabled="saving || (!!editing && lockCodeOnEdit)"
              placeholder="ex: ACME"
            />
          </div>

          <div>
            <label class="text-xs font-medium text-slate-700 dark:text-slate-300">Nome</label>
            <input
              v-model="form.name"
              class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
              :disabled="saving"
              placeholder="ex: ACME Ltda"
            />
          </div>
        </div>

        <div class="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50
                   disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            :disabled="saving"
            @click="closeModal"
          >
            Cancelar
          </button>

          <button
            type="button"
            class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800
                   disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            :disabled="saving || !canSubmit"
            @click="save"
          >
            {{ saving ? "Salvando..." : "Salvar" }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import type { CustomerRow } from "./adminApi";
import { createCustomer, setCustomerStatus, updateCustomer } from "./adminApi";
import { useConfirm } from "@/ui/confirm/useConfirm";
import { useBusyMap } from "@/ui/ops/useBusyMap";
import { useOptimisticMutation } from "@/ui/ops/useOptimisticMutation";
import { normalizeApiError } from "@/ui/ops/normalizeApiError";
import { useToast } from "@/ui/toast/useToast";

const { confirm } = useConfirm();
const { push } = useToast();
const busy = useBusyMap();
const { mutate } = useOptimisticMutation();

const props = defineProps<{
  customers: CustomerRow[];
  loading?: boolean;
  error?: string;

  refresh: () => Promise<void> | void;
  upsertCustomerLocal: (row: CustomerRow) => void;
  patchCustomerLocal: (customerId: string, patch: Partial<CustomerRow>) => void;
}>();

const lockCodeOnEdit = true;

// ---------- list / filter ----------
const q = ref("");

const errorText = computed(() => props.error ?? "");
const loading = computed(() => props.loading ?? false);
const customers = computed(() => props.customers ?? []);

const filtered = computed(() => {
  const needle = q.value.trim().toLowerCase();
  if (!needle) return customers.value;

  return customers.value.filter((c) => {
    const hay = `${c.code ?? ""} ${c.name ?? ""}`.toLowerCase();
    return hay.includes(needle);
  });
});

// ---------- modal create/edit ----------
const modalOpen = ref(false);
const saving = ref(false);
const editing = ref<CustomerRow | null>(null);

const form = reactive({
  code: "",
  name: "",
});

const canSubmit = computed(() => {
  const code = form.code.trim();
  const name = form.name.trim();
  return code.length >= 2 && name.length >= 2;
});

function openCreate() {
  editing.value = null;
  form.code = "";
  form.name = "";
  modalOpen.value = true;
}

function openEdit(c: CustomerRow) {
  editing.value = c;
  form.code = c.code ?? "";
  form.name = c.name ?? "";
  modalOpen.value = true;
}

function closeModal() {
  if (saving.value) return;
  modalOpen.value = false;
}

async function refreshSafe() {
  try {
    await props.refresh?.();
  } catch (e: any) {
    const ne = normalizeApiError(e);
    push({
      kind: "error",
      title: "Falha ao recarregar customers",
      message: ne.message,
      details: ne.details,
      timeoutMs: 9000,
    });
  }
}

async function toggleStatus(c: CustomerRow) {
  const next: "active" | "inactive" = c.status === "active" ? "inactive" : "active";

  if (next === "inactive") {
    const ok = await confirm({
      title: "Inativar customer?",
      message:
        "Inativar um customer pode desativar workspaces/reports e afetar acesso de usuários. " +
        "Confirme que esta ação é realmente desejada.",
      confirmText: "Inativar",
      cancelText: "Cancelar",
      danger: true,
    });
    if (!ok) return;
  }

  await mutate<{ prevStatus: string }, { ok: boolean; status: string; workspacesDeactivated?: number; reportsDeactivated?: number }>({
    key: c.id,
    busy,
    optimistic: () => {
      const prevStatus = c.status;
      props.patchCustomerLocal(c.id, { status: next });
      return { prevStatus };
    },
    request: async () => {
      return await setCustomerStatus(c.id, next);
    },
    rollback: (snap) => {
      props.patchCustomerLocal(c.id, { status: snap.prevStatus });
    },
    onSuccess: (res) => {
      if (res?.status) props.patchCustomerLocal(c.id, { status: res.status as any });
    },
    toast: {
      success: {
        title: next === "active" ? "Customer ativado" : "Customer inativado",
        message:
          next === "active"
            ? `${c.code} foi ativado.`
            : `${c.code} foi inativado.` +
              (typeof (arguments as any)[0]?.workspacesDeactivated === "number"
                ? ""
                : ""),
      },
      error: {
        title: next === "active" ? "Falha ao ativar customer" : "Falha ao inativar customer",
      },
    },
  });
}

async function save() {
  if (!canSubmit.value) return;

  const payload = {
    code: form.code.trim(),
    name: form.name.trim(),
  };

  saving.value = true;

  try {
    if (!editing.value) {
      const created = await createCustomer({ code: payload.code, name: payload.name, status: "active" });
      props.upsertCustomerLocal(created);

      push({
        kind: "success",
        title: "Customer criado",
        message: `${created.code} — ${created.name}`,
      });

      modalOpen.value = false;
      return;
    }

    const target = editing.value;
    const prev = { code: target.code, name: target.name };

    await mutate<typeof prev, { ok: boolean; customer: CustomerRow }>({
      key: target.id,
      busy,
      optimistic: () => {
        props.patchCustomerLocal(target.id, { code: payload.code, name: payload.name });
        return prev;
      },
      request: async () => {
        return await updateCustomer(target.id, { code: payload.code, name: payload.name });
      },
      rollback: (snap) => {
        props.patchCustomerLocal(target.id, { code: snap.code, name: snap.name });
      },
      onSuccess: (res) => {
        if (res?.customer) props.upsertCustomerLocal(res.customer);
      },
      toast: {
        success: { title: "Customer atualizado", message: `${payload.code} — ${payload.name}` },
        error: { title: "Falha ao atualizar customer" },
      },
    });

    modalOpen.value = false;
  } catch (e: any) {
    const ne = normalizeApiError(e);
    push({
      kind: "error",
      title: "Falha ao salvar customer",
      message: ne.message,
      details: ne.details,
      timeoutMs: 9000,
    });
  } finally {
    saving.value = false;
  }
}
</script>
