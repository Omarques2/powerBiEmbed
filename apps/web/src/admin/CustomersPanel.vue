<!-- apps/web/src/admin/CustomersPanel.vue -->
<template>
  <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">Customers</div>
        <div class="mt-1 text-xs text-slate-600 dark:text-slate-300">
          CRUD de customers (soft delete via status) + auditoria.
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50
                 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
          :disabled="loading"
          @click="refresh()"
        >
          {{ loading ? "Carregando..." : "Recarregar" }}
        </button>

        <button
          class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800
                 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          @click="openCreate()"
        >
          Novo customer
        </button>
      </div>
    </div>

    <div v-if="error" class="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700
                           dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
      {{ error }}
    </div>

    <div class="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div class="flex-1">
        <label class="block text-xs font-medium text-slate-700 dark:text-slate-300">Buscar</label>
        <input
          v-model="q"
          type="text"
          placeholder="Filtrar por code, name ou status..."
          class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                 dark:border-slate-800 dark:bg-slate-900"
        />
      </div>

      <div class="text-xs text-slate-500 dark:text-slate-400">
        Total: <span class="font-medium">{{ filtered.length }}</span>
      </div>
    </div>

    <div class="mt-4 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table class="min-w-[860px] w-full text-left text-xs">
        <thead class="bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <tr>
            <th class="px-3 py-2">Code</th>
            <th class="px-3 py-2">Name</th>
            <th class="px-3 py-2">Status</th>
            <th class="px-3 py-2">Created</th>
            <th class="px-3 py-2">ID</th>
            <th class="px-3 py-2 text-right">Ações</th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="c in filtered"
            :key="c.id"
            class="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          >
            <td class="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
              {{ c.code }}
            </td>
            <td class="px-3 py-2 text-slate-700 dark:text-slate-200">
              {{ c.name }}
            </td>
            <td class="px-3 py-2">
              <span
                class="rounded-lg px-2 py-1 text-[11px]"
                :class="c.status === 'active'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'"
              >
                {{ c.status }}
              </span>
            </td>
            <td class="px-3 py-2 text-slate-600 dark:text-slate-300">
              {{ formatDate(c.createdAt) }}
            </td>
            <td class="px-3 py-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
              {{ c.id }}
            </td>
            <td class="px-3 py-2 text-right">
              <div class="inline-flex items-center gap-2">
                <button
                  class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] hover:bg-slate-50
                         dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                  @click="openEdit(c)"
                >
                  Editar
                </button>

                <button
                  class="rounded-lg border px-2 py-1 text-[11px]"
                  :class="c.status === 'active'
                    ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200'"
                  :disabled="busyId === c.id"
                  @click="toggleStatus(c)"
                >
                  {{ busyId === c.id ? "..." : (c.status === "active" ? "Desativar" : "Ativar") }}
                </button>
              </div>
            </td>
          </tr>

          <tr v-if="filtered.length === 0">
            <td colspan="6" class="px-3 py-6 text-center text-slate-500 dark:text-slate-400">
              Nenhum customer encontrado.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal (Create/Edit) -->
    <div
      v-if="modal.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="closeModal()"
    >
      <div class="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-900">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {{ modal.mode === "create" ? "Novo customer" : "Editar customer" }}
            </div>
            <div class="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Code: 3-32 chars, A-Z/0-9/_/-. Name: 2-120 chars.
            </div>
          </div>

          <button
            class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50
                   dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            @click="closeModal()"
          >
            Fechar
          </button>
        </div>

        <div v-if="modalError" class="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700
                                     dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {{ modalError }}
        </div>

        <div class="mt-4 space-y-3">
          <div>
            <label class="block text-xs font-medium text-slate-700 dark:text-slate-300">Code</label>
            <input
              v-model="form.code"
              type="text"
              placeholder="EX: ACME_FARM"
              class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                     dark:border-slate-800 dark:bg-slate-900"
              :disabled="modal.mode === 'edit' && lockCodeOnEdit"
            />
            <div v-if="modal.mode === 'edit' && lockCodeOnEdit" class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Code está travado no modo edit (recomendado). Se quiser permitir edição do code, desative <span class="font-mono">lockCodeOnEdit</span> no componente.
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 dark:text-slate-300">Name</label>
            <input
              v-model="form.name"
              type="text"
              placeholder="Nome do customer"
              class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                     dark:border-slate-800 dark:bg-slate-900"
            />
          </div>

          <div v-if="modal.mode === 'create'">
            <label class="block text-xs font-medium text-slate-700 dark:text-slate-300">Status inicial</label>
            <select
              v-model="form.status"
              class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                     dark:border-slate-800 dark:bg-slate-900"
            >
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </div>

          <div class="flex gap-2 pt-2">
            <button
              class="flex-1 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800
                     disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              :disabled="saving"
              @click="save()"
            >
              {{ saving ? "Salvando..." : "Salvar" }}
            </button>

            <button
              class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50
                     disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
              :disabled="saving"
              @click="closeModal()"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>

  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { CustomerRow } from "./adminApi";
import { createCustomer, updateCustomer, setCustomerStatus } from "./adminApi";

const props = defineProps<{
  customers: CustomerRow[];
  loading?: boolean;
  error?: string;
  refresh: () => Promise<void> | void;
}>();

const lockCodeOnEdit = true;

const q = ref("");

const error = computed(() => props.error ?? "");
const loading = computed(() => Boolean(props.loading));

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase();
  if (!s) return props.customers;

  return props.customers.filter((c) => {
    return (
      c.code.toLowerCase().includes(s) ||
      c.name.toLowerCase().includes(s) ||
      String(c.status).toLowerCase().includes(s) ||
      c.id.toLowerCase().includes(s)
    );
  });
});

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

const modal = ref<{ open: boolean; mode: "create" | "edit"; customerId?: string }>({
  open: false,
  mode: "create",
});

const form = ref<{ code: string; name: string; status: "active" | "inactive" }>({
  code: "",
  name: "",
  status: "active",
});

const modalError = ref("");
const saving = ref(false);
const busyId = ref<string>("");

function openCreate() {
  modal.value = { open: true, mode: "create" };
  form.value = { code: "", name: "", status: "active" };
  modalError.value = "";
}

function openEdit(c: CustomerRow) {
  modal.value = { open: true, mode: "edit", customerId: c.id };
  form.value = { code: c.code, name: c.name, status: (c.status as any) ?? "active" };
  modalError.value = "";
}

function closeModal() {
  modal.value.open = false;
  modalError.value = "";
}

function validateLocal() {
  const code = form.value.code.trim().toUpperCase();
  const name = form.value.name.trim();

  if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) {
    throw new Error("Code inválido. Use 3-32 chars: A-Z, 0-9, '_' ou '-', começando com alfanumérico.");
  }
  if (name.length < 2 || name.length > 120) {
    throw new Error("Name inválido. Use 2-120 caracteres.");
  }
}

async function save() {
  modalError.value = "";
  saving.value = true;

  try {
    validateLocal();

    const code = form.value.code.trim().toUpperCase();
    const name = form.value.name.trim();

    if (modal.value.mode === "create") {
      await createCustomer({ code, name, status: form.value.status });
    } else {
      const customerId = modal.value.customerId!;
      const payload: any = { name };

      // code (opcional no edit; padrão travado)
      if (!lockCodeOnEdit) payload.code = code;

      await updateCustomer(customerId, payload);
    }

    await props.refresh();
    closeModal();
  } catch (e: any) {
    modalError.value = e?.response?.data?.message ?? e?.message ?? "Falha ao salvar";
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(c: CustomerRow) {
  busyId.value = c.id;
  try {
    const next = c.status === "active" ? "inactive" : "active";
    await setCustomerStatus(c.id, next as any);
    await props.refresh();
  } catch (e: any) {
    // se preferir, pode emitir toast global; aqui fica simples
    alert(e?.response?.data?.message ?? e?.message ?? "Falha ao alterar status");
  } finally {
    busyId.value = "";
  }
}

async function refresh() {
  await props.refresh();
}
</script>
