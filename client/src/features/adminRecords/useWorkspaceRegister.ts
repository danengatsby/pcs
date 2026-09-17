import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@features/auth/context'
import { useAdminWorkspace } from '@features/adminShell/AdminContext'
import { apiGet, apiPatch, apiPost } from '@lib/http'

export function useWorkspaceRegister<T>(path: string, filters: string) {
  const { user } = useAuth()
  const { access } = useAdminWorkspace()
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['admin', 'records', path, user?.id, access.scope, filters], queryFn: async () => {
    const result = await apiGet<T>(`${path}?${filters}`, { auth: true })
    if (!result.ok) throw new Error(result.error.message)
    return result.data
  } })
  const mutation = useMutation({ mutationFn: async ({ suffix = '', body, method = 'POST' }: { suffix?: string; body: unknown; method?: 'POST' | 'PATCH' }) => {
    const result = await (method === 'PATCH' ? apiPatch : apiPost)(`${path}${suffix}`, body, { auth: true })
    if (!result.ok) throw new Error(result.error.message)
    return result.data
  }, onSuccess: async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['admin', 'records', path] }),
      client.invalidateQueries({ queryKey: ['admin', 'record-history'] }),
      client.invalidateQueries({ queryKey: ['admin', 'tasks'] }),
    ])
  } })
  return { query, mutation }
}
