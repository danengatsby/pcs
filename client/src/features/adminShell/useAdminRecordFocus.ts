import { useEffect } from 'react'

// Run only when the selected record changes, not on background data refreshes.
// Call from the component that renders the record, after its data has loaded.
export function useAdminRecordFocus(id: string | null) {
  useEffect(() => {
    if (!id) return
    const element = document.getElementById(id)
    element?.scrollIntoView?.({ block: 'start' })
    element?.focus({ preventScroll: true })
  }, [id])
}
