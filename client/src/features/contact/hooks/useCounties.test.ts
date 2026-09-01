import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCounties } from './useCounties'
import { getCounties } from '../api/getCounties'
import { createWrapper, buildCounties } from '@test/testUtils'

vi.mock('../api/getCounties', () => ({
  getCounties: vi.fn(),
}))

describe('useCounties', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads counties on mount', async () => {
    const counties = buildCounties()
    vi.mocked(getCounties).mockResolvedValue(counties)

    const { result } = renderHook(() => useCounties(), {
      wrapper: createWrapper(),
    })

    expect(result.current.loading).toBe(true)
    expect(result.current.counties).toEqual([])
    expect(result.current.error).toBeNull()

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.counties).toEqual(counties)
    expect(result.current.error).toBeNull()
    expect(getCounties).toHaveBeenCalledTimes(1)
  })

  it('returns empty array initially', () => {
    vi.mocked(getCounties).mockResolvedValue([])

    const { result } = renderHook(() => useCounties(), {
      wrapper: createWrapper(),
    })

    expect(result.current.counties).toEqual([])
    expect(result.current.loading).toBe(true)
  })

  it('handles loading state correctly', async () => {
    const counties = buildCounties()
    vi.mocked(getCounties).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(counties), 10))
    )

    const { result } = renderHook(() => useCounties(), {
      wrapper: createWrapper(),
    })

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.counties).toEqual(counties)
  })

  it('handles API errors with custom message', async () => {
    const errorMessage = 'Failed to fetch counties'
    vi.mocked(getCounties).mockRejectedValue(new Error(errorMessage))

    const { result } = renderHook(() => useCounties(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.counties).toEqual([])
    expect(result.current.error).not.toBeNull()
    expect(result.current.error).toBe(errorMessage)
  })

  it('caches results for 24 hours (staleTime)', async () => {
    const counties = buildCounties()
    vi.mocked(getCounties).mockResolvedValue(counties)

    const { rerender } = renderHook(() => useCounties(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(getCounties).toHaveBeenCalledTimes(1))

    rerender()

    await waitFor(() => {
      expect(getCounties).toHaveBeenCalledTimes(1)
    })
  })

  it('handles empty counties list', async () => {
    vi.mocked(getCounties).mockResolvedValue([])

    const { result } = renderHook(() => useCounties(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.counties).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('loads multiple counties', async () => {
    const counties = [
      { name: 'Cluj' },
      { name: 'Iași' },
      { name: 'București' },
      { name: 'Constanța' },
    ]
    vi.mocked(getCounties).mockResolvedValue(counties)

    const { result } = renderHook(() => useCounties(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.counties).toHaveLength(4)
    expect(result.current.counties).toEqual(counties)
  })
})
