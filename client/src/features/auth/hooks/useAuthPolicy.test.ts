import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthPolicy } from './useAuthPolicy'
import { getAuthPolicy } from '../api/getAuthPolicy'
import { createWrapper } from '@test/testUtils'

vi.mock('../api/getAuthPolicy', () => ({
  getAuthPolicy: vi.fn(),
}))

describe('useAuthPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads auth policy on mount', async () => {
    const mockPolicy = {
      minPasswordLength: 10,
      maxPasswordLength: 128,
      requireUppercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
    }
    vi.mocked(getAuthPolicy).mockResolvedValue(mockPolicy)

    const { result } = renderHook(() => useAuthPolicy(), {
      wrapper: createWrapper(),
    })

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).toEqual(mockPolicy)
    expect(result.current.error).toBeNull()
    expect(getAuthPolicy).toHaveBeenCalledTimes(1)
  })

  it('returns null initially', () => {
    vi.mocked(getAuthPolicy).mockResolvedValue({})

    const { result } = renderHook(() => useAuthPolicy(), {
      wrapper: createWrapper(),
    })

    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(true)
  })

  it('handles loading state correctly', async () => {
    const mockPolicy = {
      minPasswordLength: 10,
    }
    vi.mocked(getAuthPolicy).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockPolicy), 10))
    )

    const { result } = renderHook(() => useAuthPolicy(), {
      wrapper: createWrapper(),
    })

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).toEqual(mockPolicy)
  })

  it('handles API errors with custom message', async () => {
    const errorMessage = 'Failed to fetch auth policy'
    vi.mocked(getAuthPolicy).mockRejectedValue(new Error(errorMessage))

    const { result } = renderHook(() => useAuthPolicy(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).toBeNull()
    expect(result.current.error).not.toBeNull()
    expect(result.current.error).toBe(errorMessage)
  })

  it('caches results with staleTime of 5 minutes', async () => {
    const mockPolicy = {
      minPasswordLength: 10,
    }
    vi.mocked(getAuthPolicy).mockResolvedValue(mockPolicy)

    const { rerender } = renderHook(() => useAuthPolicy(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(getAuthPolicy).toHaveBeenCalledTimes(1))

    rerender()

    await waitFor(() => {
      expect(getAuthPolicy).toHaveBeenCalledTimes(1)
    })
  })

  it('handles empty policy object', async () => {
    vi.mocked(getAuthPolicy).mockResolvedValue({})

    const { result } = renderHook(() => useAuthPolicy(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).toEqual({})
    expect(result.current.error).toBeNull()
  })
})
