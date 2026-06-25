import { defineConfig } from 'vite'

// base must match the GitHub Pages subpath so hashed asset URLs resolve in production.
export default defineConfig({
  base: '/Castlevania97/',
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
})
