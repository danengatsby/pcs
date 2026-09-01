import type { ElectionRecord, ListElectionsQuery } from "./elections.schema.js";

const electionsSeed: ElectionRecord[] = [];

export async function listElectionsRepository(filters: ListElectionsQuery): Promise<{
  rows: ElectionRecord[];
  total: number;
}> {
  const filtered = electionsSeed.filter((row) => {
    const typeMatch = !filters.type || row.type === filters.type;
    const yearMatch = !filters.year || row.year === filters.year;
    return typeMatch && yearMatch;
  });

  const rows = filtered.slice(filters.offset, filters.offset + filters.limit);

  return {
    rows,
    total: filtered.length,
  };
}
