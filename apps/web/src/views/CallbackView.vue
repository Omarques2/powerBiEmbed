<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-50 p-6">
    <div class="flex flex-col items-center justify-center">
      <!-- Spinner grande -->
      <div class="relative h-20 w-20">
        <!-- Halo / glow -->
        <div
          class="absolute inset-0 rounded-full blur-xl opacity-30 bg-slate-900 animate-pulse"
        ></div>

        <!-- Ring -->
        <div
          class="absolute inset-0 rounded-full border-[6px] border-slate-200"
        ></div>

        <!-- Parte animada -->
        <div
          class="absolute inset-0 rounded-full border-[6px] border-transparent border-t-slate-900 animate-spin"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { getActiveAccount, initAuthOnce } from "../auth/auth";

const router = useRouter();

onMounted(async () => {
  await initAuthOnce();
  const acc = getActiveAccount();
  router.replace(acc ? "/app" : "/login");
});
</script>
