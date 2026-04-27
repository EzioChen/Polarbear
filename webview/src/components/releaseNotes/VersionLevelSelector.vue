<template>
  <div class="version-level-selector">
    <div
      v-for="option in options"
      :key="option.level"
      class="level-card"
      :class="{ active: modelValue === option.level }"
      @click="selectLevel(option.level)"
    >
      <div class="level-badge" :class="`level-${option.level.toLowerCase()}`">
        {{ option.level }}
      </div>
      <div class="level-name">{{ option.name }}</div>
      <div class="level-desc">{{ option.description }}</div>
      <div class="level-tag" :class="{ required: option.required }">
        {{ option.required ? '必须修复' : '可选修复' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { VersionLevel, VersionLevelInfo } from '../../types/releaseNotes';

defineProps<{
  modelValue: VersionLevel;
  options: VersionLevelInfo[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: VersionLevel];
}>();

const selectLevel = (level: VersionLevel) => {
  emit('update:modelValue', level);
};
</script>

<style scoped>
.version-level-selector {
  display: flex;
  gap: 12px;
}

.level-card {
  flex: 1;
  padding: 16px;
  border: 2px solid var(--vscode-panel-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.level-card:hover {
  border-color: var(--vscode-focusBorder);
}

.level-card.active {
  border-color: var(--vscode-button-background);
  background: var(--vscode-button-hoverBackground);
}

.level-badge {
  width: 40px;
  height: 40px;
  line-height: 40px;
  border-radius: 50%;
  margin: 0 auto 8px;
  font-size: 18px;
  font-weight: bold;
  color: white;
}

.level-a { background: #e74c3c; }
.level-b { background: #f39c12; }
.level-c { background: #27ae60; }

.level-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.level-desc {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  margin-bottom: 8px;
}

.level-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
}

.level-tag.required {
  background: #e74c3c;
  color: white;
}
</style>
