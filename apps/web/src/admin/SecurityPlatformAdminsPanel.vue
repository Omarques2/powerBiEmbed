<template>
  <div class="space-y-4">
    <!-- Banner de risco -->
    <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
      <div class="text-sm font-semibold">Atenção: Platform Admin</div>
      <div class="mt-1 text-sm opacity-90">
        Platform admin tem acesso total ao Admin Panel e às operações de Power BI. Conceda este acesso apenas quando necessário.
      </div>
    </div>

    <!-- Controles -->
    <div class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">Platform Admins</div>
          <div class="mt-1 text-xs text-slate-600 dark:text-slate-300">
            Aplicação:
            <span class="font-mono">{{ appKey }}</span>
          </div>
        </div>

        <div class="flex gap-2">
          <input
            v-model="q"
            placeholder="Buscar por nome/email..."
            class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900 sm:w-72"
          />
          <button
            class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            :disabled="loading"
            @click="load()"
          >
            {{ loading ? "Carregando..." : "Recarregar" }}
          </button>
        </div>
      </div>

      <!-- Add -->
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
        <input
          v-model="newEmail"
          placeholder="Email do usuário para conceder Platform Admin"
          class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
        />
        <button
          class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          :disabled="granting || !newEmail.trim()"
          @click="onGrant()"
        >
          {{ granting ? "Concedendo..." : "Conceder" }}
        </button>
      </div>

      <div v-if="error" class="text-sm text-rose-600">{{ error }}</div>
    </div>

    <!-- Table -->
    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-50 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300">
          <tr>
            <th class="px-4 py-3">Nome</th>
            <th class="px-4 py-3">Email</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3">Concedido em</th>
            <th class="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in filtered" :key="r.userId" class="border-t border-slate-100 dark:border-slate-800">
            <td class="px-4 py-3">
              <div class="font-medium text-slate-900 dark:text-slate-100">{{ r.displayName ?? "—" }}</div>
              <div class="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono">{{ r.userId }}</div>
            </td>
            <td class="px-4 py-3">{{ r.email ?? "—" }}</td>
            <td class="px-4 py-3">
              <span
                class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
                :class="r.status === 'active'
                  ? 'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-200'
                  : 'border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-300'"
              >
                {{ r.status }}
              </span>
            </td>
            <td class="px-4 py-3">{{ fmt(r.grantedAt) }}</td>
            <td class="px-4 py-3 text-right">
              <button
                class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                :disabled="revokingId === r.userId"
                @click="onRevoke(r.userId, r.email)"
              >
                {{ revokingId === r.userId ? "Revogando..." : "Revogar" }}
              </button>
            </td>
          </tr>

          <tr v-if="!loading && filtered.length === 0">
            <td colspan="5" class="px-4 py-6 text-center text-sm text-slate-600 dark:text-slate-300">
              Nenhum platform admin encontrado.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Footer: contagem / break-glass -->
    <div class="text-xs text-slate-600 dark:text-slate-300">
      Total: <span class="font-semibold">{{ rows.length }}</span> platform admins.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { grantPlatformAdmin, listPlatformAdmins, revokePlatformAdmin, type PlatformAdminRow } from "./adminApi";
import { useToast } from "../ui/toast/useToast";
import { useConfirm } from "../ui/confirm/useConfirm";

const appKey = "PBI_EMBED";

const { push } = useToast();
const { confirm } = useConfirm();

const rows = ref<PlatformAdminRow[]>([]);
const loading = ref(false);
const error = ref("");

const q = ref("");
const newEmail = ref("");
const granting = ref(false);
const revokingId = ref<string>("");

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase();
  if (!s) return rows.value;
  return rows.value.filter((r) => {
    const name = (r.displayName ?? "").toLowerCase();
    const email = (r.email ?? "").toLowerCase();
    return name.includes(s) || email.includes(s) || r.userId.toLowerCase().includes(s);
  });
});

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    rows.value = await listPlatformAdmins(appKey);
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? String(e);
    push({
      kind: "error",
      title: "Falha ao carregar platform admins",
      message: "Verifique permissões e tente novamente.",
      details: e?.response?.data ?? e,
      timeoutMs: 6500,
    });
  } finally {
    loading.value = false;
  }
}

async function onGrant() {
  const email = newEmail.value.trim();
  const ok = await confirm({
    title: "Conceder Platform Admin?",
    message: `Você está prestes a conceder Platform Admin para: ${email}. Esta ação dá acesso total ao Admin Panel.`,
    confirmText: "Conceder",
    cancelText: "Cancelar",
    danger: true,
  });

  if (!ok) return;

  granting.value = true;
  try {
    await grantPlatformAdmin({ appKey, userEmail: email });
    push({ kind: "success", title: "Platform Admin concedido", message: email });
    newEmail.value = "";
    await load();
  } catch (e: any) {
    const data = e?.response?.data;
    push({
      kind: "error",
      title: "Falha ao conceder Platform Admin",
      message: data?.message ?? e?.message ?? "Erro desconhecido",
      details: data ?? e,
      timeoutMs: 8000,
    });
  } finally {
    granting.value = false;
  }
}

async function onRevoke(userId: string, email: string | null) {
  const label = email ?? userId;

  const ok = await confirm({
    title: "Revogar Platform Admin?",
    message: `Você está prestes a revogar Platform Admin de ${label}. Se este for o último platform admin, a operação será bloqueada.`,
    confirmText: "Revogar",
    cancelText: "Cancelar",
    danger: true,
  });

  if (!ok) return;

  revokingId.value = userId;
  try {
    await revokePlatformAdmin(userId, appKey);
    push({ kind: "success", title: "Platform Admin revogado", message: label });
    await load();
  } catch (e: any) {
    const data = e?.response?.data;
    const code = data?.code ?? data?.message?.code;

    const human =
      code === "LAST_PLATFORM_ADMIN"
        ? "Não é permitido revogar o último platform admin."
        : (data?.message ?? e?.message ?? "Erro desconhecido");

    push({
      kind: "error",
      title: "Falha ao revogar Platform Admin",
      message: human,
      details: data ?? e,
      timeoutMs: 9000,
    });
  } finally {
    revokingId.value = "";
  }
}

onMounted(load);
</script>
