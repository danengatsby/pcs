import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@features/auth/context'
import { useAdminWorkspace } from '@features/adminShell/AdminContext'
import { apiGet, apiPost } from '@lib/http'

export function useAdminRegister<T>(path: string) {
  const { user } = useAuth()
  const { access } = useAdminWorkspace()
  const queryClient = useQueryClient()
  const key = ['admin', 'register', path, user?.id, access.scope]
  const query = useQuery({ queryKey: key, queryFn: async () => {
    const result = await apiGet<T[]>(path, { auth: true })
    if (!result.ok) throw new Error(result.error.message)
    return result.data
  }, refetchOnWindowFocus: true })
  const mutation = useMutation({
    mutationFn: async ({ suffix, body }: { suffix: string; body: unknown }) => {
      const result = await apiPost<unknown>(`${path}${suffix}`, body, { auth: true })
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'register', path] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'tasks'] }),
      ])
    },
  })
  return { query, mutation }
}
