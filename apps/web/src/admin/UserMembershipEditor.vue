<!-- apps/web/src/admin/UserMembershipEditor.vue -->
<template>
  <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div class="flex items-start justify-between gap-4">
      <div>
        <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">Memberships</div>
        <div class="mt-1 text-xs text-slate-600 dark:text-slate-300">
          Gerencie customer(s) e role(s) do usuário. Operações aqui impactam acesso a workspaces/reports e são auditáveis.
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50
                 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
          :disabled="loadingCustomers"
          @click="refreshCustomers"
        >
          {{ loadingCustomers ? "Carregando..." : "Recarregar customers" }}
        </button>

        <!-- Add single icon/button -->
        <button
          type="button"
          class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800
                 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          :disabled="!canOpenAdd"
          @click="openAddModal"
          title="Adicionar customer"
        >
          + Add
        </button>
      </div>
    </div>

    <div
      v-if="error"
      class="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
    >
      {{ error }}
    </div>

    <!-- Memberships table -->
    <div class="mt-4 overflow-x-auto">
      <table class="min-w-full text-left text-xs">
        <thead class="text-slate-500 dark:text-slate-400">
          <tr>
            <th class="py-2 pr-4">Customer</th>
            <th class="py-2 pr-4">Status</th>
            <th class="py-2 pr-4">Role</th>
            <th class="py-2 pr-4">Ativo</th>
            <th class="py-2 pr-0 text-right">Ações</th>
          </tr>
        </thead>

        <tbody class="text-slate-800 dark:text-slate-100">
          <tr v-for="m in memberships" :key="m.customerId" class="border-t border-slate-100 dark:border-slate-800">
            <!-- customer -->
            <td class="py-3 pr-4">
              <div class="font-medium text-sm text-slate-900 dark:text-slate-100">
                {{ m.customer?.name ?? m.customerId }}
              </div>
              <div class="text-[11px] text-slate-500 dark:text-slate-400">
                {{ m.customer?.code ?? "" }}
              </div>
            </td>

            <!-- status -->
            <td class="py-3 pr-4">
              <div class="flex flex-wrap items-center gap-2">
                <!-- customer status -->
                <span
                  class="inline-flex items-center rounded-lg px-2 py-1 text-[11px] border"
                  :class="(m.customer?.status ?? 'inactive') === 'active'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/15 dark:text-emerald-200'
                    : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200'"
                >
                  Customer: {{ m.customer?.status ?? "—" }}
                </span>

                <!-- membership status -->
                <span
                  class="inline-flex items-center rounded-lg px-2 py-1 text-[11px] border"
                  :class="m.isActive
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/15 dark:text-emerald-200'
                    : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200'"
                >
                  Membership: {{ m.isActive ? "active" : "inactive" }}
                </span>

                <!-- effective access -->
                <span
                  class="inline-flex items-center rounded-lg px-2 py-1 text-[11px] border"
                  :class="effectiveAccess(m)
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/15 dark:text-emerald-200'
                    : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200'"
                  :title="effectiveAccess(m)
                    ? 'Usuário pode receber permissões do catálogo conforme configuração.'
                    : 'Sem acesso efetivo: membership inativa ou customer inativo.'"
                >
                  Acesso: {{ effectiveAccess(m) ? "OK" : "bloqueado" }}
                </span>
              </div>

              <div v-if="(m.customer?.status ?? 'inactive') !== 'active'" class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Customer inativo: permissões efetivas podem ficar inutilizáveis dependendo da sua policy de runtime.
              </div>
            </td>

            <!-- role -->
            <td class="py-3 pr-4">
              <select
                class="w-40 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs
                       disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950"
                :disabled="isRowBusy(m.customerId)"
                :value="m.role"
                @change="onChangeRole(m.customerId, ($event.target as HTMLSelectElement).value)"
              >
                <option value="viewer">viewer</option>
                <option value="member">member</option>
                <option value="admin">admin</option>
                <option value="owner">owner</option>
              </select>

              <div v-if="rowMsg[m.customerId]" class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {{ rowMsg[m.customerId] }}
              </div>
            </td>

            <!-- active toggle -->
            <td class="py-3 pr-4">
              <label class="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  class="h-4 w-4"
                  :disabled="isRowBusy(m.customerId)"
                  :checked="m.isActive"
                  @change="onToggleActive(m.customerId, ($event.target as HTMLInputElement).checked)"
                />
                <span class="text-slate-600 dark:text-slate-300">{{ m.isActive ? "sim" : "não" }}</span>
              </label>
            </td>

            <!-- actions -->
            <td class="py-3 pr-0">
              <div class="flex items-center justify-end gap-2">
                <button
                  type="button"
                  class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50
                         disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                  :disabled="isRowBusy(m.customerId)"
                  @click="openTransferWizard(m.customerId)"
                >
                  Transferir
                </button>

                <button
                  type="button"
                  class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 hover:bg-rose-100
                         disabled:opacity-60 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 dark:hover:bg-rose-950/50"
                  :disabled="isRowBusy(m.customerId)"
                  @click="openRemoveWizard(m.customerId)"
                >
                  Remover
                </button>
              </div>
            </td>
          </tr>

          <tr v-if="!memberships.length">
            <td colspan="5" class="py-4 text-xs text-slate-500 dark:text-slate-400">
              Nenhum membership encontrado para este usuário.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- global footer -->
    <div class="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
      Dica operacional: ao desativar/remover, recomenda-se revogar permissões do customer para reduzir superfície de acesso residual.
    </div>

    <!-- Add Membership Modal -->
    <AddMembershipModal
      :open="addOpen"
      :busy="addBusy"
      :customers="customers"
      :existingCustomerIds="existingCustomerIds"
      :error="addError"
      @close="addOpen = false"
      @submit="handleAddSubmit"
    />

    <!-- Remove Wizard -->
    <MembershipActionWizard
      :open="removeOpen"
      mode="remove"
      :busy="wizardBusy"
      :error="wizardError"
      :customers="customers"
      :memberships="memberships"
      :initialCustomerId="wizardInitialCustomerId"
      @close="closeWizard"
      @submit-remove="handleRemoveSubmit"
      @submit-transfer="noopTransfer"
    />

    <!-- Transfer Wizard -->
    <MembershipActionWizard
      :open="transferOpen"
      mode="transfer"
      :busy="wizardBusy"
      :error="wizardError"
      :customers="customers"
      :memberships="memberships"
      :initialCustomerId="wizardInitialCustomerId"
      @close="closeWizard"
      @submit-remove="noopRemove"
      @submit-transfer="handleTransferSubmit"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  listCustomers,
  patchUserMembership,
  removeUserMembership,
  transferUserMembership,
  upsertUserMembership,
  type MembershipRole,
} from "./adminApi";

import { useToast } from "../ui/toast/useToast";
import { useConfirm } from "../ui/confirm/useConfirm";

import AddMembershipModal from "./components/AddMembershipModal.vue";
import MembershipActionWizard from "./components/MembershipActionWizard.vue";

const props = defineProps<{
  userId: string;
  memberships: Array<{
    customerId: string;
    role: MembershipRole;
    isActive: boolean;
    customer?: { id: string; code: string; name: string; status: string };
  }>;
}>();

const emit = defineEmits<{ (e: "refresh"): void }>();

const { push } = useToast();
const { confirm } = useConfirm();

const error = ref<string>("");

// customers cache
const customers = ref<Array<{ id: string; code: string; name: string; status: string }>>([]);
const loadingCustomers = ref(false);

async function refreshCustomers() {
  loadingCustomers.value = true;
  error.value = "";
  try {
    customers.value = await listCustomers();
  } catch (e: any) {
    const msg = e?.response?.data?.message ?? e?.message ?? String(e);
    error.value = msg;
    push({ kind: "error", title: "Falha ao carregar customers", message: msg });
  } finally {
    loadingCustomers.value = false;
  }
}

onMounted(refreshCustomers);

// helpers
function effectiveAccess(m: { isActive: boolean; customer?: { status: string } }) {
  return m.isActive && (m.customer?.status ?? "inactive") === "active";
}

const existingCustomerIds = computed(() => props.memberships.map((m) => m.customerId));
const canOpenAdd = computed(() => customers.value.some((c) => c.status === "active"));

// ------------------------------------
// Busy por linha + mensagens por linha
// ------------------------------------
const rowBusy = reactive<Record<string, boolean>>({});
const rowMsg = reactive<Record<string, string>>({});

function setRowBusy(customerId: string, v: boolean) {
  rowBusy[customerId] = v;
}

function isRowBusy(customerId: string) {
  return !!rowBusy[customerId];
}

function setRowMsg(customerId: string, msg: string) {
  rowMsg[customerId] = msg;
}

// ------------------------------------
// Add Modal
// ------------------------------------
const addOpen = ref(false);
const addBusy = ref(false);
const addError = ref("");

function openAddModal() {
  addError.value = "";
  addOpen.value = true;
}

async function handleAddSubmit(payload: { customerId: string; role: MembershipRole; grantCustomerWorkspaces: boolean }) {
  addError.value = "";
  addBusy.value = true;
  try {
    const res = await upsertUserMembership(props.userId, {
      customerId: payload.customerId,
      role: payload.role,
      isActive: true,
      grantCustomerWorkspaces: payload.grantCustomerWorkspaces,
      revokeCustomerPermissions: false,
      ensureUserActive: true,
    });

    push({
      kind: "success",
      title: "Membership adicionada",
      message: `Customer vinculado com role ${res.membership.role}.`,
      details: res,
    });

    addOpen.value = false;
    emit("refresh");
  } catch (e: any) {
    const msg = e?.response?.data?.message ?? e?.message ?? String(e);
    addError.value = msg;
    push({ kind: "error", title: "Falha ao adicionar membership", message: msg, details: e?.response?.data ?? e });
  } finally {
    addBusy.value = false;
  }
}

// ------------------------------------
// Inline patch actions (role / active) — busy por linha
// ------------------------------------
async function onChangeRole(customerId: string, role: string) {
  error.value = "";
  setRowMsg(customerId, "");
  setRowBusy(customerId, true);

  try {
    const res = await patchUserMembership(props.userId, customerId, { role: role as MembershipRole });
    setRowMsg(customerId, "Role atualizada.");
    push({ kind: "success", title: "Role atualizada", message: `Role definida para ${res.membership.role}.`, details: res });
    emit("refresh");
  } catch (e: any) {
    const msg = e?.response?.data?.message ?? e?.message ?? String(e);
    error.value = msg;
    push({ kind: "error", title: "Falha ao atualizar role", message: msg, details: e?.response?.data ?? e });
  } finally {
    setRowBusy(customerId, false);
  }
}

async function onToggleActive(customerId: string, isActive: boolean) {
  error.value = "";
  setRowMsg(customerId, "");
  setRowBusy(customerId, true);

  try {
    const res = await patchUserMembership(props.userId, customerId, {
      isActive,
      revokeCustomerPermissions: !isActive, // default recomendação
    });

    const actionMsg = isActive ? "Membership ativada." : "Membership desativada (revoke recomendado aplicado).";
    setRowMsg(customerId, actionMsg);

    push({
      kind: "success",
      title: isActive ? "Ativada" : "Desativada",
      message: actionMsg,
      details: res,
    });

    emit("refresh");
  } catch (e: any) {
    const msg = e?.response?.data?.message ?? e?.message ?? String(e);
    error.value = msg;
    push({ kind: "error", title: "Falha ao alterar status", message: msg, details: e?.response?.data ?? e });
  } finally {
    setRowBusy(customerId, false);
  }
}

// ------------------------------------
// Wizard (Remove / Transfer)
// ------------------------------------
const removeOpen = ref(false);
const transferOpen = ref(false);
const wizardBusy = ref(false);
const wizardError = ref("");
const wizardInitialCustomerId = ref<string | null>(null);

function closeWizard() {
  removeOpen.value = false;
  transferOpen.value = false;
  wizardBusy.value = false;
  wizardError.value = "";
  wizardInitialCustomerId.value = null;
}

function openRemoveWizard(customerId: string) {
  wizardError.value = "";
  wizardInitialCustomerId.value = customerId;
  removeOpen.value = true;
}

function openTransferWizard(customerId: string) {
  wizardError.value = "";
  wizardInitialCustomerId.value = customerId;
  transferOpen.value = true;
}

function noopRemove() {}
function noopTransfer() {}

async function handleRemoveSubmit(payload: { customerId: string; revokeCustomerPermissions: boolean }) {
  wizardError.value = "";

  const ok = await confirm({
    title: "Remover membership?",
    message:
      "Você está prestes a remover o vínculo do usuário com este customer. " +
      (payload.revokeCustomerPermissions ? "As permissões do catálogo também serão revogadas." : "Permissões NÃO serão revogadas."),
    confirmText: "Remover",
    cancelText: "Cancelar",
    danger: true,
  });

  if (!ok) return;

  wizardBusy.value = true;
  setRowBusy(payload.customerId, true);

  try {
    const res = await removeUserMembership(props.userId, payload.customerId, payload.revokeCustomerPermissions);

    push({
      kind: "success",
      title: "Membership removida",
      message: payload.revokeCustomerPermissions
        ? `Removido e permissões revogadas (ws/reports).`
        : `Removido (sem revogar permissões).`,
      details: res,
    });

    closeWizard();
    emit("refresh");
  } catch (e: any) {
    const msg = e?.response?.data?.message ?? e?.message ?? String(e);
    wizardError.value = msg;
    push({ kind: "error", title: "Falha ao remover membership", message: msg, details: e?.response?.data ?? e });
  } finally {
    wizardBusy.value = false;
    setRowBusy(payload.customerId, false);
  }
}

async function handleTransferSubmit(payload: {
  fromCustomerId: string;
  toCustomerId: string;
  toRole: MembershipRole;
  revokeFromCustomerPermissions: boolean;
  grantToCustomerWorkspaces: boolean;
}) {
  wizardError.value = "";

  const ok = await confirm({
    title: "Confirmar transferência?",
    message:
      `From: ${payload.fromCustomerId}\nTo: ${payload.toCustomerId}\nRole destino: ${payload.toRole}\n\n` +
      `Revogar do from: ${payload.revokeFromCustomerPermissions ? "sim" : "não"}\n` +
      `Conceder no to: ${payload.grantToCustomerWorkspaces ? "sim" : "não"}`,
    confirmText: "Transferir",
    cancelText: "Cancelar",
    danger: true,
  });

  if (!ok) return;

  wizardBusy.value = true;
  setRowBusy(payload.fromCustomerId, true);

  try {
    const res = await transferUserMembership(props.userId, {
      fromCustomerId: payload.fromCustomerId,
      toCustomerId: payload.toCustomerId,
      toRole: payload.toRole,
      deactivateFrom: true,
      revokeFromCustomerPermissions: payload.revokeFromCustomerPermissions,
      grantToCustomerWorkspaces: payload.grantToCustomerWorkspaces,
      toIsActive: true,
    });

    push({
      kind: "success",
      title: "Transferência concluída",
      message: `Movido para o customer destino com role ${payload.toRole}.`,
      details: res,
    });

    closeWizard();
    emit("refresh");
  } catch (e: any) {
    const msg = e?.response?.data?.message ?? e?.message ?? String(e);
    wizardError.value = msg;
    push({ kind: "error", title: "Falha na transferência", message: msg, details: e?.response?.data ?? e });
  } finally {
    wizardBusy.value = false;
    setRowBusy(payload.fromCustomerId, false);
  }
}
</script>
