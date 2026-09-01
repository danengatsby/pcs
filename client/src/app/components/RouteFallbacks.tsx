import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section style={{ padding: 24 }}>
      <h1>404</h1>
      <p>Pagina căutată nu există.</p>
      <Link to="/">Înapoi la prima pagină</Link>
    </section>
  )
}

export function RouteErrorBoundary() {
  const error = useRouteError()

  const message = (() => {
    if (isRouteErrorResponse(error)) {
      return error.status === 404
        ? 'Pagina căutată nu există.'
        : 'A apărut o eroare la încărcarea paginii.'
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message
    }

    return 'A apărut o eroare neașteptată.'
  })()

  return (
    <section style={{ padding: 24 }}>
      <h1>Nu am putut încărca pagina</h1>
      <p>{message}</p>
      <Link to="/">Înapoi la prima pagină</Link>
    </section>
  )
}
