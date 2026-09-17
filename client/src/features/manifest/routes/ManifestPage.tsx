import { SiteHeader } from '@app/layout/SiteHeader'

const manifestVersion = '2026-09-07-extins'

export function ManifestPage() {
  return (
    <div className="app-shell manifest-shell">
      <SiteHeader />
      <main className="manifest-page" id="main-content" tabIndex={-1}>
        <section className="manifest-page__toolbar" aria-label="Descărcare manifest">
          <div>
            <strong>Manifestul PCS</strong>
            <span>Ediție extinsă · 7 septembrie 2026 · Alb-negru</span>
          </div>
          <div className="manifest-page__downloads">
            <a className="btn primary" href={`/downloads/Manifestul_PCS.docx?v=${manifestVersion}`} download>
              Descarcă DOCX
            </a>
            <a className="btn" href={`/downloads/Manifestul_PCS.pdf?v=${manifestVersion}`} download>
              Descarcă PDF
            </a>
          </div>
        </section>
        <iframe className="manifest-page__frame" title="Manifest PCS" src={`/manifest_pcs.html?v=${manifestVersion}`} />
      </main>
    </div>
  )
}
