import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development' || process.env.NODE_ENV === 'development';
  const sourcemap = isDev ? true : !!process.env.SOURCEMAP;

  return {
    plugins: [
      react({
        jsxImportSource: '@emotion/react',
      }),
    ],
    resolve: {
      alias: {
        react: 'preact/compat',
        'react-dom/test-utils': 'preact/test-utils',
        'react-dom': 'preact/compat',
        'react/jsx-runtime': 'preact/jsx-runtime',
      },
    },
    build: {
      sourcemap,
      outDir: 'dist',
      emptyOutDir: true,
      target: 'esnext',
      minify: false,
      // minify: !isDev,
      chunkSizeWarningLimit: 7000,
      rollupOptions: {
        input: {
          background: 'src/chrome/background',
          options: 'src/chrome/options',
          offscreen: 'src/chrome/offscreen',
          contentMain: 'src/content/main.tsx',
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name]-[hash].js',
          manualChunks: (id) => {
            if (id.includes('@mlc-ai/web-llm')) {
              return 'vendor-webllm';
            }
          },
        },
      },
    },
  };
});
