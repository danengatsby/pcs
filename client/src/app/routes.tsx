import { Suspense, lazy, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { NotFoundPage, RouteErrorBoundary } from './components/RouteFallbacks'
import { AppLayout } from './layout/AppLayout'
import RequireAuth from './components/RequireAuth'
import RequireAdmin from './components/RequireAdmin'
import { AdminLayout } from '@features/adminShell/AdminLayout'
import { AdminHomePage, RequireCapability } from '@features/adminShell/AdminPages'
import {
  loadAdminMembersDashboardPage,
  loadAuthPolicyPage,
  loadContactPage,
  loadDocumentPage,
  loadExecutiveDashboardPage,
  loadHomePage,
  loadHomeTopicPages,
  loadManifestPage,
  loadMobilizationPage,
  loadPoliticalOperationsPage,
  loadNewsDetailPage,
  loadNewsListPage,
  loadSigninPage,
  loadTerritorialOrganizationsPage,
  loadUserProfilePage,
  loadVolunteersAdminPage,
  loadCongressPage,
  loadArbitrationPage,
} from './routeModules'

const routeFallback = <div style={{ padding: 24 }}>Se încarcă...</div>

function renderRoute(element: ReactNode) {
  return (
    <Suspense fallback={routeFallback}>
      {element}
    </Suspense>
  )
}

const routeErrorElement = <RouteErrorBoundary />

function lazyNamed<TProps>(
  loader: () => Promise<Record<string, unknown>>,
  exportName: string,
): LazyExoticComponent<ComponentType<TProps>> {
  return lazy(async () => {
    const module = await loader()
    const component = module[exportName]

    if (typeof component !== 'function') {
      throw new Error(`Route export "${exportName}" is not a component.`)
    }

    return { default: component as ComponentType<TProps> }
  })
}

const HomePage = lazyNamed(loadHomePage, 'HomePage')
const NewsCommunicationPage = lazyNamed(loadHomeTopicPages, 'NewsCommunicationPage')
const TransparencyPage = lazyNamed(loadHomeTopicPages, 'TransparencyPage')
const NewsListPage = lazyNamed(loadNewsListPage, 'NewsListPage')
const NewsDetailPage = lazyNamed(loadNewsDetailPage, 'NewsDetailPage')
const AuthPolicyPage = lazyNamed(loadAuthPolicyPage, 'AuthPolicyPage')
const SigninPage = lazyNamed(loadSigninPage, 'SigninPage')
const UserProfilePage = lazyNamed(loadUserProfilePage, 'UserProfilePage')
const ContactPage = lazyNamed(loadContactPage, 'ContactPage')
const ExecutiveDashboardPage = lazyNamed(loadExecutiveDashboardPage, 'ExecutiveDashboardPage')
const TerritorialOrganizationsPage = lazyNamed(loadTerritorialOrganizationsPage, 'TerritorialOrganizationsPage')
const AdminMembersDashboardPage = lazyNamed(loadAdminMembersDashboardPage, 'AdminMembersDashboardPage')
const VolunteersAdminPage = lazyNamed(loadVolunteersAdminPage, 'VolunteersAdminPage')
const DocumentPage = lazyNamed(loadDocumentPage, 'DocumentPage')
const ManifestPage = lazyNamed(loadManifestPage, 'ManifestPage')
const MobilizationPage = lazyNamed(loadMobilizationPage, 'MobilizationPage')
const PoliticalOperationsPage = lazyNamed(loadPoliticalOperationsPage, 'PoliticalOperationsPage')
const CongressPage = lazyNamed(loadCongressPage, 'CongressPage')
const ArbitrationPage = lazyNamed(loadArbitrationPage, 'ArbitrationPage')

export const router = createBrowserRouter([
  {
    path: '/manifest',
    element: renderRoute(<ManifestPage />),
    errorElement: routeErrorElement,
  },
  {
    element: <AppLayout />,
    errorElement: routeErrorElement,
    children: [
      { path: '/', element: renderRoute(<HomePage />) },
      { path: '/initiative/stiri-si-comunicare', element: renderRoute(<NewsCommunicationPage />) },
      { path: '/initiative/voluntariat', element: renderRoute(<MobilizationPage />) },
      { path: '/mobilizare', element: renderRoute(<MobilizationPage />) },
      { path: '/initiative/transparenta', element: renderRoute(<TransparencyPage />) },
      { path: '/news', element: renderRoute(<NewsListPage />) },
      { path: '/news/:id', element: renderRoute(<NewsDetailPage />) },
      { path: '/documente/:documentSlug', element: renderRoute(<DocumentPage />) },
      { path: '/auth/policy', element: renderRoute(<AuthPolicyPage />) },
      { path: '/auth/signin', element: renderRoute(<SigninPage />) },
      {
        path: '/profil',
        element: renderRoute(
          <RequireAuth>
            <UserProfilePage />
          </RequireAuth>
        ),
      },
      {
        path: '/admin',
        element: <RequireAdmin><AdminLayout /></RequireAdmin>,
        children: [
          { index: true, element: <AdminHomePage /> },
          { path: 'dashboard', element: <RequireCapability capability="executive.read">{renderRoute(<ExecutiveDashboardPage />)}</RequireCapability> },
          { path: 'mobilization', element: <RequireCapability capability="mobilization.read">{renderRoute(<PoliticalOperationsPage />)}</RequireCapability> },
          { path: 'organizations', element: <RequireCapability capability="organization.read">{renderRoute(<TerritorialOrganizationsPage />)}</RequireCapability> },
          { path: 'members', element: <RequireCapability capability="membership.read">{renderRoute(<AdminMembersDashboardPage />)}</RequireCapability> },
          { path: 'volunteers', element: <RequireCapability capability="recruitment.read">{renderRoute(<VolunteersAdminPage />)}</RequireCapability> },
          { path: 'congresses', element: <RequireCapability capability="congress.read">{renderRoute(<CongressPage />)}</RequireCapability> },
          { path: 'arbitration', element: <RequireCapability capability="arbitration.read">{renderRoute(<ArbitrationPage />)}</RequireCapability> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      { path: '/contact', element: renderRoute(<ContactPage />) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
