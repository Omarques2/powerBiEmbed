<!-- apps/web/src/admin/drawers/UserDrawer.vue -->
<template>
  <teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[900]">
      <div class="absolute inset-0 bg-black/30" @click="close()"></div>

      <div class="absolute right-0 top-0 h-full w-[min(720px,92vw)] bg-white shadow-2xl dark:bg-slate-950">
        <div class="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
          <div class="min-w-0">
            <div class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {{ headerTitle }}
            </div>
            <div class="text-xs text-slate-500 dark:text-slate-400">
              {{ user?.id ?? "" }} · status: {{ user?.status ?? "—" }}
            </div>
          </div>

          <button
            class="rounded-xl border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
            @click="close()"
          >
            Fechar
          </button>
        </div>

        <div class="h-[calc(100%-64px)] overflow-auto p-4">
          <div
            v-if="error"
            class="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
          >
            {{ error }}
          </div>

          <div v-if="loading" class="text-xs text-slate-500 dark:text-slate-400">Carregando…</div>

          <div v-else-if="user">
            <UserMembershipEditor
              :userId="user.id"
              :memberships="memberships"
              @refresh="reload()"
            />
          </div>

          <div v-else class="text-xs text-slate-500 dark:text-slate-400">
            Nenhum usuário selecionado.
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import UserMembershipEditor from "../UserMembershipEditor.vue";
import { getUserById, getUserPermissions, type ActiveUserRow, type UserPermissionsResponse } from "@/features/admin/api";

const props = defineProps<{
  modelValue: boolean;
  userId: string | null;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "changed"): void; // manter para o pai, caso queira reagir
}>();

const open = ref(false);
const loading = ref(false);
const error = ref("");
const user = ref<ActiveUserRow | null>(null);

const permissions = ref<UserPermissionsResponse | null>(null);

const memberships = computed(() => permissions.value?.memberships ?? []);

const headerTitle = computed(() => user.value?.email ?? user.value?.display_name ?? "User");

function close() {
  emit("update:modelValue", false);
}

async function reload() {
  if (!props.userId) return;

  loading.value = true;
  error.value = "";
  try {
    // 1) Fonte da verdade do header
    user.value = await getUserById(props.userId);

    // 2) Fonte da verdade para memberships/perms
    permissions.value = await getUserPermissions(props.userId);

    emit("changed");
  } catch (e: any) {
    error.value = e?.message ?? "Falha ao carregar usuário";
    user.value = null;
    permissions.value = null;
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.modelValue,
  (v) => {
    open.value = v;
    if (v && props.userId) reload();
    if (!v) {
      // limpeza para evitar “flash” de dados ao reabrir
      error.value = "";
      user.value = null;
      permissions.value = null;
    }
  },
  { immediate: true },
);

watch(
  () => props.userId,
  (id) => {
    if (!props.modelValue) return;
    if (id) reload();
  },
);
</script>
