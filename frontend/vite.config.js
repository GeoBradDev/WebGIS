import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Root-served on DO App Platform; '/' keeps deep-link asset paths correct
  // (was './' for GitHub Pages subpath hosting).
  base: '/',
})
