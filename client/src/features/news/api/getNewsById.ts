import { apiGet } from '../../../lib/http'
import type { NewsItem } from '../types'

export async function getNewsById(id: string): Promise<NewsItem> {
  const res = await apiGet<NewsItem>(`/api/news/${encodeURIComponent(id)}`)

  if (!res.ok) {
    throw new Error(res.error.message)
  }

  return res.data
}
