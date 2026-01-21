<template>
  <ToastHost />
  <ConfirmHost />
  <router-view />
  <transition name="fade">
    <div
      v-if="routeLoading && !isAuthRoute"
      class="fixed inset-0 z-[100] grid place-items-center bg-slate-950/40 backdrop-blur-sm"
      aria-live="polite"
      aria-busy="true"
    >
      <div class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm font-medium text-slate-700 shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
        <div
          class="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900 dark:border-slate-700 dark:border-t-slate-100"
        />
        <span>Carregando...</span>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import ToastHost from "./ui/toast/ToastHost.vue";
import ConfirmHost from "./ui/confirm/ConfirmHost.vue";
import { routeLoading } from "./ui/loading/routeLoading";
import { computed } from "vue";
import { useRoute } from "vue-router";
const route = useRoute();
const isAuthRoute = computed(() => ["/login", "/auth/callback", "/pending"].includes(route.path));
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
