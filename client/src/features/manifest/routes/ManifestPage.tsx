import { SiteHeader } from '@app/layout/SiteHeader'

export function ManifestPage() {
  return (
    <div className="app-shell manifest-shell">
      <SiteHeader />
      <main className="manifest-page" id="main-content" tabIndex={-1}>
        <iframe className="manifest-page__frame" title="Manifest PCS" src="/manifest_pcs.html" />
      </main>
    </div>
  )
}
