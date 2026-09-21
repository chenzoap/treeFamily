import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { validateFirebaseConfigForBuild } from './src/lib/firebaseConfig'

export default defineConfig(({ mode, command }) => {
  if (command === 'build') {
    validateFirebaseConfigForBuild(mode, { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env })
  }
  return {
    build: { outDir: mode === 'staging' ? 'dist-staging' : 'dist' },
    plugins: [react(), tailwindcss()],
  }
})
