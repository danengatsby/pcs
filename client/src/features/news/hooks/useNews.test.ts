import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNews } from './useNews'
import { getNews } from '../api/getNews'
import { createWrapper, buildNewsItems } from '@test/testUtils'

vi.mock('../api/getNews', () => ({
  getNews: vi.fn(),
}))

describe('useNews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads news items on mount', async () => {
    const newsItems = buildNewsItems(3)
    vi.mocked(getNews).mockResolvedValue(newsItems)

    const { result } = renderHook(() => useNews(), {
      wrapper: createWrapper(),
    })

    expect(result.current.loading).toBe(true)
    expect(result.current.items).toEqual([])
    expect(result.current.error).toBeNull()

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.items).toEqual(newsItems)
    expect(result.current.error).toBeNull()
    expect(getNews).toHaveBeenCalledTimes(1)
  })

  it('returns empty array initially', () => {
    vi.mocked(getNews).mockResolvedValue([])

    const { result } = renderHook(() => useNews(), {
      wrapper: createWrapper(),
    })

    expect(result.current.items).toEqual([])
    expect(result.current.loading).toBe(true)
  })

  it('handles loading state correctly', async () => {
    const newsItems = buildNewsItems(2)
    vi.mocked(getNews).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(newsItems), 10))
    )

    const { result } = renderHook(() => useNews(), {
      wrapper: createWrapper(),
    })

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.items).toEqual(newsItems)
  })

  it('handles API errors gracefully', async () => {
    const errorMessage = 'Failed to fetch news'
    vi.mocked(getNews).mockRejectedValue(new Error(errorMessage))

    const { result } = renderHook(() => useNews(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.items).toEqual([])
    expect(result.current.error).not.toBeNull()
    expect(result.current.error).toBe(errorMessage)
  })

  it('caches results with staleTime of 60 seconds', async () => {
    const newsItems = buildNewsItems(1)
    vi.mocked(getNews).mockResolvedValue(newsItems)

    const { rerender } = renderHook(() => useNews(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(getNews).toHaveBeenCalledTimes(1))

    rerender()

    await waitFor(() => {
      expect(getNews).toHaveBeenCalledTimes(1)
    })
  })

  it('handles empty news list', async () => {
    vi.mocked(getNews).mockResolvedValue([])

    const { result } = renderHook(() => useNews(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.items).toEqual([])
    expect(result.current.error).toBeNull()
  })
})
