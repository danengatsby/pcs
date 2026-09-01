import type { ListAdminVolunteersQuery } from './api/listVolunteers'
import { volunteerWorkflowStatusValues } from './types'

export const defaultVolunteersAdminQuery: ListAdminVolunteersQuery = {
  limit: 50,
}

export function parseSelectedVolunteerId(value: string | null | undefined): number | null {
  const parsedValue = Number(value ?? '')

  if (!Number.isInteger(parsedValue) || parsedValue === 0) {
    return null
  }

  return parsedValue
}

function normalizeTextFilter(value: string | null | undefined): string | undefined {
  const trimmedValue = value?.trim()
  return trimmedValue ? trimmedValue : undefined
}

function normalizeNumberParam(
  value: string | null | undefined,
  fallback: number,
  minimum = 0,
): number {
  const parsedValue = Number.parseInt(value ?? '', 10)

  if (!Number.isFinite(parsedValue) || parsedValue < minimum) {
    return fallback
  }

  return parsedValue
}

function normalizeStatusFilter(value: string | null | undefined): string | undefined {
  const normalizedValue = normalizeTextFilter(value)
  if (!normalizedValue) {
    return undefined
  }

  return volunteerWorkflowStatusValues.includes(normalizedValue as typeof volunteerWorkflowStatusValues[number])
    ? normalizedValue
    : undefined
}

export function normalizeVolunteersAdminQuery(
  query: ListAdminVolunteersQuery,
): ListAdminVolunteersQuery {
  return {
    limit: typeof query.limit === 'number' && query.limit > 0 ? query.limit : defaultVolunteersAdminQuery.limit,
    search: normalizeTextFilter(query.search),
    status: normalizeStatusFilter(query.status),
    county: normalizeTextFilter(query.county),
    locality: normalizeTextFilter(query.locality),
    skills: normalizeTextFilter(query.skills),
    cursor: normalizeTextFilter(query.cursor),
  }
}

export function readVolunteersAdminQuery(searchParams: URLSearchParams): ListAdminVolunteersQuery {
  return normalizeVolunteersAdminQuery({
    limit: normalizeNumberParam(searchParams.get('limit'), defaultVolunteersAdminQuery.limit ?? 50, 1),
    cursor: searchParams.get('cursor') ?? undefined,
    search: searchParams.get('search') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    county: searchParams.get('county') ?? undefined,
    locality: searchParams.get('locality') ?? undefined,
    skills: searchParams.get('skills') ?? undefined,
  })
}

export function buildVolunteersAdminSearchParams(
  query: ListAdminVolunteersQuery,
  options?: { includePagination?: boolean; selectedId?: number | null },
): URLSearchParams {
  const normalizedQuery = normalizeVolunteersAdminQuery(query)
  const params = new URLSearchParams()
  const includePagination = options?.includePagination ?? true

  if (includePagination && normalizedQuery.limit !== defaultVolunteersAdminQuery.limit) {
    params.set('limit', String(normalizedQuery.limit))
  }

  if (includePagination && normalizedQuery.cursor) {
    params.set('cursor', normalizedQuery.cursor)
  }

  if (normalizedQuery.search) params.set('search', normalizedQuery.search)
  if (normalizedQuery.status) params.set('status', normalizedQuery.status)
  if (normalizedQuery.county) params.set('county', normalizedQuery.county)
  if (normalizedQuery.locality) params.set('locality', normalizedQuery.locality)
  if (normalizedQuery.skills) params.set('skills', normalizedQuery.skills)

  if (options?.selectedId) {
    params.set('selected', String(options.selectedId))
  }

  return params
}
