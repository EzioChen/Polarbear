<template>
  <div class="chip-range-input">
    <div class="chip-container">
      <span
        v-for="(chip, index) in modelValue"
        :key="index"
        class="chip-tag"
      >
        {{ chip }}
        <button class="chip-remove" @click="removeChip(index)">×</button>
      </span>
      <input
        ref="inputRef"
        v-model="inputValue"
        type="text"
        class="chip-input"
        placeholder="输入芯片型号，按回车添加"
        @keydown.enter.prevent="addChip"
        @keydown.backspace="handleBackspace"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  modelValue: string[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
}>();

const inputValue = ref('');
const inputRef = ref<HTMLInputElement>();

const addChip = () => {
  const value = inputValue.value.trim();
  if (!value) return;

  const chips = value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
  const newChips = [...props.modelValue];

  chips.forEach(chip => {
    if (!newChips.includes(chip)) {
      newChips.push(chip);
    }
  });

  emit('update:modelValue', newChips);
  inputValue.value = '';
};

const removeChip = (index: number) => {
  const newChips = [...props.modelValue];
  newChips.splice(index, 1);
  emit('update:modelValue', newChips);
};

const handleBackspace = () => {
  if (inputValue.value === '' && props.modelValue.length > 0) {
    removeChip(props.modelValue.length - 1);
  }
};
</script>

<style scoped>
.chip-range-input {
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
  padding: 4px;
  background: var(--vscode-input-background);
}

.chip-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.chip-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border-radius: 4px;
  font-size: 13px;
}

.chip-remove {
  margin-left: 4px;
  padding: 0;
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.chip-remove:hover {
  opacity: 0.8;
}

.chip-input {
  flex: 1;
  min-width: 120px;
  padding: 4px 8px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--vscode-input-foreground);
  font-size: 13px;
}

.chip-input::placeholder {
  color: var(--vscode-input-placeholderForeground);
}
</style>
