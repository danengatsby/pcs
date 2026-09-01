import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  TextRun,
} from 'docx'
import { JSDOM } from 'jsdom'
import { chromium } from 'playwright'

const rootDir = process.cwd()
const sourcePath = path.join(rootDir, 'client/public/manifest_pcs.html')
const downloadsDir = path.join(rootDir, 'client/public/downloads')
const docxPath = path.join(downloadsDir, 'Manifestul_PCS.docx')
const pdfPath = path.join(downloadsDir, 'Manifestul_PCS.pdf')
const gold = 'A8741E'
const navy = '081A2F'

function cleanText(value) {
  return value.replace(/\s+/g, ' ')
}

function inlineRuns(node, formatting = {}) {
  if (node.nodeType === 3) {
    const text = cleanText(node.textContent ?? '')
    return text ? [new TextRun({ text, ...formatting })] : []
  }

  if (node.nodeType !== 1) {
    return []
  }

  const tagName = node.tagName.toLowerCase()
  if (tagName === 'br') {
    return [new TextRun({ break: 1 })]
  }

  const nextFormatting = {
    ...formatting,
    ...(tagName === 'strong' || tagName === 'b' ? { bold: true, color: gold } : {}),
    ...(tagName === 'em' || tagName === 'i' ? { italics: true } : {}),
  }

  return [...node.childNodes].flatMap((child) => inlineRuns(child, nextFormatting))
}

function bodyParagraph(element, options = {}) {
  return new Paragraph({
    children: inlineRuns(element),
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 180, line: 340 },
    ...options,
  })
}

function textParagraph(text, options = {}) {
  return new Paragraph({
    children: [new TextRun(text)],
    ...options,
  })
}

function buildDocxChildren(document) {
  const heroSubtitle = document.querySelector('.hero-sub')?.textContent?.trim() ?? ''
  const partyName = document.querySelector('.footer .party-name')?.textContent?.trim() ?? ''
  const motto = document.querySelector('.footer .motto')?.textContent?.trim() ?? ''
  const children = [
    textParagraph('PARTIDUL CONSERVATOR AL SENIORILOR · PROGRAM PUBLIC', {
      alignment: AlignmentType.CENTER,
      spacing: { before: 900, after: 320 },
      children: [
        new TextRun({
          text: 'PARTIDUL CONSERVATOR AL SENIORILOR · PROGRAM PUBLIC',
          bold: true,
          color: gold,
          size: 22,
        }),
      ],
    }),
    textParagraph('MANIFESTUL P.C.S.', {
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 260 },
      children: [new TextRun({ text: 'MANIFESTUL P.C.S.', bold: true, color: navy, size: 52 })],
    }),
    textParagraph(heroSubtitle, {
      alignment: AlignmentType.CENTER,
      spacing: { after: 700 },
      children: [new TextRun({ text: heroSubtitle, italics: true, color: '52657A', size: 28 })],
    }),
  ]

  for (const paragraph of document.querySelectorAll('.preambul p')) {
    children.push(bodyParagraph(paragraph, { alignment: AlignmentType.CENTER }))
  }

  children.push(new Paragraph({ children: [new PageBreak()] }))
  children.push(textParagraph('CUPRINS', { heading: HeadingLevel.HEADING_1 }))

  const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
  ;[...document.querySelectorAll('.toc li')].forEach((item, index) => {
    children.push(
      textParagraph(`${romanNumerals[index] ?? index + 1}. ${item.textContent?.trim() ?? ''}`, {
        spacing: { after: 100 },
      }),
    )
  })

  for (const [chapterIndex, chapter] of [...document.querySelectorAll('.chapter')].entries()) {
    const chapterNumber = chapter.querySelector('.chapter-num')?.textContent?.trim() ?? ''
    const chapterTitle = chapter.querySelector('h2')?.textContent?.trim() ?? ''

    children.push(
      textParagraph(chapterNumber.toUpperCase(), {
        pageBreakBefore: chapterIndex > 0,
        spacing: { before: 420, after: 100 },
        children: [new TextRun({ text: chapterNumber.toUpperCase(), bold: true, color: gold, size: 20 })],
      }),
      textParagraph(chapterTitle, {
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 300 },
      }),
    )

    for (const article of chapter.querySelectorAll('.article')) {
      const articleNumber = article.querySelector('.article-num')?.textContent?.trim() ?? ''
      children.push(
        textParagraph(articleNumber, {
          heading: HeadingLevel.HEADING_2,
          keepNext: true,
          spacing: { before: 200, after: 100 },
        }),
      )
      for (const paragraph of article.querySelectorAll('p')) {
        children.push(bodyParagraph(paragraph))
      }
    }

    for (const quote of chapter.querySelectorAll('.pull-quote p')) {
      children.push(
        bodyParagraph(quote, {
          alignment: AlignmentType.CENTER,
          indent: { left: 500, right: 500 },
          border: { left: { style: BorderStyle.SINGLE, color: gold, size: 18, space: 12 } },
        }),
      )
    }

    for (const value of chapter.querySelectorAll('.valoare')) {
      const title = value.querySelector('h3')?.textContent?.trim() ?? ''
      const description = value.querySelector('p')
      children.push(
        textParagraph(title, {
          heading: HeadingLevel.HEADING_2,
          keepNext: true,
          spacing: { before: 180, after: 80 },
        }),
      )
      if (description) {
        children.push(bodyParagraph(description))
      }
    }
  }

  const commitment = document.querySelector('.angajament')
  if (commitment) {
    children.push(
      textParagraph(commitment.querySelector('h2')?.textContent?.trim() ?? 'Angajamentul Nostru Final', {
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        spacing: { after: 280 },
      }),
    )
    for (const paragraph of commitment.querySelectorAll('.angajament-inner > p, .promise p')) {
      children.push(bodyParagraph(paragraph, { alignment: AlignmentType.CENTER }))
    }
  }

  children.push(
    textParagraph(partyName, {
      alignment: AlignmentType.CENTER,
      spacing: { before: 500, after: 120 },
      children: [new TextRun({ text: partyName, bold: true, color: gold, size: 26 })],
    }),
    textParagraph(motto, {
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: motto, italics: true })],
    }),
    textParagraph('P · C · S · ROMÂNIA', {
      alignment: AlignmentType.CENTER,
      spacing: { before: 220 },
      children: [new TextRun({ text: 'P · C · S · ROMÂNIA', bold: true, color: navy })],
    }),
  )

  return children
}

async function generateDocx(html) {
  const { document } = new JSDOM(html).window
  const manifest = new Document({
    creator: 'Partidul Conservator al Seniorilor',
    title: 'Manifestul PCS',
    subject: 'Program public pentru seniorii României',
    description: 'Manifestul Partidului Conservator al Seniorilor',
    styles: {
      default: {
        document: {
          run: { font: 'Georgia', size: 24, color: '20354C' },
          paragraph: { spacing: { after: 160, line: 320 } },
        },
        title: { run: { font: 'Georgia', bold: true, color: navy, size: 52 } },
        heading1: { run: { font: 'Georgia', bold: true, color: navy, size: 36 } },
        heading2: { run: { font: 'Georgia', bold: true, color: gold, size: 26 } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 900, right: 900, bottom: 900, left: 900 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun('Manifestul PCS · Pagina '),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                ],
              }),
            ],
          }),
        },
        children: buildDocxChildren(document),
      },
    ],
  })

  await writeFile(docxPath, await Packer.toBuffer(manifest))
}

async function generatePdf() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.goto(pathToFileURL(sourcePath).href, { waitUntil: 'networkidle' })
    await page.emulateMedia({ media: 'print' })
    await page.addStyleTag({
      content: `
        @page { size: A4; margin: 0; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body::before { display: none !important; }
        .chapter { opacity: 1 !important; animation: none !important; }
        .article, .valoare, .pull-quote, .promise { break-inside: avoid; }
      `,
    })
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    })
  } finally {
    await browser.close()
  }
}

const html = await readFile(sourcePath, 'utf8')
await mkdir(downloadsDir, { recursive: true })
await generateDocx(html)
await generatePdf()

process.stdout.write(`Generated ${path.relative(rootDir, docxPath)}\n`)
process.stdout.write(`Generated ${path.relative(rootDir, pdfPath)}\n`)
