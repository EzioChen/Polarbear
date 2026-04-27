<template>
  <div class="version-input">
    <label v-if="label" class="input-label">{{ label }}</label>
    <input
      v-model="localValue"
      type="text"
      :placeholder="placeholder"
      :class="{ 'is-invalid': !isValid }"
      @blur="validate"
    />
    <span v-if="!isValid" class="error-msg">版本号格式不正确（如：v1.0.0 或 v1.1.1_Beta2_20261101）</span>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  modelValue: string;
  label?: string;
  placeholder?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const localValue = ref(props.modelValue);
const isValid = ref(true);

// 支持标准版本号如 v1.0.0 以及 beta 版本如 v1.1.1_Beta2_20261101
const versionRegex = /^v?[\w._-]+$/;

watch(() => props.modelValue, (newVal) => {
  localValue.value = newVal;
});

watch(localValue, (newVal) => {
  emit('update:modelValue', newVal);
  if (newVal) {
    isValid.value = versionRegex.test(newVal);
  } else {
    isValid.value = true;
  }
});

const validate = () => {
  if (localValue.value) {
    isValid.value = versionRegex.test(localValue.value);
  }
};
</script>

<style scoped>
.version-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-label {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.version-input input {
  padding: 6px 10px;
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  font-size: 13px;
}

.version-input input:focus {
  outline: none;
  border-color: var(--vscode-focusBorder);
}

.version-input input.is-invalid {
  border-color: #e74c3c;
}

.error-msg {
  font-size: 11px;
  color: #e74c3c;
}
</style>
