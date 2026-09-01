const contactQueryKeyPrefix = ['contact'] as const

export const contactQueryKeys = {
  all: contactQueryKeyPrefix,
  counties: () => [...contactQueryKeyPrefix, 'counties'] as const,
}
