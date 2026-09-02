import { describe, expect, it } from 'vitest'
import { getNewsEditorialSectionKey, groupNewsByEditorialSection } from './editorialSections'
import type { NewsItem } from './types'

function news(overrides: Partial<NewsItem>): NewsItem {
  return { id: 1, title: 'Titlu', ...overrides }
}

describe('news editorial sections', () => {
  it('keeps explicit PCS categories in their respective streams', () => {
    expect(getNewsEditorialSectionKey(news({ category: 'Poziție PCS' }))).toBe('positions')
    expect(getNewsEditorialSectionKey(news({ category: 'Activitate locală' }))).toBe('local')
    expect(getNewsEditorialSectionKey(news({ category: 'Comunicat' }))).toBe('releases')
  })

  it('separates externally sourced information from PCS content', () => {
    expect(getNewsEditorialSectionKey(news({
      category: 'Sănătate',
      sourceName: 'AGERPRES',
      sourceUrl: 'https://example.test/article',
    }))).toBe('press')
  })

  it('recognizes legacy local categories and groups all items', () => {
    const items = [
      news({ id: 1, category: 'Declarație' }),
      news({ id: 2, category: 'Eveniment' }),
      news({ id: 3, category: 'Comunicat' }),
      news({ id: 4, category: 'Pensii', sourceName: 'CNPP', sourceUrl: 'https://example.test/cnpp' }),
    ]

    const grouped = groupNewsByEditorialSection(items)
    expect(grouped.positions.map((item) => item.id)).toEqual([1])
    expect(grouped.local.map((item) => item.id)).toEqual([2])
    expect(grouped.releases.map((item) => item.id)).toEqual([3])
    expect(grouped.press.map((item) => item.id)).toEqual([4])
  })
})
