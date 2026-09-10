import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base is '/' by default; set VITE_BASE (e.g. "/TrueChiller/") when deploying to GitHub Pages.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/',
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => (id.includes('node_modules/three') ? 'three' : undefined),
      },
    },
  },
})
