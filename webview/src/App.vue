<template>
  <div class="app-container">
    <div v-if="!pageLoaded" class="loading">加载中...</div>
    <ReleaseNotesView v-else-if="isReleaseNotes" />
    <PublishFlowView v-else />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import ReleaseNotesView from './views/ReleaseNotesView.vue';
import PublishFlowView from './views/PublishFlowView.vue';

const isReleaseNotes = ref(false);
const pageLoaded = ref(false);

onMounted(() => {
  // 通过 data-page 属性判断页面类型
  const appElement = document.getElementById('app');
  const pageType = appElement?.dataset.page;
  console.log('[App] Page type:', pageType);
  isReleaseNotes.value = pageType === 'release-notes';
  pageLoaded.value = true;
});
</script>

<style>
@import './styles/vscode-theme.css';
</style>
