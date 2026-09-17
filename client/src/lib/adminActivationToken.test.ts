import { afterEach, expect, it } from 'vitest'
import { captureAdminActivationToken, clearAdminActivationToken, readAdminActivationToken } from './adminActivationToken'

afterEach(() => { clearAdminActivationToken(); window.history.replaceState(null, '', '/') })
it('removes the invitation from the address before rendering without persisting it', () => {
  const token = 'a'.repeat(43)
  window.history.replaceState(null, '', `/auth/activate#${token}`)
  captureAdminActivationToken()
  expect(readAdminActivationToken()).toBe(token)
  expect(window.location.hash).toBe('')
  expect(localStorage.length).toBe(0)
  expect(sessionStorage.length).toBe(0)
  clearAdminActivationToken()
  expect(readAdminActivationToken()).toBe('')
})
it('rejects malformed links and removes their fragment and query', () => {
  window.history.replaceState(null, '', '/auth/activate?token=bad#invalid')
  captureAdminActivationToken()
  expect(readAdminActivationToken()).toBe('')
  expect(window.location.hash).toBe('')
  expect(window.location.search).toBe('')
})
