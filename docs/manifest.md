# Manifestul PCS

Sursa editorială comună este `content/manifest-pcs.json`. Ediția din 7 septembrie 2026 extinde manifestul la 14 capitole, zece angajamente și repere documentare.

Generare:

```bash
npm run generate:manifest-downloads
```

Comanda produce `client/public/manifest_pcs.html`, `client/public/downloads/Manifestul_PCS.docx` și `client/public/downloads/Manifestul_PCS.pdf`. Documentele folosesc exclusiv text negru pe fond alb. PDF-ul este convertit din DOCX cu LibreOffice, pentru a păstra aceeași paginare. Este necesar executabilul `libreoffice` cu Writer instalat. Pentru HTML și DOCX fără conversia PDF: `npm run generate:manifest-downloads -- --docx-only`.

După editare, verifică textul și paginarea DOCX-ului, concordanța dintre cele trei formate și legăturile din pagina Manifest. Actualizează data și versiunea ediției în sursă și parametrul de versiune al descărcărilor din `ManifestPage.tsx`, pentru a evita servirea unui document mai vechi din cache. Publică artefactele într-un release nou al clientului, conform runbookului de producție.
