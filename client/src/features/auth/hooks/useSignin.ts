import { useCallback, useState } from 'react'
import { useAuth } from '../context'
import type { ApiErrorResult, ApiResult } from '@lib/http'
import type { AuthSessionResponse, SigninInput } from '../types'

type UseSigninState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: AuthSessionResponse }
  | { status: 'error'; error: ApiErrorResult['error'] }

export function useSignin(): {
  state: UseSigninState
  submit: (input: SigninInput) => Promise<ApiResult<AuthSessionResponse> | ApiErrorResult>
  reset: () => void
} {
  const [state, setState] = useState<UseSigninState>({ status: 'idle' })
  const { signin } = useAuth()

  const reset = useCallback(() => setState({ status: 'idle' }), [])

  const submit = useCallback(async (input: SigninInput) => {
    setState({ status: 'loading' })
    const result = await signin(input)
    if (result.ok) {
      setState({ status: 'success', data: result.data })
    } else {
      setState({ status: 'error', error: result.error })
    }
    return result
  }, [signin])

  return { state, submit, reset }
}
