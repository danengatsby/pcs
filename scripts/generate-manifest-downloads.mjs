import { mkdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  AlignmentType, Bookmark, BorderStyle, Document, ExternalHyperlink, Footer,
  Header, HeadingLevel, InternalHyperlink, LeaderType, Packer, PageNumber,
  PageReference, Paragraph, TabStopType, TextRun, UnderlineType,
} from 'docx'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = path.join(rootDir, 'client/public')
const downloadsDir = path.join(publicDir, 'downloads')
const docxPath = path.join(downloadsDir, 'Manifestul_PCS.docx')
const manifest = JSON.parse(await readFile(path.join(rootDir, 'content/manifest-pcs.json'), 'utf8'))
const black = '000000'
const white = 'FFFFFF'
const textWidth = 9526

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

function paragraphs(items) {
  return items.map((text) => `<p>${escapeHtml(text)}</p>`).join('\n')
}

function renderHtml() {
  const contents = manifest.chapters.map((chapter, index) =>
    `<li><a href="#${chapter.id}">${index + 1}. ${escapeHtml(chapter.title)}</a></li>`,
  ).join('\n')
  const chapters = manifest.chapters.map((chapter, index) => `
    <section class="chapter" id="${chapter.id}" aria-labelledby="title-${chapter.id}">
      <div class="chapter-number">CAPITOLUL ${String(index + 1).padStart(2, '0')}</div>
      <h2 id="title-${chapter.id}">${escapeHtml(chapter.title)}</h2>
      <p class="chapter-intro">${escapeHtml(chapter.intro)}</p>
      ${chapter.sections.map((section) => `<section class="article">
        <h3>${escapeHtml(section.title)}</h3>${paragraphs(section.paragraphs)}
      </section>`).join('\n')}
      <p class="monitoring"><strong>Ce urmărim:</strong> ${escapeHtml(chapter.monitoring)}</p>
    </section>`).join('\n')
  return `<!doctype html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Manifestul PCS, ediție extinsă și actualizată la ${escapeHtml(manifest.date)}. Document alb-negru, disponibil în Word și PDF.">
  <title>Manifestul PCS — ${escapeHtml(manifest.edition)}</title>
  <style>
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; background: #fff; color: #000; font: 19px/1.65 Georgia, 'Times New Roman', serif; }
    main { max-width: 900px; margin: 0 auto; padding: 44px 34px 70px; }
    h1, h2, h3, .eyebrow, .chapter-number { font-family: Arial, sans-serif; color: #000; }
    h1 { margin: 24px 0 16px; font-size: clamp(30px, 5vw, 48px); line-height: 1.1; letter-spacing: -.025em; }
    h2 { margin: 12px 0 24px; font-size: clamp(24px, 3.5vw, 32px); line-height: 1.2; }
    h3 { margin: 28px 0 12px; font-size: 21px; line-height: 1.35; }
    p { margin: 0 0 16px; }
    a { color: #000; text-underline-offset: 3px; overflow-wrap: anywhere; }
    a:focus-visible { outline: 2px solid #000; outline-offset: 4px; }
    .cover { padding: 14px 0 34px; border-bottom: 2px solid #000; }
    .eyebrow, .chapter-number { font-weight: bold; font-size: 13px; letter-spacing: .08em; }
    .subtitle { font-size: 24px; line-height: 1.35; }
    .edition { margin: 26px 0; font: 15px/1.6 Arial, sans-serif; }
    .introduction { margin-top: 32px; }
    .toc { padding: 36px 0; border-bottom: 1px solid #000; }
    .toc ol { list-style: none; margin: 0; padding: 0; }
    .toc li { padding: 4px 0; }
    .chapter, .closing, .references { padding-top: 44px; margin-top: 36px; border-top: 1px solid #000; scroll-margin-top: 24px; }
    .chapter-intro { font-style: italic; }
    .monitoring { margin-top: 24px; padding: 16px 0 0; border-top: 1px solid #000; font-size: 17px; }
    .commitments { padding-left: 28px; }
    .commitments li { padding: 0 0 14px 8px; }
    .references li { margin-bottom: 24px; padding-left: 8px; }
    .references p { font-size: 17px; margin-top: 8px; }
    .signature { margin-top: 30px; font: bold 16px/1.5 Arial, sans-serif; }
    footer { margin-top: 36px; padding-top: 18px; border-top: 1px solid #000; font: 13px/1.5 Arial, sans-serif; }
    @media (max-width: 600px) { main { padding: 28px 22px 50px; } body { font-size: 18px; } .subtitle { font-size: 21px; } }
    @media print { @page { size: A4; margin: 20mm; } main { max-width: none; padding: 0; } body { font-size: 12pt; line-height: 1.3; } .chapter, .toc, .closing, .references { break-before: page; margin-top: 0; padding-top: 0; border-top: 0; } h2, h3 { break-after: avoid; } p { orphans: 3; widows: 3; } a { text-decoration: none; } }
  </style>
</head>
<body>
<main>
  <header class="cover">
    <div class="eyebrow">${escapeHtml(manifest.party)}</div>
    <h1>${escapeHtml(manifest.title)}</h1>
    <p class="subtitle">${escapeHtml(manifest.subtitle)}</p>
    <p class="edition">${escapeHtml(manifest.edition)} · ${escapeHtml(manifest.date)}<br>${escapeHtml(manifest.horizon)} · Alb-negru</p>
    <div class="introduction">${paragraphs(manifest.introduction)}</div>
  </header>
  <nav class="toc" aria-label="Cuprinsul manifestului">
    <h2>Cuprins</h2>
    <ol>${contents}<li><a href="#angajamente">Angajamentul nostru — zece direcții de acțiune</a></li><li><a href="#repere">Repere și documente consultate</a></li></ol>
  </nav>
  ${chapters}
  <section class="closing" id="angajamente">
    <h2>Angajamentul nostru</h2>
    <p>Zece direcții de acțiune pentru demnitate și răspundere publică.</p>
    <ol class="commitments">${manifest.commitments.map((text) => `<li>${escapeHtml(text)}</li>`).join('\n')}</ol>
    <p>${escapeHtml(manifest.closing)}</p>
    <p class="signature">${escapeHtml(manifest.party)}</p>
  </section>
  <section class="references" id="repere">
    <h2>Repere și documente consultate</h2>
    <p>${escapeHtml(manifest.referencesIntro)}</p>
    <ol>${manifest.references.map((item) => `<li><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a><p>${escapeHtml(item.note)}</p></li>`).join('\n')}</ol>
  </section>
  <footer>${escapeHtml(manifest.party)} · ${escapeHtml(manifest.edition)} · ${escapeHtml(manifest.date)}</footer>
</main>
</body>
</html>
`
}

function run(text, options = {}) {
  return new TextRun({ text, color: black, ...options })
}

function paragraph(text, options = {}) {
  return new Paragraph({
    children: [run(text)],
    alignment: AlignmentType.LEFT,
    spacing: { after: 140, line: 300 },
    widowControl: true,
    ...options,
  })
}

function heading(text, anchor) {
  return paragraph(text, {
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true,
    keepNext: true,
    spacing: { before: 0, after: 260 },
    children: [new Bookmark({ id: anchor, children: [run(text)] })],
  })
}

function contentsItem(text, anchor) {
  return paragraph('', {
    spacing: { after: 130, line: 290 },
    tabStops: [{ type: TabStopType.RIGHT, position: textWidth, leader: LeaderType.DOT }],
    children: [
      new InternalHyperlink({ anchor, children: [run(text)] }),
      run('\t'),
      new PageReference(anchor, { hyperlink: true }),
    ],
  })
}

function buildDocx() {
  const children = [
    paragraph(manifest.party, {
      spacing: { before: 660, after: 520 },
      children: [run(manifest.party, { font: 'Arial', bold: true, size: 24 })],
    }),
    paragraph(manifest.title, {
      heading: HeadingLevel.TITLE,
      spacing: { after: 260 },
      children: [run(manifest.title, { font: 'Arial', bold: true, size: 68 })],
    }),
    paragraph(manifest.subtitle, {
      spacing: { after: 360, line: 380 },
      children: [run(manifest.subtitle, { size: 34 })],
    }),
    paragraph(`${manifest.edition} · ${manifest.date}`, {
      children: [run(`${manifest.edition} · ${manifest.date}`, { font: 'Arial', size: 22 })],
    }),
    paragraph(`${manifest.horizon} · Alb-negru`, {
      spacing: { after: 340 },
      border: { bottom: { style: BorderStyle.SINGLE, color: black, size: 10, space: 14 } },
      children: [run(`${manifest.horizon} · Alb-negru`, { font: 'Arial', size: 22 })],
    }),
    ...manifest.introduction.map((text) => paragraph(text)),
    heading('Cuprins', 'cuprins'),
    ...manifest.chapters.map((chapter, index) => contentsItem(`${index + 1}. ${chapter.title}`, chapter.id)),
    contentsItem('Angajamentul nostru', 'angajamente'),
    contentsItem('Repere și documente consultate', 'repere'),
  ]

  for (const [index, chapter] of manifest.chapters.entries()) {
    children.push(
      heading(`${index + 1}. ${chapter.title}`, chapter.id),
      paragraph(chapter.intro, { children: [run(chapter.intro, { italics: true })] }),
    )
    for (const section of chapter.sections) {
      children.push(paragraph(section.title, {
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 100 },
        keepNext: true,
      }))
      children.push(...section.paragraphs.map((text) => paragraph(text)))
    }
    children.push(paragraph('', {
      spacing: { before: 220, after: 100, line: 280 },
      border: { top: { style: BorderStyle.SINGLE, color: black, size: 6, space: 10 } },
      children: [run('Ce urmărim: ', { bold: true, size: 22 }), run(chapter.monitoring, { size: 22 })],
    }))
  }

  children.push(heading('Angajamentul nostru', 'angajamente'))
  children.push(paragraph('Zece direcții de acțiune pentru demnitate și răspundere publică.'))
  manifest.commitments.forEach((text, index) => children.push(paragraph('', {
    indent: { left: 450, hanging: 450 },
    children: [run(`${index + 1}. `, { bold: true }), run(text)],
  })))
  children.push(paragraph(manifest.closing, { spacing: { before: 260, after: 220, line: 300 } }))
  children.push(paragraph(manifest.party, { children: [run(manifest.party, { font: 'Arial', size: 22, bold: true })] }))
  children.push(heading('Repere și documente consultate', 'repere'))
  children.push(paragraph(manifest.referencesIntro))
  manifest.references.forEach((reference, index) => {
    children.push(paragraph('', {
      keepNext: true,
      spacing: { before: 260, after: 100 },
      children: [run(`${index + 1}. `, { bold: true }), new ExternalHyperlink({
        link: reference.url,
        children: [run(reference.title, { bold: true, underline: { type: UnderlineType.SINGLE } })],
      })],
    }))
    children.push(paragraph(reference.note))
  })

  return new Document({
    creator: 'Partidul Conservator al Seniorilor',
    title: `${manifest.title} — ${manifest.edition}`,
    subject: `${manifest.subtitle} ${manifest.horizon}`,
    description: `${manifest.edition}, ${manifest.date}. Document alb-negru.`,
    background: { color: white },
    features: { updateFields: true },
    styles: {
      default: {
        document: { run: { font: 'Times New Roman', size: 24, color: black, language: { value: 'ro-RO' } } },
        title: { run: { font: 'Arial', size: 68, color: black, bold: true } },
        heading1: { run: { font: 'Arial', size: 36, color: black, bold: true } },
        heading2: { run: { font: 'Arial', size: 26, color: black, bold: true } },
        heading3: { run: { color: black } },
        heading4: { run: { color: black } },
        heading5: { run: { color: black } },
        heading6: { run: { color: black } },
        hyperlink: { run: { color: black, underline: { type: UnderlineType.SINGLE } } },
      },
    },
    sections: [{
      properties: {
        titlePage: true,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1000, right: 1190, bottom: 1000, left: 1190, header: 480, footer: 480 },
        },
      },
      headers: {
        default: new Header({ children: [paragraph('PCS | MANIFEST', {
          spacing: { after: 100 },
          border: { bottom: { style: BorderStyle.SINGLE, color: black, size: 4, space: 6 } },
          children: [run('PCS | MANIFEST', { font: 'Arial', size: 18 })],
        })] }),
      },
      footers: {
        default: new Footer({ children: [paragraph('', {
          alignment: AlignmentType.RIGHT,
          spacing: { after: 0 },
          children: [run(`${manifest.date} · `, { size: 18 }), run('Pagina ', { size: 18 }),
            new TextRun({ children: [PageNumber.CURRENT], color: black, size: 18 }),
            run(' / ', { size: 18 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], color: black, size: 18 })],
        })] }),
      },
      children,
    }],
  })
}

async function generatePdf() {
  const profile = await mkdtemp(path.join(tmpdir(), 'pcs-manifest-libreoffice-'))
  try {
    await new Promise((resolve, reject) => {
      const child = spawn('libreoffice', [
        `-env:UserInstallation=${pathToFileURL(profile).href}`, '--headless',
        '--convert-to', 'pdf:writer_pdf_Export', '--outdir', downloadsDir, docxPath,
      ], { stdio: 'inherit' })
      child.once('error', reject)
      child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`LibreOffice exited with ${code}`)))
    })
    const pdf = await readFile(path.join(downloadsDir, 'Manifestul_PCS.pdf'))
    if (pdf.subarray(0, 5).toString() !== '%PDF-') {
      throw new Error('Invalid manifest PDF')
    }
  } finally {
    await rm(profile, { recursive: true, force: true })
  }
}

await mkdir(downloadsDir, { recursive: true })
await writeFile(path.join(publicDir, 'manifest_pcs.html'), renderHtml().replace(/[ \t]+$/gm, ''))
await writeFile(docxPath, await Packer.toBuffer(buildDocx()))
if (!process.argv.includes('--docx-only')) {
  await generatePdf()
}
process.stdout.write(`Generated manifest HTML and DOCX${process.argv.includes('--docx-only') ? '' : ' and PDF'} (${manifest.chapters.length} chapters, ${manifest.date}).\n`)
