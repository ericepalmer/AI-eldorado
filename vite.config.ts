import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Production: https://games.palton.xyz/eldorado/
// Local: npm run dev uses base /
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/eldorado/',
  server: {
    host: '127.0.0.1',
    port: 5177,
  },
})
