import { authStorage } from '@react/shared/auth/authStorage'

export type ApiResult<T> = {
  ok: true
  data: T
}

export type ApiEnvelopeResult<T, M> = {
  ok: true
  data: T
  meta?: M
}

export type ApiErrorResult = {
  ok: false
  error: {
    message: string
    status?: number
    code?: string
  }
}

export type ApiResponse<T> = ApiResult<T> | ApiErrorResult
export type ApiEnvelopeResponse<T, M> = ApiEnvelopeResult<T, M> | ApiErrorResult

type ApiRequestBaseOptions = {
  headers?: Record<string, string>
  auth?: boolean
  csrf?: boolean
}

type ApiRequestOptions<T> = ApiRequestBaseOptions & {
  parse?: (value: unknown) => T
}

type ApiEnvelopeRequestOptions<T, M> = ApiRequestBaseOptions & {
  parseData?: (value: unknown) => T
  parseMeta?: (value: unknown) => M
}

type ApiRequestConfig<T> = ApiRequestOptions<T> & {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
}

type ApiEnvelopeRequestConfig<T, M> = ApiEnvelopeRequestOptions<T, M> & {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
}

export async function apiGet<T>(path: string, options: ApiRequestOptions<T> = {}): Promise<ApiResponse<T>> {
  return apiRequest<T>(path, { method: 'GET', ...options })
}

export async function apiGetEnvelope<T, M>(
  path: string,
  options: ApiEnvelopeRequestOptions<T, M> = {},
): Promise<ApiEnvelopeResponse<T, M>> {
  return apiRequestEnvelope<T, M>(path, { method: 'GET', ...options })
}

export async function apiPost<T>(path: string, body: unknown, options: ApiRequestOptions<T> = {}): Promise<ApiResponse<T>> {
  return apiRequest<T>(path, { method: 'POST', body, ...options })
}

export async function apiPatch<T>(
  path: string,
  body: unknown,
  options: ApiRequestOptions<T> = {},
): Promise<ApiResponse<T>> {
  return apiRequest<T>(path, { method: 'PATCH', body, ...options })
}

export async function apiDelete<T>(
  path: string,
  body: unknown,
  options: ApiRequestOptions<T> = {},
): Promise<ApiResponse<T>> {
  return apiRequest<T>(path, { method: 'DELETE', body, ...options })
}

async function apiRequest<T>(path: string, opts: ApiRequestConfig<T>): Promise<ApiResponse<T>> {
  try {
    const { res, raw } = await fetchApi(path, opts)

    if (!res.ok) {
      return {
        ok: false,
        error: {
          message: readErrorMessage(raw, res.status),
          status: res.status,
          code: readErrorCode(raw),
        },
      }
    }

    const dataValue = readEnvelopeData(raw)
    const data = opts.parse ? opts.parse(dataValue) : (dataValue as T)

    return { ok: true, data }
  } catch (e) {
    return {
      ok: false,
      error: { message: e instanceof Error ? e.message : 'Network error' },
    }
  }
}

async function apiRequestEnvelope<T, M>(
  path: string,
  opts: ApiEnvelopeRequestConfig<T, M>,
): Promise<ApiEnvelopeResponse<T, M>> {
  try {
    const { res, raw } = await fetchApi(path, opts)

    if (!res.ok) {
      return {
        ok: false,
        error: {
          message: readErrorMessage(raw, res.status),
          status: res.status,
          code: readErrorCode(raw),
        },
      }
    }

    const dataValue = readEnvelopeData(raw)
    const metaValue = readEnvelopeMeta(raw)
    const data = opts.parseData ? opts.parseData(dataValue) : (dataValue as T)
    const meta = opts.parseMeta ? opts.parseMeta(metaValue) : (metaValue as M | undefined)

    return { ok: true, data, meta }
  } catch (e) {
    return {
      ok: false,
      error: { message: e instanceof Error ? e.message : 'Network error' },
    }
  }
}

async function fetchApi(
  path: string,
  opts: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown } & ApiRequestBaseOptions,
): Promise<{ res: Response; raw: unknown }> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...opts.headers,
  }

  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (opts.auth) {
    const accessToken = authStorage.getAccessToken()
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }
  }

  if (opts.csrf) {
    const csrfToken = authStorage.getCsrfToken()
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken
    }
  }

  const res = await fetch(path, {
    method: opts.method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'include',
  })

  const raw = await readResponseBody(res, path)

  return { res, raw }
}

async function readResponseBody(res: Response, path: string): Promise<unknown> {
  const contentType = res.headers.get('content-type') ?? ''
  const isJson = contentType.toLowerCase().includes('application/json')
  const rawText = await res.text()

  if (!isJson) {
    return rawText
  }

  const normalizedText = rawText.trim()
  if (!normalizedText) {
    if (allowsEmptyBody(res.status)) {
      return undefined
    }

    throw new Error(`Empty JSON response from ${path}`)
  }

  try {
    return JSON.parse(normalizedText) as unknown
  } catch {
    throw new Error(`Invalid JSON response from ${path}`)
  }
}

function allowsEmptyBody(status: number): boolean {
  return status === 204 || status === 205 || status === 304
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readEnvelopeData(raw: unknown): unknown {
  return isRecord(raw) && 'data' in raw ? raw.data : raw
}

function readEnvelopeMeta(raw: unknown): unknown {
  return isRecord(raw) && 'meta' in raw ? raw.meta : undefined
}

function readErrorMessage(raw: unknown, status: number): string {
  if (isRecord(raw) && isRecord(raw.error) && typeof raw.error.message === 'string') {
    return raw.error.message
  }

  return `HTTP ${status}`
}

function readErrorCode(raw: unknown): string | undefined {
  if (isRecord(raw) && isRecord(raw.error) && typeof raw.error.code === 'string') {
    return raw.error.code
  }

  return undefined
}
