<template>
  <div class="rounded-2xl border border-border bg-card p-4 shadow-sm">
    <div class="mb-3 flex items-center justify-between gap-3">
      <div class="text-sm font-semibold text-foreground">{{ title }}</div>
      <div class="text-xs text-muted-foreground">{{ points.length }} buckets</div>
    </div>

    <div v-if="!points.length" class="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      Sem dados para o período selecionado.
    </div>

    <div v-else class="relative">
      <svg
        class="h-[240px] w-full"
        viewBox="0 0 1000 260"
        preserveAspectRatio="none"
        role="img"
        :aria-label="title"
      >
        <line
          v-for="grid in yGrid"
          :key="grid.id"
          x1="56"
          x2="980"
          :y1="grid.y"
          :y2="grid.y"
          class="stroke-border"
          stroke-width="1"
        />

        <polyline
          fill="none"
          class="stroke-primary"
          stroke-width="3"
          :points="polylinePoints"
          stroke-linejoin="round"
          stroke-linecap="round"
        />

        <g v-for="(point, index) in plottedPoints" :key="point.id">
          <circle
            :cx="point.x"
            :cy="point.y"
            r="10"
            fill="transparent"
            tabindex="0"
            class="cursor-pointer outline-none"
            :aria-label="`${point.label}: ${point.value}`"
            :data-testid="`chart-point-hit-${index}`"
            @mouseenter="showTooltip(point)"
            @mouseleave="hideTooltip"
            @focus="showTooltip(point)"
            @blur="hideTooltip"
          />
          <circle
            :cx="point.x"
            :cy="point.y"
            :r="hoveredPoint?.id === point.id ? 5 : 3.5"
            class="pointer-events-none fill-primary transition-[r] duration-100"
            :data-testid="`chart-point-${index}`"
          />
        </g>

        <text
          v-for="grid in yGrid"
          :key="`label-${grid.id}`"
          x="8"
          :y="grid.y + 4"
          class="fill-muted-foreground text-[11px]"
        >
          {{ grid.value }}
        </text>

        <text
          v-for="tick in xTicks"
          :key="tick.id"
          :x="tick.x"
          y="252"
          text-anchor="middle"
          class="fill-muted-foreground text-[11px]"
        >
          {{ tick.label }}
        </text>
      </svg>

      <div
        v-if="hoveredPoint"
        data-testid="chart-tooltip"
        class="pointer-events-none absolute z-10 min-w-[120px] -translate-x-1/2 rounded-lg border border-border bg-background/95 px-2 py-1.5 text-xs shadow-md backdrop-blur-sm"
        :style="{
          left: `${tooltipPosition.left}%`,
          top: `${tooltipPosition.top}%`,
        }"
      >
        <div class="font-medium text-foreground">{{ hoveredPoint.label }}</div>
        <div class="text-muted-foreground">Logins: {{ hoveredPoint.value }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

type ChartPoint = {
  label: string;
  value: number;
};

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 260;

const props = withDefaults(
  defineProps<{
    title?: string;
    points: ChartPoint[];
  }>(),
  {
    title: "Série",
  },
);

const yMax = computed(() => {
  const max = props.points.reduce((acc, item) => Math.max(acc, Number(item.value ?? 0)), 0);
  return Math.max(1, max);
});

const plottedPoints = computed(() => {
  if (!props.points.length) return [];

  const chartLeft = 56;
  const chartRight = 980;
  const chartTop = 16;
  const chartBottom = 224;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;
  const stepX = props.points.length > 1 ? chartWidth / (props.points.length - 1) : 0;

  return props.points.map((point, index) => {
    const value = Number(point.value ?? 0);
    const ratio = Math.min(Math.max(value / yMax.value, 0), 1);
    return {
      id: `${index}-${point.label}`,
      x: chartLeft + index * stepX,
      y: chartBottom - ratio * chartHeight,
      label: point.label,
      value,
    };
  });
});

type PlottedPoint = (typeof plottedPoints.value)[number];
const hoveredPoint = ref<PlottedPoint | null>(null);

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const tooltipPosition = computed(() => {
  if (!hoveredPoint.value) return { left: 50, top: 50 };

  const leftPct = clamp((hoveredPoint.value.x / VIEWBOX_WIDTH) * 100, 10, 90);
  const topPct = clamp((hoveredPoint.value.y / VIEWBOX_HEIGHT) * 100 - 10, 5, 82);
  return { left: leftPct, top: topPct };
});

function showTooltip(point: PlottedPoint) {
  hoveredPoint.value = point;
}

function hideTooltip() {
  hoveredPoint.value = null;
}

const polylinePoints = computed(() => plottedPoints.value.map((point) => `${point.x},${point.y}`).join(" "));

const yGrid = computed(() => {
  const lines = 4;
  const chartTop = 16;
  const chartBottom = 224;
  const chartHeight = chartBottom - chartTop;
  return Array.from({ length: lines + 1 }, (_, i) => {
    const ratio = i / lines;
    const value = Math.round((1 - ratio) * yMax.value);
    return {
      id: i,
      y: chartTop + ratio * chartHeight,
      value,
    };
  });
});

const xTicks = computed(() => {
  const points = plottedPoints.value;
  if (!points.length) return [];
  const first = points[0]!;
  const middle = points[Math.floor((points.length - 1) / 2)]!;
  const last = points[points.length - 1]!;
  const map = new Map<string, { id: string; x: number; label: string }>();
  [first, middle, last].forEach((point, index) => {
    map.set(point.id, {
      id: `${point.id}-${index}`,
      x: point.x,
      label: point.label,
    });
  });
  return Array.from(map.values());
});
</script>
