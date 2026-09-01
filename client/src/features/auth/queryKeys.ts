const authQueryKeyPrefix = ['auth'] as const

export const authQueryKeys = {
  all: authQueryKeyPrefix,
  policy: () => [...authQueryKeyPrefix, 'policy'] as const,
}
