export const territorialOrganizationQueryKeys = {
  all: ['admin', 'territorial-organizations'] as const,
  registry: () => [...territorialOrganizationQueryKeys.all, 'registry'] as const,
  detail: (id: string | null) => [...territorialOrganizationQueryKeys.all, 'detail', id] as const,
}
