import type { FinanceRecord, ListFinanceQuery } from "./finance.schema.js";

const financeSeed: FinanceRecord[] = [];

export async function listFinanceRepository(filters: ListFinanceQuery): Promise<{ rows: FinanceRecord[]; total: number }> {
  const filtered = financeSeed.filter((row) => {
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
