<template>
  <div class="email-config">
    <!-- 标题栏 -->
    <div class="config-titlebar">
      <h2>📧 邮件服务配置</h2>
    </div>

    <!-- 配置内容区 -->
    <div class="config-content">
      <!-- SMTP 服务器设置 -->
      <div class="config-section">
        <div class="section-header">
          <span class="section-icon">📡</span>
          <span class="section-title">SMTP 服务器设置</span>
        </div>

        <div class="form-row">
          <label>服务器地址 <span class="required">*</span></label>
          <input
            type="text"
            v-model="config.smtp.host"
            placeholder="例如: 192.168.8.208"
            class="form-input"
          />
          <div class="input-hint">SMTP 服务器主机名或 IP 地址</div>
          <div v-if="errors.host" class="error-message">{{ errors.host }}</div>
        </div>

        <div class="form-row">
          <label>端口 <span class="required">*</span></label>
          <input
            type="number"
            v-model.number="config.smtp.port"
            placeholder="25"
            min="1"
            max="65535"
            class="form-input"
          />
          <div class="input-hint">常用端口: 25(默认), 465(SSL), 587(TLS)</div>
          <div v-if="errors.port" class="error-message">{{ errors.port }}</div>
        </div>

        <div class="form-row checkbox-row">
          <input type="checkbox" id="secure" v-model="config.smtp.secure" />
          <label for="secure">使用 SSL/TLS 加密连接</label>
        </div>
      </div>

      <!-- 认证信息 -->
      <div class="config-section">
        <div class="section-header">
          <span class="section-icon">🔐</span>
          <span class="section-title">认证信息</span>
        </div>

        <div class="form-row">
          <label>邮箱账号 <span class="required">*</span></label>
          <input
            type="text"
            v-model="config.auth.user"
            placeholder="your-email@example.com"
            class="form-input"
          />
          <div v-if="errors.user" class="error-message">{{ errors.user }}</div>
        </div>

        <div class="form-row">
          <label>密码 <span class="required">*</span></label>
          <input
            type="password"
            v-model="config.auth.pass"
            placeholder="输入邮箱密码"
            class="form-input"
          />
          <div class="input-hint">密码将加密存储在 VS Code SecretStorage 中</div>
          <div v-if="errors.pass" class="error-message">{{ errors.pass }}</div>
        </div>
      </div>

      <!-- 发件人设置 -->
      <div class="config-section">
        <div class="section-header">
          <span class="section-icon">✉️</span>
          <span class="section-title">发件人设置</span>
        </div>

        <div class="form-row">
          <label>发件人名称</label>
          <input
            type="text"
            v-model="config.sender.name"
            placeholder="PolarBear 发布系统"
            class="form-input"
          />
          <div class="input-hint">显示在邮件中的发件人名称</div>
        </div>

        <div class="form-row">
          <label>发件人地址 <span class="required">*</span></label>
          <input
            type="text"
            v-model="config.sender.address"
            placeholder="noreply@example.com"
            class="form-input"
          />
          <div v-if="errors.address" class="error-message">{{ errors.address }}</div>
        </div>
      </div>

      <!-- 高级设置 -->
      <div class="config-section">
        <div class="section-header">
          <span class="section-icon">⚙️</span>
          <span class="section-title">高级设置</span>
        </div>

        <div class="form-row">
          <label>连接超时（毫秒）</label>
          <input
            type="number"
            v-model.number="config.connection.timeout"
            placeholder="30000"
            min="1000"
            step="1000"
            class="form-input"
          />
          <div class="input-hint">默认: 30000ms (30秒)</div>
        </div>

        <div class="form-row checkbox-row">
          <input
            type="checkbox"
            id="rejectUnauthorized"
            v-model="config.smtp.tls.rejectUnauthorized"
          />
          <label for="rejectUnauthorized">验证服务器证书</label>
        </div>
        <div class="input-hint checkbox-hint">取消勾选可允许自签名证书（不推荐用于生产环境）</div>
      </div>

      <!-- 状态消息 -->
      <div v-if="statusMessage" :class="['status-message', statusType]">
        {{ statusMessage }}
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="config-footer">
      <button class="btn-primary" :disabled="isLoading" @click="saveConfig">
        <span v-if="isLoading" class="loading"></span>
        <span v-else>💾 保存配置</span>
      </button>
      <button class="btn-secondary" :disabled="isLoading" @click="testConnection">
        🔌 测试连接
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useVscodeApi } from '../composables/useVscodeApi';

const vscode = useVscodeApi();

interface SMTPConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    tls: {
      rejectUnauthorized: boolean;
    };
  };
  auth: {
    user: string;
    pass: string;
    type: 'login' | 'plain' | 'oauth2';
  };
  sender: {
    name: string;
    address: string;
  };
  connection: {
    timeout: number;
  };
}

const defaultConfig: SMTPConfig = {
  smtp: {
    host: '',
    port: 25,
    secure: false,
    tls: {
      rejectUnauthorized: false,
    },
  },
  auth: {
    user: '',
    pass: '',
    type: 'login',
  },
  sender: {
    name: 'PolarBear 发布系统',
    address: '',
  },
  connection: {
    timeout: 30000,
  },
};

const config = ref<SMTPConfig>(JSON.parse(JSON.stringify(defaultConfig)));
const errors = ref<Record<string, string>>({});
const isLoading = ref(false);
const statusMessage = ref('');
const statusType = ref<'success' | 'error'>('success');

function validateConfig(): boolean {
  errors.value = {};
  let isValid = true;

  if (!config.value.smtp.host.trim()) {
    errors.value.host = '服务器地址不能为空';
    isValid = false;
  }

  if (!config.value.smtp.port || config.value.smtp.port < 1 || config.value.smtp.port > 65535) {
    errors.value.port = '端口号必须在 1-65535 范围内';
    isValid = false;
  }

  if (!config.value.auth.user.trim()) {
    errors.value.user = '邮箱账号不能为空';
    isValid = false;
  }

  if (!config.value.auth.pass) {
    errors.value.pass = '密码不能为空';
    isValid = false;
  }

  if (!config.value.sender.address.trim()) {
    errors.value.address = '发件人地址不能为空';
    isValid = false;
  }

  return isValid;
}

function saveConfig() {
  if (!validateConfig()) return;

  isLoading.value = true;
  statusMessage.value = '';

  vscode.postMessage({
    type: 'saveConfig',
    data: config.value,
  });
}

function testConnection() {
  if (!validateConfig()) return;

  isLoading.value = true;
  statusMessage.value = '';

  vscode.postMessage({ type: 'testConnection' });
}

function showStatus(message: string, type: 'success' | 'error') {
  statusMessage.value = message;
  statusType.value = type;
  isLoading.value = false;

  setTimeout(() => {
    statusMessage.value = '';
  }, 5000);
}

// 监听来自扩展的消息
window.addEventListener('message', (event) => {
  const message = event.data;

  switch (message.type) {
    case 'configLoaded':
      if (message.data) {
        config.value = {
          ...defaultConfig,
          ...message.data,
          smtp: {
            ...defaultConfig.smtp,
            ...message.data.smtp,
            tls: {
              ...defaultConfig.smtp.tls,
              ...message.data.smtp?.tls,
            },
          },
          auth: {
            ...defaultConfig.auth,
            ...message.data.auth,
          },
          sender: {
            ...defaultConfig.sender,
            ...message.data.sender,
          },
          connection: {
            ...defaultConfig.connection,
            ...message.data.connection,
          },
        };
      }
      break;
    case 'configSaved':
      showStatus('配置已保存', 'success');
      break;
    case 'saveError':
      showStatus(message.data?.message || '保存失败', 'error');
      break;
    case 'testSuccess':
      showStatus(message.data?.message || '连接成功', 'success');
      break;
    case 'testError':
      showStatus(message.data?.message || '连接失败', 'error');
      break;
  }
});

onMounted(() => {
  // 页面加载完成后请求获取配置
  vscode.postMessage({ type: 'getConfig' });
});
</script>

<style scoped>
/* 基础容器 - 铺满页面 */
.email-config {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  background-color: var(--vscode-editor-background);
  color: var(--vscode-foreground);
  overflow: hidden;
}

/* 标题栏 */
.config-titlebar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--vscode-titleBar-activeBackground);
  border-bottom: 1px solid var(--vscode-panel-border);
  flex-shrink: 0;
}

.config-titlebar h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--vscode-titleBar-activeForeground);
}

/* 配置内容区 - 可滚动 */
.config-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 配置区块 */
.config-section {
  background-color: var(--vscode-sideBar-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  padding: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.section-icon {
  font-size: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--vscode-foreground);
}

/* 表单行 */
.form-row {
  margin-bottom: 16px;
}

.form-row:last-child {
  margin-bottom: 0;
}

.form-row > label {
  display: block;
  font-size: 13px;
  margin-bottom: 6px;
  color: var(--vscode-foreground);
}

.required {
  color: var(--vscode-errorForeground);
  margin-left: 2px;
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--vscode-input-border);
  background-color: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: var(--vscode-focusBorder);
}

.input-hint {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  margin-top: 4px;
}

.checkbox-hint {
  margin-left: 24px;
}

.error-message {
  color: var(--vscode-errorForeground);
  font-size: 12px;
  margin-top: 4px;
}

/* 复选框行 */
.checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.checkbox-row input[type='checkbox'] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.checkbox-row label {
  margin-bottom: 0;
  cursor: pointer;
  font-size: 13px;
}

/* 状态消息 */
.status-message {
  padding: 10px 16px;
  border-radius: 4px;
  font-size: 13px;
  margin-bottom: 16px;
}

.status-message.success {
  background-color: var(--vscode-testing-iconPassed);
  color: var(--vscode-button-foreground);
}

.status-message.error {
  background-color: var(--vscode-errorForeground);
  color: var(--vscode-button-foreground);
}

/* 底部操作栏 */
.config-footer {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  background-color: var(--vscode-sideBar-background);
  border-top: 1px solid var(--vscode-panel-border);
  flex-shrink: 0;
}

.btn-primary {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--vscode-button-hoverBackground);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--vscode-button-secondaryHoverBackground);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid var(--vscode-button-foreground);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
