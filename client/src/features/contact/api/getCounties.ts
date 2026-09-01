import { callOpenApiData, openApiClients } from '../../../lib/openapi'

export type CountyName = string

export async function getCounties(): Promise<CountyName[]> {
  const res = await callOpenApiData(() => openApiClients.meta.getCountiesMetadata())

  if (!res.ok) {
    throw new Error(res.error.message)
  }

  return readCountyNames(res.data)
}

function readCountyNames(value: unknown): CountyName[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error('Răspuns invalid de la server.')
  }

  return value
}
