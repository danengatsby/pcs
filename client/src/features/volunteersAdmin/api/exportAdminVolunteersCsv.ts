import { authStorage } from '@react/shared/auth/authStorage'
import type { ListAdminVolunteersQuery } from './listVolunteers'
import { buildVolunteersAdminSearchParams } from '../queryState'

function readFilename(response: Response): string {
  const headerValue = response.headers.get('content-disposition') ?? ''
  const match = /filename="([^"]+)"/i.exec(headerValue)
  return match?.[1] ?? 'pcp-volunteers.csv'
}

async function readExportError(response: Response): Promise<Error> {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.toLowerCase().includes('application/json')) {
    const body = await response.json()
    if (
      body
      && typeof body === 'object'
      && 'error' in body
      && body.error
      && typeof body.error === 'object'
      && 'message' in body.error
      && typeof body.error.message === 'string'
    ) {
      return new Error(body.error.message)
    }
  }

  const text = await response.text()
  return new Error(text || `Export CSV eșuat (HTTP ${response.status}).`)
}

function downloadBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

export async function exportAdminVolunteersCsv(query: ListAdminVolunteersQuery): Promise<void> {
  const headers: Record<string, string> = {
    Accept: 'text/csv',
  }

  const accessToken = authStorage.getAccessToken()
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  const params = buildVolunteersAdminSearchParams(query, { includePagination: false })
  const path = params.toString()
    ? `/api/admin/volunteers/export.csv?${params.toString()}`
    : '/api/admin/volunteers/export.csv'

  const response = await fetch(path, {
    method: 'GET',
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    throw await readExportError(response)
  }

  const blob = await response.blob()
  downloadBlob(blob, readFilename(response))
}
