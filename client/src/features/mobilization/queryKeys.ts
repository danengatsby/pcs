export const mobilizationQueryKeys = {
  all: ['mobilization'] as const,
  actions: () => [...mobilizationQueryKeys.all, 'actions'] as const,
}
