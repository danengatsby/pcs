export const loadHomePage = () => import('@features/home/routes/HomePage')
export const loadHomeTopicPages = () => import('@features/home/routes/HomeTopicPages')
export const loadNewsListPage = () => import('@features/news/routes/NewsListPage')
export const loadNewsDetailPage = () => import('@features/news/routes/NewsDetailPage')
export const loadAuthPolicyPage = () => import('@features/auth/routes/AuthPolicyPage')
export const loadSigninPage = () => import('@features/auth/routes/SigninPage')
export const loadUserProfilePage = () => import('@features/profile/routes/UserProfilePage')
export const loadContactPage = () => import('@features/contact/routes/ContactPage')
export const loadAdminMembersDashboardPage = () => import('@features/adminMembersDashboard')
export const loadVolunteersAdminPage = () => import('@features/volunteersAdmin')
export const loadDocumentPage = () => import('@features/documents/routes/DocumentPage')
export const loadManifestPage = () => import('@features/manifest/routes/ManifestPage')

export function prefetchAdminRoutes(): void {
  void loadAdminMembersDashboardPage()
  void loadVolunteersAdminPage()
}
