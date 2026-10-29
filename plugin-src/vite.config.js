import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteSingleFile } from 'vite-plugin-singlefile';

// uTools 生产环境经 file:// 加载 dist/index.html：
// base './' + singlefile 把 JS/CSS 全部内联，规避 file:// 下 ES module 的 CORS 限制
export default defineConfig({
  base: './',
  plugins: [vue(), viteSingleFile()],
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2020' },
  server: { port: 5173 },
});
