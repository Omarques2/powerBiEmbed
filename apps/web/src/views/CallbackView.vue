<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-50 p-6">
    <div class="w-full max-w-md rounded-2xl bg-white shadow p-6">
      <h1 class="text-lg font-semibold text-slate-900">Concluindo login...</h1>
      <p class="mt-2 text-sm text-slate-600">Você será redirecionado automaticamente.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { getActiveAccount } from "../auth/auth";

const router = useRouter();

onMounted(async () => {
  // initAuth() já foi chamado no main.ts
  const acc = getActiveAccount();
  router.replace(acc ? "/app" : "/login");
});
</script>
