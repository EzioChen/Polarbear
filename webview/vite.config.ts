import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: '../dist/webview',
    emptyOutDir: true,
    // 禁用模块预加载，避免 Service Worker 问题
    modulePreload: false,
    // 禁用 sourcemap
    sourcemap: false,
    // 确保 CSS 被正确提取
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        // 内联所有 chunk，避免动态加载问题
        inlineDynamicImports: true,
        // 禁用 ES 模块格式，使用 IIFE
        format: 'iife'
      }
    }
  },
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
