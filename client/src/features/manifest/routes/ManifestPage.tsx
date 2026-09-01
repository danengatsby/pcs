import { SiteHeader } from '@app/layout/SiteHeader'

export function ManifestPage() {
  return (
    <div className="app-shell manifest-shell">
      <SiteHeader />
      <main className="manifest-page" id="main-content" tabIndex={-1}>
        <section className="manifest-page__toolbar" aria-label="Descărcare manifest">
          <div>
            <strong>Manifestul PCS</strong>
            <span>Alege formatul documentului</span>
          </div>
          <div className="manifest-page__downloads">
            <a className="btn primary" href="/downloads/Manifestul_PCS.docx" download>
              Descarcă DOCX
            </a>
            <a className="btn" href="/downloads/Manifestul_PCS.pdf" download>
              Descarcă PDF
            </a>
          </div>
        </section>
        <iframe className="manifest-page__frame" title="Manifest PCS" src="/manifest_pcs.html" />
      </main>
    </div>
  )
}
