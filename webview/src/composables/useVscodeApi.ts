import { ref, onMounted, onUnmounted } from 'vue';
import type { ExtensionMessage, WebviewMessage } from '../types';

declare const acquireVsCodeApi: () => {
  postMessage: (message: WebviewMessage) => void;
  getState: () => any;
  setState: (state: any) => void;
};

export function useVscodeApi() {
  const vscode = acquireVsCodeApi();
  const messageHandlers = ref<((message: ExtensionMessage) => void)[]>([]);

  const postMessage = (message: WebviewMessage) => {
    vscode.postMessage(message);
  };

  const onMessage = (handler: (message: ExtensionMessage) => void) => {
    messageHandlers.value.push(handler);
  };

  const handleMessage = (event: MessageEvent) => {
    const message = event.data as ExtensionMessage;
    messageHandlers.value.forEach(handler => handler(message));
  };

  onMounted(() => {
    window.addEventListener('message', handleMessage);
  });

  onUnmounted(() => {
    window.removeEventListener('message', handleMessage);
  });

  return {
    postMessage,
    onMessage,
    vscode
  };
}
