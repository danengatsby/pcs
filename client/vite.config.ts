import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

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
  plugins: [opentelemetryBrowserCompatibilityPlugin(), react()],
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
