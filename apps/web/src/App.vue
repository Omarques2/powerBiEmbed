<template>
  <ToastHost />
  <ConfirmHost />
  <router-view />
</template>

<script setup lang="ts">
import ToastHost from "./ui/toast/ToastHost.vue";
import ConfirmHost from "./ui/confirm/ConfirmHost.vue";
</script>