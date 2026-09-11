import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base is '/' by default; set VITE_BASE (e.g. "/TrueChiller/") when deploying to GitHub Pages.
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://upload.wikimedia.org; connect-src 'self' https://en.wikipedia.org https://api.open-meteo.com; base-uri 'self'; form-action 'none'; object-src 'none'"

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    {
      // The policy is only injected into production HTML: Vite's dev server needs inline scripts.
      name: 'csp-meta',
      transformIndexHtml: (html) => (command === 'build' ? html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`) : html),
    },
  ],
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
}))
