<template>
  <!-- Container “card-like” mas fino -->
  <header
    class="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur
           dark:border-slate-800 dark:bg-slate-900/70"
  >
    <div class="px-2.5 py-2 sm:px-3">
      <!-- Grid garante centralização real do título -->
      <div class="grid grid-cols-[auto_1fr_auto] items-center gap-2">
        <!-- Left: Home/App -->
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs
                 hover:bg-slate-50 active:scale-[0.98] transition
                 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
          title="Voltar para o App"
          aria-label="Voltar para o App"
          @click="$emit('back')"
        >
          <IconArrowLeft class="h-4 w-4" />
          <span class="hidden sm:inline">App</span>
        </button>

        <!-- Center: Admin / Section -->
        <div class="min-w-0 justify-self-center text-center">
          <div
            class="inline-flex max-w-full items-center gap-2 truncate
                   text-sm font-semibold text-slate-900 dark:text-slate-100 sm:text-base"
          >
            <span class="truncate">Admin</span>
            <span class="text-slate-400 dark:text-slate-500">/</span>
            <span class="truncate">{{ displayTitle }}</span>
          </div>

          <!-- Subtitle só em telas maiores para não aumentar altura no mobile -->
          <div
            v-if="displaySubtitle"
            class="mt-0.5 hidden max-w-[70vw] truncate text-xs text-slate-500 dark:text-slate-400 lg:block"
          >
            {{ displaySubtitle }}
          </div>
        </div>

        <!-- Right: actions -->
        <div class="flex items-center justify-self-end gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs
                   hover:bg-slate-50 active:scale-[0.98] transition
                   disabled:opacity-60 disabled:cursor-not-allowed
                   dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            :disabled="loadingAny"
            title="Recarregar"
            aria-label="Recarregar"
            @click="$emit('reload')"
          >
            <IconRefresh class="h-4 w-4" :class="loadingAny ? 'animate-spin' : ''" />
            <span class="hidden sm:inline">{{ loadingAny ? "Carregando..." : "Recarregar" }}</span>
          </button>

          <button
            v-if="showSearch"
            type="button"
            class="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50
                   dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 sm:inline-flex"
            @click="$emit('search')"
          >
            Buscar (Ctrl+K)
          </button>

          <ThemeToggle :show-label="true" size="sm" />
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import ThemeToggle from "@/ui/theme/ThemeToggle.vue";
import IconRefresh from "@/components/icons/IconRefresh.vue";
import IconArrowLeft from "@/components/icons/IconArrowLeft.vue";

const props = withDefaults(
  defineProps<{
    /**
     * LEGADO: AdminView usa :section="title"
     */
    section?: string;

    /**
     * NOVO: uso mais explícito
     */
    title?: string;
    subtitle?: string;

    loadingAny: boolean;
    showSearch?: boolean;
  }>(),
  {
    section: "",
    showSearch: false,
    subtitle: "",
    title: "",
  }
);

defineEmits<{
  (e: "reload"): void;
  (e: "back"): void;   // agora é o “App/Home”
  (e: "search"): void;
}>();

const displayTitle = computed(() => props.title ?? props.section ?? "");
const displaySubtitle = computed(() => props.subtitle ?? "");
</script>
