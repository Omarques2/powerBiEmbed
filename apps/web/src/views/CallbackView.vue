<template>
  <div class="min-h-screen bg-background p-6 text-foreground">
    <div
      v-if="showNonAdminModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
    >
      <div class="w-full max-w-md rounded-3xl border border-border/60 bg-card p-6 shadow-xl">
        <h2 class="text-lg font-semibold">Permissão de administrador necessária</h2>
        <p class="mt-3 text-sm text-muted-foreground">
          A autorização falhou porque sua conta não é administradora do tenant.
          Peça para o time de TI autorizar o acesso usando o link exibido nesta tela.
        </p>
        <div class="mt-6 flex justify-end">
          <button
            class="inline-flex items-center justify-center rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90"
            type="button"
            @click="showNonAdminModal = false"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
    <div v-if="consentState !== 'none'" class="mx-auto flex max-w-2xl flex-col gap-6">
      <div class="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-sm">
        <div class="flex flex-col gap-2">
          <h1 class="text-xl font-semibold">
            <span v-if="consentState === 'required'">Autorizar minha empresa</span>
            <span v-else>Consentimento concluído</span>
          </h1>
          <p class="text-sm text-muted-foreground">
            <span v-if="consentState === 'required'">
              Este acesso precisa de consentimento do administrador do seu tenant Microsoft Entra.
            </span>
            <span v-else>
              O administrador concluiu o consentimento. Agora você pode entrar novamente.
            </span>
          </p>
          <p
            v-if="consentState === 'required'"
            class="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300"
          >
            Somente administradores podem autorizar o acesso da empresa. Se você não for admin,
            copie o link abaixo e envie para o responsável de TI.
          </p>
          <p
            v-if="consentState === 'required' && consentError"
            class="mt-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground"
          >
            {{ consentError }}
          </p>
        </div>

        <div v-if="consentState === 'required'" class="mt-6 flex flex-col gap-3">
          <a
            class="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90"
            :href="adminConsentUrl"
          >
            Autorizar minha empresa
          </a>
          <div class="rounded-2xl border border-border/60 bg-background/60 p-4 text-xs text-muted-foreground">
            Esta etapa exige um administrador do seu tenant. Se você não for admin, copie o link
            abaixo e envie para o responsável de TI.
            <div class="mt-3 break-all rounded-xl border border-border/60 bg-background px-3 py-2">
              {{ adminConsentUrl }}
            </div>
          </div>
        </div>

        <div v-else class="mt-6 flex flex-col gap-3">
          <button
            class="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90"
            type="button"
            @click="goLogin"
          >
            Voltar para login
          </button>
        </div>
      </div>
    </div>

    <div v-else class="flex min-h-screen items-center justify-center">
      <div class="flex flex-col items-center justify-center">
        <!-- Spinner grande -->
        <div class="relative h-20 w-20">
          <!-- Halo / glow -->
          <div
            class="absolute inset-0 rounded-full blur-xl opacity-30 bg-foreground animate-pulse"
          ></div>

          <!-- Ring -->
          <div
            class="absolute inset-0 rounded-full border-[6px] border-border"
          ></div>

          <!-- Parte animada -->
          <div
            class="absolute inset-0 rounded-full border-[6px] border-transparent border-t-foreground animate-spin"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  getActiveAccount,
  getAdminConsentUrl,
  hardResetAuthState,
  initAuthSafe,
} from "../auth/auth";
import { getMeCached } from "../auth/me";

const router = useRouter();
const consentState = ref<"none" | "required" | "granted">("none");
const consentError = ref<string | null>(null);
const showNonAdminModal = ref(false);
const tenantHint = ref<string | null>(null);

const adminConsentUrl = computed(() =>
  getAdminConsentUrl(tenantHint.value ?? undefined),
);

function extractTenantHint(description: string | null): string | null {
  if (!description) return null;
  const match = description.match(/organization '([^']+)'/i);
  return match?.[1] ?? null;
}

function readAuthError(): { code?: string; description?: string } {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(window.location.search.replace(/^\?/, ""));
  return {
    code: hashParams.get("error") ?? searchParams.get("error") ?? undefined,
    description:
      hashParams.get("error_description") ??
      searchParams.get("error_description") ??
      undefined,
  };
}

function readAdminConsentFlag(): boolean {
  const searchParams = new URLSearchParams(window.location.search.replace(/^\?/, ""));
  return searchParams.get("admin_consent")?.toLowerCase() === "true";
}

function goLogin(): void {
  router.replace("/login");
}

onMounted(async () => {
  const authError = readAuthError();
  if (authError.code || authError.description) {
    consentState.value = "required";
    consentError.value =
      authError.description ??
      "Seu administrador precisa autorizar este aplicativo para o tenant.";
    tenantHint.value = extractTenantHint(authError.description ?? null);
    if (authError.code === "access_denied") {
      showNonAdminModal.value = true;
    }
    return;
  }

  if (readAdminConsentFlag()) {
    consentState.value = "granted";
    return;
  }

  try {
    await initAuthSafe();
  } catch {
    await hardResetAuthState();
  }
  const acc = getActiveAccount();
  if (!acc) {
    router.replace("/login");
    return;
  }
  const me = await getMeCached(true);
  router.replace(me?.status === "active" ? "/app" : "/pending");
});
</script>
