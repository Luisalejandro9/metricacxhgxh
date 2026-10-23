import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const buildVersion = Date.now().toString()

function autoVersionPlugin() {
  return {
    name: 'auto-version-generator',
    buildStart() {
      try {
        const publicDir = path.resolve(__dirname, 'public')
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true })
        }
        const versionPath = path.join(publicDir, 'version.json')
        fs.writeFileSync(
          versionPath,
          JSON.stringify({ version: buildVersion, buildTime: new Date().toISOString() }, null, 2)
        )
      } catch (err) {
        console.warn('Could not write version.json:', err)
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), autoVersionPlugin()],
  define: {
    __APP_BUILD_VERSION__: JSON.stringify(buildVersion),
  },
  server: {
    proxy: {
      '/supabase': {
        target: 'https://oyhlhdlubralrgjbgtqw.supabase.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/supabase/, '')
      }
    }
  }
})
