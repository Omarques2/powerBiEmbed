<template>
  <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div class="flex items-start justify-between gap-4">
      <div>
        <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">Memberships</div>
        <div class="mt-1 text-xs text-slate-600 dark:text-slate-300">
          Gerencie customer(s) e role(s) do usuário. Para segurança, ao desativar/remover, recomenda-se revogar permissões do customer.
        </div>
      </div>
      <button
        type="button"
        class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50
               disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
        :disabled="busy"
        @click="refreshCustomers"
      >
        Recarregar customers
      </button>
    </div>

    <div v-if="error" class="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
      {{ error }}
    </div>

    <!-- Lista de memberships -->
    <div class="mt-4 overflow-x-auto">
      <table class="min-w-full text-left text-xs">
        <thead class="text-slate-500 dark:text-slate-400">
          <tr>
            <th class="py-2 pr-4">Customer</th>
            <th class="py-2 pr-4">Status</th>
            <th class="py-2 pr-4">Role</th>
            <th class="py-2 pr-4">Ativo</th>
            <th class="py-2 pr-0">Ações</th>
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
                :class="m.customer?.status === 'active'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'"
              >
                {{ m.customer?.status ?? "—" }}
              </span>
            </td>

            <td class="py-2 pr-4">
              <select
                class="w-40 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs
                       dark:border-slate-800 dark:bg-slate-900"
                :disabled="busy"
                :value="m.role"
                @change="onChangeRole(m.customerId, ($event.target as HTMLSelectElement).value)"
              >
                <option value="viewer">viewer</option>
                <option value="member">member</option>
                <option value="admin">admin</option>
                <option value="owner">owner</option>
              </select>
            </td>

            <td class="py-2 pr-4">
              <label class="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  class="h-4 w-4"
                  :disabled="busy"
                  :checked="m.isActive"
                  @change="onToggleActive(m.customerId, ($event.target as HTMLInputElement).checked)"
                />
                <span class="text-slate-600 dark:text-slate-300">{{ m.isActive ? "sim" : "não" }}</span>
              </label>
            </td>

            <td class="py-2 pr-0">
              <button
                type="button"
                class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50
                       disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                :disabled="busy"
                @click="removeMembership(m.customerId)"
              >
                Remover
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

    <!-- Adicionar membership -->
    <div class="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-3">
      <div class="lg:col-span-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Adicionar customer</div>

      <div>
        <div class="mb-1 text-xs text-slate-600 dark:text-slate-300">Customer</div>
        <select
          class="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs
                 dark:border-slate-800 dark:bg-slate-900"
          v-model="addCustomerId"
          :disabled="busy"
        >
          <option value="">Selecione…</option>
          <option v-for="c in availableCustomersForAdd" :key="c.id" :value="c.id">
            {{ c.name }} ({{ c.code }})
          </option>
        </select>
      </div>

      <div>
        <div class="mb-1 text-xs text-slate-600 dark:text-slate-300">Role</div>
        <select
          class="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs
                 dark:border-slate-800 dark:bg-slate-900"
          v-model="addRole"
          :disabled="busy"
        >
          <option value="viewer">viewer</option>
          <option value="member">member</option>
          <option value="admin">admin</option>
          <option value="owner">owner</option>
        </select>
      </div>

      <div class="flex items-end gap-4">
        <label class="inline-flex items-center gap-2 text-xs">
          <input type="checkbox" class="h-4 w-4" v-model="addGrantAll" :disabled="busy" />
          <span class="text-slate-600 dark:text-slate-300">Grant workspaces/reports do customer</span>
        </label>

        <button
          type="button"
          class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800
                 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          :disabled="busy || !addCustomerId"
          @click="addMembership"
        >
          Adicionar
        </button>
      </div>
    </div>

    <!-- Transfer -->
    <div class="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-4">
      <div class="lg:col-span-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Transferir customer</div>

      <div>
        <div class="mb-1 text-xs text-slate-600 dark:text-slate-300">From</div>
        <select
          class="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs
                 dark:border-slate-800 dark:bg-slate-900"
          v-model="trFromCustomerId"
          :disabled="busy"
        >
          <option value="">Selecione…</option>
          <option v-for="m in memberships" :key="m.customerId" :value="m.customerId">
            {{ m.customer?.name ?? m.customerId }}
          </option>
        </select>
      </div>

      <div>
        <div class="mb-1 text-xs text-slate-600 dark:text-slate-300">To</div>
        <select
          class="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs
                 dark:border-slate-800 dark:bg-slate-900"
          v-model="trToCustomerId"
          :disabled="busy"
        >
          <option value="">Selecione…</option>
          <option v-for="c in availableCustomersForTransfer" :key="c.id" :value="c.id">
            {{ c.name }} ({{ c.code }})
          </option>
        </select>
      </div>

      <div>
        <div class="mb-1 text-xs text-slate-600 dark:text-slate-300">Role no destino</div>
        <select
          class="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs
                 dark:border-slate-800 dark:bg-slate-900"
          v-model="trToRole"
          :disabled="busy"
        >
          <option value="viewer">viewer</option>
          <option value="member">member</option>
          <option value="admin">admin</option>
          <option value="owner">owner</option>
        </select>
      </div>

      <div class="flex items-end justify-between gap-4">
        <div class="flex flex-col gap-2">
          <label class="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" class="h-4 w-4" v-model="trRevokeFrom" :disabled="busy" />
            <span class="text-slate-600 dark:text-slate-300">Revogar permissões do “from”</span>
          </label>
          <label class="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" class="h-4 w-4" v-model="trGrantTo" :disabled="busy" />
            <span class="text-slate-600 dark:text-slate-300">Grant permissões no “to”</span>
          </label>
        </div>

        <button
          type="button"
          class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800
                 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          :disabled="busy || !trFromCustomerId || !trToCustomerId"
          @click="transfer"
        >
          Transferir
        </button>
      </div>
    </div>

    <div v-if="busy" class="mt-3 text-xs text-slate-500 dark:text-slate-400">
      Salvando alterações…
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  listCustomers,
  patchUserMembership,
  removeUserMembership,
  transferUserMembership,
  upsertUserMembership,
  type MembershipRole,
} from "./adminApi";

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

const busy = ref(false);
const error = ref<string>("");

const customers = ref<Array<{ id: string; code: string; name: string; status: string }>>([]);

async function refreshCustomers() {
  error.value = "";
  try {
    const rows = await listCustomers();
    customers.value = rows;
  } catch (e: any) {
    error.value = e?.message ?? String(e);
  }
}

onMounted(refreshCustomers);

// Add
const addCustomerId = ref("");
const addRole = ref<MembershipRole>("viewer");
const addGrantAll = ref(true);

const membershipCustomerIds = computed(() => new Set(props.memberships.map((m) => m.customerId)));

const availableCustomersForAdd = computed(() =>
  customers.value
    .filter((c) => c.status === "active")
    .filter((c) => !membershipCustomerIds.value.has(c.id)),
);

async function addMembership() {
  error.value = "";
  if (!addCustomerId.value) return;

  busy.value = true;
  try {
    await upsertUserMembership(props.userId, {
      customerId: addCustomerId.value,
      role: addRole.value,
      isActive: true,
      grantCustomerWorkspaces: addGrantAll.value,
      revokeCustomerPermissions: false,
      ensureUserActive: true,
    });
    addCustomerId.value = "";
    emit("refresh");
  } catch (e: any) {
    error.value = e?.message ?? String(e);
  } finally {
    busy.value = false;
  }
}

// Patch role
async function onChangeRole(customerId: string, role: string) {
  error.value = "";
  busy.value = true;
  try {
    await patchUserMembership(props.userId, customerId, { role: role as MembershipRole });
    emit("refresh");
  } catch (e: any) {
    error.value = e?.message ?? String(e);
  } finally {
    busy.value = false;
  }
}

// Toggle active
async function onToggleActive(customerId: string, isActive: boolean) {
  error.value = "";
  busy.value = true;
  try {
    await patchUserMembership(props.userId, customerId, {
      isActive,
      revokeCustomerPermissions: !isActive, // recomendação default
    });
    emit("refresh");
  } catch (e: any) {
    error.value = e?.message ?? String(e);
  } finally {
    busy.value = false;
  }
}

// Remove
async function removeMembership(customerId: string) {
  error.value = "";
  const ok = confirm("Remover membership? Isto pode revogar o acesso do usuário ao customer.");
  if (!ok) return;

  busy.value = true;
  try {
    await removeUserMembership(props.userId, customerId, true);
    emit("refresh");
  } catch (e: any) {
    error.value = e?.message ?? String(e);
  } finally {
    busy.value = false;
  }
}

// Transfer
const trFromCustomerId = ref("");
const trToCustomerId = ref("");
const trToRole = ref<MembershipRole>("viewer");
const trRevokeFrom = ref(true);
const trGrantTo = ref(true);

const availableCustomersForTransfer = computed(() =>
  customers.value
    .filter((c) => c.status === "active")
    .filter((c) => c.id !== trFromCustomerId.value),
);

async function transfer() {
  error.value = "";
  if (!trFromCustomerId.value || !trToCustomerId.value) return;

  const ok = confirm("Confirmar transferência de customer para este usuário?");
  if (!ok) return;

  busy.value = true;
  try {
    await transferUserMembership(props.userId, {
      fromCustomerId: trFromCustomerId.value,
      toCustomerId: trToCustomerId.value,
      toRole: trToRole.value,
      deactivateFrom: true,
      revokeFromCustomerPermissions: trRevokeFrom.value,
      grantToCustomerWorkspaces: trGrantTo.value,
      toIsActive: true,
    });

    trFromCustomerId.value = "";
    trToCustomerId.value = "";
    emit("refresh");
  } catch (e: any) {
    error.value = e?.message ?? String(e);
  } finally {
    busy.value = false;
  }
}
</script>
