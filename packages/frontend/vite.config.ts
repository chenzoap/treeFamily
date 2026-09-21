import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { getFirebaseConfig } from './src/lib/firebaseConfig'

export default defineConfig(({ mode, command }) => {
  if (command === 'build') {
    getFirebaseConfig({ ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env, DEV: false, MODE: mode })
  }
  return {
    build: { outDir: mode === 'staging' ? 'dist-staging' : 'dist' },
    plugins: [react(), tailwindcss()],
  }
})
