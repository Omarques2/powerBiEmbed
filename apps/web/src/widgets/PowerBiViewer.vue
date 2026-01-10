<template>
  <div class="h-full w-full">
    <div class="h-full w-full rounded-2xl border border-slate-200 bg-white overflow-hidden relative">
      <div v-if="!workspaceId || !reportId" class="absolute inset-0 grid place-items-center p-6">
        <div class="text-center">
          <div class="text-slate-900 font-semibold">Selecione um report</div>
          <div class="text-sm text-slate-600 mt-1">
            O relatório embutido aparecerá aqui.
          </div>
        </div>
      </div>

      <div v-if="loading" class="absolute top-3 right-3 text-xs text-slate-600">
        Carregando...
      </div>

      <div v-if="error" class="absolute bottom-3 left-3 right-3 text-xs text-red-700 whitespace-pre-wrap">
        {{ error }}
      </div>

      <div ref="containerEl" class="h-full w-full"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import * as pbi from "powerbi-client";
import { http } from "@/api/http";

const props = defineProps<{
  workspaceId: string | null;
  reportId: string | null;
}>();

const containerEl = ref<HTMLDivElement | null>(null);
const loading = ref(false);
const error = ref("");

let powerbiService: pbi.service.Service | null = null;
let currentEmbed: pbi.Embed | null = null;

function ensureService() {
  if (!powerbiService) {
    powerbiService = new pbi.service.Service(
      pbi.factories.hpmFactory,
      pbi.factories.wpmpFactory,
      pbi.factories.routerFactory
    );
  }
}

function reset() {
  try {
    if (powerbiService && containerEl.value) {
      powerbiService.reset(containerEl.value);
    }
  } catch {
    // ignore reset errors
  }
  currentEmbed = null;
}

async function embedReport(workspaceId: string, reportId: string) {
  ensureService();
  error.value = "";
  loading.value = true;

  try {
    reset();

    const res = await http.get("/powerbi/embed-config", {
      params: { workspaceId, reportId },
    });

    const cfg = res.data as {
      workspaceId: string;
      reportId: string;
      embedUrl: string;
      embedToken: string;
      expiresOn: string;
    };

    const embedConfig: pbi.IEmbedConfiguration = {
      type: "report",
      tokenType: pbi.models.TokenType.Embed,
      accessToken: cfg.embedToken,
      embedUrl: cfg.embedUrl,
      id: cfg.reportId,
      settings: {
        panes: {
          filters: { visible: false },
          pageNavigation: { visible: true },
        },
      },
    };

    currentEmbed = powerbiService!.embed(containerEl.value!, embedConfig);

    currentEmbed.on("loaded", () => console.log("Power BI: loaded"));
    currentEmbed.on("rendered", () => console.log("Power BI: rendered"));
    currentEmbed.on("error", (evt: any) => {
      console.error("Power BI error:", evt?.detail ?? evt);
      error.value = `Erro do Power BI: ${JSON.stringify(evt?.detail ?? evt)}`;
    });
  } catch (e: any) {
    error.value = `Falha ao embutir report: ${e?.message ?? String(e)}`;
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.workspaceId, props.reportId] as const,
  async ([wsId, rpId]) => {
    reset();
    if (wsId && rpId) await embedReport(wsId, rpId);
  },
  { immediate: true }
);

onBeforeUnmount(() => reset());
</script>
