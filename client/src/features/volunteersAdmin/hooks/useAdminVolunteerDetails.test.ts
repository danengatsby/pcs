import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminVolunteerDetails } from './useAdminVolunteerDetails'
import { getAdminVolunteerById } from '../api/getAdminVolunteerById'
import { createWrapper } from '@test/testUtils'
import type { VolunteerAdminRow } from '../types'

vi.mock('../api/getAdminVolunteerById', () => ({
  getAdminVolunteerById: vi.fn(),
}))

function buildMockVolunteer(id = 1, overrides: Partial<VolunteerAdminRow> = {}): VolunteerAdminRow {
  return {
    id,
    volunteerId: id,
    fullName: 'Test Volunteer',
    email: 'volunteer@example.test',
    phone: '0712345678',
    county: 'Cluj',
    locality: 'Cluj-Napoca',
    skills: 'organizare',
    motivation: 'Vreau să ajut.',
    workflowStatus: 'nou',
    internalNotes: 'Test notes',
    createdAt: '2026-04-05T10:00:00.000Z',
    statusUpdatedAt: null,
    statusUpdatedByUserId: null,
    statusUpdatedByName: null,
    statusUpdatedByEmail: null,
    ownerUserId: null,
    ownerName: null,
    ownerEmail: null,
    ownerRole: null,
    followUpAt: null,
    reminderAt: null,
    lastContactAt: null,
    contactChannel: null,
    priority: 'medie',
    rejectionReason: null,
    tags: [],
    skillTags: [],
    accountRole: null,
    recordSource: 'volunteer',
    ...overrides,
  }
}

describe('useAdminVolunteerDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads volunteer details when id is provided', async () => {
    const volunteer = buildMockVolunteer(1)
    vi.mocked(getAdminVolunteerById).mockResolvedValue(volunteer)

    const { result } = renderHook(() => useAdminVolunteerDetails(1), {
      wrapper: createWrapper(),
    })

    expect(result.current.loading).toBe(true)
    expect(result.current.volunteer).toBeNull()

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.volunteer).toEqual(volunteer)
    expect(result.current.error).toBeNull()
    expect(getAdminVolunteerById).toHaveBeenCalledWith(1)
  })

  it('does not fetch when id is null', () => {
    vi.mocked(getAdminVolunteerById).mockResolvedValue(buildMockVolunteer())

    const { result } = renderHook(() => useAdminVolunteerDetails(null), {
      wrapper: createWrapper(),
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.volunteer).toBeNull()
    expect(getAdminVolunteerById).not.toHaveBeenCalled()
  })

  it('uses initial volunteer data if provided', () => {
    const initialVolunteer = buildMockVolunteer(1, { fullName: 'Initial Volunteer' })
    vi.mocked(getAdminVolunteerById).mockResolvedValue(buildMockVolunteer())

    const { result } = renderHook(() => useAdminVolunteerDetails(1, initialVolunteer), {
      wrapper: createWrapper(),
    })

    expect(result.current.volunteer).toEqual(initialVolunteer)
  })

  it('fetches when id changes', async () => {
    const volunteer1 = buildMockVolunteer(1, { fullName: 'Volunteer 1' })
    const volunteer2 = buildMockVolunteer(2, { fullName: 'Volunteer 2' })

    vi.mocked(getAdminVolunteerById)
      .mockResolvedValueOnce(volunteer1)
      .mockResolvedValueOnce(volunteer2)

    const { result, rerender } = renderHook((id: number | null) => useAdminVolunteerDetails(id), {
      initialProps: 1 as number | null,
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.volunteer).toEqual(volunteer1))

    rerender(2)

    await waitFor(() => expect(result.current.volunteer).toEqual(volunteer2))
    expect(getAdminVolunteerById).toHaveBeenCalledWith(2)
  })

  it('handles API errors with custom message', async () => {
    const errorMessage = 'Not found'
    vi.mocked(getAdminVolunteerById).mockRejectedValue(new Error(errorMessage))

    const { result } = renderHook(() => useAdminVolunteerDetails(999), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.volunteer).toBeNull()
    expect(result.current.error).not.toBeNull()
    expect(result.current.error).toBe(errorMessage)
  })

  it('does not show loading state when transitioning from non-null to null id', async () => {
    const volunteer = buildMockVolunteer(1)
    vi.mocked(getAdminVolunteerById).mockResolvedValue(volunteer)

    const { result, rerender } = renderHook((id: number | null) => useAdminVolunteerDetails(id), {
      initialProps: 1 as number | null,
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    rerender(null)

    expect(result.current.loading).toBe(false)
  })

  it('clears error when successfully fetching a new volunteer', async () => {
    vi.mocked(getAdminVolunteerById)
      .mockRejectedValueOnce(new Error('First error'))
      .mockResolvedValueOnce(buildMockVolunteer(2))

    const { result, rerender } = renderHook((id: number | null) => useAdminVolunteerDetails(id), {
      initialProps: 1 as number | null,
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.error).not.toBeNull())

    rerender(2)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeNull()
    expect(result.current.volunteer).not.toBeNull()
  })
})
