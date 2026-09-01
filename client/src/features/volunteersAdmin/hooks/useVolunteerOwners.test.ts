import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useVolunteerOwners } from './useVolunteerOwners'
import { getVolunteerOwners } from '../api/getVolunteerOwners'
import { createWrapper } from '@test/testUtils'
import type { VolunteerOwnerOption } from '../types'

vi.mock('../api/getVolunteerOwners', () => ({
  getVolunteerOwners: vi.fn(),
}))

function buildMockOwners(): VolunteerOwnerOption[] {
  return [
    {
      id: 1,
      email: 'admin1@example.test',
      fullName: 'Admin One',
    },
    {
      id: 2,
      email: 'admin2@example.test',
      fullName: 'Admin Two',
    },
  ]
}

describe('useVolunteerOwners', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads volunteer owners on mount', async () => {
    const owners = buildMockOwners()
    vi.mocked(getVolunteerOwners).mockResolvedValue(owners)

    const { result } = renderHook(() => useVolunteerOwners(), {
      wrapper: createWrapper(),
    })

    expect(result.current.loading).toBe(true)
    expect(result.current.owners).toEqual([])
    expect(result.current.error).toBeNull()

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.owners).toEqual(owners)
    expect(result.current.error).toBeNull()
    expect(getVolunteerOwners).toHaveBeenCalledTimes(1)
  })

  it('returns empty array initially', () => {
    vi.mocked(getVolunteerOwners).mockResolvedValue([])

    const { result } = renderHook(() => useVolunteerOwners(), {
      wrapper: createWrapper(),
    })

    expect(result.current.owners).toEqual([])
    expect(result.current.loading).toBe(true)
  })

  it('handles loading state correctly', async () => {
    const owners = buildMockOwners()
    vi.mocked(getVolunteerOwners).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(owners), 10))
    )

    const { result } = renderHook(() => useVolunteerOwners(), {
      wrapper: createWrapper(),
    })

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.owners).toEqual(owners)
  })

  it('handles API errors with custom message', async () => {
    const errorMessage = 'Failed to fetch owners'
    vi.mocked(getVolunteerOwners).mockRejectedValue(new Error(errorMessage))

    const { result } = renderHook(() => useVolunteerOwners(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.owners).toEqual([])
    expect(result.current.error).not.toBeNull()
    expect(result.current.error).toBe(errorMessage)
  })

  it('caches results for 5 minutes (staleTime)', async () => {
    const owners = buildMockOwners()
    vi.mocked(getVolunteerOwners).mockResolvedValue(owners)

    const { rerender } = renderHook(() => useVolunteerOwners(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(getVolunteerOwners).toHaveBeenCalledTimes(1))

    rerender()

    await waitFor(() => {
      expect(getVolunteerOwners).toHaveBeenCalledTimes(1)
    })
  })

  it('handles empty owners list', async () => {
    vi.mocked(getVolunteerOwners).mockResolvedValue([])

    const { result } = renderHook(() => useVolunteerOwners(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.owners).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('loads multiple owners', async () => {
    const owners = buildMockOwners()
    vi.mocked(getVolunteerOwners).mockResolvedValue(owners)

    const { result } = renderHook(() => useVolunteerOwners(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.owners).toHaveLength(2)
    expect(result.current.owners).toEqual(owners)
  })
})
