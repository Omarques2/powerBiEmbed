<!-- apps/web/src/admin/UserMembershipEditor.vue -->
<template>
  <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div class="flex items-start justify-between gap-4">
      <div>
        <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">Memberships</div>
        <div class="mt-1 text-xs text-slate-600 dark:text-slate-300">
          Gerencie customer(s) e role(s) do usuário. Para segurança, ao desativar/remover, recomenda-se revogar permissões do customer.
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
          {{ loadingCustomers ? "Recarregando..." : "Recarregar customers" }}
        </button>

        <button
          type="button"
          class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800
                 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          :disabled="loadingCustomers"
          @click="addOpen = true"
          title="Adicionar customer"
        >
          + Adicionar
        </button>
      </div>
    </div>

    <div
      v-if="error"
      class="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700
             dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
    >
      {{ error }}
    </div>

    <!-- Lista de memberships (compacta) -->
    <div class="mt-4 overflow-x-auto">
      <table class="min-w-full text-left text-xs">
        <thead class="text-slate-500 dark:text-slate-400">
          <tr>
            <th class="py-2 pr-4">Customer</th>
            <th class="py-2 pr-4">Acesso efetivo</th>
            <th class="py-2 pr-4">Role</th>
            <th class="py-2 pr-4">Ativo</th>
            <th class="py-2 pr-0 text-right">Ações</th>
          </tr>
        </thead>

        <tbody class="text-slate-800 dark:text-slate-100">
          <tr v-for="m in memberships" :key="m.customerId" class="border-t border-slate-100 dark:border-slate-800">
            <td class="py-2 pr-4">
              <div class="font-medium">{{ m.customer?.name ?? m.customerId }}</div>
              <div class="text-[11px] text-slate-500 dark:text-slate-400">{{ m.customer?.code ?? "" }}</div>
            </td>

            <td class="py-2 pr-4">
              <span
                class="inline-flex items-center rounded-lg px-2 py-1 text-[11px]"
                :class="effectiveAccess(m)
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'"
              >
                {{ effectiveAccess(m) ? "permitido" : "bloqueado" }}
              </span>
              <div class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                customer: {{ m.customer?.status ?? "—" }}
              </div>
            </td>

            <td class="py-2 pr-4">
              <select
                class="w-36 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs
                       disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900"
                :disabled="!!busyByCustomer[m.customerId]"
                :value="m.role"
                @change="onChangeRole(m.customerId, ($event.target as HTMLSelectElement).value)"
              >
                <option value="viewer">viewer</option>
                <option value="member">member</option>
                <option value="admin">admin</option>
                <option value="owner">owner</option>
              </select>
            </td>

            <td class="py-2 pr-4 align-middle">
              <div class="inline-flex items-center">
                <PermSwitch
                  :model-value="m.isActive"
                  :loading="!!busyByCustomer[m.customerId]"
                  :disabled="!!busyByCustomer[m.customerId] || (m.customer?.status !== 'active' && !m.isActive)"
                  onLabel="Ativo"
                  offLabel="Inativo"
                  @toggle="toggleActive(m.customerId, m.isActive)"
                />
              </div>
            </td>

            <td class="py-2 pr-0 text-right">
              <button
                type="button"
                class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 hover:bg-rose-100
                       disabled:opacity-60 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 dark:hover:bg-rose-950/50"
                :disabled="!!busyByCustomer[m.customerId]"
                @click="openRemoveWizard(m.customerId)"
              >
                Remover
              </button>

              <button
                type="button"
                class="ml-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50
                       disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                :disabled="!!busyByCustomer[m.customerId]"
                @click="openTransferWizard(m.customerId)"
              >
                Transferir
              </button>
            </td>
          </tr>

          <tr v-if="!memberships.length">
            <td colspan="5" class="py-3 text-xs text-slate-500 dark:text-slate-400">
              Nenhum membership encontrado para este usuário.
            </td>
          </tr>
        </tbody>
      </table>
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
import { PermSwitch } from "@/ui/toggles";

const props = defineProps<{
  userId: string;
  memberships: Array<{
    customerId: string;
    role: MembershipRole;
    isActive: boolean;
    customer?: { id: string; code: string; name: string; status: string };
  }>;
}>();

const emit = defineEmits<{
  (e: "update:memberships", v: typeof props.memberships): void;
  (e: "changed"): void;
}>();

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

// busy por customer
const busyByCustomer = reactive<Record<string, boolean>>({});

function setBusy(customerId: string, v: boolean) {
  busyByCustomer[customerId] = v;
}

// Add (modal)
const addOpen = ref(false);
const addBusy = ref(false);
const addError = ref("");

async function handleAddSubmit(payload: { customerId: string; role: MembershipRole; grantCustomerWorkspaces: boolean }) {
  addBusy.value = true;
  addError.value = "";
  try {
    await upsertUserMembership(props.userId, {
      customerId: payload.customerId,
      role: payload.role,
      isActive: true,
      grantCustomerWorkspaces: payload.grantCustomerWorkspaces,
      revokeCustomerPermissions: false,
      ensureUserActive: true,
    });

    // update local
    const c = customers.value.find((x) => x.id === payload.customerId);
    const next = [
      ...props.memberships,
      { customerId: payload.customerId, role: payload.role, isActive: true, customer: c },
    ];
    emit("update:memberships", next);
    emit("changed");
    addOpen.value = false;

    push({ kind: "success", title: "Membership adicionada", message: c ? `${c.name} (${c.code})` : payload.customerId });
  } catch (e: any) {
    const msg = e?.response?.data?.message ?? e?.message ?? String(e);
    addError.value = msg;
    push({ kind: "error", title: "Falha ao adicionar membership", message: msg });
  } finally {
    addBusy.value = false;
  }
}

// Patch role
async function onChangeRole(customerId: string, role: string) {
  setBusy(customerId, true);
  try {
    await patchUserMembership(props.userId, customerId, { role: role as MembershipRole });

    const next = props.memberships.map((m) => (m.customerId === customerId ? { ...m, role: role as MembershipRole } : m));
    emit("update:memberships", next);
    emit("changed");

    push({ kind: "success", title: "Role atualizada" });
  } catch (e: any) {
    const msg = e?.response?.data?.message ?? e?.message ?? String(e);
    push({ kind: "error", title: "Falha ao atualizar role", message: msg });
  } finally {
    setBusy(customerId, false);
  }
}

// Toggle active
async function onToggleActive(customerId: string, isActive: boolean) {
  setBusy(customerId, true);
  try {
    await patchUserMembership(props.userId, customerId, {
      isActive,
      revokeCustomerPermissions: !isActive,
    });

    const next = props.memberships.map((m) => (m.customerId === customerId ? { ...m, isActive } : m));
    emit("update:memberships", next);
    emit("changed");

    push({ kind: "success", title: isActive ? "Membership reativada" : "Membership desativada" });
  } catch (e: any) {
    const msg = e?.response?.data?.message ?? e?.message ?? String(e);
    push({ kind: "error", title: "Falha ao atualizar membership", message: msg });
  } finally {
    setBusy(customerId, false);
  }
}

// Wizards: remove/transfer
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
  wizardInitialCustomerId.value = customerId;
  wizardError.value = "";
  removeOpen.value = true;
}

function openTransferWizard(customerId: string) {
  wizardInitialCustomerId.value = customerId;
  wizardError.value = "";
  transferOpen.value = true;
}

function toggleActive(customerId: string, current: boolean) {
  const next = !current;
  onToggleActive(customerId, next);
}

function noopTransfer() {}
function noopRemove() {}

async function handleRemoveSubmit(payload: { customerId: string; revokeCustomerPermissions: boolean }) {
  const customerId = payload.customerId;
  const m = props.memberships.find((x) => x.customerId === customerId);
  const label = m?.customer?.name ? `${m.customer.name} (${m.customer.code ?? ""})` : customerId;

  const ok = await confirm({
    title: "Remover membership?",
    message: `Você está prestes a remover o membership de ${label}. Isso pode revogar o acesso do usuário ao customer.`,
    confirmText: "Remover",
    cancelText: "Cancelar",
    danger: true,
  });
  if (!ok) return;

  wizardBusy.value = true;
  wizardError.value = "";
  try {
    await removeUserMembership(props.userId, customerId, payload.revokeCustomerPermissions);

    const next = props.memberships.filter((x) => x.customerId !== customerId);
    emit("update:memberships", next);
    emit("changed");

    push({ kind: "success", title: "Membership removida", message: label });
    closeWizard();
  } catch (e: any) {
    const msg = e?.response?.data?.message ?? e?.message ?? String(e);
    wizardError.value = msg;
    push({ kind: "error", title: "Falha ao remover membership", message: msg });
  } finally {
    wizardBusy.value = false;
  }
}

async function handleTransferSubmit(payload: {
  fromCustomerId: string;
  toCustomerId: string;
  toRole: MembershipRole;
  revokeFromCustomerPermissions: boolean;
  grantToCustomerWorkspaces: boolean;
}) {
  wizardBusy.value = true;
  wizardError.value = "";
  try {
    await transferUserMembership(props.userId, {
      fromCustomerId: payload.fromCustomerId,
      toCustomerId: payload.toCustomerId,
      toRole: payload.toRole,
      deactivateFrom: true,
      revokeFromCustomerPermissions: payload.revokeFromCustomerPermissions,
      grantToCustomerWorkspaces: payload.grantToCustomerWorkspaces,
      toIsActive: true,
    });

    const toCustomer = customers.value.find((x) => x.id === payload.toCustomerId);

    const next = props.memberships
      .map((m) => (m.customerId === payload.fromCustomerId ? { ...m, isActive: false } : m))
      .concat([
        {
          customerId: payload.toCustomerId,
          role: payload.toRole,
          isActive: true,
          customer: toCustomer,
        },
      ]);

    emit("update:memberships", next);
    emit("changed");

    push({ kind: "success", title: "Transferência concluída" });
    closeWizard();
  } catch (e: any) {
    const msg = e?.response?.data?.message ?? e?.message ?? String(e);
    wizardError.value = msg;
    push({ kind: "error", title: "Falha ao transferir membership", message: msg });
  } finally {
    wizardBusy.value = false;
  }
}
</script>
