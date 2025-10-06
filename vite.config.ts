import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/gig-token': {
        target: 'https://gapaautoparts.com',
        changeOrigin: true,
        rewrite: () => '/logistics/access-token',
        secure: true,
      }
    }
  }
})
