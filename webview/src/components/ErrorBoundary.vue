<template>
  <div v-if="hasError" class="error-boundary">
    <div class="error-content">
      <span class="codicon codicon-error"></span>
      <h3>发生错误</h3>
      <p>{{ errorMessage }}</p>
      <button @click="resetError">重试</button>
    </div>
  </div>
  <slot v-else></slot>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';

const hasError = ref(false);
const errorMessage = ref('');

onErrorCaptured((err) => {
  hasError.value = true;
  errorMessage.value = (err as Error).message || '未知错误';
  console.error('Error captured:', err);
  return false;
});

const resetError = () => {
  hasError.value = false;
  errorMessage.value = '';
  window.location.reload();
};
</script>

<style scoped>
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: var(--vscode-editor-background);
}

.error-content {
  text-align: center;
  padding: 40px;
}

.error-content .codicon {
  font-size: 48px;
  color: #f48771;
  margin-bottom: 16px;
}

.error-content h3 {
  margin-bottom: 8px;
  color: var(--vscode-foreground);
}

.error-content p {
  color: var(--vscode-descriptionForeground);
  margin-bottom: 20px;
}

.error-content button {
  padding: 8px 16px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.error-content button:hover {
  background: var(--vscode-button-hoverBackground);
}
</style>
