import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // backend pod tym samym adresem co SPA, więc bez CORS (PROJECT_CONTEXT §2)
    proxy: { '/api': 'http://localhost:8080' },
  },
})
