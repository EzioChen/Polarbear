<template>
  <div class="sdk-version-table">
    <table>
      <thead>
        <tr>
          <th>芯片</th>
          <th>版本</th>
          <th>备注</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in modelValue" :key="item.id">
          <td>
            <input
              v-model="item.chip"
              type="text"
              placeholder="如：AC707N"
              @input="updateItem(item)"
            />
          </td>
          <td>
            <input
              v-model="item.version"
              type="text"
              placeholder="如：v2.1.0"
              @input="updateItem(item)"
            />
          </td>
          <td>
            <input
              v-model="item.remark"
              type="text"
              placeholder="备注信息"
              @input="updateItem(item)"
            />
          </td>
          <td>
            <button class="btn-delete" @click="removeItem(item.id)">删除</button>
          </td>
        </tr>
        <tr v-if="modelValue.length === 0">
          <td colspan="4" class="empty-state">
            暂无数据，点击下方"添加行"按钮
          </td>
        </tr>
      </tbody>
    </table>
    <button class="btn-add" @click="addItem">+ 添加行</button>
  </div>
</template>

<script setup lang="ts">
import type { SdkVersionInfo } from '../../types/releaseNotes';

const props = defineProps<{
  modelValue: SdkVersionInfo[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: SdkVersionInfo[]];
  add: [];
  remove: [id: string];
}>();

const addItem = () => {
  const newItem: SdkVersionInfo = {
    id: `sdk-${Date.now()}`,
    chip: '',
    version: '',
    remark: ''
  };
  emit('update:modelValue', [...props.modelValue, newItem]);
  emit('add');
};

const removeItem = (id: string) => {
  const newValue = props.modelValue.filter(item => item.id !== id);
  emit('update:modelValue', newValue);
  emit('remove', id);
};

const updateItem = (item: SdkVersionInfo) => {
  const index = props.modelValue.findIndex(i => i.id === item.id);
  if (index !== -1) {
    const newValue = [...props.modelValue];
    newValue[index] = { ...item };
    emit('update:modelValue', newValue);
  }
};
</script>

<style scoped>
.sdk-version-table {
  width: 100%;
}

.sdk-version-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.sdk-version-table th,
.sdk-version-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.sdk-version-table th {
  background: var(--vscode-editor-background);
  font-weight: 600;
}

.sdk-version-table input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid var(--vscode-input-border);
  border-radius: 3px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  font-size: 13px;
}

.sdk-version-table input:focus {
  outline: none;
  border-color: var(--vscode-focusBorder);
}

.btn-delete {
  padding: 4px 8px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
}

.btn-delete:hover {
  background: #c0392b;
}

.btn-add {
  margin-top: 8px;
  padding: 6px 12px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.btn-add:hover {
  background: var(--vscode-button-hoverBackground);
}

.empty-state {
  text-align: center;
  color: var(--vscode-descriptionForeground);
  padding: 24px;
}
</style>
