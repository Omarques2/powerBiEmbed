<!-- apps/web/src/ui/toggles/AdminToggle.vue -->
<template>
  <PermSwitch
    :modelValue="modelValue"
    :onLabel="onLabel"
    :offLabel="offLabel"
    :loading="loading"
    :disabled="disabled"
    @update:modelValue="(v: boolean) => emit('update:modelValue', v)"
  />
</template>

<script setup lang="ts">
import PermSwitch from "./PermSwitch.vue";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    onLabel?: string;
    offLabel?: string;
    loading?: boolean;
    disabled?: boolean;
  }>(),
  {
    onLabel: "Ativo",
    offLabel: "Inativo",
    loading: false,
    disabled: false,
  }
);

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
}>();

// props existe para TS e consistência, ainda que o template use diretamente
void props;
</script>
