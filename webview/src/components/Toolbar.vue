<template>
  <div class="toolbar">
    <button class="toolbar-btn" @click="$emit('selectFiles')">
      <span class="codicon codicon-folder"></span>
      选择发布文件/文件夹
    </button>
    <button class="toolbar-btn" @click="$emit('addFolder')">
      <span class="codicon codicon-add"></span>
      新增文件夹
    </button>
    <button class="toolbar-btn primary" @click="$emit('saveConfig')">
      <span class="codicon codicon-save"></span>
      保存配置
    </button>
  </div>
</template>

<script setup lang="ts">
defineEmits<{
  selectFiles: [];
  addFolder: [];
  saveConfig: [];
}>();
</script>

<style scoped>
.toolbar {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--vscode-panel-border);
  background: var(--vscode-panel-background);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  background: var(--vscode-background);
  color: var(--vscode-foreground);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background: var(--vscode-list-hoverBackground);
}

.toolbar-btn.primary {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border-color: var(--vscode-button-background);
}

.toolbar-btn.primary:hover {
  background: var(--vscode-button-hoverBackground);
}

.codicon {
  font-size: 14px;
}
</style>
