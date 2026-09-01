const newsQueryKeyPrefix = ['news'] as const

export const newsQueryKeys = {
  all: newsQueryKeyPrefix,
  list: () => [...newsQueryKeyPrefix, 'list'] as const,
  detail: (id: string) => [...newsQueryKeyPrefix, 'detail', id] as const,
}
