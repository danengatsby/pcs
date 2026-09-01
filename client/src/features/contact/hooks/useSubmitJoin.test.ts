import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSubmitJoin } from './useSubmitJoin'
import { submitJoin } from '../api/submitJoin'
import { createWrapper } from '@test/testUtils'

vi.mock('../api/submitJoin', () => ({
  submitJoin: vi.fn(),
}))

describe('useSubmitJoin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('provides submit function', () => {
    vi.mocked(submitJoin).mockResolvedValue({ id: '1' })

    const { result } = renderHook(() => useSubmitJoin(), {
      wrapper: createWrapper(),
    })

    expect(result.current).toBeDefined()
    expect(result.current.submit).toBeDefined()
    expect(result.current.submitting).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.reset).toBeDefined()
  })

  it('resets error state when reset is called', async () => {
    vi.mocked(submitJoin).mockImplementationOnce(async () => {
      throw new Error('Test error')
    })

    const { result } = renderHook(() => useSubmitJoin(), {
      wrapper: createWrapper(),
    })

    const payload = {
      fullName: 'New Volunteer',
      email: 'new@example.test',
      password: 'StrongPass123!',
      county: 'Cluj',
      locality: 'Cluj-Napoca',
      motivation: 'Vreau să ajut.',
      website: '',
    }

    // Submit and expect error
    await act(async () => {
      try {
        await result.current.submit(payload)
      } catch {
        // Expected
      }
    })

    // Reset
    act(() => {
      result.current.reset()
    })

    expect(result.current.error).toBeNull()
  })

  it('can call submit function', async () => {
    vi.mocked(submitJoin).mockResolvedValue({ id: '123' })

    const { result } = renderHook(() => useSubmitJoin(), {
      wrapper: createWrapper(),
    })

    const payload = {
      fullName: 'New Volunteer',
      email: 'new@example.test',
      password: 'StrongPass123!',
      county: 'Cluj',
      locality: 'Cluj-Napoca',
      motivation: 'Vreau să ajut.',
      website: '',
    }

    // Submit
    await act(async () => {
      const response = await result.current.submit(payload)
      expect(response).toBeDefined()
    })

    expect(submitJoin).toHaveBeenCalled()
  })
})
