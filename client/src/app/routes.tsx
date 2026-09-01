import { Suspense, lazy, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { NotFoundPage, RouteErrorBoundary } from './components/RouteFallbacks'
import { AppLayout } from './layout/AppLayout'
import RequireAuth from './components/RequireAuth'
import RequireAdmin from './components/RequireAdmin'
import {
  loadAdminMembersDashboardPage,
  loadAuthPolicyPage,
  loadContactPage,
  loadDocumentPage,
  loadHomePage,
  loadHomeTopicPages,
  loadManifestPage,
  loadNewsDetailPage,
  loadNewsListPage,
  loadSigninPage,
  loadUserProfilePage,
  loadVolunteersAdminPage,
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
const VolunteeringPage = lazyNamed(loadHomeTopicPages, 'VolunteeringPage')
const TransparencyPage = lazyNamed(loadHomeTopicPages, 'TransparencyPage')
const NewsListPage = lazyNamed(loadNewsListPage, 'NewsListPage')
const NewsDetailPage = lazyNamed(loadNewsDetailPage, 'NewsDetailPage')
const AuthPolicyPage = lazyNamed(loadAuthPolicyPage, 'AuthPolicyPage')
const SigninPage = lazyNamed(loadSigninPage, 'SigninPage')
const UserProfilePage = lazyNamed(loadUserProfilePage, 'UserProfilePage')
const ContactPage = lazyNamed(loadContactPage, 'ContactPage')
const AdminMembersDashboardPage = lazyNamed(loadAdminMembersDashboardPage, 'AdminMembersDashboardPage')
const VolunteersAdminPage = lazyNamed(loadVolunteersAdminPage, 'VolunteersAdminPage')
const DocumentPage = lazyNamed(loadDocumentPage, 'DocumentPage')
const ManifestPage = lazyNamed(loadManifestPage, 'ManifestPage')

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
      { path: '/initiative/voluntariat', element: renderRoute(<VolunteeringPage />) },
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
        path: '/admin/members',
        element: renderRoute(
          <RequireAdmin>
            <AdminMembersDashboardPage />
          </RequireAdmin>
        ),
      },
      {
        path: '/admin/volunteers',
        element: renderRoute(
          <RequireAdmin>
            <VolunteersAdminPage />
          </RequireAdmin>
        ),
      },
      { path: '/contact', element: renderRoute(<ContactPage />) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
