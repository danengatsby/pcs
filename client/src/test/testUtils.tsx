import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

/**
 * Creates a QueryClient wrapper for testing React Query hooks
 * with retry disabled to speed up tests
 */
export function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

/**
 * Creates a mock API response object for testing
 */
export function mockApiResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Creates a mock API error response object for testing
 */
export function mockApiErrorResponse(error: { message: string; code: string; status?: number }) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status: error.status ?? 400,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Creates mock user data for authentication tests
 */
export function buildUser(overrides: Partial<{ id: string; email: string; fullName: string; role: string }> = {}) {
  return {
    id: 'user-1',
    email: 'user@example.test',
    fullName: 'Test User',
    role: 'user',
    ...overrides,
  }
}

/**
 * Creates mock admin user data
 */
export function buildAdminUser() {
  return buildUser({ id: 'admin-1', email: 'admin@example.test', fullName: 'Admin User', role: 'admin' })
}

/**
 * Creates mock news items for testing
 */
export function buildNewsItem(overrides: Partial<{ id: number; title: string; summary: string; content: string; status: string; category: string; publishedAt: string; sourceName: string; sourceUrl: string }> = {}) {
  return {
    id: 1,
    title: 'Test News',
    summary: 'Test news summary',
    content: 'Test news content',
    status: 'published',
    category: 'Comunicat',
    publishedAt: '2026-04-05T10:00:00.000Z',
    sourceName: 'Sursa Test',
    sourceUrl: 'https://example.test/articol',
    ...overrides,
  }
}

/**
 * Creates a list of mock news items
 */
export function buildNewsItems(count = 3) {
  return Array.from({ length: count }, (_, i) =>
    buildNewsItem({
      id: i + 1,
      title: `News Item ${i + 1}`,
      summary: `Summary for news ${i + 1}`,
    })
  )
}

/**
 * Creates mock county data for testing
 */
export function buildCounty(overrides: Partial<{ id: number; name: string }> = {}) {
  return {
    id: 1,
    name: 'Cluj',
    ...overrides,
  }
}

/**
 * Creates a list of mock counties
 */
export function buildCounties() {
  return [
    buildCounty({ id: 1, name: 'Cluj' }),
    buildCounty({ id: 2, name: 'Iași' }),
    buildCounty({ id: 3, name: 'București' }),
  ]
}

/**
 * Creates mock volunteer data for testing
 */
export function buildVolunteer(overrides: Partial<{ id: string; fullName: string; email: string; phone: string; county: string; locality: string; skills: string; motivation: string }> = {}) {
  return {
    id: '1',
    fullName: 'Test Volunteer',
    email: 'volunteer@example.test',
    phone: '0712345678',
    county: 'Cluj',
    locality: 'Cluj-Napoca',
    skills: 'organizare, komunikare',
    motivation: 'Vreau să ajut partidul.',
    ...overrides,
  }
}

/**
 * Generic query error builder for error state testing
 */
export function buildQueryError(message: string, code = 'INTERNAL_SERVER_ERROR') {
  return new Error(JSON.stringify({ error: { message, code } }))
}
