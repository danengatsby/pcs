export type DocumentItem = {
  slug: string
  menuLabel: string
  pageTitle: string
  description: string
  assetPath: string
}

export const documents: DocumentItem[] = [
  {
    slug: 'statut',
    menuLabel: 'Statut',
    pageTitle: 'Statut PCS',
    description: 'Documentul statutar al partidului, disponibil integral pentru consultare online.',
    assetPath: '/documents/Statut_PCS_v7.html',
  },
  {
    slug: 'program-politic',
    menuLabel: 'Program politic',
    pageTitle: 'Program Politic PCS',
    description: 'Programul politic al PCS, afișat în format integral direct în platformă.',
    assetPath: '/documents/Program_Politic_PCS_PRO.html',
  },
  {
    slug: 'legea-14',
    menuLabel: 'Legea 14',
    pageTitle: 'Legea nr. 14/2003 privind partidele politice',
    description: 'Textul de referință pentru organizarea și funcționarea partidelor politice.',
    assetPath: '/documents/Legea_14_2003_partide_politice.html',
  },
  {
    slug: 'legea-334',
    menuLabel: 'Legea 334',
    pageTitle: 'Legea nr. 334/2006 privind finanțarea partidelor politice',
    description: 'Cadrul legal pentru finanțarea partidelor politice și a campaniilor electorale.',
    assetPath: '/documents/Legea_334_2006_finantarea_partidelor.html',
  },
  {
    slug: 'regulament-gdpr',
    menuLabel: 'Regulament GDPR',
    pageTitle: 'Regulament GDPR',
    description: 'Regulamentul intern privind protecția datelor cu caracter personal.',
    assetPath: '/documents/Regulament_GDPR.html',
  },
]

export const documentBySlug = Object.fromEntries(documents.map((document) => [document.slug, document])) as Record<
  string,
  DocumentItem
>
