import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { useAuth } from '@features/auth/context'
import { useAdminWorkspace } from '@features/adminShell/AdminContext'
import { apiGet } from '@lib/http'

export function OrganizationSelect({ allowNational = false, defaultValue = '', nationalLabel = 'Jurisdicție națională (fără filială)' }: { allowNational?: boolean; defaultValue?: string; nationalLabel?: string }) {
  const { user } = useAuth()
  const { access } = useAdminWorkspace()
  const selectId = useId()
  const [value, setValue] = useState(defaultValue)
  const query = useQuery({
    queryKey: ['admin', 'organization-options', user?.id, access.scope],
    enabled: access.capabilities.includes('workspace.read'),
    queryFn: async () => {
      const rows: Array<{ id: string; name: string }> = []
      for (let offset = 0; offset <= 10000; offset += 200) {
        const result = await apiGet<{ rows: Array<{ id: string; name: string }>; total: number }>(`/api/admin/organization-options?limit=200&offset=${offset}`, { auth: true })
        if (!result.ok) throw new Error(result.error.message)
        rows.push(...result.data.rows)
        if (rows.length >= result.data.total || result.data.rows.length === 0) return rows
      }
      throw new Error('Registrul depășește limita selecției de organizații.')
    },
  })
  const national = allowNational && access.scope.national
  return <div>
    <label htmlFor={selectId}>Organizație</label>
    <select id={selectId} name="organizationId" required={!national} value={value} onChange={(event) => setValue(event.target.value)} disabled={query.isPending || query.isError}>
      <option value="">{national ? nationalLabel : 'Selectează organizația'}</option>
      {query.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
    {query.isError && <span role="alert">Organizațiile nu au putut fi încărcate. <button type="button" className="btn" onClick={() => void query.refetch()}>Reîncarcă organizațiile</button></span>}
  </div>
}
