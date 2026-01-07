<!-- apps/web/src/admin/panels/ActiveUsersPanel.vue -->
<template>
  <div class="space-y-3">
    <div
      v-if="err"
      class="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700
             dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
    >
      {{ err }}
    </div>

    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div class="text-xs text-slate-600 dark:text-slate-300">Usuários ativos</div>

      <div class="flex items-center gap-2">
        <input
          v-model="q"
          type="text"
          class="w-64 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none
                 dark:border-slate-800 dark:bg-slate-900"
          placeholder="Buscar por email/nome…"
          @keydown.enter.prevent="load(1)"
        />

        <button
          type="button"
          class="rounded-xl border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50
                 disabled:opacity-60 dark:border-slate-800 dark:hover:bg-slate-800"
          :disabled="loading"
          @click="load(1)"
        >
          Buscar
        </button>
      </div>
    </div>

    <div class="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs text-slate-600 dark:bg-slate-950/30 dark:text-slate-300">
          <tr>
            <th class="px-3 py-2 text-left">Email</th>
            <th class="px-3 py-2 text-left">Nome</th>
            <th class="px-3 py-2 text-left">Status</th>
            <th class="px-3 py-2 text-left">Último login</th>
            <th class="px-3 py-2 text-right">Ações</th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="u in rows"
            :key="u.id"
            class="border-t border-slate-200 dark:border-slate-800"
          >
            <td class="px-3 py-2">{{ u.email ?? "—" }}</td>
            <td class="px-3 py-2">{{ u.display_name ?? "—" }}</td>
            <td class="px-3 py-2">{{ u.status ?? "—" }}</td>
            <td class="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
              {{ formatDate(u.last_login_at) }}
            </td>
            <td class="px-3 py-2 text-right">
              <button
                type="button"
                class="rounded-xl border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50
                       dark:border-slate-800 dark:hover:bg-slate-800"
                @click="$emit('openUser', u.id)"
              >
                Abrir
              </button>
            </td>
          </tr>

          <tr v-if="!rows.length">
            <td colspan="5" class="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Nenhum usuário.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
      <button
        type="button"
        class="rounded-lg border px-2 py-1 disabled:opacity-60 dark:border-slate-800"
        :disabled="loading || page <= 1"
        @click="load(page - 1)"
      >
        ←
      </button>

      <div>Página {{ page }} (total: {{ total }})</div>

      <button
        type="button"
        class="rounded-lg border px-2 py-1 disabled:opacity-60 dark:border-slate-800"
        :disabled="loading || page * pageSize >= total"
        @click="load(page + 1)"
      >
        →
      </button>
    </div>

    <div v-if="loading" class="text-xs text-slate-500 dark:text-slate-400">
      Carregando…
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { listActiveUsers, type ActiveUserRow } from "../adminApi";

defineEmits<{
  (e: "openUser", userId: string): void;
}>();

const loading = ref(false);
const err = ref("");
const q = ref("");

const rows = ref<ActiveUserRow[]>([]);
const page = ref(1);
const pageSize = ref(25);
const total = ref(0);

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

async function load(p = 1) {
  loading.value = true;
  err.value = "";
  try {
    const res = await listActiveUsers(q.value, p, pageSize.value);
    rows.value = res.rows ?? [];
    total.value = res.total ?? 0;
    page.value = res.page ?? p;
  } catch (e: any) {
    err.value = e?.message ?? "Falha ao listar usuários ativos";
  } finally {
    loading.value = false;
  }
}

onMounted(() => load(1));
</script>
