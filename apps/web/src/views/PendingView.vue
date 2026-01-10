<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
    <div
      class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm
             dark:border-slate-800 dark:bg-slate-900"
    >
      <h1 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Aguardando liberação do administrador
      </h1>

      <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Seu acesso foi criado, mas ainda não foi ativado. Assim que o administrador liberar, você será redirecionado.
      </p>

      <div v-if="statusMessage" class="mt-4 text-xs text-slate-500 dark:text-slate-400">
        {{ statusMessage }}
      </div>

      <div class="mt-6 flex items-center justify-between gap-3">
        <button
          class="inline-flex items-center justify-center rounded-xl border border-slate-900 bg-white px-4 py-2 text-sm
                 hover:bg-slate-50 active:scale-[0.98] transition
                 dark:border-slate-800 dark:bg-slate-300 dark:hover:bg-slate-200"
          @click="checkNow"
          :disabled="checking"
        >
          {{ checking ? "Verificando..." : "Verificar agora" }}
        </button>

        <button
          class="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white
                 hover:bg-slate-800 active:scale-[0.98] transition
                 dark:bg-slate-300 dark:text-slate-900 dark:hover:bg-slate-200"
          @click="onLogout"
        >
          Sair
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { http } from "@/api/http";
import { logout } from "../auth/auth";

type MeResponse = {
  status?: "pending" | "active" | "disabled";
  rawStatus?: string;
  memberships?: any[];
};

const router = useRouter();

const checking = ref(false);
const statusMessage = ref("");

let timer: number | null = null;

async function fetchMe(): Promise<MeResponse | null> {
  try {
    const res = await http.get("/users/me");
    return res.data as MeResponse;
  } catch (e: any) {
    const status = e?.response?.status;

    // Se perdeu sessão / token inválido, volta para login
    if (status === 401) {
      await logout();
      return null;
    }

    return null;
  }
}

async function checkNow() {
  checking.value = true;
  try {
    const me = await fetchMe();
    if (!me) {
      statusMessage.value = "Sessão expirada. Redirecionando para login...";
      return;
    }
    const st = me?.status;

    if (st === "active") {
      // liberado -> volta para o app
      router.replace("/app");
      return;
    }

    if (st === "disabled") {
      statusMessage.value = "Seu usuário está desativado. Contate o administrador.";
      return;
    }

    // pending ou null
    statusMessage.value = "Ainda pendente. Aguarde a liberação.";
  } finally {
    checking.value = false;
  }
}

async function onLogout() {
  await logout();
}

onMounted(async () => {
  // checa na entrada (boa UX)
  await checkNow();

  // polling leve: a cada 10s
  timer = window.setInterval(() => {
    void checkNow();
  }, 10_000);
});

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer);
});
</script>