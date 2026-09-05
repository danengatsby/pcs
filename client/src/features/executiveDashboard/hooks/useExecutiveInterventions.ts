import { useContext } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@features/auth/context'
import { AdminContext } from '@features/adminShell/AdminContext'
import { apiGet, apiPatch } from '@lib/http'
import type { ExpiryData, ExpiryRecord, InterventionData, InterventionKind } from '../interventions'

export function useExecutiveInterventions(kind: InterventionKind | '', offset: number) {
  const { user } = useAuth()
  const workspace = useContext(AdminContext)
  return useQuery({
    queryKey: ['admin', 'executive-interventions', user?.id, workspace?.access, kind, offset],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '20', offset: String(offset), ...(kind ? { kind } : {}) })
      const result = await apiGet<InterventionData>(`/api/admin/executive-dashboard/interventions?${params}`, { auth: true })
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
    staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 30_000,
  })
}

export function useExecutiveExpirations(record: string | null, offset: number) {
  const { user } = useAuth()
  const workspace = useContext(AdminContext)
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['admin', 'executive-expirations', user?.id, workspace?.access, record, offset],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '20', offset: String(offset), ...(record ? { record } : {}) })
      const result = await apiGet<ExpiryData>(`/api/admin/executive-dashboard/expirations?${params}`, { auth: true })
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
    staleTime: 0, refetchOnWindowFocus: true,
  })
  const mutation = useMutation({
    mutationFn: async ({ row, expiresOn }: { row: ExpiryRecord; expiresOn: string | null }) => {
      const result = await apiPatch(`/api/admin/executive-dashboard/expirations/${encodeURIComponent(row.source)}/${encodeURIComponent(row.id)}`,
        { expiresOn, expectedExpiresOn: row.expiresOn }, { auth: true })
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: async () => { await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'executive-interventions'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'executive-expirations'] }),
    ]) },
  })
  return { query, mutation }
}
