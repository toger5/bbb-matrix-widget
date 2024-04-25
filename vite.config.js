import { defineConfig } from 'vite'

export default defineConfig({
  base: '',
  optimizeDeps: {
    esbuildOptions: {
        // Node.js global to browser globalThis
        define: {
            global: 'globalThis',
        },
    },
},
})
