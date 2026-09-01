import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNewsById } from './useNewsById'
import { getNewsById } from '../api/getNewsById'
import { createWrapper, buildNewsItem } from '@test/testUtils'

vi.mock('../api/getNewsById', () => ({
  getNewsById: vi.fn(),
}))

describe('useNewsById', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads a single news item by id', async () => {
    const newsItem = buildNewsItem({ id: 1, title: 'Breaking News' })
    vi.mocked(getNewsById).mockResolvedValue(newsItem)

    const { result } = renderHook(() => useNewsById('1'), {
      wrapper: createWrapper(),
    })

    expect(result.current.loading).toBe(true)
    expect(result.current.item).toBeNull()

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.item).toEqual(newsItem)
    expect(result.current.error).toBeNull()
    expect(getNewsById).toHaveBeenCalledWith('1')
  })

  it('does not fetch when id is empty', () => {
    vi.mocked(getNewsById).mockResolvedValue(buildNewsItem())

    const { result } = renderHook(() => useNewsById(''), {
      wrapper: createWrapper(),
    })

    expect(result.current.item).toBeNull()
    expect(getNewsById).not.toHaveBeenCalled()
  })

  it('does not fetch when id is whitespace only', () => {
    vi.mocked(getNewsById).mockResolvedValue(buildNewsItem())

    const { result } = renderHook(() => useNewsById('   '), {
      wrapper: createWrapper(),
    })

    expect(result.current.item).toBeNull()
    expect(getNewsById).not.toHaveBeenCalled()
  })

  it('fetches when id changes', async () => {
    const newsItem1 = buildNewsItem({ id: 1, title: 'News 1' })
    const newsItem2 = buildNewsItem({ id: 2, title: 'News 2' })

    vi.mocked(getNewsById)
      .mockResolvedValueOnce(newsItem1)
      .mockResolvedValueOnce(newsItem2)

    const { result, rerender } = renderHook((id: string) => useNewsById(id), {
      initialProps: '1',
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.item).toEqual(newsItem1))
    expect(getNewsById).toHaveBeenCalledWith('1')

    rerender('2')

    await waitFor(() => expect(result.current.item).toEqual(newsItem2))
    expect(getNewsById).toHaveBeenCalledWith('2')
  })

  it('handles API errors with custom message', async () => {
    const errorMessage = 'Not found'
    vi.mocked(getNewsById).mockRejectedValue(new Error(errorMessage))

    const { result } = renderHook(() => useNewsById('999'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.item).toBeNull()
    expect(result.current.error).not.toBeNull()
    expect(result.current.error).toBe(errorMessage)
  })

  it('returns null item initially', () => {
    vi.mocked(getNewsById).mockResolvedValue(buildNewsItem())

    const { result } = renderHook(() => useNewsById('1'), {
      wrapper: createWrapper(),
    })

    expect(result.current.item).toBeNull()
  })

  it('handles empty string ids that become whitespace after trim', async () => {
    const { rerender } = renderHook((id: string) => useNewsById(id), {
      initialProps: '1',
      wrapper: createWrapper(),
    })

    vi.mocked(getNewsById).mockResolvedValue(buildNewsItem())
    await waitFor(() => expect(getNewsById).toHaveBeenCalledTimes(1))

    rerender('  ')

    await waitFor(() => {
      expect(getNewsById).toHaveBeenCalledTimes(1)
    })
  })

  it('caches results with staleTime of 60 seconds', async () => {
    const newsItem = buildNewsItem({ id: 1 })
    vi.mocked(getNewsById).mockResolvedValue(newsItem)

    const { rerender } = renderHook(() => useNewsById('1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(getNewsById).toHaveBeenCalledTimes(1))

    rerender()

    await waitFor(() => {
      expect(getNewsById).toHaveBeenCalledTimes(1)
    })
  })
})
