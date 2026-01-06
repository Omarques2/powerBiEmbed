<template>
  <div class="min-h-screen bg-slate-50 p-6 dark:bg-slate-950">
    <div class="mx-auto max-w-6xl">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h1 class="text-xl font-semibold text-slate-900 dark:text-slate-100">Admin</h1>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Aprovação de usuários, vínculo com customer e permissões iniciais.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50
                   dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            :disabled="loading"
            @click="reloadAll"
          >
            {{ loading ? "Carregando..." : "Recarregar" }}
          </button>

          <button
            class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800
                   dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            @click="goBack"
          >
            Voltar
          </button>
        </div>
      </div>

      <div
        v-if="error"
        class="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700
               dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200"
      >
        {{ error }}
      </div>

      <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- Left: pending list -->
        <div class="lg:col-span-2">
          <div
            class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm
                   dark:border-slate-800 dark:bg-slate-900"
          >
            <div class="flex items-center justify-between">
              <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Usuários pendentes ({{ pending.length }})
              </div>
            </div>

            <div v-if="pending.length === 0 && !loading" class="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Nenhum usuário pendente no momento.
            </div>

            <div class="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
              <button
                v-for="u in pending"
                :key="u.id"
                class="w-full px-2 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                :class="selected?.id === u.id ? 'bg-slate-50 dark:bg-slate-800' : ''"
                @click="select(u)"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <div class="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {{ u.display_name ?? "—" }}
                    </div>
                    <div class="truncate text-xs text-slate-600 dark:text-slate-300">
                      {{ u.email ?? "sem email" }}
                    </div>
                  </div>

                  <div class="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                    {{ fmtDate(u.created_at) }}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        <!-- Right: action panel -->
        <div>
          <div
            class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm
                   dark:border-slate-800 dark:bg-slate-900"
          >
            <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Aprovação
            </div>

            <div v-if="!selected" class="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Selecione um usuário pendente à esquerda.
            </div>

            <div v-else class="mt-3 space-y-3">
              <div class="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
                <div class="font-medium text-slate-900 dark:text-slate-100">
                  {{ selected.display_name ?? "—" }}
                </div>
                <div class="text-xs text-slate-600 dark:text-slate-300">
                  {{ selected.email ?? "sem email" }}
                </div>
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-700 dark:text-slate-300">Customer</label>
                <select
                  v-model="customerId"
                  class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                         dark:border-slate-800 dark:bg-slate-900"
                >
                  <option value="" disabled>Selecione…</option>
                  <option v-for="c in customersActiveFirst" :key="c.id" :value="c.id">
                    {{ c.name }} ({{ c.code }}) — {{ c.status }}
                  </option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-700 dark:text-slate-300">Role</label>
                <select
                  v-model="role"
                  class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm
                         dark:border-slate-800 dark:bg-slate-900"
                >
                  <option value="viewer">viewer</option>
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                  <option value="owner">owner</option>
                </select>
              </div>

              <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input type="checkbox" v-model="grantCustomerWorkspaces" />
                Conceder workspaces do customer automaticamente
              </label>

              <div class="flex gap-2">
                <button
                  class="flex-1 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800
                         disabled:opacity-60 disabled:cursor-not-allowed
                         dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                  :disabled="saving || !customerId"
                  @click="approve"
                >
                  {{ saving ? "Ativando..." : "Ativar" }}
                </button>

                <button
                  class="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 hover:bg-red-100
                         disabled:opacity-60 disabled:cursor-not-allowed
                         dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/55"
                  :disabled="saving"
                  @click="disable"
                >
                  {{ saving ? "..." : "Desativar" }}
                </button>
              </div>

              <div v-if="actionMsg" class="text-xs text-slate-600 dark:text-slate-300">
                {{ actionMsg }}
              </div>
            </div>
          </div>

          <div class="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Observação: para ambiente produtivo, considere auditoria (audit_log) e DTO + ValidationPipe no NestJS.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  type CustomerRow,
  type PendingUserRow,
  activateUser,
  disableUser,
  listCustomers,
  listPendingUsers,
} from "../admin/adminApi";

const router = useRouter();

const loading = ref(false);
const saving = ref(false);
const error = ref("");

const pending = ref<PendingUserRow[]>([]);
const customers = ref<CustomerRow[]>([]);
const selected = ref<PendingUserRow | null>(null);

const customerId = ref<string>("");
const role = ref<"owner" | "admin" | "member" | "viewer">("viewer");
const grantCustomerWorkspaces = ref(true);
const actionMsg = ref("");

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

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function select(u: PendingUserRow) {
  selected.value = u;
  customerId.value = "";
  role.value = "viewer";
  grantCustomerWorkspaces.value = true;
  actionMsg.value = "";
}

async function reloadAll() {
  error.value = "";
  actionMsg.value = "";
  loading.value = true;
  try {
    const [p, c] = await Promise.all([listPendingUsers(), listCustomers()]);
    pending.value = p;
    customers.value = c;

    // se o selecionado sumiu (aprovado por outro admin), limpa
    if (selected.value && !pending.value.find(x => x.id === selected.value!.id)) {
      selected.value = null;
      customerId.value = "";
    }
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? String(e);
  } finally {
    loading.value = false;
  }
}

async function approve() {
  if (!selected.value) return;
  if (!customerId.value) return;

  saving.value = true;
  error.value = "";
  actionMsg.value = "";

  try {
    await activateUser(selected.value.id, {
      customerId: customerId.value,
      role: role.value,
      grantCustomerWorkspaces: grantCustomerWorkspaces.value,
    });

    actionMsg.value = "Usuário ativado com sucesso.";
    await reloadAll();
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? String(e);
  } finally {
    saving.value = false;
  }
}

async function disable() {
  if (!selected.value) return;

  const ok = window.confirm("Confirmar desativação deste usuário?");
  if (!ok) return;

  saving.value = true;
  error.value = "";
  actionMsg.value = "";

  try {
    await disableUser(selected.value.id);
    actionMsg.value = "Usuário desativado.";
    await reloadAll();
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? String(e);
  } finally {
    saving.value = false;
  }
}

function goBack() {
  router.replace("/app");
}

onMounted(async () => {
  await reloadAll();
});
</script>