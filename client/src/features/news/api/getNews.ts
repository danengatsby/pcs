import { apiGet } from '../../../lib/http'
import type { NewsItem } from '../types'

export async function getNews(): Promise<NewsItem[]> {
  const res = await apiGet<NewsItem[]>('/api/news')

  if (!res.ok) {
    throw new Error(res.error.message)
  }

  return res.data
}
