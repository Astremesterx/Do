import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { collectorMiddleware } from './server/collector.mjs'

export default defineConfig({
  plugins: [
    react(),
    ...(process.argv.includes('--https') ? [basicSsl()] : []),
    {
      name: 'do-local-collector',
      configureServer(server) {
        server.middlewares.use(collectorMiddleware())
      },
      configurePreviewServer(server) {
        server.middlewares.use(collectorMiddleware())
      },
    },
    {
      name: 'do-offline-assets',
      apply: 'build',
      closeBundle() {
        const html = readFileSync(resolve('dist/index.html'), 'utf8')
        const assets = [...new Set(html.match(/\/assets\/[^"\s]+/g) ?? [])]
        const version = createHash('sha256').update(assets.join('|')).digest('hex').slice(0, 12)
        const worker = readFileSync(resolve('dist/sw.js'), 'utf8')
          .replace("'do-v2'", `'do-${version}'`)
          .replace('const BUILD_ASSETS = []', `const BUILD_ASSETS = ${JSON.stringify(assets)}`)
        writeFileSync(resolve('dist/sw.js'), worker)
      },
    },
  ],
  build: { chunkSizeWarningLimit: 650 },
  server: {
    host: true,
  },
  preview: {
    host: true,
  },
})
