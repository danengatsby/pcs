import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const turnstileTestSiteKeys = new Set([
  '1x00000000000000000000AA',
  '2x00000000000000000000AB',
  '1x00000000000000000000BB',
  '2x00000000000000000000BB',
  '3x00000000000000000000FF',
])

function assertProductionCaptchaSiteKey(value: string | undefined) {
  const siteKey = value?.trim() ?? ''
  const normalizedSiteKey = siteKey.toLowerCase()

  if (
    !siteKey
    || normalizedSiteKey.startsWith('replace-with-')
    || normalizedSiteKey.startsWith('replace_with_')
  ) {
    throw new Error(
      'VITE_CAPTCHA_SITE_KEY este obligatoriu pentru build-ul de producție și nu poate fi placeholder.',
    )
  }

  if (
    turnstileTestSiteKeys.has(siteKey)
    && process.env.ALLOW_TEST_CAPTCHA_SITE_KEY !== '1'
  ) {
    throw new Error(
      'O cheie Cloudflare Turnstile de test necesită ALLOW_TEST_CAPTCHA_SITE_KEY=1.',
    )
  }
}

function productionCaptchaGuardPlugin() {
  return {
    name: 'production-captcha-site-key-guard',
    config(_config: unknown, { command, mode }: { command: string; mode: string }) {
      if (command !== 'build' || mode !== 'production') {
        return
      }

      const clientEnv = loadEnv(mode, import.meta.dirname, 'VITE_')
      assertProductionCaptchaSiteKey(
        process.env.VITE_CAPTCHA_SITE_KEY ?? clientEnv.VITE_CAPTCHA_SITE_KEY,
      )
    },
  }
}

function readNodeModulePackage(id: string): string | null {
  const [, packagePath] = id.split('node_modules/')
  if (!packagePath) {
    return null
  }

  const segments = packagePath.split('/')
  if (segments[0]?.startsWith('@') && segments[1]) {
    return `${segments[0]}/${segments[1]}`
  }

  return segments[0] ?? null
}

function manualChunks(id: string): string | undefined {
  const packageName = readNodeModulePackage(id)
  if (!packageName) {
    return undefined
  }

  if (packageName === 'react' || packageName === 'react-dom' || packageName === 'scheduler') {
    return 'react-vendor'
  }

  if (packageName === 'react-router-dom' || packageName === '@remix-run/router' || packageName === 'history') {
    return 'router-vendor'
  }

  if (packageName === '@tanstack/react-query' || packageName === '@tanstack/query-core') {
    return 'query-vendor'
  }

  return 'vendor'
}

function opentelemetryBrowserCompatibilityPlugin() {
  const shimPath = path.resolve(
    import.meta.dirname,
    'src/lib/opentelemetryInstrumentationNodeModuleFileShim.ts',
  )

  return {
    name: 'opentelemetry-browser-compatibility',
    enforce: 'pre' as const,
    resolveId(source: string, importer?: string) {
      const normalizedImporter = importer?.replace(/\\/g, '/')

      if (
        (source === './instrumentationNodeModuleFile' ||
          source === './instrumentationNodeModuleFile.js') &&
        normalizedImporter &&
        /\/@opentelemetry\/instrumentation\/build\/es(?:m|next)\/index\.js$/.test(
          normalizedImporter,
        )
      ) {
        return shimPath
      }

      return null
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [productionCaptchaGuardPlugin(), opentelemetryBrowserCompatibilityPlugin(), react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  resolve: {
    alias: {
      '@app': path.resolve(import.meta.dirname, 'src/app'),
      '@features': path.resolve(import.meta.dirname, 'src/features'),
      '@react': path.resolve(import.meta.dirname, 'src/react'),
      '@components': path.resolve(import.meta.dirname, 'src/components/index.ts'),
      '@components/*': path.resolve(import.meta.dirname, 'src/components/*'),
      '@lib': path.resolve(import.meta.dirname, 'src/lib'),
      '@test': path.resolve(import.meta.dirname, 'src/test'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
